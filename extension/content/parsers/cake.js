// ============================================
// CakeResume / Cake - 公司名抓取 parser
// ============================================
// Cake 一張卡片裡常有多個 <a href="/companies/X">：
//   - 職缺標題（link 到公司頁）
//   - 公司名顯示（link 到公司頁）
//   - 立即應徵 / 儲存 / 查看詳情 等動作按鈕（可能也 link 到公司頁變體）
// 所以要：
//   1. 限定 path 為純 /companies/{slug}（剝掉 sub-path）
//   2. 同一張卡片內 dedup（每家公司一個 badge）
//   3. 排除動作按鈕文字
//   4. 同 slug 多候選時，優先文字像公司名（有 公司/商店/工作室 等後綴）

(function () {
  const { registerParser, isExcluded, isExcludedContainer, CITY_ONLY } = window.__jobguard_parserCommon;

  // Cake 上有大量英文公司名（Apple、Stripe…），不強制中文
  function isPlausibleCompanyText(text) {
    const t = (text || '').trim();
    if (!t || t.length < 2 || t.length > 80) return false;
    if (!/[一-鿿a-zA-Z]/.test(t)) return false;
    if (CITY_ONLY.test(t)) return false;
    return true;
  }

  const EXCLUDE_SLUGS = new Set([
    'search', 'all', 'list', 'popular', 'featured', 'new',
  ]);

  const ACTION_WORDS = new Set([
    '立即應徵', '查看詳情', '儲存', '已儲存', '申請', '投遞履歷',
    '已應徵', '查看公司', '查看更多', '收藏', '分享', '了解更多',
    '應徵職缺', '檢視', 'Apply', 'Save', 'Saved', 'View',
  ]);

  // 看起來像公司名的後綴（中英）
  const COMPANY_SUFFIX = /公司|商店|工作室|工坊|工廠|集團|事業|協會|股份|科技$|資訊$|實業$|企業$|Inc\.|Ltd\.|LLC|Co\.|Corp\.|GmbH|Studio/i;

  function looksLikeCompanyText(text) {
    return COMPANY_SUFFIX.test(text);
  }

  function parseCake() {
    const links = document.querySelectorAll('a[href*="/companies/"]');

    // 第一步：篩出純公司頁連結
    const candidates = [];
    for (const link of links) {
      if (isExcludedContainer(link)) continue;

      let url;
      try { url = new URL(link.href); } catch { continue; }
      if (!/(cake\.me|cakeresume\.com)$/i.test(url.hostname)) continue;

      // 必須是 /companies/{slug} 結尾（容許語言前綴與 trailing slash）
      const m = url.pathname.match(/^(?:\/[a-z]{2}(?:-[A-Z]{2})?)?\/companies\/([^/?#]+)\/?$/);
      if (!m) continue;

      const slug = m[1];
      if (!slug || slug.length < 2) continue;
      if (EXCLUDE_SLUGS.has(slug.toLowerCase())) continue;

      const text = (link.textContent || '').trim();
      if (!text || text.length < 2 || text.length > 100) continue;
      if (ACTION_WORDS.has(text)) continue;
      if (isExcluded(text)) continue;
      if (!isPlausibleCompanyText(text)) continue;

      candidates.push({
        link,
        slug,
        name: text,
        url: link.href,
        hasSuffix: looksLikeCompanyText(text),
      });
    }

    // 第二步：按 slug 分組
    //   - 若該 slug 有「文字含公司後綴」的候選 → 只保留這些（過濾掉職缺標題等雜訊）
    //   - 否則保留全部（英文公司名沒後綴的退路）
    // 然後按 link element 去重（防止同一個 <a> 被加多次）
    const bySlug = new Map();
    for (const c of candidates) {
      if (!bySlug.has(c.slug)) bySlug.set(c.slug, []);
      bySlug.get(c.slug).push(c);
    }

    const results = [];
    const seenLinks = new WeakSet();
    for (const [, group] of bySlug) {
      const withSuffix = group.filter((c) => c.hasSuffix);
      const finalSet = withSuffix.length > 0 ? withSuffix : group;
      for (const c of finalSet) {
        if (seenLinks.has(c.link)) continue;
        seenLinks.add(c.link);
        results.push({ name: c.name, url: c.url, element: c.link });
      }
    }

    return results;
  }

  registerParser({
    id: 'cake',
    label: 'CakeResume / Cake',
    hostnames: ['cake.me', 'cakeresume.com'],
    pathTest: (url) => /\/jobs(\b|\/|\?)|\/companies(\b|\/|\?)/i.test(url),
    parse: parseCake,
  });

  window.__jobguard_parseCake = parseCake;
})();
