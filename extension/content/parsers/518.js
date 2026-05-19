// ============================================
// 518 熊班 - 公司名抓取 parser（初稿）
// ============================================
// 518 公司頁 URL 常見模式：
//   https://www.518.com.tw/company-{id}.html
//   https://www.518.com.tw/companies/{id}/
//   https://www.518.com.tw/co/{id}/
// 搜尋頁 URL 樣本：
//   https://www.518.com.tw/job-index-search-...html
//   https://www.518.com.tw/jobs

(function () {
  const { genericLinkBasedParser, registerParser } = window.__jobguard_parserCommon;

  const parse518 = genericLinkBasedParser({
    linkSelectors: [
      'a[href*="/company-"]',
      'a[href*="/companies/"]',
      'a[href*="/co/"]',
    ],
    hostnameSuffix: '518.com.tw',
    // 不限定 pathPrefixes，因為 /company-{id}.html 格式特殊
    minIdLength: 1,
    extraValidate: (link, name) => {
      const url = new URL(link.href);
      // 518 老式 URL: /company-12345.html
      if (/^\/company-\w+\.html?$/i.test(url.pathname)) return true;
      // 較新格式: /companies/{id}/ 或 /co/{id}/
      if (/^\/(companies|co)\/[^/]{2,}/.test(url.pathname)) return true;
      return false;
    },
  });

  registerParser({
    id: '518',
    label: '518 熊班',
    hostnames: ['518.com.tw'],
    pathTest: (url) => /\/(job-index-search|jobs?|search)/i.test(url),
    parse: parse518,
  });

  window.__jobguard_parse518 = parse518;
})();
