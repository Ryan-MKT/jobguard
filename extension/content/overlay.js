// ============================================
// 浮層 UI v2.0 — Shadow DOM 完全隔離 + 美化
// ============================================
//
// Shadow DOM 的好處：
//   - 我們的 CSS 不會影響 104（不會誤改人家樣式）
//   - 104 的 CSS 不會影響我們（不會被改版搞壞）
//   - 像把家具關在房間裡，門關起來就互不干擾

(function () {
  const BADGE_ATTR = 'data-jobguard-badge';

  // ============================================
  // 徽章樣式（注入到 shadow root 的 <style>）
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
      border-radius: 11px;
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
  `;

  // ============================================
  // 視窗樣式
  // ============================================
  const MODAL_CSS = `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, "Microsoft JhengHei",
                   "PingFang TC", sans-serif;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.18s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .card {
      background: #fff;
      max-width: 560px;
      width: 100%;
      max-height: 86vh;
      overflow-y: auto;
      border-radius: 16px;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
      color: #1a1a1a;
      animation: slideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      border-top: 6px solid var(--risk-color);
    }
    @keyframes slideUp {
      from { transform: translateY(24px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .head {
      padding: 22px 24px 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .title {
      margin: 0;
      font-size: 22px;
      color: var(--risk-color);
      font-weight: 700;
      line-height: 1.2;
    }
    .company {
      margin: 6px 0 0;
      font-size: 15px;
      color: #333;
      font-weight: 600;
    }
    .meta {
      margin: 4px 0 0;
      font-size: 12px;
      color: #888;
    }
    .close {
      background: transparent;
      border: 0;
      font-size: 26px;
      cursor: pointer;
      color: #bbb;
      line-height: 1;
      padding: 0;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
    }
    .close:hover {
      background: #f0f0f0;
      color: #333;
    }
    .section {
      padding: 0 24px 14px;
    }
    .section h3 {
      margin: 8px 0;
      font-size: 13px;
      color: #888;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .violation-box {
      background: linear-gradient(135deg, #fef3f3, #fff5f5);
      padding: 14px 16px;
      border-radius: 10px;
      border: 1px solid #fde0e0;
    }
    .violation-count {
      font-weight: 700;
      font-size: 18px;
      color: #d32f2f;
    }
    .violation-detail {
      margin-top: 4px;
      color: #555;
      font-size: 14px;
    }
    .violation-meta {
      margin-top: 6px;
      font-size: 11px;
      color: #888;
    }
    .news-item {
      display: block;
      padding: 12px 14px;
      margin-bottom: 8px;
      border: 1px solid #eee;
      border-radius: 10px;
      color: #222;
      text-decoration: none;
      transition: border-color 0.15s, background 0.15s, transform 0.15s;
    }
    .news-item:hover {
      border-color: #e69138;
      background: #fffbf5;
      transform: translateX(2px);
    }
    .news-title {
      font-size: 13px;
      line-height: 1.45;
      color: #1a1a1a;
    }
    .news-date {
      font-size: 11px;
      color: #888;
      margin-top: 4px;
    }
    .footer {
      padding: 14px 24px 22px;
      border-top: 1px solid #f0f0f0;
      margin-top: 8px;
    }
    .footer p {
      margin: 0;
      font-size: 11px;
      color: #999;
      line-height: 1.6;
    }
    .footer a {
      color: #888;
      text-decoration: underline;
    }
  `;

  // ============================================
  // 注入徽章
  // ============================================
  function injectBadge(linkElement, result) {
    if (linkElement.hasAttribute(BADGE_ATTR)) return;
    linkElement.setAttribute(BADGE_ATTR, 'true');

    const host = document.createElement('span');
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
      showModal(result);
    });

    linkElement.parentNode.insertBefore(host, linkElement);
  }

  // ============================================
  // 詳細視窗
  // ============================================
  function showModal(result) {
    document.getElementById('jobguard-modal-host')?.remove();

    const host = document.createElement('div');
    host.id = 'jobguard-modal-host';
    host.style.cssText = `--risk-color: ${result.risk.color};`;
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${MODAL_CSS}</style>${renderModalHTML(result)}`;

    // 背景點擊關閉
    const backdrop = shadow.querySelector('.backdrop');
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) host.remove();
    });
    // X 按鈕關閉
    shadow.querySelector('.close').addEventListener('click', () => host.remove());
    // Esc 鍵關閉
    const onKey = (e) => {
      if (e.key === 'Escape') {
        host.remove();
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
      html += `
        <div class="section">
          <h3>⚖️ 政府裁罰紀錄</h3>
          <div class="violation-box">
            <div class="violation-count">${match.count} 次違規</div>
            <div class="violation-detail">累計罰款 NT$ ${match.totalFine.toLocaleString()}</div>
            <div class="violation-meta">最近違規日：${escapeHtml(match.latestDate)}</div>
            <div class="violation-meta">比對「${escapeHtml(match.matchedKey)}」(${match.matchType}, 信心 ${(match.confidence * 100).toFixed(0)}%)</div>
          </div>
        </div>
      `;
    }

    if (news?.items?.length > 0) {
      html += `<div class="section"><h3>📰 最近 6 個月相關新聞（${news.count} 則）</h3>`;
      for (const n of news.items) {
        const date = n.pubDate ? new Date(n.pubDate).toISOString().slice(0, 10) : '';
        html += `
          <a class="news-item" href="${escapeHtml(n.link)}" target="_blank" rel="noopener noreferrer">
            <div class="news-title">${escapeHtml(n.title)}</div>
            <div class="news-date">${escapeHtml(date)}</div>
          </a>
        `;
      }
      html += `</div>`;
    }

    html += `
          <div class="footer">
            <p>
              資料來源：<a href="https://data.ntpc.gov.tw/datasets/A3408B16-7B28-4FA5-9834-D147AAE909BF" target="_blank">新北市資料開放平台</a> + Google News<br>
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

  window.__jobguard_injectBadge = injectBadge;
})();
