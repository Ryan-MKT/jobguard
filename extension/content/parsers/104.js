// ============================================
// 104 人力銀行 - 公司名抓取 parser（v1.2 不去重）
// ============================================
//
// 變更：不去重，每個職缺卡片的公司連結都會回傳
// 這樣每張卡片都能有徽章

// 排除清單 A：包含這些字串就算（推廣/廣告類）
const EXCLUDE_CONTAINS =
  /推薦|總整理|精選|相關公司|百萬年薪|外商公司外商|科技園區內|更多.*相關|職涯診所|查看完整|尚未/;

// 排除清單 B：完全相等就算（公司屬性標籤，這些是篩選器不是公司）
const EXCLUDE_EXACT = new Set([
  '上市上櫃', '上市櫃', '上市', '上櫃', '興櫃', '公開發行',
  '外商公司', '外商', '跨國公司', '跨國', '外資',
  '中小企業', '新創', '新創公司', '新創企業',
  '國營事業', '國營', '公營',
  '大型企業', '中型企業', '小型企業', '知名企業',
  '老字號', '連鎖企業', '連鎖品牌', '集團企業', '集團',
  '科技業', '製造業', '服務業', '金融業', '零售業',
  '所有產業', '所有公司',
]);

// 排除清單 C：URL path 含這些字 = 搜尋/分類頁，不是真公司
const PATH_NON_COMPANY = /\/(search|feature|list|category|industry|filter|searching|tags?|featured)/i;

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
    if (EXCLUDE_CONTAINS.test(name)) continue;

    // 排除公司屬性標籤（上市上櫃、外商公司 等）
    if (EXCLUDE_EXACT.has(name)) continue;

    // 排除特定容器
    if (link.closest('.suggestion')) continue;
    if (link.closest('footer')) continue;
    if (link.closest('[class*="suggestion"]')) continue;
    if (link.closest('[class*="footer"]')) continue;
    // 額外：常見的「標籤群組」容器
    if (link.closest('[class*="tag"]')) continue;
    if (link.closest('[class*="label"]')) continue;
    if (link.closest('[class*="badge"]:not([class*="jobguard"])')) continue;

    // href 必須是真的 104 公司 URL（不只字串含 /company/）
    let url;
    try {
      url = new URL(link.href);
    } catch {
      continue;
    }
    if (!/104\.com\.tw$/.test(url.hostname)) continue;
    if (!url.pathname.startsWith('/company/')) continue;

    // 排除 /company/search、/company/feature 等非公司頁
    if (PATH_NON_COMPANY.test(url.pathname)) continue;

    // 真正公司頁的 id 至少要 2 個字（避免 /company/  這種短路徑）
    const idPart = url.pathname.slice('/company/'.length).split('/')[0];
    if (!idPart || idPart.length < 2) continue;

    results.push({ name, url: link.href, element: link });
  }

  return results;
}

window.__jobguard_parse104 = parse104SearchPage;
