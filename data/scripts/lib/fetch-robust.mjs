// ============================================
// 通用容錯 fetch 邏輯
// ============================================
//
// 多種策略順序嘗試，任一成功即可
//
// 策略：
//   1. 嘗試原本範圍 + 嚴格解析
//   2. 失敗 → 寬鬆解析
//   3. 失敗 → 分段（每年一段）+ 寬鬆解析
//   4. 全部失敗 → 拋錯誤但不影響其他項目

import { parseRobust } from './csv-parser.mjs';
import { splitMingooRange } from './date-range.mjs';

/**
 * @typedef {Object} FetchAttempt
 * @property {string} strategy
 * @property {Object[]} records
 * @property {string[]} errors
 */

/**
 * 對單一目標執行三段式 fetch
 *
 * @param {Object} target 任意目標識別物件（傳給 fetchFn）
 * @param {string} startDate 民國日期
 * @param {string} endDate 民國日期
 * @param {Function} fetchFn (target, startDate, endDate) => Promise<csvText[]>
 *                            回傳 CSV 文字陣列（一個 ZIP 可能含多個 CSV）
 * @returns {Promise<FetchAttempt>}
 */
export async function fetchWithFallback(target, startDate, endDate, fetchFn) {
  const allRecords = [];
  const errors = [];
  let strategy = 'unknown';

  // 第 1 級：全範圍 + 嚴格→寬鬆→容錯
  try {
    const csvs = await fetchFn(target, startDate, endDate);
    let allOk = true;
    for (const csv of csvs) {
      const result = parseRobust(csv);
      allRecords.push(...result.records);
      if (result.strategy !== 'strict') {
        allOk = false;
        errors.push(`${result.strategy}: ${result.errors.join('; ')}`);
      }
      strategy = result.strategy;
    }
    if (allRecords.length > 0) return { strategy, records: allRecords, errors };
  } catch (e) {
    errors.push(`full-range: ${e.message}`);
  }

  // 第 2 級：分段（每年一段）
  const segments = splitMingooRange(startDate, endDate, 1);
  const segRecords = [];
  let segStrategies = new Set();
  for (const seg of segments) {
    try {
      const csvs = await fetchFn(target, seg.start, seg.end);
      for (const csv of csvs) {
        const result = parseRobust(csv);
        segRecords.push(...result.records);
        segStrategies.add(result.strategy);
      }
    } catch (e) {
      errors.push(`seg ${seg.start}-${seg.end}: ${e.message}`);
    }
  }

  return {
    strategy: `segmented(${[...segStrategies].join('/')})`,
    records: segRecords,
    errors,
  };
}
