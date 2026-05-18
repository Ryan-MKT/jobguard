// ============================================
// 抓勞動部全國違反勞動法令資料
// ============================================
//
// 來源：announcement.mol.gov.tw (勞動部全國彙整)
// 涵蓋：22 縣市 + 4 個科學園區 + 中央機關
// 法令：9 種（勞基、性平、職安、就服、退休金、勞職保、工會、最低工資、中高齡）
//
// 跑法：pnpm --filter @jobguard/data fetch:mol

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { parse as parseCsv } from 'csv-parse/sync';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'raw');
const OUT_FILE = join(OUT_DIR, 'mol-national.json');

// 全台 22 縣市 + 科學園區
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

// 查詢日期區間（民國年）2020-01-01 ~ 2025-12-31
const DATE_START = '1090101';
const DATE_END = '1141231';

// ============================================
// 工具：從 HTML 抓 CSRF + 拿 cookie
// ============================================
async function getCsrfAndCookie() {
  const res = await fetch('https://announcement.mol.gov.tw/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobGuard/0.1)' },
  });
  const html = await res.text();
  const tokenMatch = html.match(/name="_csrf_token"\s+value="([^"]+)"/);
  if (!tokenMatch) throw new Error('找不到 _csrf_token');
  const cookies = res.headers.getSetCookie?.() || [];
  const cookieStr = cookies.map((c) => c.split(';')[0]).join('; ');
  return { csrfToken: tokenMatch[1], cookie: cookieStr };
}

// ============================================
// 下載單一縣市 ZIP
// ============================================
async function downloadCity(city, csrfToken, cookie) {
  const body = new URLSearchParams({
    _csrf_token: csrfToken,
    CITYNO: city.code,
    UNITNAME: '',
    REGNUMBER: '',
    REGNO: '',
    FINE: '',
    DOCstartDate: DATE_START,
    DOCEndDate: DATE_END,
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
      'Referer': 'https://announcement.mol.gov.tw/',
      Cookie: cookie,
      'User-Agent': 'Mozilla/5.0 (compatible; JobGuard/0.1)',
    },
    body,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} for ${city.name}`);
  const buf = Buffer.from(await res.arrayBuffer());

  // 檢查是否真的拿到 ZIP（PK magic bytes）
  if (buf.length < 10 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    return []; // 該縣市無資料
  }

  return extractCsvs(buf);
}

// ============================================
// 解 ZIP → 取出所有 CSV 內容
// ============================================
function extractCsvs(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const csvs = [];
  for (const entry of entries) {
    if (!entry.entryName.endsWith('.csv')) continue;
    // 勞動部 CSV 是 UTF-8 with BOM
    const text = entry.getData().toString('utf-8');
    csvs.push(text);
  }
  return csvs;
}

// ============================================
// 解析 CSV 為記錄
// ============================================
function parseAndNormalize(csvText, cityName) {
  // 移除 BOM、跳過第一行「違反雇主清冊」標題
  const text = csvText.replace(/^﻿/, '');
  const lines = text.split(/\r?\n/);
  // 找到真正的欄位 header 行（含「編號」）
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('"編號"')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const csvBody = lines.slice(headerIdx).join('\n');

  let records;
  try {
    records = parseCsv(csvBody, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });
  } catch (e) {
    console.warn(`     CSV 解析失敗: ${e.message}`);
    return [];
  }

  const out = [];
  for (const r of records) {
    const name = (r['事業單位名稱(負責人)\n自然人姓名'] ||
                  r['事業單位名稱(負責人)自然人姓名'] || '').trim();
    if (!name) continue;
    // 民國年/月/日 → 西元
    const date = mingooToWestern(r['處分日期']);
    const law = (r['違反法規條款'] || '').trim();
    const lawType = detectLawType(law);

    // 罰款金額（可能是「150,000」字串）
    const amtRaw = (r['罰鍰金額'] || r['處分金額／滯納金'] || r['處分金額'] || '').toString();
    const amount = parseInt(amtRaw.replace(/[^\d]/g, ''), 10) || 0;

    out.push({
      city: cityName,
      name,
      date,
      law,
      lawType,
      lawcontent: (r['法條敘述'] || '').trim(),
      docno: (r['處分字號'] || '').trim(),
      amt_dollartwd: amount.toString(),
      announceDate: mingooToWestern(r['公告日期']),
    });
  }
  return out;
}

// 民國 115/02/05 → 2026-02-05
function mingooToWestern(s) {
  if (!s) return '';
  const m = s.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return s;
  const year = parseInt(m[1], 10) + 1911;
  const month = m[2].padStart(2, '0');
  const day = m[3].padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 從「違反法規條款」文字判斷法令類型
function detectLawType(law) {
  if (!law) return '其他';
  if (law.includes('勞動基準法')) return '勞動基準法';
  if (law.includes('性別')) return '性別平等工作法';
  if (law.includes('職業安全衛生') || law.includes('營造安全')) return '職業安全衛生法';
  if (law.includes('勞工退休金')) return '勞工退休金條例';
  if (law.includes('就業服務')) return '就業服務法';
  if (law.includes('勞工職業災害') || law.includes('勞工保險')) return '勞工職業災害保險及保護法';
  if (law.includes('工會法')) return '工會法';
  if (law.includes('最低工資')) return '最低工資法';
  if (law.includes('中高齡')) return '中高齡者及高齡者就業促進法';
  return '其他';
}

// ============================================
// 主流程
// ============================================
async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('🚀 開始抓勞動部全國資料');
  console.log(`📅 期間：民國 ${DATE_START} ~ ${DATE_END}`);
  console.log(`🌍 涵蓋：${CITIES.length} 個地區`);
  console.log('============================================');

  console.log('🔑 取 CSRF token + cookie...');
  const { csrfToken, cookie } = await getCsrfAndCookie();
  console.log(`   token: ${csrfToken.slice(0, 30)}...`);

  const all = [];
  const stats = {};

  for (let i = 0; i < CITIES.length; i++) {
    const city = CITIES[i];
    process.stdout.write(`📥 [${i + 1}/${CITIES.length}] ${city.name.padEnd(10)} `);

    try {
      const csvs = await downloadCity(city, csrfToken, cookie);
      let cityCount = 0;
      for (const csv of csvs) {
        const records = parseAndNormalize(csv, city.name);
        all.push(...records);
        cityCount += records.length;
      }
      stats[city.name] = cityCount;
      console.log(`${cityCount.toString().padStart(5)} 筆`);
    } catch (err) {
      console.log(`❌ ${err.message}`);
      stats[city.name] = 0;
    }

    // 禮貌間隔
    if (i < CITIES.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  await writeFile(OUT_FILE, JSON.stringify(all, null, 2), 'utf-8');

  console.log('');
  console.log('============================================');
  console.log(`✅ 完成！共 ${all.length.toLocaleString()} 筆`);
  console.log(`💾 ${OUT_FILE}`);
  console.log('============================================');

  // 法令類型統計
  const byLawType = {};
  for (const r of all) byLawType[r.lawType] = (byLawType[r.lawType] || 0) + 1;
  console.log('\n📊 各法令類型筆數：');
  for (const [t, c] of Object.entries(byLawType).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${t.padEnd(20)} ${c.toLocaleString()}`);
  }
}

main().catch((err) => {
  console.error('❌ 失敗:', err.message);
  console.error(err.stack);
  process.exit(1);
});
