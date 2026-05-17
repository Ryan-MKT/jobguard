// ============================================
// 把原始違規資料 → extension 可用的索引
// ============================================
//
// 輸入：data/raw/ntpc-labor-violations.json     (51,000 筆雜亂原始資料)
// 輸出：data/dist/violations.json               (乾淨的公司索引)
//
// 處理步驟：
//   1. 公司名正規化（去掉「即」「股份有限公司」等）
//   2. 按正規化後的公司名分組
//   3. 算每家公司：違規次數、總罰款、最近日期
//   4. 寫成 JSON

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_FILE = join(__dirname, '..', 'raw', 'ntpc-labor-violations.json');
const OUT_DIR = join(__dirname, '..', 'dist');
const OUT_FILE = join(OUT_DIR, 'violations.json');

// ============================================
// 公司名正規化
// ============================================
//
// 規則：
//   "郭淑玲(即鼎天餐飲店)"          → "鼎天餐飲店"
//   "  鴻海精密工業股份有限公司"    → "鴻海精密工業"
//   "全聯實業股份有限公司"          → "全聯實業"
//   "ABC企業社"                     → "ABC企業社"  (沒變化)
//
function normalizeName(rawName) {
  if (!rawName || typeof rawName !== 'string') return null;

  let n = rawName.trim();
  if (!n) return null;

  // 1. 處理「XXX(即YYY)」格式 → 取出 YYY
  const matchJi = n.match(/[(（]\s*即\s*([^)）]+)\s*[)）]/);
  if (matchJi) {
    n = matchJi[1].trim();
  }

  // 2. 移除「股份有限公司」「有限公司」後綴
  n = n.replace(/股份有限公司$/, '');
  n = n.replace(/有限公司$/, '');

  // 3. 移除頭尾空白
  return n.trim();
}

// ============================================
// 主流程
// ============================================
async function main() {
  console.log('📖 讀取原始資料...');
  const raw = JSON.parse(await readFile(RAW_FILE, 'utf-8'));
  console.log(`   共 ${raw.length.toLocaleString()} 筆原始紀錄`);

  console.log('🔧 正規化 + 分組中...');
  const byCompany = new Map();
  let skipped = 0;

  for (const rec of raw) {
    const normalized = normalizeName(rec.name);
    if (!normalized || normalized.length < 2) {
      skipped++;
      continue;
    }

    // 第一次看到這家公司：建立基本結構
    if (!byCompany.has(normalized)) {
      byCompany.set(normalized, {
        displayName: rec.name.trim(),
        originalNames: new Set(),
        count: 0,
        totalFine: 0,
        latestDate: '',
        violations: [],
      });
    }

    // 把這筆違規加進去
    const entry = byCompany.get(normalized);
    entry.originalNames.add(rec.name.trim());
    entry.count++;
    entry.totalFine += parseInt(rec.amt_dollartwd, 10) || 0;
    if (rec.date > entry.latestDate) entry.latestDate = rec.date;
    entry.violations.push({
      date: rec.date,
      law: rec.law,
      content: rec.lawcontent,
      amount: parseInt(rec.amt_dollartwd, 10) || 0,
    });
  }

  console.log(`   ✅ 分組完成：${byCompany.size.toLocaleString()} 家獨立公司`);
  if (skipped > 0) console.log(`   ⚠️ 跳過 ${skipped} 筆名稱無效`);

  // ============================================
  // 轉成 plain object（Set 不能直接 JSON）
  // ============================================
  const index = {};
  for (const [name, entry] of byCompany) {
    index[name] = {
      displayName: entry.displayName,
      originalNames: Array.from(entry.originalNames),
      count: entry.count,
      totalFine: entry.totalFine,
      latestDate: entry.latestDate,
      // 違規明細按日期新到舊排序
      violations: entry.violations.sort((a, b) => b.date.localeCompare(a.date)),
    };
  }

  const output = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    source: '新北市資料開放平台 - 違反勞動基準法',
    sourceUrl: 'https://data.ntpc.gov.tw/datasets/A3408B16-7B28-4FA5-9834-D147AAE909BF',
    totalRecords: raw.length,
    uniqueCompanies: byCompany.size,
    index,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(output, null, 2), 'utf-8');

  // ============================================
  // 摘要
  // ============================================
  console.log('');
  console.log('============================================');
  console.log(`✅ 寫到 ${OUT_FILE}`);
  console.log('============================================');

  // 印出違規次數前 10 名（誰最常違規）
  console.log('\n🏆 違規次數 Top 10：');
  const top10 = Array.from(byCompany.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  for (const [name, info] of top10) {
    console.log(
      `  ${info.count.toString().padStart(3)} 次 | 罰款 NT$ ${info.totalFine.toLocaleString().padStart(10)} | ${name}`
    );
  }

  // 印出罰款金額 Top 5
  console.log('\n💰 罰款總額 Top 5：');
  const topFine = Array.from(byCompany.entries())
    .sort((a, b) => b[1].totalFine - a[1].totalFine)
    .slice(0, 5);

  for (const [name, info] of topFine) {
    console.log(
      `  NT$ ${info.totalFine.toLocaleString().padStart(12)} | ${info.count} 次 | ${name}`
    );
  }
}

main().catch((err) => {
  console.error('❌ 失敗:', err.message);
  process.exit(1);
});
