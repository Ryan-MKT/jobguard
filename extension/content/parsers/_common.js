// ============================================
// Parser 共用模組：合理性檢查、排除清單、registry
// ============================================

(function () {
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
    '查看更多', '更多公司', '查看全部',
  ]);

  // 排除清單 C：URL path 含這些字 = 搜尋/分類頁，不是真公司
  const PATH_NON_COMPANY = /\/(search|feature|list|category|industry|filter|searching|tags?|featured|popular|recommend)/i;

  // 排除清單 D：常見地名（避免把地區當公司名）
  const CITY_ONLY = /^(台北|新北|桃園|台中|台南|高雄|新竹|嘉義|苗栗|彰化|南投|雲林|屏東|宜蘭|花蓮|台東|澎湖|金門|連江|基隆)(市|縣)?$/;

  function looksLikeCompanyName(text) {
    if (!text || typeof text !== 'string') return false;
    const t = text.trim();
    if (t.length < 2 || t.length > 60) return false;
    // 必須含中文（避免純英文 nav）
    if (!/[一-鿿]/.test(t)) return false;
    if (CITY_ONLY.test(t)) return false;
    return true;
  }

  function isExcluded(name) {
    return EXCLUDE_CONTAINS.test(name) || EXCLUDE_EXACT.has(name.trim());
  }

  function isExcludedContainer(link) {
    // 結構性容器
    if (link.closest('nav')) return true;
    if (link.closest('[role="navigation"]')) return true;
    if (link.closest('footer')) return true;

    // class name 比對：用 hyphen 邊界避免誤殺
    // （CSS [class*="tag"] 會把 "stage"、"package" 也算進來）
    const SAFE_PATTERNS = [
      '.tag', '.tags', '[class*="-tag"]', '[class*="tag-"]', '[class$="tag"]',
      '.label', '.labels', '[class*="-label"]', '[class*="label-"]',
      '.suggestion', '[class*="-suggestion"]', '[class*="suggestion-"]',
      '[class*="-footer"]', '[class*="footer-"]',
      '.badge:not([class*="jobguard"])',
      '[class*="-badge"]:not([class*="jobguard"])',
      '[class*="badge-"]:not([class*="jobguard"])',
    ];
    if (link.closest(SAFE_PATTERNS.join(','))) return true;

    return false;
  }

  // ============================================
  // Parser Registry
  // ============================================
  const registry = [];

  function registerParser(config) {
    // config: { id, hostnames: string[], pathTest: (url) => bool, parse: () => [{name, url, element}] }
    registry.push(config);
  }

  function findParser(url = location.href, hostname = location.hostname) {
    for (const p of registry) {
      const hostMatch = p.hostnames.some((h) => hostname.includes(h));
      if (!hostMatch) continue;
      if (p.pathTest && !p.pathTest(url)) continue;
      return p;
    }
    return null;
  }

  function listSupportedSites() {
    return registry.map((p) => ({ id: p.id, hostnames: p.hostnames }));
  }

  // ============================================
  // 通用 parser：用 href pattern + 合理性檢查
  // 適合大部分網站的 fallback
  // ============================================
  function genericLinkBasedParser({
    linkSelectors,        // CSS selectors 陣列，符合任一就算（多個 selector OR）
    hostnameSuffix,       // 連結的 hostname 必須以此結尾（防範被當廣告連結）
    pathPrefixes,         // 連結 pathname 必須以這些 prefix 開頭（陣列）
    minIdLength = 1,      // pathname 在 prefix 之後至少要有幾個字（過濾 /company/ 這種短路徑）
    extraValidate,        // 額外驗證 function(link, name) => bool
  }) {
    return function parse() {
      const selectorStr = linkSelectors.join(', ');
      const links = document.querySelectorAll(selectorStr);
      const results = [];
      const seen = new WeakSet();

      for (const link of links) {
        if (seen.has(link)) continue;
        seen.add(link);

        const name = (link.textContent || '').trim();
        if (!looksLikeCompanyName(name)) continue;
        if (isExcluded(name)) continue;
        if (isExcludedContainer(link)) continue;

        let url;
        try {
          url = new URL(link.href);
        } catch {
          continue;
        }

        if (hostnameSuffix && !url.hostname.endsWith(hostnameSuffix)) continue;

        if (pathPrefixes && pathPrefixes.length > 0) {
          const matchedPrefix = pathPrefixes.find((p) => url.pathname.startsWith(p));
          if (!matchedPrefix) continue;
          if (PATH_NON_COMPANY.test(url.pathname)) continue;
          const idPart = url.pathname.slice(matchedPrefix.length).split(/[/?#]/)[0];
          if (!idPart || idPart.length < minIdLength) continue;
        }

        if (typeof extraValidate === 'function' && !extraValidate(link, name)) continue;

        results.push({ name, url: link.href, element: link });
      }

      return results;
    };
  }

  // 對外 API
  window.__jobguard_parserCommon = {
    EXCLUDE_CONTAINS,
    EXCLUDE_EXACT,
    PATH_NON_COMPANY,
    CITY_ONLY,
    looksLikeCompanyName,
    isExcluded,
    isExcludedContainer,
    registerParser,
    findParser,
    listSupportedSites,
    genericLinkBasedParser,
  };
})();
