// ============================================
// 求職門神 - Content Script 主入口（v1.6）
// 多站台 parser registry + 啟動模式設定
// ============================================

(function () {
  console.log(
    '%c🛡️ 求職門神 v1.0.2',
    'color: #fff; background: #e69138; padding: 4px 8px; border-radius: 4px; font-weight: bold;',
    location.href
  );

  const common = window.__jobguard_parserCommon;
  if (!common) {
    console.error('[JobGuard] parser common module 未載入');
    return;
  }

  const activeParser = common.findParser();
  if (!activeParser) {
    // 不是支援的網站搜尋頁，靜默退出
    return;
  }

  console.log(
    `%c[JobGuard] 偵測到 ${activeParser.label}（${activeParser.id}）`,
    'color: #e69138; font-weight: bold;'
  );

  let hasStarted = false;

  // 暴露給設定面板「⚡ 立刻分析此頁面」按鈕、popup 等使用
  window.__jobguard_runScan = function (opts = {}) {
    if (opts.force) hasStarted = false;
    startScan();
  };

  // 監聽設定變化：手動 → 自動且尚未掃描時，立刻啟動
  const settings = window.__jobguard_settings;
  if (settings) {
    settings.onChange((next) => {
      if (next.scanMode === 'auto' && !hasStarted) {
        window.__jobguard_hideManualTrigger?.();
        startScan();
      }
    });

    settings.load().then(({ scanMode }) => {
      if (scanMode === 'manual') {
        console.log('%c[JobGuard] 手動模式 — 等待使用者點擊', 'color: #e69138;');
        window.__jobguard_showManualTrigger(() => startScan());
      } else {
        startScan();
      }
    });
  } else {
    console.warn('[JobGuard] settings 模組未載入，使用預設自動模式');
    startScan();
  }

  function startScan() {
    if (hasStarted) {
      console.log('[JobGuard] 已啟動過，略過');
      return;
    }
    hasStarted = true;
    window.__jobguard_hideManualTrigger?.();
    window.__jobguard_showProgress('🛡️ 求職門神 啟動中…');

    let attempts = 0;
    const MAX_ATTEMPTS = 30;

    const timer = setInterval(() => {
      attempts++;
      // 第一次嘗試用 parser 抓——只要抓得到資料就開始
      const preview = activeParser.parse();

      if (preview.length >= 3 || (attempts >= 10 && preview.length >= 1)) {
        clearInterval(timer);
        setTimeout(() => {
          runMatcher();
          startObserver();
        }, 800);
      } else if (attempts >= MAX_ATTEMPTS) {
        clearInterval(timer);
        console.warn(`⚠️ [${activeParser.id}] 等了太久沒抓到公司連結（最終 ${preview.length} 個）`);
        window.__jobguard_showProgressDone('⚠️ 未偵測到職缺列表', { warn: true });
      }
    }, 500);
  }

  async function runMatcher() {
    const allLinks = activeParser.parse();
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
      `%c📋 [${activeParser.id}] ${unprocessed.length} 個職缺位置 (${uniqueNames.length} 家獨立公司)，查詢中...`,
      'color: #e69138; font-weight: bold;'
    );

    // ⭐ 法人全名增益（若 parser 支援）：拿法人全名 + 縣市，讓 matcher 做高信心比對
    //    失敗則送空陣列 → matcher 自動 fallback 回品牌名，不會比原本差
    let legals = [];
    let cities = [];
    if (typeof activeParser.enrich === 'function' && typeof activeParser.extractHashId === 'function') {
      try {
        const repHash = uniqueNames.map((name) => activeParser.extractHashId(byName.get(name)[0].url));
        const legalMap = await activeParser.enrich(repHash);
        legals = repHash.map((h) => (h && legalMap.get(h) ? legalMap.get(h).legal : undefined));
        cities = repHash.map((h) => (h && legalMap.get(h) ? legalMap.get(h).city : undefined));
        const enriched = legals.filter(Boolean).length;
        console.log(`%c🏷️ [${activeParser.id}] 取得 ${enriched}/${uniqueNames.length} 家法人全名`, 'color: #6aa84f;');
      } catch (e) {
        console.warn('[JobGuard] 法人名增益失敗，改用品牌名比對:', e?.message || e);
      }
    }

    const t0 = Date.now();
    const results = await sendToSW({ type: 'findCompanies', names: uniqueNames, legals, cities });
    const elapsed = Date.now() - t0;

    // ⭐ 替換 loading 為實際徽章
    let injected = 0;
    const stats = { red: 0, yellow: 0, green: 0 };

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
        if (stats[result.risk.level] !== undefined) stats[result.risk.level]++;
      }
    }

    console.log(
      `%c🎨 [${activeParser.id}] 注入 ${injected} 個徽章 | 🔴${stats.red} 🟡${stats.yellow} 🟢${stats.green} | ${elapsed}ms`,
      'color: #e69138; font-weight: bold;'
    );

    // ⭐ 完成提示（v3：圖示常駐，不自動消失，可點開設定）
    const warning = stats.red + stats.yellow;
    const doneText =
      warning > 0
        ? `${stats.red} 家有裁罰、${stats.yellow} 家有新聞（${injected} 家完成）`
        : `已分析 ${injected} 家公司，皆無風險`;
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
