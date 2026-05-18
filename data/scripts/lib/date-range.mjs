// ============================================
// 日期區間工具（民國年）
// ============================================
//
// 政府網站常用民國年（YYYMMDD 7 碼），我們用同樣格式

/**
 * 把民國年區間切成 N 段
 * @param {string} start "1090101"
 * @param {string} end   "1141231"
 * @param {number} years 每段幾年（預設 1）
 * @returns {Array<{start: string, end: string}>}
 */
export function splitMingooRange(start, end, years = 1) {
  const startYear = parseInt(start.slice(0, 3), 10);
  const endYear = parseInt(end.slice(0, 3), 10);

  const segments = [];
  for (let y = startYear; y <= endYear; y += years) {
    const segStart = y === startYear ? start : `${y.toString().padStart(3, '0')}0101`;
    const segEndYear = Math.min(y + years - 1, endYear);
    const segEnd =
      segEndYear === endYear ? end : `${segEndYear.toString().padStart(3, '0')}1231`;
    segments.push({ start: segStart, end: segEnd });
  }

  return segments;
}

/**
 * 民國年/月/日 → 西元字串
 * "115/02/05" → "2026-02-05"
 */
export function mingooToWestern(s) {
  if (!s) return '';
  const m = s.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return s;
  const year = parseInt(m[1], 10) + 1911;
  const month = m[2].padStart(2, '0');
  const day = m[3].padStart(2, '0');
  return `${year}-${month}-${day}`;
}
