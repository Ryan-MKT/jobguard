// PoC：探 104 公司資料結構，找「法人全名 / 統一編號」
// 用法：node poc/probe-104.mjs [keyword]
// 純探測，不寫入任何專案資料，不影響審查中的 1.0.2

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const keyword = process.argv[2] || '餐廳';

async function getRaw(url, referer) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Referer: referer,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'zh-TW,zh;q=0.9',
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

// 1) 職缺搜尋 API
const searchUrl =
  `https://www.104.com.tw/jobs/search/api/jobs?jobsource=joblist_search&keyword=${encodeURIComponent(keyword)}&mode=s&page=1&pagesize=20&order=15&ro=0`;
const searchRef = `https://www.104.com.tw/jobs/search/?keyword=${encodeURIComponent(keyword)}`;

console.log(`\n=== 1) 搜尋 API（keyword=「${keyword}」）===`);
const search = await getRaw(searchUrl, searchRef);
console.log('HTTP', search.status);
const jobs = Array.isArray(search.json?.data) ? search.json.data : [];
console.log(`拿到 ${jobs.length} 筆職缺\n`);

// 2) 分析 custName 格式：是否含「品牌_法人全名」
console.log('=== 2) custName 格式分析（品牌名_法人全名？）===');
const seen = new Set();
const companies = [];
let withLegal = 0;
for (const j of jobs) {
  const cn = j.custName || '';
  if (seen.has(cn)) continue;
  seen.add(cn);
  const hasUnderscore = cn.includes('_');
  const parts = cn.split('_');
  const looksLegal = /有限公司|股份|商行|企業社|工作室|診所|事務所|餐廳|行$|社$/.test(parts[parts.length - 1] || '');
  if (hasUnderscore && looksLegal) withLegal++;
  const link = j?.link?.cust || '';
  const m = link.match(/\/company\/([A-Za-z0-9]+)/);
  companies.push({ custName: cn, brand: parts[0], legal: hasUnderscore ? parts.slice(1).join('_') : null, hashId: m?.[1] || null });
  console.log(`  「${cn}」  → 品牌:「${parts[0]}」 法人:「${hasUnderscore ? parts.slice(1).join('_') : '（無_，只有單一名）'}」`);
}
console.log(`\n→ ${seen.size} 家中，${withLegal} 家的 custName 帶可辨識的法人全名 (${Math.round(withLegal / seen.size * 100)}%)`);

// 3) 抓一家的公司內容端點，找統編
const target = companies.find((c) => c.hashId);
if (target) {
  console.log(`\n=== 3) 公司內容端點找統編：${target.custName}（${target.hashId}）===`);
  const r = await getRaw(`https://www.104.com.tw/company/ajax/content/${target.hashId}`,
    `https://www.104.com.tw/company/${target.hashId}`);
  console.log('HTTP', r.status);
  if (r.json) {
    const d = r.json?.data ?? r.json;
    console.log('欄位鍵：', Object.keys(d).join(', '));
    const flat = JSON.stringify(d);
    const taxMatch = flat.match(/"[^"]*(統一編號|統編|taxId|banNo|uniformNumber)[^"]*"\s*:\s*"?(\d{8})/i);
    const any8 = flat.match(/\b\d{8}\b/);
    console.log('統編欄位：', taxMatch ? `找到 ${taxMatch[2]}` : '❌ 無明確統編欄位');
    console.log('全文任意8碼數字：', any8 ? any8[0] + '（需人工確認是否為統編）' : '無');
    for (const [k, v] of Object.entries(d)) {
      const sv = typeof v === 'string' ? v : JSON.stringify(v);
      if (/name|cust|company|nation|profile|industry/i.test(k)) console.log(`  ${k}:`, (sv || '').slice(0, 80));
    }
  } else {
    console.log('非 JSON，前 200 字：', r.text.slice(0, 200));
  }
}
console.log('\n=== 探測完成 ===');
