// ============================================
// 求職門神 - 背景 Service Worker
// ============================================

import { replaceAllCompanies, setMeta, getMeta } from './db.js';
import { findCompany, findCompanies } from './matcher.js';
import { calculateRisk } from './scorer.js';
import { fetchAllNews } from './news.js';
import { fetchWithRetry } from './fetch-utils.js';

const DATA_URL = 'https://ryan-mkt.github.io/jobguard/data/violations.json';
const ALARM_NAME = 'sync-violations';
const SYNC_INTERVAL_MINUTES = 60 * 24 * 7;

console.log('[JobGuard SW] Service Worker 啟動', new Date().toISOString());

async function syncViolations() {
  console.log('[JobGuard SW] 🔄 開始同步...');
  console.log('[JobGuard SW] 📡 URL:', DATA_URL);

  try {
    const startTime = Date.now();
    // 帶 retry + timeout（30 秒，因為 36MB 檔案大）
    const response = await fetchWithRetry(
      DATA_URL,
      {},
      { maxRetries: 3, timeoutMs: 30000, baseDelayMs: 2000 }
    );

    const data = await response.json();

    // 防呆：驗證資料結構
    if (!data || typeof data !== 'object' || !data.index) {
      throw new Error('違規資料格式異常（缺 index 欄位）');
    }

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
      dateRange: data.dateRange || null,
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
// 訊息來源驗證：只接受 content script 或自身 popup
function isValidSender(sender) {
  // 來自 extension 自己的 popup/options
  if (sender.id === chrome.runtime.id) return true;
  // 來自 content script（有 tab）
  if (sender.tab && sender.tab.url) return true;
  return false;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 防呆：拒絕不認識的訊息來源
  if (!isValidSender(sender)) {
    console.warn('[JobGuard SW] 拒絕未知來源訊息', sender);
    sendResponse({ error: 'unauthorized' });
    return false;
  }

  // 防呆：訊息必須有 type
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
    sendResponse({ error: 'invalid message' });
    return false;
  }

  if (msg.type === 'sync') {
    syncViolations().then(sendResponse).catch((e) =>
      sendResponse({ error: e.message })
    );
    return true;
  }

  if (msg.type === 'getMeta') {
    getMeta().then(sendResponse).catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  // 單一公司比對（含風險評分）
  if (msg.type === 'findCompany') {
    if (typeof msg.name !== 'string' || msg.name.length === 0 || msg.name.length > 100) {
      sendResponse({ error: 'invalid name' });
      return false;
    }
    findCompany(msg.name)
      .then((match) => sendResponse({ match, risk: calculateRisk(match, null) }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  // 批次比對（含風險評分 + Google News）
  if (msg.type === 'findCompanies') {
    if (!Array.isArray(msg.names) || msg.names.length === 0 || msg.names.length > 100) {
      sendResponse({ error: 'invalid names' });
      return false;
    }
    // 過濾不合理的名字
    const validNames = msg.names.filter(
      (n) => typeof n === 'string' && n.length > 0 && n.length <= 100
    );
    (async () => {
      try {
        const matches = await findCompanies(validNames);
        const newsList = await fetchAllNews(validNames, 5);
        const results = matches.map((match, i) => ({
          match,
          news: newsList[i],
          risk: calculateRisk(match, newsList[i]),
        }));
        sendResponse(results);
      } catch (e) {
        console.error('[JobGuard SW] findCompanies 失敗:', e);
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  if (msg.type === 'ping') {
    sendResponse({ pong: true, time: Date.now() });
    return false;
  }

  sendResponse({ error: `unknown type: ${msg.type}` });
  return false;
});
