// 驗證 v1.1.0 新比對：完全複製 matcher.js 的分層邏輯，跑真實 104 樣本
// 用法：node poc/verify-v2.mjs
import { readFile } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const KEYWORDS = ['餐廳', '物流', '保全', '清潔', '客運', '照顧服務', '紡織', '電子廠', '建築工程', '食品', '飯店', '超市'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const v = JSON.parse(await readFile('data/dist/violations.json', 'utf-8'));
const index = v.index;
const legalIndex = v.legalIndex || {};
const keys = Object.keys(index);
const keySet = new Set(keys);
console.log(`索引 ${keys.length.toLocaleString()} 家 / legalIndex ${Object.keys(legalIndex).length.toLocaleString()} 筆\n`);

// ---- 複製 matcher.js ----
function normalizeName(raw) {
  if (!raw) return null;
  let n = raw.trim(); if (!n) return null;
  const ji = n.match(/[(（]\s*即\s*([^)）]+)\s*[)）]/); if (ji) n = ji[1].trim();
  n = n.replace(/股份有限公司$/, '').replace(/有限公司$/, '');
  return n.trim();
}
function canonicalLegalName(raw) {
  if (!raw) return null;
  let n = raw.trim(); if (!n) return null;
  const ji = n.match(/[(（]\s*即\s*([^)）]+)\s*[)）]/); if (ji) n = ji[1].trim();
  const m = n.match(/^(.+?)\s*[(（][^)）]+[)）]\s*$/);
  if (m) { const b = m[1].trim(); if (b && !b.startsWith('(') && !b.startsWith('（')) n = b; }
  return n.trim();
}
function findOld(brand) { // 現行：品牌名 strict
  const nm = normalizeName(brand);
  if (!nm || nm.length < 2) return null;
  if (keySet.has(nm)) return { key: nm, type: 'exact', conf: 1.0 };
  if (nm.length < 3) return null;
  const rev = keys.filter((k) => k.includes(nm) && k.length >= nm.length + 2).sort((a, b) => a.length - b.length);
  return rev.length ? { key: rev[0], type: 'reverse', conf: 0.7 } : null;
}
function findV2(brand, legal, city) { // 新：法人 exact 高信心 → 品牌 fallback
  if (legal) {
    const lk = canonicalLegalName(legal);
    if (lk && lk.length >= 2 && legalIndex[lk]) {
      const key = legalIndex[lk];
      const entry = index[key];
      const isCorp = /(股份)?有限公司$/.test(lk);
      const cityOK = !city || !Array.isArray(entry.cities) || entry.cities.includes(city);
      if (isCorp || cityOK) return { key, type: 'legal-exact', tier: 'verified', conf: isCorp ? 0.98 : 0.95 };
    }
  }
  return findOld(brand); // tier: suspect/likely
}

// ---- pickLegal / city（複製 104.js）----
function pickLegal(custName) {
  const parts = String(custName || '').split('_').map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return parts[0] || '';
  const legalish = parts.filter((p) => /[一-鿿]/.test(p) && /(有限公司|股份|企業社|商行|工作室|診所|事務所|餐廳|社$|行$|號$)/.test(p));
  if (legalish.length) return legalish[legalish.length - 1];
  const zh = parts.filter((p) => /[一-鿿]/.test(p));
  return (zh.length ? zh[zh.length - 1] : parts[parts.length - 1]) || '';
}

async function fetchCompanies(kw) {
  const url = `https://www.104.com.tw/jobs/search/api/jobs?jobsource=joblist_search&keyword=${encodeURIComponent(kw)}&mode=s&page=1&pagesize=20&order=15&ro=0`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: `https://www.104.com.tw/jobs/search/?keyword=${encodeURIComponent(kw)}`, Accept: 'application/json' } });
  const j = await res.json().catch(() => null);
  const jobs = Array.isArray(j?.data) ? j.data : [];
  return jobs.map((job) => {
    const cn = job.custName || '';
    const cityM = String(job.jobAddrNoDesc || '').match(/^(.{1,2}[市縣])/);
    return { raw: cn, brand: cn.split('_')[0], legal: pickLegal(cn), city: cityM ? cityM[1] : undefined };
  });
}

const all = new Map();
for (const kw of KEYWORDS) {
  try { for (const c of await fetchCompanies(kw)) if (!all.has(c.raw)) all.set(c.raw, c); } catch {}
  await sleep(350);
}
const companies = [...all.values()];
console.log(`樣本 ${companies.length} 家\n`);

let oldHit = 0, v2Hit = 0, verified = 0, v2OnlyGain = 0;
const gains = [];
for (const c of companies) {
  const o = findOld(c.brand);
  const n = findV2(c.brand, c.legal, c.city);
  if (o) oldHit++;
  if (n) v2Hit++;
  if (n?.tier === 'verified') verified++;
  if (n && !o) { v2OnlyGain++; if (gains.length < 14) gains.push({ c, n }); }
}
console.log('========== v1.1.0 新比對 vs 現行 ==========');
console.log(`現行（品牌名）命中：       ${oldHit} 家`);
console.log(`新（法人名+品牌 fallback）：${v2Hit} 家  （其中法人 exact 已核實 ${verified} 家）`);
console.log(`✅ 新增抓到的真違規（品牌名漏）：${v2OnlyGain} 家`);
console.log(`📈 召回提升：${oldHit ? '+' + Math.round((v2Hit - oldHit) / oldHit * 100) + '%' : 'n/a'}\n`);
console.log('--- 新增命中範例（品牌名漏、法人名核實）---');
for (const g of gains) console.log(`  品牌「${g.c.brand}」→ 法人「${g.c.legal}」中 key「${g.n.key}」(${g.n.type}, 裁罰 ${index[g.n.key].count} 次)`);
