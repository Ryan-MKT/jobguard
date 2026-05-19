// ============================================
// 1111 人力銀行 - 公司名抓取 parser（初稿）
// ============================================
// 1111 公司頁常見 URL 模式：
//   https://www.1111.com.tw/corp/{id}/
//   https://www.1111.com.tw/company/{id}/
// 搜尋頁 URL 樣本：
//   https://www.1111.com.tw/search/job?ks=...
//   https://www.1111.com.tw/job/?...

(function () {
  const { genericLinkBasedParser, registerParser } = window.__jobguard_parserCommon;

  const parse1111 = genericLinkBasedParser({
    linkSelectors: [
      'a[href*="/corp/"]',
      'a[href*="/company/"]',
    ],
    hostnameSuffix: '1111.com.tw',
    pathPrefixes: ['/corp/', '/company/'],
    minIdLength: 2,
  });

  registerParser({
    id: '1111',
    label: '1111 人力銀行',
    hostnames: ['1111.com.tw'],
    pathTest: (url) => /\/(search\/job|job\/?)\b|jobsearch/i.test(url),
    parse: parse1111,
  });

  window.__jobguard_parse1111 = parse1111;
})();
