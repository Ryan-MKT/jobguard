// ============================================
// 公司名模糊比對引擎 ⭐ 求職門神最核心
// ============================================
//
// 三層策略（由準到鬆）：
//   策略 1：精確比對        confidence 1.0  例：「統一速達股份有限公司」normalize 後 = 「統一速達」找到
//   策略 2：反向包含        confidence 0.7  例：104 顯示「全聯」，IndexedDB「全聯實業」包含「全聯」
//   策略 3：正向包含        confidence 0.6  例：104「郭淑玲(即鼎天餐飲店)」包含 IndexedDB「鼎天餐飲店」

import { getCompany, getAllCompanyKeys } from './db.js';

// ============================================
// 正規化：跟 data/scripts/build-violations-index.mjs 用同一套邏輯
// ============================================
export function normalizeName(rawName) {
  if (!rawName || typeof rawName !== 'string') return null;
  let n = rawName.trim();
  if (!n) return null;

  // 處理「XXX(即YYY)」格式 → 取 YYY
  const matchJi = n.match(/[(（]\s*即\s*([^)）]+)\s*[)）]/);
  if (matchJi) n = matchJi[1].trim();

  // 移除「股份有限公司」「有限公司」後綴
  n = n.replace(/股份有限公司$/, '');
  n = n.replace(/有限公司$/, '');

  return n.trim();
}

// 快取所有 key（避免每次都掃描 IndexedDB）
let _keysCache = null;
let _keysCacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1 分鐘

async function getKeysCached() {
  const now = Date.now();
  if (_keysCache && now - _keysCacheTime < CACHE_TTL) return _keysCache;
  _keysCache = await getAllCompanyKeys();
  _keysCacheTime = now;
  return _keysCache;
}

/**
 * 比對單一公司
 * @param {string} searchName 104 上抓到的公司名
 * @returns {Promise<MatchResult | null>}
 *
 * MatchResult = {
 *   ...violation data,
 *   matchType: 'exact' | 'reverse-contains' | 'forward-contains',
 *   confidence: 0.6 ~ 1.0,
 *   matchedKey: string,
 *   searchName: string
 * }
 */
export async function findCompany(searchName) {
  const normalized = normalizeName(searchName);
  if (!normalized || normalized.length < 2) return null;

  // ─────────────────────────────
  // 策略 1：精確比對 (O(1) hash lookup)
  // ─────────────────────────────
  const exact = await getCompany(normalized);
  if (exact) {
    return {
      ...exact,
      matchType: 'exact',
      confidence: 1.0,
      matchedKey: normalized,
      searchName,
    };
  }

  // ─────────────────────────────
  // 策略 2：反向包含（IndexedDB key 包含搜尋名）
  // 例：104「全聯」、key「全聯實業」
  // ─────────────────────────────
  const allKeys = await getKeysCached();
  const reverseMatches = allKeys.filter((k) => k.includes(normalized));
  if (reverseMatches.length > 0) {
    // 多個候選時，取最短的（最像）
    reverseMatches.sort((a, b) => a.length - b.length);
    const best = await getCompany(reverseMatches[0]);
    return {
      ...best,
      matchType: 'reverse-contains',
      confidence: 0.7,
      matchedKey: reverseMatches[0],
      searchName,
    };
  }

  // ─────────────────────────────
  // 策略 3：正向包含（搜尋名包含 IndexedDB key）
  // 例：搜尋「全聯實業股份有限公司」、key「全聯實業」
  // (通常 normalize 階段就處理掉了，這是保險)
  // ─────────────────────────────
  const forwardMatches = allKeys.filter(
    (k) => k.length >= 2 && normalized.includes(k)
  );
  if (forwardMatches.length > 0) {
    // 取最長的 key（最有識別性）
    forwardMatches.sort((a, b) => b.length - a.length);
    const best = await getCompany(forwardMatches[0]);
    return {
      ...best,
      matchType: 'forward-contains',
      confidence: 0.6,
      matchedKey: forwardMatches[0],
      searchName,
    };
  }

  // 三層都沒找到
  return null;
}

/**
 * 批次比對多家公司（效能優化版）
 * @param {string[]} names
 * @returns {Promise<Array<MatchResult | null>>}
 */
export async function findCompanies(names) {
  return Promise.all(names.map((n) => findCompany(n)));
}
