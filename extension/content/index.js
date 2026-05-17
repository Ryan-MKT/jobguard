// ============================================
// 求職門神 - Content Script 主入口（正式版 v1.0）
// ============================================

(function () {
  console.log(
    '%c🛡️ 求職門神 v0.1.0',
    'color: #fff; background: #e69138; padding: 4px 8px; border-radius: 4px; font-weight: bold;',
    location.href
  );

  if (!location.href.includes('/jobs/search/')) return;

  // 等到頁面上「有限公司」出現超過 10 次再開始
  let attempts = 0;
  const MAX_ATTEMPTS = 20;

  const timer = setInterval(() => {
    attempts++;
    const count = (document.body?.textContent?.match(/有限公司/g) || []).length;

    if (count >= 10) {
      clearInterval(timer);
      // 再多等 1 秒確保最後幾張卡片載完
      setTimeout(runParser, 1000);
    } else if (attempts >= MAX_ATTEMPTS) {
      clearInterval(timer);
      console.warn('⚠️ 等了太久沒看到足夠職缺');
    }
  }, 500);

  function runParser() {
    const companies = window.__jobguard_parse104();
    console.log(
      `%c✅ 抓到 ${companies.length} 家公司`,
      'color: green; font-weight: bold; font-size: 14px;'
    );
    // 只印 name 跟 url 兩欄
    console.table(companies.map(c => ({ name: c.name, url: c.url })));
  }
})();
