// IndexedDB 저장소 — 모든 데이터는 이 기기 안에만 있다.
//
// items 스토어 항목 형태:
// {
//   id: string,
//   brand: string,          // 예: 'CU', '스타벅스'
//   name: string,           // 상품명
//   amount: number|null,    // 금액(원)
//   expiresAt: string,      // 'YYYY-MM-DD' (빈 문자열이면 미입력)
//   barcode: string,        // 숫자/문자만, 공백 없음
//   barcodeFormat: string,  // 'CODE_128' 등 (모르면 '')
//   memo: string,
//   image: Blob|null,       // 축소한 원본 사진
//   status: 'active'|'used',
//   usedAt: number|null,    // ms
//   createdAt: number,
//   updatedAt: number,
// }

const DB_NAME = 'gifticon-box';
const DB_VERSION = 1;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('items')) {
        const s = db.createObjectStore('items', { keyPath: 'id' });
        s.createIndex('status', 'status');
        s.createIndex('expiresAt', 'expiresAt');
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
    req.onblocked = () => reject(new Error('다른 탭이 저장소를 쓰고 있어. 다른 탭을 닫아줘.'));
  });
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    let result;
    if (req) req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('저장이 취소됐어'));
  });
}

export const allItems = () => run('items', 'readonly', (s) => s.getAll()).then((v) => v || []);
export const getItem = (id) => run('items', 'readonly', (s) => s.get(id));
export const putItem = (item) => run('items', 'readwrite', (s) => s.put(item));
export const deleteItem = (id) => run('items', 'readwrite', (s) => s.delete(id));
export const getMeta = (key) => run('meta', 'readonly', (s) => s.get(key));
export const setMeta = (key, value) => run('meta', 'readwrite', (s) => s.put(value, key));

// 브라우저가 저장소를 마음대로 정리하지 않게 요청 (지원할 때만)
export async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch { /* 무시 */ }
  return false;
}
