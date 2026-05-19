// ============================================
// CakeResume / Cake - 公司名抓取 parser（初稿）
// ============================================
// Cake rebrand 後主網域是 cake.me，舊網域 cakeresume.com 仍會 redirect
// 公司頁 URL 常見：
//   https://www.cake.me/companies/{slug}
//   https://www.cake.me/zh-TW/companies/{slug}
// 搜尋頁 URL 樣本：
//   https://www.cake.me/jobs
//   https://www.cake.me/zh-TW/jobs
//   https://www.cake.me/companies

(function () {
  const { genericLinkBasedParser, registerParser } = window.__jobguard_parserCommon;

  const parseCake = genericLinkBasedParser({
    linkSelectors: [
      'a[href*="/companies/"]',
    ],
    // 同時涵蓋 cake.me 與舊網域 cakeresume.com
    hostnameSuffix: null,
    pathPrefixes: null,
    minIdLength: 2,
    extraValidate: (link, name) => {
      let url;
      try { url = new URL(link.href); } catch { return false; }
      // host 限定 cake 系列
      if (!/(cake\.me|cakeresume\.com)$/i.test(url.hostname)) return false;
      // path 必須是 /companies/{slug} 或 /zh-TW/companies/{slug} 等含語言前綴的
      const m = url.pathname.match(/^(?:\/[a-z]{2}(?:-[A-Z]{2})?)?\/companies\/([^/?#]+)/);
      if (!m) return false;
      const slug = m[1];
      if (!slug || slug.length < 2) return false;
      if (['search', 'all', 'list', 'popular', 'featured'].includes(slug.toLowerCase())) return false;
      return true;
    },
  });

  registerParser({
    id: 'cake',
    label: 'CakeResume / Cake',
    hostnames: ['cake.me', 'cakeresume.com'],
    pathTest: (url) => /\/jobs(\b|\/|\?)|\/companies(\b|\/|\?)/i.test(url),
    parse: parseCake,
  });

  window.__jobguard_parseCake = parseCake;
})();
