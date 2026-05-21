// PoC：量化比較「品牌名比對」vs「法人全名比對」的精準度
// 抓多產業 104 公司 → 對真實裁罰索引跑 strict 比對 → 統計差異
// 用法：node poc/compare-match.mjs
import { readFile } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const KEYWORDS = ['餐廳', '物流', '保全', '清潔', '客運', '照顧服務', '紡織', '電子廠', '建築工程', '食品'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 1) 載入裁罰索引 ----
const v = JSON.parse(await readFile('data/dist/violations.json', 'utf-8'));
const index = v.index;
const keys = Object.keys(index);
const keySet = new Set(keys);
console.log(`裁罰索引：${keys.length.toLocaleString()} 家公司\n`);

// ---- 2) 複製 extension matcher.js 的 normalizeName + strict findCompany ----
function normalizeName(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let n = raw.trim();
  if (!n) return null;
  const ji = n.match(/[(（]\s*即\s*([^)）]+)\s*[)）]/);
  if (ji) n = ji[1].trim();
  n = n.replace(/股份有限公司$/, '').replace(/有限公司$/, '');
  return n.trim();
}
function findCompanyStrict(searchName) {
  const normalized = normalizeName(searchName);
  if (!normalized || normalized.length < 2) return null;
  if (keySet.has(normalized)) return { key: normalized, type: 'exact', conf: 1.0 };
  if (normalized.length < 3) return null;
  let rev = keys.filter((k) => k.includes(normalized) && k.length >= normalized.length + 2);
  if (rev.length) { rev.sort((a, b) => a.length - b.length); return { key: rev[0], type: 'reverse', conf: 0.7 }; }
  return null;
}

// ---- 3) 抓 104 公司（品牌_法人全名）----
async function fetchCompanies(kw) {
  const url = `https://www.104.com.tw/jobs/search/api/jobs?jobsource=joblist_search&keyword=${encodeURIComponent(kw)}&mode=s&page=1&pagesize=20&order=15&ro=0`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: `https://www.104.com.tw/jobs/search/?keyword=${encodeURIComponent(kw)}`, Accept: 'application/json' } });
  const j = await res.json().catch(() => null);
  const jobs = Array.isArray(j?.data) ? j.data : [];
  return jobs.map((job) => {
    const cn = job.custName || '';
    const parts = cn.split('_');
    const hasLegal = parts.length > 1;
    return { raw: cn, brand: parts[0], legal: hasLegal ? parts.slice(1).join('_') : parts[0], hasUnderscore: hasLegal };
  });
}

const all = new Map();
for (const kw of KEYWORDS) {
  try {
    const cs = await fetchCompanies(kw);
    for (const c of cs) if (!all.has(c.raw)) all.set(c.raw, c);
    process.stdout.write(`  抓「${kw}」+${cs.length}  `);
  } catch (e) { process.stdout.write(`  「${kw}」失敗 `); }
  await sleep(400);
}
const companies = [...all.values()];
console.log(`\n\n共 ${companies.length} 家不重複公司\n`);

// ---- 4) 比對 + 統計 ----
let brandHit = 0, legalHit = 0, both = 0, legalOnly = 0, brandOnly = 0, diffTarget = 0;
const legalOnlyEx = [], brandOnlyEx = [], diffEx = [];
for (const c of companies) {
  const mb = findCompanyStrict(c.brand);
  const ml = findCompanyStrict(c.legal);
  if (mb) brandHit++;
  if (ml) legalHit++;
  if (mb && ml) { both++; if (mb.key !== ml.key) { diffTarget++; if (diffEx.length < 8) diffEx.push({ c, mb, ml }); } }
  if (ml && !mb) { legalOnly++; if (legalOnlyEx.length < 10) legalOnlyEx.push({ c, ml }); }
  if (mb && !ml) { brandOnly++; if (brandOnlyEx.length < 10) brandOnlyEx.push({ c, mb }); }
}

console.log('========== 結果 ==========');
console.log(`品牌名比對命中：${brandHit} 家`);
console.log(`法人名比對命中：${legalHit} 家`);
console.log(`兩者都中：${both}（其中指向「不同」裁罰對象＝品牌名認錯：${diffTarget}）`);
console.log(`✅ 只有法人名中（品牌名漏抓的真違規）：${legalOnly}`);
console.log(`⚠️ 只有品牌名中（多半是品牌名誤命中別家）：${brandOnly}`);

console.log('\n--- ✅ 法人名抓到、品牌名漏掉的例子（recall 增益）---');
for (const e of legalOnlyEx) console.log(`  品牌「${e.c.brand}」漏 → 法人「${e.c.legal}」中裁罰 key「${e.ml.key}」(${e.ml.type})`);

console.log('\n--- ⚠️ 品牌名命中但法人名沒中（潛在誤標）---');
for (const e of brandOnlyEx) console.log(`  品牌「${e.c.brand}」中 key「${e.mb.key}」(${e.mb.type}) ← 但法人「${e.c.legal}」查無 → 可能認錯`);

console.log('\n--- ⚠️ 兩者都中但「指到不同公司」（品牌名認錯對象）---');
for (const e of diffEx) console.log(`  「${e.c.raw}」品牌→「${e.mb.key}」 vs 法人→「${e.ml.key}」`);
