// ============================================
// PROBE：勞動部 announcement.mol.gov.tw 能抓到何時為止
// ============================================
// 用台北市 + 單月區間，從不同年份探測：
//   - 有回資料 → 該時期有
//   - 0 筆或拒絕 → 該時期沒有（系統硬邊界）

import AdmZip from 'adm-zip';

const CITY = { code: '63', name: '台北市' };

// 探測點（民國年月 → 該月的最後一天當結束日）
const PROBES = [
  { label: '2005-01 (民國 94)',  start: '0940101', end: '0940131' },
  { label: '2008-01 (民國 97)',  start: '0970101', end: '0970131' },
  { label: '2010-01 (民國 99)',  start: '0990101', end: '0990131' },
  { label: '2012-01 (民國 101)', start: '1010101', end: '1010131' },
  { label: '2013-01 (民國 102)', start: '1020101', end: '1020131' },
  { label: '2014-01 (民國 103)', start: '1030101', end: '1030131' },
  { label: '2015-01 (民國 104)', start: '1040101', end: '1040131' },
  { label: '2019-01 (民國 108)', start: '1080101', end: '1080131' },
];

// 失敗時自動重試的次數
const RETRY = 2;

async function getCsrfAndCookie() {
  const res = await fetch('https://announcement.mol.gov.tw/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobGuard-Probe/0.1)' },
  });
  const html = await res.text();
  const tokenMatch = html.match(/name="_csrf_token"\s+value="([^"]+)"/);
  if (!tokenMatch) throw new Error('找不到 _csrf_token');
  const cookies = res.headers.getSetCookie?.() || [];
  const cookieStr = cookies.map((c) => c.split(';')[0]).join('; ');
  return { csrfToken: tokenMatch[1], cookie: cookieStr };
}

async function probeOne(csrfToken, cookie, probe) {
  const body = new URLSearchParams({
    _csrf_token: csrfToken,
    CITYNO: CITY.code,
    UNITNAME: '',
    REGNUMBER: '',
    REGNO: '',
    FINE: '',
    DOCstartDate: probe.start,
    DOCEndDate: probe.end,
    downloadType: '3',
    Page1: '1', Page2: '1', Page3: '1',
    sortName1: '', sortName2: '', sortName3: '',
  });

  const res = await fetch('https://announcement.mol.gov.tw/Download/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: 'https://announcement.mol.gov.tw/',
      Cookie: cookie,
      'User-Agent': 'Mozilla/5.0 (compatible; JobGuard-Probe/0.1)',
    },
    body,
  });

  if (!res.ok) return { kind: 'http_error', detail: `HTTP ${res.status}` };

  const buf = Buffer.from(await res.arrayBuffer());

  // 非 ZIP（魔數 PK = 0x50 0x4b）→ 回的是 HTML（通常是「無資料」或錯誤頁）
  if (buf.length < 10 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    const text = buf.toString('utf-8').slice(0, 500);
    // 從 HTML 抓關鍵字判斷
    let hint = 'unknown_html';
    if (/查無|無資料|沒有.*資料|找不到/.test(text)) hint = 'no_data';
    else if (/錯誤|失敗|error/i.test(text)) hint = 'error_page';
    return { kind: 'not_zip', hint, preview: text.slice(0, 200).replace(/\s+/g, ' ') };
  }

  // 是 ZIP → 解開算筆數
  try {
    const zip = new AdmZip(buf);
    const entries = zip.getEntries().filter((e) => e.entryName.endsWith('.csv'));
    let totalRows = 0;
    for (const e of entries) {
      const text = e.getData().toString('utf-8');
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      // 扣掉標題（前 1-2 行）
      const data = Math.max(0, lines.length - 2);
      totalRows += data;
    }
    return { kind: 'zip', csvCount: entries.length, rows: totalRows, bytes: buf.length };
  } catch (e) {
    return { kind: 'zip_parse_error', detail: e.message };
  }
}

async function main() {
  console.log('🔬 PROBE 勞動部 announcement 系統的時間下限');
  console.log(`📍 探測目標：${CITY.name}（code=${CITY.code}），每點抓 1 個月`);
  console.log('============================================');

  console.log('🔑 取得 CSRF + cookie...');
  const { csrfToken, cookie } = await getCsrfAndCookie();
  console.log(`   csrf=${csrfToken.slice(0, 20)}...`);
  console.log('');

  for (const probe of PROBES) {
    process.stdout.write(`📅 ${probe.label.padEnd(22)} `);
    let r = null;
    let lastErr = null;
    for (let attempt = 0; attempt <= RETRY; attempt++) {
      try {
        r = await probeOne(csrfToken, cookie, probe);
        break;
      } catch (e) {
        lastErr = e;
        if (attempt < RETRY) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    if (!r) {
      console.log(`💥 例外（重試 ${RETRY} 次後仍失敗）: ${lastErr?.message}`);
    } else if (r.kind === 'zip') {
      console.log(`✅ ZIP ${r.bytes} bytes / ${r.csvCount} csv / 約 ${r.rows} 筆`);
    } else if (r.kind === 'not_zip') {
      console.log(`❌ 非 ZIP（${r.hint}）`);
      if (r.preview) console.log(`     ↳ ${r.preview}`);
    } else if (r.kind === 'http_error') {
      console.log(`⚠️  ${r.detail}`);
    } else {
      console.log(`⚠️  ${r.kind}: ${r.detail || ''}`);
    }
    // 禮貌間隔
    await new Promise((r) => setTimeout(r, 700));
  }

  console.log('');
  console.log('============================================');
  console.log('📋 解讀：');
  console.log('  ✅ ZIP 有筆數    → 該時期有資料，可以抓');
  console.log('  ❌ no_data       → 系統「該時期查無資料」（硬邊界）');
  console.log('  ❌ error_page    → 系統拒絕（可能硬邊界、可能參數錯）');
}

main().catch((err) => {
  console.error('❌ probe 失敗:', err.message);
  console.error(err.stack);
  process.exit(1);
});
