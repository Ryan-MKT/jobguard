// ============================================
// 求職門神 - Content Script 主入口（v1.4）
// 加入 loading 狀態 + 全域進度
// ============================================

(function () {
  console.log(
    '%c🛡️ 求職門神 v0.1.0',
    'color: #fff; background: #e69138; padding: 4px 8px; border-radius: 4px; font-weight: bold;',
    location.href
  );

  if (!location.href.includes('/jobs/search/')) return;

  // ⭐ 頁面一載入就立刻顯示啟動中圖示（不用等職缺渲染）
  window.__jobguard_showProgress('🛡️ 求職門神 啟動中…');

  let attempts = 0;
  const MAX_ATTEMPTS = 30;

  const timer = setInterval(() => {
    attempts++;
    const companyLinkCount = document.querySelectorAll('a[href*="/company/"]').length;

    if (companyLinkCount >= 10) {
      clearInterval(timer);
      setTimeout(() => {
        runMatcher();
        startObserver();
      }, 800);
    } else if (attempts >= MAX_ATTEMPTS) {
      clearInterval(timer);
      console.warn('⚠️ 等了太久沒看到足夠職缺');
      window.__jobguard_showProgressDone('⚠️ 未偵測到職缺列表', { warn: true });
    }
  }, 500);

  async function runMatcher() {
    const allLinks = window.__jobguard_parse104();
    if (allLinks.length === 0) return;

    const unprocessed = allLinks.filter(
      (c) => !c.element.hasAttribute('data-jobguard-badge')
    );
    if (unprocessed.length === 0) return;

    // ⭐ 立刻注入 loading 徽章 + 顯示右上角進度
    for (const link of unprocessed) {
      window.__jobguard_injectLoadingBadge(link.element);
    }

    // 按公司名分組
    const byName = new Map();
    for (const link of unprocessed) {
      if (!byName.has(link.name)) byName.set(link.name, []);
      byName.get(link.name).push(link);
    }
    const uniqueNames = [...byName.keys()];

    window.__jobguard_showProgress(`🛡️ 分析 ${uniqueNames.length} 家公司中...`);
    console.log(
      `%c📋 ${unprocessed.length} 個職缺位置 (${uniqueNames.length} 家獨立公司)，查詢中...`,
      'color: #e69138; font-weight: bold;'
    );

    const t0 = Date.now();
    const results = await sendToSW({ type: 'findCompanies', names: uniqueNames });
    const elapsed = Date.now() - t0;

    // ⭐ 替換 loading 為實際徽章
    let injected = 0;
    const stats = { red: 0, yellow: 0, low: 0, green: 0, none: 0 };

    for (let i = 0; i < uniqueNames.length; i++) {
      const name = uniqueNames[i];
      const result = results[i];
      const occurrences = byName.get(name);

      for (const occ of occurrences) {
        window.__jobguard_replaceBadge(occ.element, {
          company: name,
          ...result,
        });
        injected++;
        stats[result.risk.level]++;
      }
    }

    console.log(
      `%c🎨 注入 ${injected} 個徽章 | 🔴${stats.red} 🟡${stats.yellow} 🟠${stats.low} 🟢${stats.green} ✅${stats.none} | ${elapsed}ms`,
      'color: #e69138; font-weight: bold;'
    );

    // ⭐ 完成提示（v3：圖示常駐，不自動消失，可點開設定）
    const warning = stats.red + stats.yellow + stats.low;
    const doneText =
      warning > 0
        ? `${warning} 家有風險（${injected} 家完成）`
        : `已分析 ${injected} 家公司`;
    window.__jobguard_showProgressDone(doneText, { warn: warning > 0 });
  }

  let observerTimer = null;
  function startObserver() {
    const observer = new MutationObserver(() => {
      clearTimeout(observerTimer);
      observerTimer = setTimeout(runMatcher, 500);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('%c👁️ 已啟動頁面變化監聽', 'color: #888;');
  }

  function sendToSW(msg) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(response);
      });
    });
  }
})();
