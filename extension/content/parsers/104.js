// ============================================
// 104 人力銀行 - 公司名抓取 parser（v1.2 不去重）
// ============================================
//
// 變更：不去重，每個職缺卡片的公司連結都會回傳
// 這樣每張卡片都能有徽章

function parse104SearchPage() {
  const companyLinks = document.querySelectorAll('a[href*="/company/"]');

  const results = [];

  for (const link of companyLinks) {
    const name = link.textContent.trim();

    // 基本 sanity check
    if (!name || name.length < 2 || name.length > 60) continue;

    // 必須含中文
    if (!/[一-鿿]/.test(name)) continue;

    // 排除推廣
    if (
      /推薦|總整理|精選|相關公司|百萬年薪|外商公司外商|科技園區內|更多.*相關|職涯診所/.test(
        name
      )
    ) {
      continue;
    }

    // 排除特定容器
    if (link.closest('.suggestion')) continue;
    if (link.closest('footer')) continue;
    if (link.closest('[class*="suggestion"]')) continue;
    if (link.closest('[class*="footer"]')) continue;

    // ⭐ v1.2 改動：不再用 URL 去重
    // 每個 <a> 都是頁面上實際存在的一個職缺卡片位置
    results.push({ name, url: link.href, element: link });
  }

  return results;
}

window.__jobguard_parse104 = parse104SearchPage;
