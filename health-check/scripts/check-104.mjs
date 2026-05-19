// ============================================
// 求職門神自動健檢 - 104 parser
// ============================================
//
// 目的：每天跑一次，確認：
//   1. 104 搜尋頁能正常載入
//   2. 頁面上有抓得到「公司連結」
//   3. 我們的 parser 抓到的數量合理
//   4. 沒有屬性標籤（上市上櫃 / 外商公司）被誤抓
//   5. 沒有「假公司」連結被當成真公司
//
// 失敗時 exit 1，配合 GitHub Actions 觸發 Discord 通知

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PARSER_PATH = resolve(__dirname, '../../extension/content/parsers/104.js');
const FAILURE_SUMMARY_PATH = resolve(__dirname, '../failure-summary.txt');

const TARGET_URL = 'https://www.104.com.tw/jobs/search/?keyword=%E5%B7%A5%E7%A8%8B%E5%B8%AB&order=14';
const HEADLESS = process.env.HEALTH_CHECK_HEADLESS !== 'false';
const TIMEOUT = 45_000;

// 期望門檻（headless 環境下 lazy load 觸發較少，所以門檻調低 — 主要靠「結構檢測」）
const MIN_RAW_LINKS = 4;       // 頁面至少有幾個 /company/ 連結
const MIN_PARSED = 1;          // parser 抓出至少幾家公司
const MAX_PARSED = 200;        // 超過代表抓到不該抓的東西

// 不該被當成公司名的字（誤抓的指標）
const FORBIDDEN_NAMES = [
  '上市上櫃', '外商公司', '中小企業', '新創', '集團',
  '科技業', '製造業', '服務業', '金融業',
];

const checks = [];
function ok(label, detail = '') {
  checks.push({ status: 'ok', label, detail });
  console.log(`✅ ${label}${detail ? ` (${detail})` : ''}`);
}
function fail(label, detail = '') {
  checks.push({ status: 'fail', label, detail });
  console.log(`❌ ${label}${detail ? ` (${detail})` : ''}`);
}
function info(label, detail = '') {
  checks.push({ status: 'info', label, detail });
  console.log(`ℹ️  ${label}${detail ? ` (${detail})` : ''}`);
}

