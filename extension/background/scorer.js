// ============================================
// 風險評分器
// ============================================
//
// 綜合三個因素打 0–8 分：
//   1. 違規次數：0~5 分
//   2. 罰款金額：0~3 分
//   3. 信心度低時懲罰 -2 分（避免誤指控）
//
// 對應顏色：
//   0    分 → 🟢 安心（綠燈）
//   1–2  分 → 🟠 輕度（橘燈）
//   3–5  分 → 🟡 注意（黃燈）
//   6+   分 → 🔴 高風險（紅燈）

const FINE_TIERS = [
  { min: 10_000_000, points: 3, label: '罰款逾 1000 萬' },
  { min: 1_000_000, points: 2, label: '罰款逾 100 萬' },
  { min: 100_000, points: 1, label: '罰款逾 10 萬' },
];

const COUNT_TIERS = [
  { min: 50, points: 5, label: (n) => `累犯 ${n} 次` },
  { min: 20, points: 4, label: (n) => `違規 ${n} 次` },
  { min: 10, points: 3, label: (n) => `違規 ${n} 次` },
  { min: 5, points: 2, label: (n) => `違規 ${n} 次` },
  { min: 1, points: 1, label: (n) => `違規 ${n} 次` },
];

/**
 * @param {Object|null} match - 從 matcher 來的結果（含 count, totalFine, confidence）
 * @returns {Object} { level, label, color, score, max, reasons }
 */
export function calculateRisk(match) {
  if (!match) {
    return {
      level: 'none',
      label: '✅ 無紀錄',
      color: '#4caf50',
      score: 0,
      max: 8,
      reasons: ['新北市違規資料庫中查無紀錄'],
    };
  }

  let score = 0;
  const reasons = [];

  // === 違規次數 ===
  for (const tier of COUNT_TIERS) {
    if (match.count >= tier.min) {
      score += tier.points;
      reasons.push(tier.label(match.count));
      break;
    }
  }

  // === 罰款金額 ===
  for (const tier of FINE_TIERS) {
    if (match.totalFine >= tier.min) {
      score += tier.points;
      reasons.push(tier.label);
      break;
    }
  }

  // === 信心度懲罰 ===
  // 模糊比對結果不確定 → 保守減分，避免誤指控
  if (match.confidence < 0.8) {
    score = Math.max(0, score - 2);
    reasons.push(`(模糊比對 ${(match.confidence * 100).toFixed(0)}% 信心，分數已扣)`);
  }

  // === 換算燈號 ===
  let level, label, color;
  if (score >= 6) {
    level = 'red';
    label = '🔴 高風險';
    color = '#d32f2f';
  } else if (score >= 3) {
    level = 'yellow';
    label = '🟡 注意';
    color = '#f9a825';
  } else if (score >= 1) {
    level = 'low';
    label = '🟠 輕度';
    color = '#ed6c02';
  } else {
    level = 'green';
    label = '🟢 安心';
    color = '#4caf50';
  }

  return {
    level,
    label,
    color,
    score,
    max: 8,
    reasons,
  };
}
