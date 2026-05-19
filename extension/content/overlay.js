// ============================================
// 浮層 UI v2.1 — 含 loading 狀態
// ============================================

(function () {
  const BADGE_ATTR = 'data-jobguard-badge';
  const HOST_ATTR = 'data-jobguard-host';

  // ============================================
  // 徽章 CSS
  // ============================================
  const BADGE_CSS = `
    :host {
      display: inline-block;
      vertical-align: middle;
      margin-right: 6px;
      font-family: -apple-system, BlinkMacSystemFont, "Microsoft JhengHei",
                   "PingFang TC", sans-serif;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 3px 9px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      line-height: 16px;
      color: #fff;
      background: var(--risk-color);
      cursor: pointer;
      user-select: none;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
      transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
      border: none;
      font-family: inherit;
    }
    .badge:hover {
      transform: translateY(-1px);
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.28);
      filter: brightness(1.08);
    }
    .badge:active {
      transform: translateY(0);
      filter: brightness(0.95);
    }
    .badge.loading {
      cursor: default;
      animation: gentle-pulse 1.5s ease-in-out infinite;
    }
    .badge.loading:hover {
      transform: none;
    }
    @keyframes gentle-pulse {
      0%, 100% { opacity: 0.85; }
      50% { opacity: 1; }
    }
    .dot {
      display: inline-block;
      animation: dot-blink 1.4s infinite;
    }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dot-blink {
      0%, 80%, 100% { opacity: 0.3; }
      40% { opacity: 1; }
    }
  `;

  // ============================================
  // 右上角常駐圖示 CSS（v3：可點擊、不自動消失）
  // ============================================
  const PROGRESS_CSS = `
    :host {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483646;
      font-family: -apple-system, BlinkMacSystemFont, "Microsoft JhengHei",
                   "PingFang TC", sans-serif;
    }
    .indicator {
      background: linear-gradient(135deg, #e69138, #e0791e);
      color: white;
      padding: 10px 16px;
      border-radius: 24px;
      box-shadow: 0 6px 20px rgba(230, 145, 56, 0.4);
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: slideIn 0.3s ease;
      cursor: pointer;
      user-select: none;
      transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
      border: none;
      font-family: inherit;
    }
    .indicator:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 24px rgba(230, 145, 56, 0.55);
      filter: brightness(1.05);
    }
    .indicator:active {
      transform: translateY(0);
      filter: brightness(0.95);
    }
    .indicator.done {
      background: linear-gradient(135deg, #4caf50, #43a047);
      box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
    }
    .indicator.done:hover {
      box-shadow: 0 8px 24px rgba(76, 175, 80, 0.55);
    }
    .indicator.warn {
      background: linear-gradient(135deg, #f57c00, #e65100);
      box-shadow: 0 6px 20px rgba(245, 124, 0, 0.4);
    }
    .indicator.warn:hover {
      box-shadow: 0 8px 24px rgba(245, 124, 0, 0.55);
    }
    @keyframes slideIn {
      from { transform: translateX(120%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .check {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      background: white;
      color: #4caf50;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 900;
    }
    .indicator.warn .check {
      color: #e65100;
    }
    .gear {
      margin-left: 4px;
      opacity: 0.7;
      font-size: 12px;
      transition: transform 0.3s ease, opacity 0.15s ease;
    }
    .indicator:hover .gear {
      opacity: 1;
      transform: rotate(45deg);
    }
  `;

  // ============================================
  // 設定面板 CSS
  // ============================================
  const SETTINGS_CSS = `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, "Microsoft JhengHei",
                   "PingFang TC", sans-serif;
    }
    .backdrop {
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      animation: fadeIn 0.18s ease;
    }
    @keyframes fadeIn { from {opacity:0} to {opacity:1} }
    .card {
      background: #fff;
      max-width: 520px; width: 100%;
      max-height: 86vh; overflow-y: auto;
      border-radius: 16px;
      box-shadow: 0 30px 80px rgba(0,0,0,0.4);
      color: #1a1a1a;
      animation: slideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      border-top: 6px solid #e69138;
    }
    @keyframes slideUp {
      from {transform: translateY(24px); opacity:0}
      to {transform: translateY(0); opacity:1}
    }
    .head { padding: 22px 24px 12px; display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .title { margin:0; font-size:20px; color:#e69138; font-weight:700; line-height:1.2; }
    .subtitle { margin:6px 0 0; font-size:13px; color:#666; }
    .close { background:transparent; border:0; font-size:26px; cursor:pointer; color:#bbb; line-height:1; padding:0; width:32px; height:32px; border-radius:8px; transition:all 0.15s; flex-shrink:0; }
    .close:hover { background:#f0f0f0; color:#333; }
    .section { padding: 0 24px 16px; }
    .section h3 { margin:14px 0 8px; font-size:12px; color:#888; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
    .option-row {
      display:flex; justify-content:space-between; align-items:center;
      padding:12px 14px; border-radius:10px; margin-bottom:6px;
      background:#fafafa; border:1px solid #eee;
      opacity:0.55; cursor:not-allowed;
    }
    .option-row.disabled-label {
      font-size:10px; color:#aaa; background:#f0f0f0; padding:1px 6px; border-radius:8px; font-weight:600;
    }
    .option-text { font-size:14px; color:#333; }
    .option-desc { font-size:11px; color:#888; margin-top:2px; }
    .badge-soon {
      font-size:10px; background:#ffe0b2; color:#bf6a00; padding:2px 8px; border-radius:10px; font-weight:600;
    }
    .badge-on {
      font-size:10px; background:#e0f5e0; color:#2e7d32; padding:2px 8px; border-radius:10px; font-weight:600;
    }
    .option-row.active {
      opacity:1; cursor:default;
      background:#f7fdf7; border-color:#d4ecd4;
    }
    .law-tag {
      display:inline-block;
      font-size:10px;
      padding:2px 8px;
      background:#fff;
      border:1px solid #d4ecd4;
      border-radius:8px;
      color:#444;
      font-weight:500;
    }
    .status-box {
      background:linear-gradient(135deg, #fff8ee, #fff4e5);
      padding:14px 16px; border-radius:10px;
      border:1px solid #ffe0b2; font-size:13px; color:#5a3a00;
    }
    .footer { padding:14px 24px 22px; border-top:1px solid #f0f0f0; }
    .footer p { margin:0; font-size:11px; color:#999; line-height:1.6; }
  `;

  // ============================================
  // 視窗 CSS (繼承 v2.0)
  // ============================================
  const MODAL_CSS = `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, "Microsoft JhengHei",
                   "PingFang TC", sans-serif;
    }
    .backdrop {
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      animation: fadeIn 0.18s ease;
    }
    @keyframes fadeIn { from {opacity:0} to {opacity:1} }
    .card {
      background: #fff;
      max-width: 560px; width: 100%;
      max-height: 86vh; overflow-y: auto;
      border-radius: 16px;
      box-shadow: 0 30px 80px rgba(0,0,0,0.4);
      color: #1a1a1a;
      animation: slideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      border-top: 6px solid var(--risk-color);
    }
    @keyframes slideUp {
      from {transform: translateY(24px); opacity:0}
      to {transform: translateY(0); opacity:1}
    }
    .head { padding: 22px 24px 16px; display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .title { margin:0; font-size:22px; color:var(--risk-color); font-weight:700; line-height:1.2; }
    .company { margin:6px 0 0; font-size:15px; color:#333; font-weight:600; }
    .meta { margin:4px 0 0; font-size:12px; color:#888; }
    .close { background:transparent; border:0; font-size:26px; cursor:pointer; color:#bbb; line-height:1; padding:0; width:32px; height:32px; border-radius:8px; transition:all 0.15s; flex-shrink:0; }
    .close:hover { background:#f0f0f0; color:#333; }
    .section { padding: 0 24px 14px; }
    .section h3 { margin:8px 0; font-size:13px; color:#888; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
    .violation-box { background:linear-gradient(135deg, #fef3f3, #fff5f5); padding:14px 16px; border-radius:10px; border:1px solid #fde0e0; }
    .violation-count { font-weight:700; font-size:18px; color:#d32f2f; }
    .violation-detail { margin-top:4px; color:#555; font-size:14px; }
    .violation-meta { margin-top:6px; font-size:11px; color:#888; }
    .law-chips { margin-top:10px; display:flex; flex-wrap:wrap; gap:6px; }
    .law-chip { display:inline-flex; align-items:center; gap:3px; padding:3px 9px; background:#fff; border:1px solid #f0d0d0; border-radius:11px; font-size:11px; color:#555; font-weight:500; }
    .violation-list { margin-top:14px; padding-top:12px; border-top:1px dashed #fde0e0; }
    .violation-list h4 { margin:0 0 8px; font-size:11px; color:#a04848; font-weight:700; letter-spacing:0.3px; }
    .violation-item { background:#fff; border:1px solid #f3dada; border-radius:8px; padding:9px 12px; margin-bottom:6px; font-size:12px; line-height:1.55; }
    .violation-item-head { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px; font-size:11px; }
    .violation-item-head .vdate { font-weight:600; color:#666; }
    .violation-item-head .vlaw { background:#fde0e0; color:#a04848; padding:1px 8px; border-radius:8px; font-weight:600; font-size:10px; flex-shrink:0; }
    .violation-item-content { color:#333; word-break:break-word; }
    .violation-item-fine { margin-top:5px; font-size:11px; color:#888; }
    .violation-item-fine.has-amount { color:#d32f2f; font-weight:600; }
    .violation-item-docno {
      margin-top:5px; padding-top:5px;
      border-top:1px dashed #f3dada;
      font-size:10px; color:#999;
      font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
      word-break: break-all;
      letter-spacing:0.2px;
    }
    .violation-item-docno .docno-label { color:#a04848; font-weight:600; margin-right:4px; font-family:inherit; }
    .violation-more { margin-top:8px; }
    .violation-more summary { cursor:pointer; padding:8px 12px; background:#fff; border:1px dashed #f3dada; border-radius:8px; font-size:11px; color:#888; user-select:none; text-align:center; list-style:none; }
    .violation-more summary::-webkit-details-marker { display:none; }
    .violation-more summary:hover { background:#fff5f5; border-color:#e6c8c8; color:#666; }
    .violation-more[open] summary { margin-bottom:8px; }
    .official-link { display:inline-block; margin-top:10px; padding-top:8px; border-top:1px dashed #fde0e0; font-size:11px; color:#888; text-decoration:none; }
    .official-link:hover { color:#555; text-decoration:underline; }
    .news-item { display:block; padding:12px 14px; margin-bottom:8px; border:1px solid #eee; border-radius:10px; color:#222; text-decoration:none; transition:all 0.15s; }
    .news-item:hover { border-color:#e69138; background:#fffbf5; transform:translateX(2px); }
    .news-title { font-size:13px; line-height:1.45; color:#1a1a1a; }
    .news-date { font-size:11px; color:#888; margin-top:4px; }
    .footer { padding:14px 24px 22px; border-top:1px solid #f0f0f0; margin-top:8px; }
    .footer p { margin:0; font-size:11px; color:#999; line-height:1.6; }
    .footer a { color:#888; text-decoration:underline; }
  `;

  // ============================================
  // 注入 LOADING 徽章（占位）
  // ============================================
  function injectLoadingBadge(linkElement) {
    if (linkElement.hasAttribute(BADGE_ATTR)) return;
    linkElement.setAttribute(BADGE_ATTR, 'loading');

    const host = document.createElement('span');
    host.setAttribute(HOST_ATTR, 'loading');
    host.style.cssText = `--risk-color: #aaa;`;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${BADGE_CSS}</style>
      <span class="badge loading">⏳ 分析中<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>
    `;

    linkElement.parentNode.insertBefore(host, linkElement);
  }

  // ============================================
  // 替換 LOADING 徽章為正式徽章
  // ============================================
  function replaceBadge(linkElement, result) {
    // 找到並移除前面的 loading host
    let prev = linkElement.previousSibling;
    while (prev) {
      if (prev.nodeType === 1 && prev.getAttribute?.(HOST_ATTR)) {
        prev.remove();
        break;
      }
      prev = prev.previousSibling;
    }
    linkElement.removeAttribute(BADGE_ATTR);
    injectBadge(linkElement, result);
  }

  // ============================================
  // 注入正式徽章
  // ============================================
  function injectBadge(linkElement, result) {
    if (linkElement.hasAttribute(BADGE_ATTR) && linkElement.getAttribute(BADGE_ATTR) !== 'loading') return;
    linkElement.setAttribute(BADGE_ATTR, 'true');

    const host = document.createElement('span');
    host.setAttribute(HOST_ATTR, 'final');
    host.style.cssText = `--risk-color: ${result.risk.color};`;
    const shadow = host.attachShadow({ mode: 'open' });

    const emoji = result.risk.label.split(' ')[0];
    let txt = emoji;
    if (result.match) txt += ' ' + result.match.count;
    if (result.news?.count > 0) txt += ' · 📰' + result.news.count;

    shadow.innerHTML = `
      <style>${BADGE_CSS}</style>
      <button class="badge" type="button" title="點擊看完整資訊">${escapeHtml(txt)}</button>
    `;

    shadow.querySelector('.badge').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showDetailModal(result);
    });

    linkElement.parentNode.insertBefore(host, linkElement);
  }

  // ============================================
  // 右上角常駐圖示（v3：可點擊、不自動消失）
  // ============================================
  // 最後一次完成狀態的摘要，給設定面板顯示用
  let lastDoneSummary = null;

  function ensureProgressHost() {
    let host = document.getElementById('jobguard-progress');
    if (host) return host;

    host = document.createElement('div');
    host.id = 'jobguard-progress';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${PROGRESS_CSS}</style>
      <button class="indicator" type="button" title="點擊開啟設定">
        <div class="spinner"></div>
        <span class="text"></span>
        <span class="gear">⚙</span>
      </button>
    `;

    // 整個指示器都可點開設定面板
    shadow.querySelector('.indicator').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showSettingsPanel();
    });

    return host;
  }

  function showProgress(text) {
    const host = ensureProgressHost();
    const shadow = host.shadowRoot;
    const indicator = shadow.querySelector('.indicator');
    indicator.classList.remove('done', 'warn');
    // 確保 spinner 存在（done 狀態會用 check 取代）
    if (!shadow.querySelector('.spinner')) {
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      indicator.insertBefore(spinner, shadow.querySelector('.text'));
    }
    shadow.querySelector('.check')?.remove();
    shadow.querySelector('.text').textContent = text;
  }

  function showProgressDone(text, opts = {}) {
    const host = ensureProgressHost();
    const shadow = host.shadowRoot;
    const indicator = shadow.querySelector('.indicator');
    const warn = !!opts.warn;
    indicator.classList.remove('warn', 'done');
    indicator.classList.add(warn ? 'warn' : 'done');

    // spinner → check
    shadow.querySelector('.spinner')?.remove();
    let check = shadow.querySelector('.check');
    if (!check) {
      check = document.createElement('span');
      check.className = 'check';
      check.textContent = warn ? '!' : '✓';
      indicator.insertBefore(check, shadow.querySelector('.text'));
    } else {
      check.textContent = warn ? '!' : '✓';
    }
    shadow.querySelector('.text').textContent = text;

    lastDoneSummary = { text, warn, at: Date.now() };
    // 注意：v3 起完成後不再自動隱藏，圖示常駐
  }

  // 保留 API（外部目前沒呼叫，但保留供未來「關閉圖示」用）
  function hideProgress() {
    document.getElementById('jobguard-progress')?.remove();
  }

  // ============================================
  // 設定面板（v2：顯示實際資料源 metadata）
  // ============================================
  function showSettingsPanel() {
    document.getElementById('jobguard-settings')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'jobguard-settings';
    document.body.appendChild(overlay);

    const shadow = overlay.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${SETTINGS_CSS}</style>${renderSettingsHTML()}`;

    const backdrop = shadow.querySelector('.backdrop');
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) overlay.remove();
    });
    shadow.querySelector('.close').addEventListener('click', () => overlay.remove());
    const onKey = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);

    // 非同步抓 metadata，拿到後 patch 到面板
    chrome.runtime.sendMessage({ type: 'getMeta' }, (meta) => {
      if (chrome.runtime.lastError || !meta || meta.error) return;
      const updatedEl = shadow.querySelector('[data-meta-updated]');
      const scaleEl = shadow.querySelector('[data-meta-scale]');
      const syncEl = shadow.querySelector('[data-meta-sync]');
      const rangeEl = shadow.querySelector('[data-meta-range]');
      if (updatedEl && meta.dataUpdatedAt) {
        updatedEl.textContent = meta.dataUpdatedAt.slice(0, 10);
      }
      if (scaleEl && meta.companyCount) {
        scaleEl.textContent = meta.companyCount.toLocaleString() + ' 家公司';
      }
      if (syncEl && meta.lastSyncAt) {
        syncEl.textContent = meta.lastSyncAt.slice(0, 10) + ' ' + meta.lastSyncAt.slice(11, 16);
      }
      if (rangeEl && meta.dateRange?.earliest && meta.dateRange?.latest) {
        rangeEl.textContent = meta.dateRange.earliest + ' ~ ' + meta.dateRange.latest;
      }
    });
  }

  function renderSettingsHTML() {
    const statusLine = lastDoneSummary
      ? (lastDoneSummary.warn ? '⚠️ ' : '✅ ') + escapeHtml(lastDoneSummary.text)
      : '🔄 仍在分析中…';

    return `
      <div class="backdrop">
        <div class="card">
          <div class="head">
            <div>
              <h2 class="title">⚙️ 求職門神 設定</h2>
              <p class="subtitle">目前狀態：${statusLine}</p>
            </div>
            <button class="close" title="關閉">×</button>
          </div>

          <div class="section">
            <h3>呈現偏好 <span class="badge-soon">即將推出</span></h3>
            <div class="option-row">
              <div>
                <div class="option-text">只顯示有風險的公司</div>
                <div class="option-desc">隱藏無違規、無新聞的綠燈徽章</div>
              </div>
              <span class="badge-soon">SOON</span>
            </div>
            <div class="option-row">
              <div>
                <div class="option-text">職缺列表自動標示風險顏色</div>
                <div class="option-desc">把高風險職缺整列染色，更醒目</div>
              </div>
              <span class="badge-soon">SOON</span>
            </div>
          </div>

          <div class="section">
            <h3>目前使用的資料來源</h3>

            <div class="option-row active" style="flex-direction:column;align-items:stretch;gap:8px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
                <div>
                  <div class="option-text">勞動部違反勞動法令事業單位</div>
                  <div class="option-desc">announcement.mol.gov.tw（全國彙整）</div>
                </div>
                <span class="badge-on">已啟用</span>
              </div>
              <div style="font-size:11px;color:#555;line-height:1.6;padding-top:4px;border-top:1px dashed #d4ecd4;">
                <div style="margin-bottom:4px;"><strong>涵蓋 9 種法令：</strong></div>
                <div style="display:flex;flex-wrap:wrap;gap:4px;">
                  <span class="law-tag">⚖️ 勞動基準法</span>
                  <span class="law-tag">🛠️ 職業安全衛生法</span>
                  <span class="law-tag">⚧️ 性別平等工作法</span>
                  <span class="law-tag">💰 勞工退休金條例</span>
                  <span class="law-tag">💵 最低工資法</span>
                  <span class="law-tag">📋 就業服務法</span>
                  <span class="law-tag">👴 中高齡就業促進法</span>
                  <span class="law-tag">🩹 職災保險法</span>
                </div>
                <div style="margin-top:8px;color:#666;">
                  全國 26 個地區 · <span data-meta-scale>載入中…</span><br>
                  涵蓋期間：<span data-meta-range>2020 年起</span><br>
                  資料更新：<span data-meta-updated>—</span> · 上次同步：<span data-meta-sync>—</span><br>
                  自動同步頻率：每 7 天
                </div>
              </div>
            </div>

            <div class="option-row active" style="flex-direction:column;align-items:stretch;gap:6px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
                <div>
                  <div class="option-text">Google News 即時新聞</div>
                  <div class="option-desc">最近 10 年公司勞資相關新聞（依日期倒序，含 59 個過濾關鍵字）</div>
                </div>
                <span class="badge-on">已啟用</span>
              </div>
            </div>

            <div style="font-size:11px;color:#888;margin-top:8px;line-height:1.5;">
              未來會開放個別關閉、加入司法院判決書（勞資訴訟）等更多資料源。
            </div>
          </div>

          <div class="section">
            <h3>關於</h3>
            <div class="status-box">
              求職門神 v0.1.0 — 客製化選項規劃中。<br>
              點擊右上角圖示可隨時開啟此面板。
            </div>
          </div>

          <div class="footer">
            <p>
              資料來源：勞動部違反勞動法令事業單位查詢系統 + Google News<br>
              本擴充功能完全在本機運作，不收集任何個人資料。
            </p>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================
  // 詳細視窗
  // ============================================
  function showDetailModal(result) {
    document.getElementById('jobguard-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'jobguard-modal';
    overlay.style.cssText = `--risk-color: ${result.risk.color};`;
    document.body.appendChild(overlay);

    const shadow = overlay.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${MODAL_CSS}</style>${renderModalHTML(result)}`;

    const backdrop = shadow.querySelector('.backdrop');
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) overlay.remove();
    });
    shadow.querySelector('.close').addEventListener('click', () => overlay.remove());
    const onKey = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
  }

  function renderModalHTML(result) {
    const { match, risk, news, company } = result;
    let html = `
      <div class="backdrop">
        <div class="card">
          <div class="head">
            <div>
              <h2 class="title">${escapeHtml(risk.label)}</h2>
              <p class="company">${escapeHtml(company)}</p>
              <p class="meta">風險分數 ${risk.score}/${risk.max}：${escapeHtml(risk.reasons.join('、'))}</p>
            </div>
            <button class="close" title="關閉">×</button>
          </div>
    `;

    if (match) {
      const lawIcons = {
        '勞動基準法':'⚖️','性別平等工作法':'⚧️','職業安全衛生法':'🛠️',
        '勞工退休金條例':'💰','最低工資法':'💵','就業服務法':'📋',
        '中高齡者及高齡者就業促進法':'👴','勞工職業災害保險及保護法':'🩹',
        '其他':'📋',
      };
      let lawChips = '';
      if (match.byLawType) {
        for (const [law, count] of Object.entries(match.byLawType)) {
          lawChips += `<span class="law-chip">${lawIcons[law]||'📋'} ${escapeHtml(law)} ${count}</span>`;
        }
      }

      // 違規明細列表（資料已依日期倒序）
      const violations = Array.isArray(match.violations) ? match.violations : [];
      const VISIBLE = 5;
      const renderItem = (v) => {
        const date = escapeHtml(v.date || '—');
        const city = escapeHtml(v.city || '—');
        const lawType = escapeHtml(v.lawType || '—');
        // 多項違規用全形分號分隔比較好讀
        const content = escapeHtml(v.content || '（無詳細描述）').replace(/;/g, '；');
        const amount = Number(v.amount) || 0;
        const fineHtml = amount > 0
          ? `<div class="violation-item-fine has-amount">罰款 NT$ ${amount.toLocaleString()}</div>`
          : `<div class="violation-item-fine">限期改善（罰款 0 元）</div>`;
        const docnoHtml = v.docno
          ? `<div class="violation-item-docno"><span class="docno-label">處分字號</span>${escapeHtml(v.docno)}</div>`
          : '';
        return `
          <div class="violation-item">
            <div class="violation-item-head">
              <span class="vdate">${date} · ${city}</span>
              <span class="vlaw">${lawType}</span>
            </div>
            <div class="violation-item-content">${content}</div>
            ${fineHtml}
            ${docnoHtml}
          </div>
        `;
      };
      const visibleHtml = violations.slice(0, VISIBLE).map(renderItem).join('');
      const hiddenHtml = violations.slice(VISIBLE).map(renderItem).join('');
      const restCount = Math.max(0, violations.length - VISIBLE);

      const listHtml = violations.length === 0 ? '' : `
        <div class="violation-list">
          <h4>📋 違規明細（最近 ${Math.min(VISIBLE, violations.length)} 筆，依日期倒序）</h4>
          ${visibleHtml}
          ${restCount > 0 ? `
            <details class="violation-more">
              <summary>展開其餘 ${restCount} 筆 ▾</summary>
              ${hiddenHtml}
            </details>
          ` : ''}
          <a class="official-link" href="https://announcement.mol.gov.tw/" target="_blank" rel="noopener noreferrer">
            → 到勞動部查詢系統驗證
          </a>
        </div>
      `;

      html += `
        <div class="section">
          <h3>⚖️ 政府裁罰紀錄</h3>
          <div class="violation-box">
            <div class="violation-count">${match.count} 次違規</div>
            <div class="violation-detail">累計罰款 NT$ ${match.totalFine.toLocaleString()}</div>
            <div class="violation-meta">最近違規日：${escapeHtml(match.latestDate)}</div>
            ${lawChips ? `<div class="law-chips">${lawChips}</div>` : ''}
            <div class="violation-meta">比對「${escapeHtml(match.matchedKey)}」(${match.matchType}, 信心 ${(match.confidence * 100).toFixed(0)}%)</div>
            ${listHtml}
          </div>
        </div>
      `;
    }

    if (news?.items?.length > 0) {
      // 範圍標籤：'10y' → '10 年內'，'5y' → '5 年內'，'1y' → '1 年內'
      const rangeLabel = (news.timeframe || '10y').replace(/^(\d+)y$/, '$1 年內');
      html += `<div class="section"><h3>📰 相關新聞（${news.count} 則，${rangeLabel}，依日期倒序）</h3>`;
      for (const n of news.items) {
        const date = n.pubDate ? new Date(n.pubDate).toISOString().slice(0, 10) : '';
        // URL 防護：只允許 http(s) 連結，避免 javascript: 等 scheme
        const safeLink = isSafeUrl(n.link) ? n.link : '#';
        html += `
          <a class="news-item" href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer">
            <div class="news-title">${escapeHtml(n.title)}</div>
            <div class="news-date">${escapeHtml(date)}</div>
          </a>`;
      }
      html += `</div>`;
    }

    html += `
          <div class="footer">
            <p>
              資料來源：勞動部違反勞動法令事業單位查詢系統（全國彙整） + Google News<br>
              資料更新可能有時間差，請以官方公告為準。
            </p>
          </div>
        </div>
      </div>
    `;
    return html;
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 只允許 http(s) URL，防止 javascript:、data: 等惡意 scheme
  function isSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // 對外 API
  window.__jobguard_injectLoadingBadge = injectLoadingBadge;
  window.__jobguard_replaceBadge = replaceBadge;
  window.__jobguard_injectBadge = injectBadge;
  window.__jobguard_showProgress = showProgress;
  window.__jobguard_hideProgress = hideProgress;
  window.__jobguard_showProgressDone = showProgressDone;
  window.__jobguard_showSettingsPanel = showSettingsPanel;
})();
