// ============================================
// 104 人力銀行 - 公司名抓取 parser（正式版 v1.0）
// ============================================
//
// 經過 4 次偵察驗證的策略：
//   - 公司名在 <a> 標籤裡
//   - 文字以「有限公司」「股份」「診所」等結尾
//   - 排除 .suggestion（搜尋建議下拉）
//   - 排除 footer（版權區）

/**
 * 從 104 搜尋結果頁抓出所有公司
 * @returns {Array<{name: string, url: string, element: HTMLElement}>}
 */
function parse104SearchPage() {
  const COMPANY_SUFFIX = /(有限公司|股份有限公司|診所|事務所|工作室|商行|診療所)$/;

  const allAnchors = document.querySelectorAll('a');
  const results = [];
  const seen = new Set();

  for (const a of allAnchors) {
    const name = a.textContent.trim();

    // Sanity check
    if (name.length < 4 || name.length > 50) continue;
    if (!COMPANY_SUFFIX.test(name)) continue;
    if (a.closest('.suggestion')) continue;
    if (a.closest('footer')) continue;
    if (name.includes('版權')) continue;

    // 用 URL 去除重複（同公司可能多個職缺）
    const url = a.href;
    if (seen.has(url)) continue;
    seen.add(url);

    results.push({ name, url, element: a });
  }

  return results;
}

window.__jobguard_parse104 = parse104SearchPage;
