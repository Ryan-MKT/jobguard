// ============================================
// IndexedDB 操作工具 v2.0 - 含配額容錯
// ============================================
const DB_NAME = 'jobguard-db';
const DB_VERSION = 1;
const STORE_COMPANIES = 'companies';
const STORE_META = 'meta';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_COMPANIES)) {
        db.createObjectStore(STORE_COMPANIES);
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 寫入全部公司資料
 * 含配額容錯：超過時 prune 一半再試
 */
export async function replaceAllCompanies(index) {
  try {
    return await doReplaceAll(index);
  } catch (err) {
    // 配額不足，砍一半重試
    if (err.name === 'QuotaExceededError' || /quota/i.test(err.message || '')) {
      console.warn('[JobGuard DB] ⚠️ IndexedDB 配額不足，砍一半舊資料後重試');
      try {
        await pruneStore(STORE_COMPANIES, 0.5);
        return await doReplaceAll(index);
      } catch (err2) {
        console.error('[JobGuard DB] ❌ 砍完還是寫不進去:', err2.message);
        throw err2;
      }
    }
    throw err;
  }
}

async function doReplaceAll(index) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COMPANIES, 'readwrite');
    const store = tx.objectStore(STORE_COMPANIES);
    store.clear();
    let count = 0;
    for (const [name, data] of Object.entries(index)) {
      store.put(data, name);
      count++;
    }
    tx.oncomplete = () => resolve(count);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('交易被中止'));
  });
}

/**
 * 砍掉一定比例的舊資料（緊急情況用）
 * @param {string} storeName
 * @param {number} ratio 0.5 = 砍一半
 */
async function pruneStore(storeName, ratio) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    const countReq = store.count();
    countReq.onsuccess = () => {
      const total = countReq.result;
      const toDelete = Math.floor(total * ratio);
      let deleted = 0;
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && deleted < toDelete) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve(deleted);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    };
    countReq.onerror = () => reject(countReq.error);
  });
}

export async function getCompany(normalizedName) {
  if (!normalizedName || typeof normalizedName !== 'string') return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COMPANIES, 'readonly');
    const req = tx.objectStore(STORE_COMPANIES).get(normalizedName);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllCompanyKeys() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COMPANIES, 'readonly');
    const req = tx.objectStore(STORE_COMPANIES).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function setMeta(meta) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(meta, 'state');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMeta() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get('state');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// 法人全名 → key 對照表（高信心比對用）。存在 meta store 的 'legalIndex' 鍵
export async function setLegalIndex(legalIndex) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(legalIndex || {}, 'legalIndex');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLegalIndex() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get('legalIndex');
    req.onsuccess = () => resolve(req.result || {});
    req.onerror = () => reject(req.error);
  });
}
