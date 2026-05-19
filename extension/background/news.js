// ============================================
// Google News 抓取 + 過濾
// ============================================
//
// 策略：
//   1. query 帶負面關鍵字讓 Google 先篩
//   2. 拿到結果後，再用 LABOR_FILTER_KEYWORDS 客戶端過濾標題，
//      只保留標題真的提到勞資相關詞的新聞（避免公司被點名但跟勞資無關）

import { fetchWithTimeout } from './fetch-utils.js';

// 給 Google 的 query 用：縮短、最常見的負面詞（避免 query 太長被截斷）
const NEGATIVE_KEYWORDS = [
  '違法', '違規', '罰款', '裁罰', '判賠',
  '勞資', '糾紛', '訴訟', '判決',
  '抗議', '罷工', '欠薪', '過勞',
  '爭議', '爆料', '投訴', '霸凌', '性騷',
];

// 客戶端過濾用：標題含任一個就保留（59 個關鍵字，分 7 類）
const LABOR_FILTER_KEYWORDS = [
  // 法律處分（14）
  '違法', '違規', '違反', '裁罰', '罰款', '罰鍰', '開罰', '處分',
  '判賠', '賠償', '停業', '勒令', '撤照', '糾正',
  // 勞動爭議（12）
  '勞資', '勞權', '工會', '罷工', '抗議', '爭議', '糾紛', '申訴',
  '檢舉', '靜坐', '示威', '聲援',
  // 工作條件（13）
  '欠薪', '積欠', '過勞', '超時', '解雇', '資遣', '血汗', '加班費',
  '無薪假', '減薪', '苛扣', '剝削', '惡意倒閉',
  // 司法（6）
  '訴訟', '判決', '起訴', '敗訴', '提告', '和解',
  // 不當對待（7）
  '霸凌', '性騷', '騷擾', '歧視', '虐待', '暴力', '不當',
  // 員工權益（4）
  '職災', '工傷', '職業病', '勞健保',
  // 公司形象（3）
  '黑心', '慣老闆', '奴工',
];

/**
 * 判斷新聞標題是否跟勞資相關（含任一關鍵字即通過）
 */
function isLaborRelated(title) {
  if (!title || typeof title !== 'string') return false;
  return LABOR_FILTER_KEYWORDS.some((kw) => title.includes(kw));
}

// 記憶體快取（service worker 重啟會清空，但夠用）
const cache = new Map(); // companyName → { fetchedAt, result }
const CACHE_TTL = 60 * 60 * 1000; // 1 小時

/**
 * 抓某公司的最近負面新聞
 * @param {string} companyName
 * @param {string} timeframe '7d' | '1m' | '6m' | '1y' | '5y' | '10y'
 */
export async function fetchCompanyNews(companyName, timeframe = '10y') {
  if (!companyName) return null;

  // 檢查快取
  const cached = cache.get(companyName);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.result;
  }

  // 組裝 query：「公司名」 + 任一負面關鍵字
  const negativeQuery = NEGATIVE_KEYWORDS.slice(0, 12).join(' OR ');
  const query = `"${companyName}" (${negativeQuery})`;

  const url =
    `https://news.google.com/rss/search` +
    `?q=${encodeURIComponent(query)}` +
    `&when=${timeframe}` +
    `&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;

  try {
    // 8 秒 timeout（單一公司不該等太久）
    const response = await fetchWithTimeout(url, {}, 8000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const xml = await response.text();
    const allItems = parseRSSItems(xml);

    // 實測 Google News `when` 參數不被遵守（probe-news-range.mjs 證實），
    // 所以這裡用客戶端 cutoff 才能真正做到 10 年限制
    const yearsLimit = parseInt(String(timeframe).replace('y', ''), 10) || 10;
    const cutoff = Date.now() - yearsLimit * 365.25 * 24 * 60 * 60 * 1000;

    // 客戶端過濾：標題沒含勞資關鍵字、或太舊 → 丟掉
    const filtered = allItems.filter((it) => {
      if (!isLaborRelated(it.title)) return false;
      if (!it.pubDate) return true; // 沒日期的保留，由排序處理
      const t = new Date(it.pubDate).getTime();
      return Number.isFinite(t) ? t >= cutoff : true;
    });

    // 依日期倒序（最新→最舊），無 pubDate 的排到最後
    filtered.sort((a, b) => {
      const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return tb - ta;
    });

    const result = {
      companyName,
      query,
      count: filtered.length,
      items: filtered.slice(0, 5), // 最多保留前 5 筆（最新的）
      timeframe,
      yearsLimit,
      rawCount: allItems.length, // Google 回的總數，過濾前
    };

    cache.set(companyName, { fetchedAt: Date.now(), result });
    return result;
  } catch (err) {
    console.warn(`[News] ${companyName} 抓取失敗:`, err.message);
    return { companyName, count: 0, items: [], error: err.message };
  }
}

/**
 * 批次抓多家公司新聞（並發限制）
 * @param {string[]} names
 * @param {number} concurrency 同時最多幾個請求
 */
export async function fetchAllNews(names, concurrency = 5) {
  const results = new Array(names.length);
  let index = 0;

  async function worker() {
    while (index < names.length) {
      const i = index++;
      results[i] = await fetchCompanyNews(names[i]);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

// ============================================
// 簡單 XML 解析（service worker 沒 DOMParser，用 regex 處理）
// ============================================
function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1];
    items.push({
      title: extractTag(content, 'title'),
      link: extractTag(content, 'link'),
      pubDate: extractTag(content, 'pubDate'),
      source: extractTag(content, 'source'),
    });
  }
  return items;
}

function extractTag(content, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const m = content.match(re);
  if (!m) return '';
  let text = m[1];
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text.trim();
}
