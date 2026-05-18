// ============================================
// Google News 抓取 + 過濾
// ============================================
//
// 策略：在 query 裡加入負面關鍵字，讓 Google 幫我們先篩過
// 例如：搜尋「"鴻海" (違法 OR 勞資 OR 訴訟 OR 罷工)」
// 這樣回來的結果幾乎都是負面新聞

const NEGATIVE_KEYWORDS = [
  '違法', '違規', '罰款', '裁罰', '判賠',
  '勞資', '糾紛', '訴訟', '判決',
  '抗議', '罷工', '欠薪', '過勞',
  '爭議', '爆料', '投訴', '霸凌', '性騷',
];

// 記憶體快取（service worker 重啟會清空，但夠用）
const cache = new Map(); // companyName → { fetchedAt, result }
const CACHE_TTL = 60 * 60 * 1000; // 1 小時

/**
 * 抓某公司的最近負面新聞
 * @param {string} companyName
 * @param {string} timeframe '7d' | '1m' | '6m' | '1y'
 */
export async function fetchCompanyNews(companyName, timeframe = '6m') {
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
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const xml = await response.text();
    const items = parseRSSItems(xml);

    const result = {
      companyName,
      query,
      count: items.length,
      items: items.slice(0, 5), // 最多保留前 5 筆
      timeframe,
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
