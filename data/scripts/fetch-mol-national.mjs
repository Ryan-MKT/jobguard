// ============================================
// 抓勞動部全國違反勞動法令資料 v2 - 通用容錯版
// ============================================
//
// 用 lib/ 共用工具：
//   - csv-parser: 三層解析
//   - fetch-robust: 失敗自動分段重試
//   - law-classifier: 改良分類規則
//   - date-range: 民國年/西元轉換

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { fetchWithFallback } from './lib/fetch-robust.mjs';
import { mingooToWestern } from './lib/date-range.mjs';
import { detectLawType } from './lib/law-classifier.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'raw');
const OUT_FILE = join(OUT_DIR, 'mol-national.json');

const CITIES = [
  { code: '63', name: '台北市' },
  { code: '65', name: '新北市' },
  { code: '68', name: '桃園市' },
  { code: '66', name: '台中市' },
  { code: '67', name: '台南市' },
  { code: '64', name: '高雄市' },
  { code: '17', name: '基隆市' },
  { code: '25', name: '新竹市' },
  { code: '04', name: '新竹縣' },
  { code: '05', name: '苗栗縣' },
  { code: '07', name: '彰化縣' },
  { code: '08', name: '南投縣' },
  { code: '09', name: '雲林縣' },
  { code: '10', name: '嘉義縣' },
  { code: '26', name: '嘉義市' },
  { code: '13', name: '屏東縣' },
  { code: '02', name: '宜蘭縣' },
  { code: '14', name: '台東縣' },
  { code: '15', name: '花蓮縣' },
  { code: '16', name: '澎湖縣' },
  { code: '23', name: '金門縣' },
  { code: '24', name: '連江縣' },
  { code: '96', name: '產業園區管理局' },
  { code: '97', name: '新竹科學園區' },
  { code: '92', name: '中部科學園區' },
  { code: '95', name: '南部科學園區' },
];

// 民國 104/01/01 ~ 民國 114/12/31（西元 2015 ~ 2025）
// 為何 2015 起？實測 announcement.mol.gov.tw 至少 2005 起就有資料，
// 但 2012 以前每月只有個位數筆數（早期制度不完整），
// 2015 起密度才穩定可用。詳見 probe-mol-date-range.mjs。
const DATE_START = '1040101';
const DATE_END = '1141231';

// ============================================
// 取 CSRF + cookie
// ============================================
async function getCsrfAndCookie() {
  const res = await fetch('https://announcement.mol.gov.tw/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobGuard/0.2)' },
  });
  const html = await res.text();
  const tokenMatch = html.match(/name="_csrf_token"\s+value="([^"]+)"/);
  if (!tokenMatch) throw new Error('找不到 _csrf_token');
  const cookies = res.headers.getSetCookie?.() || [];
  const cookieStr = cookies.map((c) => c.split(';')[0]).join('; ');
  return { csrfToken: tokenMatch[1], cookie: cookieStr };
}

// ============================================
// 下載某縣市某時段的 ZIP，回傳 CSV 字串陣列
// ============================================
function makeFetcher(csrfToken, cookie) {
  return async function fetchCityCsvs(city, startDate, endDate) {
    const body = new URLSearchParams({
      _csrf_token: csrfToken,
      CITYNO: city.code,
      UNITNAME: '',
      REGNUMBER: '',
      REGNO: '',
      FINE: '',
      DOCstartDate: startDate,
      DOCEndDate: endDate,
      downloadType: '3',
      Page1: '1',
      Page2: '1',
      Page3: '1',
      sortName1: '',
      sortName2: '',
      sortName3: '',
    });

    const res = await fetch('https://announcement.mol.gov.tw/Download/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 'https://announcement.mol.gov.tw/',
        Cookie: cookie,
        'User-Agent': 'Mozilla/5.0 (compatible; JobGuard/0.2)',
      },
      body,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    // 非 ZIP（可能是「請輸入搜尋條件」之類）
    if (buf.length < 10 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
      return [];
    }

    // 解 ZIP 取出 CSVs
    const zip = new AdmZip(buf);
    return zip
      .getEntries()
      .filter((e) => e.entryName.endsWith('.csv'))
      .map((e) => {
        const text = e.getData().toString('utf-8');
        // 移除 BOM、剪掉第一行「違反雇主清冊」標題
        const cleaned = text.replace(/^﻿/, '');
        const lines = cleaned.split(/\r?\n/);
        const headerIdx = lines.findIndex((l) => l.includes('"編號"'));
        return headerIdx >= 0 ? lines.slice(headerIdx).join('\n') : cleaned;
      });
  };
}

