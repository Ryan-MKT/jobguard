// ============================================
// 求職門神 - 背景 Service Worker
// ============================================

import { replaceAllCompanies, setMeta, getMeta } from './db.js';
import { findCompany, findCompanies } from './matcher.js';
import { calculateRisk } from './scorer.js';
import { fetchAllNews } from './news.js';

const DATA_URL = 'https://ryan-mkt.github.io/jobguard/data/violations.json';
const ALARM_NAME = 'sync-violations';
const SYNC_INTERVAL_MINUTES = 60 * 24 * 7;

console.log('[JobGuard SW] Service Worker 啟動', new Date().toISOString());

async function syncViolations() {
  console.log('[JobGuard SW] 🔄 開始同步...');
  console.log('[JobGuard SW] 📡 URL:', DATA_URL);

  try {
    const startTime = Date.now();
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const data = await response.json();
    console.log(
      `[JobGuard SW] 📥 下載完成（${Date.now() - startTime}ms） ` +
      `schemaVersion=${data.schemaVersion}, ${data.uniqueCompanies} 家公司`
    );

    const writtenCount = await replaceAllCompanies(data.index);
    await setMeta({
      schemaVersion: data.schemaVersion,
      dataUpdatedAt: data.updatedAt,
      source: data.source,
      sourceUrl: data.sourceUrl,
      lastSyncAt: new Date().toISOString(),
      companyCount: writtenCount,
    });

    console.log(`[JobGuard SW] ✅ 完成！已存入 ${writtenCount} 家公司`);
    return { success: true, count: writtenCount };
  } catch (err) {
    console.error('[JobGuard SW] ❌ 同步失敗:', err.message);
    return { success: false, error: err.message };
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[JobGuard SW] onInstalled - 觸發原因: ${details.reason}`);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: SYNC_INTERVAL_MINUTES });
  console.log(`[JobGuard SW] ⏰ 已設定每 ${SYNC_INTERVAL_MINUTES} 分鐘同步一次`);
  syncViolations();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('[JobGuard SW] ⏰ 鬧鐘響了，開始定期同步');
    syncViolations();
  }
});

// ============================================
// 訊息接收
// ============================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'sync') {
    syncViolations().then(sendResponse);
    return true;
  }

  if (msg.type === 'getMeta') {
    getMeta().then(sendResponse);
    return true;
  }

  // 單一公司比對（含風險評分）
  if (msg.type === 'findCompany') {
    findCompany(msg.name).then((match) => {
      const risk = calculateRisk(match);
      sendResponse({ match, risk });
    });
    return true;
  }

  // 批次比對（含風險評分 + Google News）
  if (msg.type === 'findCompanies') {
    (async () => {
      const matches = await findCompanies(msg.names);
      const newsList = await fetchAllNews(msg.names, 5);
      const results = matches.map((match, i) => ({
        match,
        risk: calculateRisk(match),
        news: newsList[i],
      }));
      sendResponse(results);
    })();
    return true;
  }

  if (msg.type === 'ping') {
    sendResponse({ pong: true, time: Date.now() });
  }
});
