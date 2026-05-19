// ============================================
// 網路韌性工具
// ============================================
// - timeout：避免 fetch 卡死
// - retry：失敗自動重試（指數退避）
// - 都失敗就拋錯，由呼叫端決定要怎麼降級

/**
 * fetch 帶 timeout
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} timeoutMs 預設 15 秒
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * fetch 帶 retry + timeout
 * @param {string} url
 * @param {Object} opts
 * @param {number} opts.maxRetries 預設 3
 * @param {number} opts.timeoutMs 預設 15000
 * @param {number} opts.baseDelayMs 預設 1000（重試間隔起始）
 */
export async function fetchWithRetry(url, requestInit = {}, opts = {}) {
  const { maxRetries = 3, timeoutMs = 15000, baseDelayMs = 1000 } = opts;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, requestInit, timeoutMs);

      // 5xx 重試、4xx 不重試
      if (res.ok) return res;
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }

    // 指數退避（1s、2s、4s...）
    if (attempt < maxRetries - 1) {
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(`[JobGuard] fetch 失敗（attempt ${attempt + 1}/${maxRetries}）, ${delay}ms 後重試`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError || new Error('fetch 重試全失敗');
}
