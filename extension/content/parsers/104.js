// ============================================
// 104 人力銀行 - 公司名抓取 parser
// ============================================

(function () {
  const { genericLinkBasedParser, registerParser, looksLikeCompanyName, isExcluded, isExcludedContainer, PATH_NON_COMPANY } = window.__jobguard_parserCommon;

  // 104 的公司頁 id 至少 2 個字（避免 /company/ 這種短路徑）
  const parse104 = genericLinkBasedParser({
    linkSelectors: ['a[href*="/company/"]'],
    hostnameSuffix: '104.com.tw',
    pathPrefixes: ['/company/'],
    minIdLength: 2,
  });

  registerParser({
    id: '104',
    label: '104 人力銀行',
    hostnames: ['104.com.tw'],
    pathTest: (url) => url.includes('/jobs/search/'),
    parse: parse104,
  });

  // 保留舊 API（避免有其他地方還在叫）
  window.__jobguard_parse104 = parse104;
})();
