// ============================================
// 抓新北市 3 大勞動相關法令裁罰資料
// ============================================
// 1. 違反勞動基準法（工時、加班費、解雇、薪資）
// 2. 違反性別工作平等法（性騷擾、孕婦解雇、性別歧視）
// 3. 違反職業安全衛生法（工傷、防護設備、機械事故）
//
// 跑法：
//   pnpm --filter @jobguard/data fetch:ntpc-laws

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'raw');
const PAGE_SIZE = 1000;
const API_BASE = 'https://data.ntpc.gov.tw/api/datasets';

const DATASETS = [
  {
    id: 'A3408B16-7B28-4FA5-9834-D147AAE909BF',
    lawType: '勞動基準法',
    fileName: 'ntpc-labor-base.json',
  },
  {
    id: 'D7B245C0-0BA7-4EE9-9021-5CA27AC52EB4',
    lawType: '性別工作平等法',
    fileName: 'ntpc-labor-gender.json',
  },
  {
    id: '8EC84245-450B-45DF-9BC5-510AB6E02E73',
    lawType: '職業安全衛生法',
    fileName: 'ntpc-labor-safety.json',
  },
];

async function fetchDataset({ id, lawType, fileName }) {
  console.log(`\n📥 抓「違反${lawType}」(${id})`);
  let all = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const offset = page * PAGE_SIZE;
    const url = `${API_BASE}/${id}/json?size=${PAGE_SIZE}&skip=${offset}`;
    process.stdout.write(`  第 ${page + 1} 頁 (offset=${offset})... `);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const batch = await res.json();
    console.log(`${batch.length} 筆`);

    all = all.concat(batch);
    if (batch.length < PAGE_SIZE) hasMore = false;
    else {
      page++;
      await new Promise((r) => setTimeout(r, 200));
    }

    if (page > 60) {
      console.warn('  ⚠️ 已抓 60 頁，強制停止');
      break;
    }
  }

  const outPath = join(OUT_DIR, fileName);
  await writeFile(outPath, JSON.stringify(all, null, 2), 'utf-8');
  console.log(`  ✅ ${all.length.toLocaleString()} 筆 → ${fileName}`);
  return all.length;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log('🚀 開始抓新北市 3 大勞動法令違規資料');
  console.log('============================================');

  let total = 0;
  for (const ds of DATASETS) {
    const count = await fetchDataset(ds);
    total += count;
  }

  console.log('\n============================================');
  console.log(`🎉 完成！3 個資料集共 ${total.toLocaleString()} 筆`);
  console.log('============================================');
}

main().catch((err) => {
  console.error('❌ 失敗:', err.message);
  process.exit(1);
});
