// ============================================
// 104 人力銀行 - 公司名抓取 parser（v1.2 不去重）
// ============================================
//
// 變更：不去重，每個職缺卡片的公司連結都會回傳
// 這樣每張卡片都能有徽章

// 排除清單（避免抓到非公司元素）
const EXCLUDE_PATTERN =
  /推薦|總整理|精選|相關公司|百萬年薪|外商公司外商|科技園區內|更多.*相關|職涯診所|查看完整|尚未/;

// 看起來像「公司名」的最低要求（額外防呆）
function looksLikeCompanyName(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  if (t.length < 2 || t.length > 60) return false;
  // 必須含中文（避免純英文 nav）
  if (!/[一-鿿]/.test(t)) return false;
  // 排除全是常見地名（避免把地區當公司名）
  const cityOnly = /^(台北|新北|桃園|台中|台南|高雄|新竹|嘉義|苗栗|彰化|南投|雲林|屏東|宜蘭|花蓮|台東|澎湖|金門|連江|基隆)(市|縣)?$/;
  if (cityOnly.test(t)) return false;
  return true;
}

function parse104SearchPage() {
  const companyLinks = document.querySelectorAll('a[href*="/company/"]');
  const results = [];

  for (const link of companyLinks) {
    const name = link.textContent.trim();

    // 基本 sanity check（增強版）
    if (!looksLikeCompanyName(name)) continue;

    // 排除推廣文字
    if (EXCLUDE_PATTERN.test(name)) continue;

    // 排除特定容器
    if (link.closest('.suggestion')) continue;
    if (link.closest('footer')) continue;
    if (link.closest('[class*="suggestion"]')) continue;
    if (link.closest('[class*="footer"]')) continue;

    // href 必須是真的 104 公司 URL（不只字串含 /company/）
    let url;
    try {
      url = new URL(link.href);
    } catch {
      continue;
    }
    if (!/104\.com\.tw$/.test(url.hostname)) continue;
    if (!url.pathname.startsWith('/company/')) continue;

    results.push({ name, url: link.href, element: link });
  }

  return results;
}

window.__jobguard_parse104 = parse104SearchPage;
