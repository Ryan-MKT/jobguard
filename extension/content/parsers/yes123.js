// ============================================
// yes123 求職網 - 公司名抓取 parser（初稿）
// ============================================
// yes123 是較舊的 ASP 網站，URL 結構特殊
// 公司頁 URL 常見：
//   https://www.yes123.com.tw/admin/company_info.asp?company_no=...
//   https://www.yes123.com.tw/wk_index/company_search.asp?...
// 搜尋頁 URL 樣本：
//   https://www.yes123.com.tw/admin/job_refer_list.asp?...
//   https://www.yes123.com.tw/wk_index/job_refer_list.asp?...

(function () {
  const { genericLinkBasedParser, registerParser } = window.__jobguard_parserCommon;

  const parseYes123 = genericLinkBasedParser({
    linkSelectors: [
      'a[href*="comp_info.asp"]',       // ← yes123 實際檔名（短）
      'a[href*="company_info.asp"]',    // ← 後備：長版本以防部分頁面用
      'a[href*="company_no="]',
      'a[href*="comp_no="]',
    ],
    hostnameSuffix: 'yes123.com.tw',
    minIdLength: 0,
    extraValidate: (link, name) => {
      const url = new URL(link.href);
      return (
        url.searchParams.has('company_no') ||
        url.searchParams.has('comp_no') ||
        /comp(any)?_info\.asp/i.test(url.pathname)
      );
    },
  });

  registerParser({
    id: 'yes123',
    label: 'yes123 求職網',
    hostnames: ['yes123.com.tw'],
    pathTest: (url) => /job_refer_list\.asp|job_search\.asp|joblist/i.test(url),
    parse: parseYes123,
  });

  window.__jobguard_parseYes123 = parseYes123;
})();
