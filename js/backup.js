// 백업 내보내기·가져오기 — 파일은 기기 안에서만 만들고 읽는다.
// 형식: JSON 한 파일 { app, version, exportedAt, items: [...] } (사진은 data URL로 포함)
import { allItems, putItem, setMeta } from './db.js';
import { todayStr } from './util.js';

export const BACKUP_APP = 'gifticon-box';
export const BACKUP_VERSION = 1;

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

function dataURLToBlob(url) {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i.exec(url);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

// 백업 파일(File) 만들기
export async function buildBackup() {
  const items = await allItems();
  const out = [];
  for (const it of items) {
    out.push({ ...it, image: it.image ? await blobToDataURL(it.image) : null });
  }
  const json = JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), items: out });
  const name = `기프티콘함-백업-${todayStr()}.json`;
  return { file: new File([json], name, { type: 'application/json' }), count: items.length };
}

// 파일 저장: 아이폰은 공유 시트('파일에 저장'), 안 되면 다운로드
// 반드시 사용자가 버튼을 누른 직후에 불러야 한다 (공유 시트 제한)
export async function saveBackupFile(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // 공유 실패 → 다운로드로
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

export const markBackedUp = () => setMeta('lastBackupAt', Date.now());

const str = (v) => (typeof v === 'string' ? v : '');

// 항목 하나 검사·정리. 이상하면 null
function cleanItem(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const exp = str(raw.expiresAt);
  const status = raw.status === 'used' ? 'used' : 'active';
  return {
    id: raw.id,
    brand: str(raw.brand),
    name: str(raw.name),
    amount: Number.isFinite(raw.amount) ? raw.amount : null,
    expiresAt: /^\d{4}-\d{2}-\d{2}$/.test(exp) ? exp : '',
    barcode: str(raw.barcode),
    barcodeFormat: str(raw.barcodeFormat),
    memo: str(raw.memo),
    image: typeof raw.image === 'string' ? dataURLToBlob(raw.image) : null,
    status,
    usedAt: status === 'used' && Number.isFinite(raw.usedAt) ? raw.usedAt : (status === 'used' ? Date.now() : null),
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
  };
}

// 백업 파일 읽기 → 적용 계획 (아직 저장하지 않음)
// 같은 id가 이미 있으면 더 최근에 수정된 쪽을 남긴다
export async function readBackup(file, currentItems) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('백업 파일이 아니거나 손상됐어');
  }
  if (!data || data.app !== BACKUP_APP || !Array.isArray(data.items)) throw new Error('기프티콘함 백업 파일이 아니야');
  if (data.version > BACKUP_VERSION) throw new Error('더 새 버전 앱에서 만든 백업이야. 앱을 업데이트해줘');

  const byId = new Map(currentItems.map((i) => [i.id, i]));
  const plan = { add: [], update: [], skip: 0, invalid: 0, exportedAt: data.exportedAt || '' };
  for (const raw of data.items) {
    const it = cleanItem(raw);
    if (!it) { plan.invalid++; continue; }
    const cur = byId.get(it.id);
    if (!cur) plan.add.push(it);
    else if ((it.updatedAt || 0) > (cur.updatedAt || 0)) plan.update.push(it);
    else plan.skip++;
  }
  return plan;
}

export async function applyBackup(plan) {
  for (const it of [...plan.add, ...plan.update]) await putItem(it);
  return plan.add.length + plan.update.length;
}
