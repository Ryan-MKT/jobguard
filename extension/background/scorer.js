// ============================================
// 風險分級 v2（三色制）
// ============================================
//
// 邏輯：
//   🔴 紅 = 有明確政府裁罰紀錄（match.count > 0）
//   🟡 黃 = 沒裁罰但有抓到勞資相關新聞（news.count > 0）
//   🟢 綠 = 兩者都沒有

/**
 * @param {Object|null} match - 從 matcher 來的結果（含 count, totalFine, confidence）
 * @param {Object|null} news  - 從 fetchCompanyNews 來的結果（含 count）
 * @returns {Object} { level, label, color, reasons }
 */
export function calculateRisk(match, news) {
  const hasViolation = !!(match && match.count > 0);
  const newsCount = (news && Number(news.count)) || 0;
  const hasNews = newsCount > 0;

  // 🔴 紅：明確裁罰
  if (hasViolation) {
    const reasons = [];
    reasons.push(`政府裁罰 ${match.count} 次`);
    if (match.totalFine > 0) {
      reasons.push(`累計罰款 NT$ ${match.totalFine.toLocaleString()}`);
    }
    if (match.confidence < 0.8) {
      reasons.push(`模糊比對 ${(match.confidence * 100).toFixed(0)}% 信心`);
    }
    if (hasNews) {
      reasons.push(`+ ${newsCount} 則相關新聞`);
    }
    return {
      level: 'red',
      label: '🔴 有裁罰紀錄',
      color: '#d32f2f',
      reasons,
    };
  }

  // 🟡 黃：無裁罰但有新聞
  if (hasNews) {
    return {
      level: 'yellow',
      label: '🟡 有相關新聞',
      color: '#f9a825',
      reasons: [`${newsCount} 則勞資相關新聞（無裁罰紀錄）`],
    };
  }

  // 🟢 綠：完全乾淨
  return {
    level: 'green',
    label: '🟢 無紀錄',
    color: '#4caf50',
    reasons: ['查無政府裁罰、無相關新聞'],
  };
}
