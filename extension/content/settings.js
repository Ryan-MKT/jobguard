// ============================================
// 求職門神 - 使用者設定模組（chrome.storage.local）
// ============================================

(function () {
  const KEY = 'jobguard.settings';
  const DEFAULTS = Object.freeze({
    scanMode: 'auto', // 'auto' | 'manual'
  });

  function load() {
    return new Promise((resolve) => {
      chrome.storage.local.get(KEY, (res) => {
        const stored = res?.[KEY] || {};
        resolve({ ...DEFAULTS, ...stored });
      });
    });
  }

  function save(partial) {
    return load().then((current) => {
      const next = { ...current, ...partial };
      return new Promise((resolve) => {
        chrome.storage.local.set({ [KEY]: next }, () => resolve(next));
      });
    });
  }

  function onChange(callback) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[KEY]) return;
      const next = { ...DEFAULTS, ...(changes[KEY].newValue || {}) };
      const prev = { ...DEFAULTS, ...(changes[KEY].oldValue || {}) };
      callback(next, prev);
    });
  }

  window.__jobguard_settings = { load, save, onChange, DEFAULTS };
})();
