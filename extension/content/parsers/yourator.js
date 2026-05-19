// ============================================
// Yourator - 公司名抓取 parser
// ============================================
// Yourator 把整張職缺卡片包成 <a href="/companies/{slug}/jobs/{id}">
//   - 連結 textContent 是「職務名」（不是公司名）
//   - 公司名藏在卡片內的 <img alt="公司名"> （公司 logo 的 alt 屬性）
//   - 顯示用的公司名文字是卡片內某個 <span> / <div>
//     徽章要插在那個元素之前，不能插在 <a> 之前（否則跑到卡片左上）

(function () {
  const { registerParser, isExcluded, isExcludedContainer } = window.__jobguard_parserCommon;

  const EXCLUDE_SLUGS = new Set([
    'search', 'all', 'list', 'popular', 'featured', 'new', 'remote',
  ]);

  // 在卡片 <a> 內找到「顯示公司名」的最小元素
  // 演算法：textContent 等於公司名（或以公司名開頭、後面 ≤15 字）
  //   - 優先文字最短（最內層含義）
  //   - 文字長度相同時優先 inline 標籤（span/a > p > div）
  //   - 仍同分時優先「最深」的元素（最內層 DOM 節點）
  //     避免抓到外層 flex 容器，導致徽章被擠到品牌名上方
  const INLINE_TAG_PRIORITY = { SPAN: 1, A: 2, EM: 3, STRONG: 4, B: 5, I: 6, P: 7 };

  function getDepth(el, root) {
    let d = 0;
    for (let p = el.parentElement; p && p !== root; p = p.parentElement) d++;
    return d;
  }

  function findCompanyDisplayElement(linkEl, companyName) {
    if (!companyName) return null;
    const trimmed = companyName.trim();
    const walker = document.createTreeWalker(linkEl, NodeFilter.SHOW_ELEMENT, null);
    const candidates = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.tagName === 'IMG') continue;
      const txt = (node.textContent || '').trim();
      if (!txt) continue;
      const exact = txt === trimmed;
      const prefix = txt.startsWith(trimmed) && txt.length <= trimmed.length + 15;
      if (exact || prefix) {
        candidates.push({ el: node, txtLen: txt.length });
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      if (a.txtLen !== b.txtLen) return a.txtLen - b.txtLen;
      const pa = INLINE_TAG_PRIORITY[a.el.tagName] || 99;
      const pb = INLINE_TAG_PRIORITY[b.el.tagName] || 99;
      if (pa !== pb) return pa - pb;
      // 同分 → 深的優先（深度大的排前面）
      return getDepth(b.el, linkEl) - getDepth(a.el, linkEl);
    });
    return candidates[0].el;
  }

  // 清理某個元素之前殘留的 badge（host span + data-jobguard-badge 屬性）
  function removeStaleBadge(el) {
    if (!el.hasAttribute('data-jobguard-badge')) return;
    el.removeAttribute('data-jobguard-badge');
    // badge host 是上一個 element sibling
    let prev = el.previousSibling;
    while (prev) {
      if (prev.nodeType === 1 && prev.getAttribute?.('data-jobguard-host')) {
        prev.remove();
        break;
      }
      prev = prev.previousSibling;
    }
  }

  function parseYourator() {
    const links = document.querySelectorAll('a[href*="/companies/"][href*="/jobs/"]');
    const byUrl = new Map();

    for (const link of links) {
      if (isExcludedContainer(link)) continue;

      let url;
      try { url = new URL(link.href); } catch { continue; }
      if (!url.hostname.endsWith('yourator.co')) continue;

      const m = url.pathname.match(
        /^(?:\/[a-z]{2}(?:-[A-Z]{2})?)?\/companies\/([^/]+)\/jobs\/([^/]+)/
      );
      if (!m) continue;

      const slug = m[1];
      if (EXCLUDE_SLUGS.has(slug.toLowerCase())) continue;

      const img = link.querySelector('img[alt]');
      let name = img?.alt?.trim() || '';
      if (!name) name = slug.replace(/-/g, ' ');

      if (!name || name.length < 2 || name.length > 80) continue;
      if (isExcluded(name)) continue;

      // Yourator 找不到 display element（React 還在 hydration）→ skip，等下次 MutationObserver 再試
      // 不退回到 <a>，避免 badge 卡在圖片角落
      const displayEl = findCompanyDisplayElement(link, name);
      if (!displayEl) continue;

      // 清掉前一輪可能殘留在 <a> 上的 badge
      removeStaleBadge(link);

      // 同一張卡片可能有多個 <a>（圖片連結+標題連結），但 findCompanyDisplayElement
      // 在沒有公司名文字的子樹會回 null（被上面 skip 掉）
      // 留下的 <a> 都應該指向同一個 <p>，URL 去重再保險一層
      const existing = byUrl.get(link.href);
      if (existing && existing.element === displayEl) continue;
      byUrl.set(link.href, { name, url: link.href, element: displayEl });
    }

    return [...byUrl.values()];
  }

  registerParser({
    id: 'yourator',
    label: 'Yourator',
    hostnames: ['yourator.co'],
    pathTest: (url) => /\/jobs(\b|\/|\?)/.test(url),
    parse: parseYourator,
  });

  window.__jobguard_parseYourator = parseYourator;
})();
