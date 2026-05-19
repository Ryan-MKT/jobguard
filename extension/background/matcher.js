// ============================================
// 公司名模糊比對引擎 ⭐ 求職門神最核心
// ============================================
//
// 三層策略（由準到鬆）：
//   策略 1：精確比對        confidence 1.0
//     例：「統一速達股份有限公司」normalize 後 = 「統一速達」找到
//   策略 2：反向包含        confidence 0.7
//     例：104 顯示「全聯」，IndexedDB「全聯實業」包含「全聯」
//   策略 3：正向包含        confidence 0.6（容易誤判，僅 loose 模式啟用）
//     例：104「上策行銷」包含 IndexedDB「上策」(2字 key 風險高)
//
// 模式：
//   strict（預設）— 精確優先，避免誤標無辜公司
//     ✘ 策略 3 完全停用
//     策略 2 要求：搜尋名 ≥ 3 字 且 DB key 比搜尋名長 ≥ 2 字
//   loose — 寬鬆比對，三層都跑（涵蓋多但有誤判風險）

import { getCompany, getAllCompanyKeys } from './db.js';

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

let _keysCache = null;
let _keysCacheTime = 0;
const CACHE_TTL = 60 * 1000;

async function getKeysCached() {
  const now = Date.now();
  if (_keysCache && now - _keysCacheTime < CACHE_TTL) return _keysCache;
  _keysCache = await getAllCompanyKeys();
  _keysCacheTime = now;
  return _keysCache;
}

/**
 * 比對單一公司
 * @param {string} searchName 求職網上抓到的公司名
 * @param {object} [options]
 * @param {'strict'|'loose'} [options.matchMode='strict']
 * @returns {Promise<MatchResult | null>}
 */
export async function findCompany(searchName, options = {}) {
  const matchMode = options.matchMode === 'loose' ? 'loose' : 'strict';

  const normalized = normalizeName(searchName);
  if (!normalized || normalized.length < 2) return null;

  // 策略 1：精確比對（兩個模式都跑）
  const exact = await getCompany(normalized);
  if (exact) {
    return {
      ...exact,
      matchType: 'exact',
      confidence: 1.0,
      matchedKey: normalized,
      searchName,
      matchMode,
    };
  }

  // 策略 2：反向包含
  // strict 模式：搜尋名 ≥ 3 字 且 DB key 比搜尋名長 ≥ 2 字
  const allKeys = await getKeysCached();
  if (matchMode === 'strict' && normalized.length < 3) {
    return null;
  }

  let reverseMatches = allKeys.filter((k) => k.includes(normalized));
  if (matchMode === 'strict') {
    reverseMatches = reverseMatches.filter((k) => k.length >= normalized.length + 2);
  }
  if (reverseMatches.length > 0) {
    reverseMatches.sort((a, b) => a.length - b.length);
    const best = await getCompany(reverseMatches[0]);
    return {
      ...best,
      matchType: 'reverse-contains',
      confidence: 0.7,
      matchedKey: reverseMatches[0],
      searchName,
      matchMode,
    };
  }

  // 策略 3：正向包含（誤判風險高，僅 loose 模式啟用）
  if (matchMode === 'loose') {
    const forwardMatches = allKeys.filter(
      (k) => k.length >= 2 && normalized.includes(k)
    );
    if (forwardMatches.length > 0) {
      forwardMatches.sort((a, b) => b.length - a.length);
      const best = await getCompany(forwardMatches[0]);
      return {
        ...best,
        matchType: 'forward-contains',
        confidence: 0.6,
        matchedKey: forwardMatches[0],
        searchName,
        matchMode,
      };
    }
  }

  return null;
}

/**
 * 批次比對多家公司
 * @param {string[]} names
 * @param {object} [options]
 * @returns {Promise<Array<MatchResult | null>>}
 */
export async function findCompanies(names, options) {
  return Promise.all(names.map((n) => findCompany(n, options)));
}