// ============================================
// 解析記錄 → 統一 schema
// ============================================
function normalizeRecord(rec, cityName) {
  const name = (
    rec['事業單位名稱(負責人)\n自然人姓名'] ||
    rec['事業單位名稱(負責人)自然人姓名'] ||
    ''
  ).trim();
  if (!name) return null;

  const law = (rec['違反法規條款'] || '').trim();
  const amtRaw = (
    rec['罰鍰金額'] ||
    rec['處分金額／滯納金'] ||
    rec['處分金額'] ||
    ''
  ).toString();
  const amount = parseInt(amtRaw.replace(/[^\d]/g, ''), 10) || 0;

  return {
    city: cityName,
    name,
    date: mingooToWestern(rec['處分日期']),
    law,
    lawType: detectLawType(law),
    lawcontent: (rec['法條敘述'] || '').trim(),
    docno: (rec['處分字號'] || '').trim(),
    amt_dollartwd: amount.toString(),
    announceDate: mingooToWestern(rec['公告日期']),
  };
}

// ============================================
// 主流程
// ============================================
async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('🚀 抓勞動部全國資料 v2（通用容錯）');
  console.log(`📅 期間：民國 ${DATE_START} ~ ${DATE_END}`);
  console.log(`🌍 涵蓋：${CITIES.length} 個地區`);
  console.log('============================================');

  const { csrfToken, cookie } = await getCsrfAndCookie();
  console.log(`🔑 CSRF: ${csrfToken.slice(0, 30)}...`);
  console.log('');

  const fetchCityCsvs = makeFetcher(csrfToken, cookie);
  const all = [];
  const reports = [];

  for (let i = 0; i < CITIES.length; i++) {
    const city = CITIES[i];
    const padded = city.name.padEnd(10);
    process.stdout.write(`📥 [${(i + 1).toString().padStart(2)}/${CITIES.length}] ${padded} `);

    try {
      const result = await fetchWithFallback(
        city,
        DATE_START,
        DATE_END,
        fetchCityCsvs
      );

      let cityCount = 0;
      for (const rec of result.records) {
        const norm = normalizeRecord(rec, city.name);
        if (norm) all.push(norm);
        if (norm) cityCount++;
      }

      const strategyTag =
        result.strategy === 'strict'
          ? '  '
          : result.strategy.startsWith('seg')
            ? ' ⚠'
            : ' △';
      console.log(`${cityCount.toString().padStart(5)} 筆${strategyTag} (${result.strategy})`);
      reports.push({ city: city.name, count: cityCount, strategy: result.strategy, errors: result.errors });
    } catch (err) {
      console.log(`❌ ${err.message}`);
      reports.push({ city: city.name, count: 0, strategy: 'error', errors: [err.message] });
    }

    if (i < CITIES.length - 1) await new Promise((r) => setTimeout(r, 500));
  }

  await writeFile(OUT_FILE, JSON.stringify(all, null, 2), 'utf-8');

  console.log('');
  console.log('============================================');
  console.log(`✅ 總計 ${all.length.toLocaleString()} 筆`);
  console.log(`💾 ${OUT_FILE}`);
  console.log('============================================');

  // 法令類型統計
  const byLawType = {};
  for (const r of all) byLawType[r.lawType] = (byLawType[r.lawType] || 0) + 1;
  console.log('\n📊 各法令類型筆數：');
  for (const [t, c] of Object.entries(byLawType).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${t.padEnd(22)} ${c.toLocaleString()}`);
  }

  // 各縣市策略報告
  console.log('\n📋 縣市抓取策略：');
  for (const r of reports) {
    if (r.strategy === 'strict') continue; // 正常的不印
    console.log(`   ${r.city.padEnd(10)} ${r.count.toString().padStart(5)} 筆  策略=${r.strategy}`);
    if (r.errors.length > 0) {
      console.log(`     ↳ ${r.errors[0]}`);
    }
  }
}

main().catch((err) => {
  console.error('❌ 失敗:', err.message);
  console.error(err.stack);
  process.exit(1);
});