async function main() {
  console.log('🩺 求職門神健檢開始');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`🎯 ${TARGET_URL}`);
  console.log(`👁️  headless=${HEADLESS}`);
  console.log('============================================\n');

  // anti-detection：繞 104 的 headless 偵測
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
    ],
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'zh-TW',
    viewport: { width: 1366, height: 900 },
    timezoneId: 'Asia/Taipei',
  });

  // 隱藏 navigator.webdriver
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // 補一些常被偵測的點
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'languages', { get: () => ['zh-TW', 'zh', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });

  const page = await context.newPage();

  try {
    // === 1. 頁面能不能正常開 ===
    const response = await page.goto(TARGET_URL, { timeout: TIMEOUT, waitUntil: 'domcontentloaded' });
    if (!response || !response.ok()) {
      fail('104 搜尋頁載入', `HTTP ${response?.status() ?? 'n/a'}`);
      throw new Error('頁面載入失敗');
    }
    ok('104 搜尋頁載入', `HTTP ${response.status()}`);

    // 等 JS 跑完
    await page.waitForLoadState('networkidle', { timeout: TIMEOUT }).catch(() => {
      info('networkidle 等待', '逾時但繼續');
    });

    // 捲動觸發 lazy load（104 職缺列表是 scroll 才繼續 render）
    await page.evaluate(async () => {
      for (let y = 0; y < 6000; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 250));
      }
      window.scrollTo(0, 0); // 捲回頂部，避免影響後續操作
    });

    // === 2. 等職缺 render ===
    try {
      await page.waitForFunction(
        (min) => document.querySelectorAll('a[href*="/company/"]').length >= min,
        MIN_RAW_LINKS,
        { timeout: TIMEOUT }
      );
      ok('職缺列表 render', `等到 ≥${MIN_RAW_LINKS} 個公司連結`);
    } catch {
      // debug 用：截圖看 104 端到底回了什麼
      const debugPath = resolve(__dirname, '../debug-failure.png');
      await page.screenshot({ path: debugPath, fullPage: true }).catch(() => {});
      const title = await page.title().catch(() => 'n/a');
      const linkCount = await page
        .evaluate(() => document.querySelectorAll('a[href*="/company/"]').length)
        .catch(() => -1);
      fail(
        '職缺列表 render',
        `超時 ${TIMEOUT / 1000}s · title="${title}" · 連結數=${linkCount} · 截圖=${debugPath}`
      );
      throw new Error('職缺列表沒 render');
    }

    // === 3. 算原始公司連結數 ===
    const rawCount = await page.evaluate(
      () => document.querySelectorAll('a[href*="/company/"]').length
    );
    if (rawCount >= MIN_RAW_LINKS) {
      ok('原始 /company/ 連結數', `${rawCount} 個（門檻 ≥${MIN_RAW_LINKS}）`);
    } else {
      fail('原始 /company/ 連結數', `只有 ${rawCount} 個（門檻 ≥${MIN_RAW_LINKS}）`);
    }

    // === 4. 注入 parser 並執行 ===
    await page.addScriptTag({ path: PARSER_PATH });
    const parsed = await page.evaluate(() => {
      if (typeof window.__jobguard_parse104 !== 'function') return null;
      const results = window.__jobguard_parse104();
      // element 不能序列化，剝掉
      return results.map((r) => ({ name: r.name, url: r.url }));
    });

    if (!parsed) {
      fail('Parser 注入', 'window.__jobguard_parse104 不存在');
      throw new Error('Parser 載入失敗');
    }
    ok('Parser 注入', `__jobguard_parse104 ready`);

    // === 5. Parser 結果數量檢查 ===
    if (parsed.length >= MIN_PARSED && parsed.length <= MAX_PARSED) {
      ok('Parser 抓到公司數', `${parsed.length} 家（門檻 ${MIN_PARSED}–${MAX_PARSED}）`);
    } else if (parsed.length < MIN_PARSED) {
      fail('Parser 抓到公司數', `只有 ${parsed.length} 家（門檻 ≥${MIN_PARSED}）`);
    } else {
      fail('Parser 抓到公司數', `${parsed.length} 家爆量（門檻 ≤${MAX_PARSED}，可能誤抓）`);
    }

    // === 6. 誤抓檢查：抓到的名字不該是屬性標籤 ===
    const forbiddenHits = parsed.filter((p) => FORBIDDEN_NAMES.includes(p.name));
    if (forbiddenHits.length === 0) {
      ok('屬性標籤過濾', '沒抓到「上市上櫃 / 外商公司」等標籤');
    } else {
      fail(
        '屬性標籤過濾',
        `誤抓 ${forbiddenHits.length} 個：${forbiddenHits.map((h) => h.name).join('、')}`
      );
    }

    // === 7. URL 結構合理性 ===
    const badUrls = parsed.filter((p) => {
      try {
        const u = new URL(p.url);
        return !/104\.com\.tw$/.test(u.hostname) || !u.pathname.startsWith('/company/');
      } catch {
        return true;
      }
    });
    if (badUrls.length === 0) {
      ok('URL 結構', '全部公司 URL 都是 /company/...');
    } else {
      fail('URL 結構', `${badUrls.length} 個 URL 異常`);
    }

    // === 8. 範例輸出（debug 用，不影響 pass/fail）===
    info('範例公司（前 5 家）', parsed.slice(0, 5).map((p) => p.name).join(' / '));

  } catch (err) {
    console.error(`\n💥 例外: ${err.message}`);
    if (err.stack) console.error(err.stack);
  } finally {
    await browser.close();
  }

  // === 結果 ===
  console.log('\n============================================');
  const fails = checks.filter((c) => c.status === 'fail');
  if (fails.length === 0) {
    console.log('🎉 全部通過！104 parser 健康');
    process.exit(0);
  } else {
    console.log(`💀 ${fails.length} 項失敗：`);
    for (const f of fails) {
      console.log(`   - ${f.label}: ${f.detail}`);
    }
    // 寫 summary 給 GitHub Actions 讀，組 LINE 訊息用
    try {
      const summary = fails.map((f) => `• ${f.label}\n  ${f.detail}`).join('\n');
      writeFileSync(FAILURE_SUMMARY_PATH, summary, 'utf-8');
    } catch (e) {
      console.error('寫 failure-summary 失敗:', e.message);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('未預期錯誤:', err);
  process.exit(1);
});
