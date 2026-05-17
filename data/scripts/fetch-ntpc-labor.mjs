// ============================================
// 抓「新北市政府」違反勞動基準法資料
// ============================================
//
// 資料來源：新北市資料開放平台
//   Dataset: 違反勞動基準法事業單位
//   API: data.ntpc.gov.tw
//
// 為什麼先用新北市？
//   政府開放資料其實全台各縣市分開公布，
//   新北市的 API 最穩定、欄位最完整，先從這裡開始。
//   未來可以再加台北、桃園、台中等縣市。
//
// 跑法：
//   pnpm --filter @jobguard/data fetch:ntpc-labor
//   或
//   cd data && node scripts/fetch-ntpc-labor.mjs

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// === 設定 ===
const DATASET_ID = 'A3408B16-7B28-4FA5-9834-D147AAE909BF'; // 違反勞動基準法
const API_BASE = 'https://data.ntpc.gov.tw/api/datasets';
const PAGE_SIZE = 1000; // 新北市 API 單次最多 1000 筆
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'raw');
const OUT_FILE = join(OUT_DIR, 'ntpc-labor-violations.json');

// === 主程式 ===
async function main() {
  console.log('🚀 開始抓「新北市違反勞動基準法」資料...');
  console.log(`📡 API: ${API_BASE}/${DATASET_ID}/json`);

  await mkdir(OUT_DIR, { recursive: true });

  let allRecords = [];
  let page = 0;
  let hasMore = true;

  // === 分頁抓取 ===
  // API 一次最多 1000 筆，要分頁抓完所有資料
  while (hasMore) {
    const offset = page * PAGE_SIZE;
    const url = `${API_BASE}/${DATASET_ID}/json?size=${PAGE_SIZE}&skip=${offset}`;
    process.stdout.write(`📥 抓第 ${page + 1} 頁 (offset=${offset})... `);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const batch = await response.json();
    console.log(`拿到 ${batch.length} 筆`);

    allRecords = allRecords.concat(batch);

    // 如果這頁不滿 1000 筆，代表抓完了
    if (batch.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      page++;
      // 禮貌一下，間隔 200ms 不要打太快
      await new Promise((r) => setTimeout(r, 200));
    }

    // 安全閥：避免無限迴圈，最多抓 50 頁（5 萬筆）
    if (page > 50) {
      console.warn('⚠️ 已抓 50 頁，強制停止');
      break;
    }
  }

  // === 存檔 ===
  await writeFile(OUT_FILE, JSON.stringify(allRecords, null, 2), 'utf-8');

  // === 摘要 ===
  console.log('');
  console.log('============================================');
  console.log(`✅ 完成！總共 ${allRecords.length} 筆違規紀錄`);
  console.log(`💾 已存到 ${OUT_FILE}`);
  console.log('============================================');

  // 印前 3 筆讓使用者看看
  console.log('\n📋 前 3 筆範例：');
  for (const rec of allRecords.slice(0, 3)) {
    console.log(`  ▸ ${rec.name}`);
    console.log(`    違反: ${rec.law} — ${rec.lawcontent}`);
    console.log(`    日期: ${rec.date} | 罰款: NT$ ${rec.amt_dollartwd}`);
  }
}

main().catch((err) => {
  console.error('❌ 失敗:', err.message);
  process.exit(1);
});
