// ============================================
// 把多份原始違規資料 → extension 用的索引
// ============================================
// 輸入：data/raw/ntpc-labor-*.json  (多個法令)
// 輸出：data/dist/violations.json   (含 lawType 分類)

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(__dirname, '..', 'raw');
const OUT_DIR = join(__dirname, '..', 'dist');
const OUT_FILE = join(OUT_DIR, 'violations.json');

// raw 檔對應的法令類型
const SOURCES = [
  { file: 'ntpc-labor-base.json', lawType: '勞動基準法' },
  { file: 'ntpc-labor-gender.json', lawType: '性別工作平等法' },
  { file: 'ntpc-labor-safety.json', lawType: '職業安全衛生法' },
];

// ============================================
// 公司名正規化
// ============================================
function normalizeName(rawName) {
  if (!rawName || typeof rawName !== 'string') return null;
  let n = rawName.trim();
  if (!n) return null;

  const matchJi = n.match(/[(（]\s*即\s*([^)）]+)\s*[)）]/);
  if (matchJi) n = matchJi[1].trim();

  n = n.replace(/股份有限公司$/, '');
  n = n.replace(/有限公司$/, '');
  return n.trim();
}

async function main() {
  console.log('📖 讀取原始資料...');
  let totalRecords = 0;
  const byCompany = new Map();
  const lawTypeCounts = {};
  let skipped = 0;

  for (const { file, lawType } of SOURCES) {
    const filePath = join(RAW_DIR, file);
    let raw;
    try {
      raw = JSON.parse(await readFile(filePath, 'utf-8'));
    } catch {
      console.warn(`   ⚠️ 找不到 ${file}，跳過`);
      continue;
    }

    console.log(`   ${file}: ${raw.length.toLocaleString()} 筆 (${lawType})`);
    totalRecords += raw.length;
    lawTypeCounts[lawType] = raw.length;

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
          byLawType: {},
          violations: [],
        });
      }

      const entry = byCompany.get(normalized);
      entry.originalNames.add(rec.name.trim());
      entry.count++;
      entry.totalFine += parseInt(rec.amt_dollartwd, 10) || 0;
      if (rec.date > entry.latestDate) entry.latestDate = rec.date;

      // 按法令類型分類計數
      entry.byLawType[lawType] = (entry.byLawType[lawType] || 0) + 1;

      entry.violations.push({
        date: rec.date,
        lawType,
        law: rec.law,
        content: rec.lawcontent,
        amount: parseInt(rec.amt_dollartwd, 10) || 0,
      });
    }
  }

  console.log('');
  console.log(`✅ 整理完成：${byCompany.size.toLocaleString()} 家獨立公司`);
  console.log(`   來自 ${totalRecords.toLocaleString()} 筆原始紀錄，跳過 ${skipped} 筆`);

  // 轉成 plain object
  const index = {};
  for (const [name, entry] of byCompany) {
    index[name] = {
      displayName: entry.displayName,
      originalNames: Array.from(entry.originalNames),
      count: entry.count,
      totalFine: entry.totalFine,
      latestDate: entry.latestDate,
      byLawType: entry.byLawType,
      violations: entry.violations.sort((a, b) => b.date.localeCompare(a.date)),
    };
  }

  const output = {
    schemaVersion: 2, // bump (加了 byLawType / lawType 欄位)
    updatedAt: new Date().toISOString(),
    source: '新北市資料開放平台 - 3 大勞動法令違規（勞基法、性平法、職安法）',
    sourceUrls: SOURCES.map((s) => ({
      lawType: s.lawType,
      file: s.file,
    })),
    totalRecords,
    uniqueCompanies: byCompany.size,
    lawTypeCounts,
    index,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(output, null, 2), 'utf-8');

  console.log('');
  console.log('============================================');
  console.log(`💾 已寫到 ${OUT_FILE}`);
  console.log('============================================');

  // 統計各法令違規 Top 5
  for (const [lawType, total] of Object.entries(lawTypeCounts)) {
    console.log(`\n🏆 違反「${lawType}」次數 Top 5：`);
    const top = Array.from(byCompany.entries())
      .filter(([_, info]) => info.byLawType[lawType])
      .sort((a, b) => b[1].byLawType[lawType] - a[1].byLawType[lawType])
      .slice(0, 5);
    for (const [name, info] of top) {
      console.log(`   ${info.byLawType[lawType].toString().padStart(3)} 次 | ${name}`);
    }
  }
}

main().catch((err) => {
  console.error('❌ 失敗:', err.message);
  process.exit(1);
});
