// ============================================
// 整理勞動部全國違規資料 → extension 用的索引
// ============================================
// 輸入：data/raw/mol-national.json（含全台 26 地區 9 種法令）
// 輸出：data/dist/violations.json

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_FILE = join(__dirname, '..', 'raw', 'mol-national.json');
const OUT_DIR = join(__dirname, '..', 'dist');
const OUT_FILE = join(OUT_DIR, 'violations.json');

function normalizeName(rawName) {
  if (!rawName || typeof rawName !== 'string') return null;
  let n = rawName.trim();
  if (!n) return null;

  // 處理 「即」 格式
  const matchJi = n.match(/[(（]\s*即\s*([^)）]+)\s*[)）]/);
  if (matchJi) n = matchJi[1].trim();

  // 處理 「公司名 (負責人姓名)」 格式 - 取出公司名部分
  // 例：「禾華營造股份有限公司 (吳清湖)」 → 「禾華營造股份有限公司」
  // 但保留 「黃柏銘即匠石室內設計」 之類的，因為前面已經處理過「即」
  const splitMatch = n.match(/^(.+?)\s*[(（][^)）]+[)）]\s*$/);
  if (splitMatch) {
    const before = splitMatch[1].trim();
    // 避免誤殺如 「(日商) XX」這種開頭就是括號的情況
    if (before && !before.startsWith('(') && !before.startsWith('（')) {
      n = before;
    }
  }

  // 移除常見後綴
  n = n.replace(/股份有限公司$/, '');
  n = n.replace(/有限公司$/, '');
  return n.trim();
}

async function main() {
  console.log('📖 讀取勞動部全國資料...');
  const raw = JSON.parse(await readFile(RAW_FILE, 'utf-8'));
  console.log(`   共 ${raw.length.toLocaleString()} 筆`);

  const byCompany = new Map();
  const byCity = {};
  const byLawType = {};
  let skipped = 0;

  for (const rec of raw) {
    const normalized = normalizeName(rec.name);
    if (!normalized || normalized.length < 2) {
      skipped++;
      continue;
    }

    if (!byCompany.has(normalized)) {
      byCompany.set(normalized, {
        displayName: rec.name.trim(),
        originalNames: new Set(),
        count: 0,
        totalFine: 0,
        latestDate: '',
        cities: new Set(),
        byLawType: {},
        violations: [],
      });
    }

    const entry = byCompany.get(normalized);
    entry.originalNames.add(rec.name.trim());
    entry.count++;
    entry.totalFine += parseInt(rec.amt_dollartwd, 10) || 0;
    entry.cities.add(rec.city);
    if (rec.date > entry.latestDate) entry.latestDate = rec.date;
    entry.byLawType[rec.lawType] = (entry.byLawType[rec.lawType] || 0) + 1;

    entry.violations.push({
      date: rec.date,
      city: rec.city,
      lawType: rec.lawType,
      law: rec.law,
      content: rec.lawcontent,
      amount: parseInt(rec.amt_dollartwd, 10) || 0,
    });

    // 統計
    byCity[rec.city] = (byCity[rec.city] || 0) + 1;
    byLawType[rec.lawType] = (byLawType[rec.lawType] || 0) + 1;
  }

  console.log(`✅ ${byCompany.size.toLocaleString()} 家獨立公司（跳過 ${skipped} 筆）`);

  // 轉成 plain object
  const index = {};
  for (const [name, entry] of byCompany) {
    index[name] = {
      displayName: entry.displayName,
      originalNames: Array.from(entry.originalNames),
      count: entry.count,
      totalFine: entry.totalFine,
      latestDate: entry.latestDate,
      cities: Array.from(entry.cities),
      byLawType: entry.byLawType,
      violations: entry.violations.sort((a, b) => b.date.localeCompare(a.date)),
    };
  }

  const output = {
    schemaVersion: 3,
    updatedAt: new Date().toISOString(),
    source: '勞動部違反勞動法令事業單位查詢系統（全國彙整）',
    sourceUrl: 'https://announcement.mol.gov.tw/',
    coveredAreas: Object.keys(byCity).length,
    coveredLaws: Object.keys(byLawType).length,
    totalRecords: raw.length,
    uniqueCompanies: byCompany.size,
    byCity,
    byLawType,
    index,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(output, null, 2), 'utf-8');

  console.log('');
  console.log(`💾 ${OUT_FILE}`);
  console.log('');

  // 全國累犯 Top 10
  console.log('🏆 全國累犯 Top 10：');
  const top = Array.from(byCompany.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  for (const [name, info] of top) {
    const cities = Array.from(info.cities).join('、');
    console.log(`   ${info.count.toString().padStart(4)} 次 | ${name} (${cities})`);
  }
}

main().catch((err) => {
  console.error('❌ 失敗:', err.message);
  process.exit(1);
});
