// ============================================
// 求職門神 - Content Script 主入口（v1.3）
// ============================================
// v1.3 改動：polling 信號改用「公司連結數量」
//            護理師/醫師等職缺多是診所，不一定有「有限公司」字眼

(function () {
  console.log(
    '%c🛡️ 求職門神 v0.1.0',
    'color: #fff; background: #e69138; padding: 4px 8px; border-radius: 4px; font-weight: bold;',
    location.href
  );

  if (!location.href.includes('/jobs/search/')) return;

  let attempts = 0;
  const MAX_ATTEMPTS = 30;

  const timer = setInterval(() => {
    attempts++;
    // 改用「指向 /company/ 的連結數量」當信號（更可靠）
    const companyLinkCount = document.querySelectorAll('a[href*="/company/"]').length;

    if (companyLinkCount >= 10) {
      clearInterval(timer);
      console.log(`[JobGuard] 偵測到 ${companyLinkCount} 個公司連結，開始處理`);
      setTimeout(() => {
        runMatcher();
        startObserver();
      }, 800);
    } else if (attempts >= MAX_ATTEMPTS) {
      clearInterval(timer);
      console.warn(
        `[JobGuard] 等了 ${MAX_ATTEMPTS / 2} 秒只看到 ${companyLinkCount} 個公司連結，跳過本次處理`
      );
    }
  }, 500);

  // ============================================
  // 主流程
  // ============================================
  async function runMatcher() {
    const allLinks = window.__jobguard_parse104();
    if (allLinks.length === 0) return;

    const unprocessed = allLinks.filter(
      (c) => !c.element.hasAttribute('data-jobguard-badge')
    );
    if (unprocessed.length === 0) return;

    // 按名分組（同一公司多個職缺只查 1 次）
    const byName = new Map();
    for (const link of unprocessed) {
      if (!byName.has(link.name)) byName.set(link.name, []);
      byName.get(link.name).push(link);
    }
    const uniqueNames = [...byName.keys()];

    console.log(
      `%c📋 ${unprocessed.length} 個職缺位置 (${uniqueNames.length} 家獨立公司)，查詢中...`,
      'color: #e69138; font-weight: bold;'
    );

    const results = await sendToSW({ type: 'findCompanies', names: uniqueNames });

    let injected = 0;
    const stats = { red: 0, yellow: 0, low: 0, green: 0, none: 0 };

    for (let i = 0; i < uniqueNames.length; i++) {
      const name = uniqueNames[i];
      const result = results[i];
      const occurrences = byName.get(name);

      for (const occ of occurrences) {
        window.__jobguard_injectBadge(occ.element, {
          company: name,
          ...result,
        });
        injected++;
        stats[result.risk.level]++;
      }
    }

    console.log(
      `%c🎨 注入 ${injected} 個徽章 | 🔴${stats.red} 🟡${stats.yellow} 🟠${stats.low} 🟢${stats.green} ✅${stats.none}`,
      'color: #e69138; font-weight: bold;'
    );
  }

  // ============================================
  // 監聽頁面變化
  // ============================================
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
