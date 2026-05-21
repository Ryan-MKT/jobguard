// ============================================
// 104 人力銀行 - 公司名抓取 parser
// ============================================

(function () {
  const { genericLinkBasedParser, registerParser } = window.__jobguard_parserCommon;

  // 104 的公司頁 id 至少 2 個字（避免 /company/ 這種短路徑）
  const parse104 = genericLinkBasedParser({
    linkSelectors: ['a[href*="/company/"]'],
    hostnameSuffix: '104.com.tw',
    pathPrefixes: ['/company/'],
    minIdLength: 2,
  });

  // ============================================
  // 法人全名增益：104 jobs 搜尋 API 的 custName = 「品牌名_法人全名」
  // 用它取得法人全名 → matcher 做高信心 exact 比對（公司名全國唯一）
  // 同源 fetch、一頁一次、結果快取，避免逐家請求
  // ============================================
  const PAGESIZE = 40;
  const MAX_PAGES = 8;
  const _legalMap = new Map(); // hashId → { legal, city }
  let _pagesFetched = 0;

  function extractHashId(href) {
    const m = String(href || '').match(/\/company\/([A-Za-z0-9]+)/);
    return m ? m[1] : null;
  }

  // 從 custName「品牌_法人全名」挑出最像法人全名的一段
  function pickLegalName(custName) {
    const parts = String(custName || '').split('_').map((s) => s.trim()).filter(Boolean);
    if (parts.length <= 1) return parts[0] || '';
    const legalish = parts.filter(
      (p) => /[一-鿿]/.test(p) && /(有限公司|股份|企業社|商行|工作室|診所|事務所|餐廳|社$|行$|號$)/.test(p)
    );
    if (legalish.length) return legalish[legalish.length - 1];
    const zh = parts.filter((p) => /[一-鿿]/.test(p));
    return (zh.length ? zh[zh.length - 1] : parts[parts.length - 1]) || '';
  }

  async function fetchApiPage(page) {
    const params = new URLSearchParams(location.search);
    params.set('mode', 's');
    params.set('pagesize', String(PAGESIZE));
    params.set('page', String(page));
    if (!params.has('ro')) params.set('ro', '0');
    if (!params.has('jobsource')) params.set('jobsource', 'joblist_search');
    const url = `${location.origin}/jobs/search/api/jobs?${params.toString()}`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      if (!res.ok) return null;
      const j = await res.json();
      return Array.isArray(j?.data) ? j.data : [];
    } catch {
      return null;
    }
  }

  // neededHashIds：本輪要查的公司 hashId；會增量抓頁直到都拿到或到上限
  async function enrich104(neededHashIds = []) {
    const need = new Set(neededHashIds.filter((h) => h && !_legalMap.has(h)));
    while (need.size > 0 && _pagesFetched < MAX_PAGES) {
      const data = await fetchApiPage(_pagesFetched + 1);
      _pagesFetched += 1;
      if (!data || data.length === 0) break;
      for (const job of data) {
        const hashId = extractHashId(job?.link?.cust);
        if (!hashId || _legalMap.has(hashId)) continue;
        const cityM = String(job.jobAddrNoDesc || '').match(/^(.{1,2}[市縣])/);
        _legalMap.set(hashId, {
          legal: pickLegalName(job.custName),
          city: cityM ? cityM[1] : undefined,
        });
        need.delete(hashId);
      }
      if (data.length < PAGESIZE) break;
    }
    return _legalMap;
  }

  registerParser({
    id: '104',
    label: '104 人力銀行',
    hostnames: ['104.com.tw'],
    pathTest: (url) => url.includes('/jobs/search/'),
    parse: parse104,
    enrich: enrich104,
    extractHashId,
  });

  // 保留舊 API（避免有其他地方還在叫）
  window.__jobguard_parse104 = parse104;
})();
