// 기프티콘함 — 앱 진입점
// 모든 데이터는 이 기기(IndexedDB)에만 저장한다. 외부 서버로 보내지 않는다.
import {
  $, esc, won, fmtDate, dday, ddayChip, byExpiry, openSheet, closeSheet, toast, todayStr,
  ALERT_DAYS, KEEP_USED_DAYS, daysUntilPurge, shouldPurge,
} from './util.js';
import { allItems, putItem, deleteItem, getMeta, requestPersist } from './db.js';
import { buildBackup, saveBackupFile, markBackedUp, readBackup, applyBackup } from './backup.js';
import { forgetImage } from './image.js';
import { imageURL } from './image.js';
import { openItemForm } from './form.js';
import { openDetail, closeZoom } from './detail.js';
import { folderOf, knownBrandNames } from './brands.js';

let ITEMS = [];
let dbError = null;
let lastBackupAt = null;
let preparedBackup = null; // { file, count } — 만들어 둔 백업 파일 (저장 버튼 대기)

const active = () => ITEMS.filter((i) => i.status !== 'used');
const usedList = () => ITEMS.filter((i) => i.status === 'used').sort((a, b) => b.usedAt - a.usedAt);
const isExpired = (i) => { const n = dday(i.expiresAt); return n !== null && n < 0; };
const isUrgent = (i) => { const n = dday(i.expiresAt); return n !== null && n >= 0 && n <= ALERT_DAYS; };
// 정렬: 쓸 수 있는 것 먼저(만료 가까운 순), 만료된 건 맨 뒤
const byPriority = (a, b) => (isExpired(a) - isExpired(b)) || byExpiry(a, b);
// 금액 합계는 만료되지 않은 것만
const sumAmount = (list) => list.filter((i) => !isExpired(i)).reduce((s, i) => s + (i.amount || 0), 0);

/* ---------- 라우팅 (#/f/폴더 , #/f/폴더/하위폴더 , #/used) ---------- */
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'used') return { name: 'used' };
  if (parts[0] === 'backup') return { name: 'backup' };
  if (parts[0] === 'f' && parts[1]) return { name: 'folder', folder: parts[1], sub: parts[2] || null };
  return { name: 'home' };
}
const folderHref = (folder, sub) => `#/f/${encodeURIComponent(folder)}${sub ? `/${encodeURIComponent(sub)}` : ''}`;

/* ---------- 조각 ---------- */
function itemRow(i, { showBrand = true } = {}) {
  const img = imageURL(i);
  const title = i.name || i.brand || '이름 없음';
  const sub = [showBrand && i.name ? i.brand : '', i.expiresAt ? `${fmtDate(i.expiresAt)}까지` : '', won(i.amount)]
    .filter(Boolean).join(' · ');
  return `<button class="item" data-open="${esc(i.id)}">
    <div class="thumb">${img ? `<img src="${img}" alt="">` : '🎁'}</div>
    <div class="info"><div class="nm">${esc(title)}</div><div class="sub">${esc(sub)}</div></div>
    ${ddayChip(i.expiresAt)}
  </button>`;
}

function folderCard({ href, emo, label, color, list }) {
  const nearest = list.slice().sort(byPriority)[0];
  const sum = sumAmount(list);
  return `<a class="folder" href="${href}">
    <i class="bar" style="background:${color}"></i>
    <div class="emo">${emo}</div>
    <div class="nm">${esc(label)}</div>
    <div class="meta">${list.length}개${sum ? ` · ${won(sum)}` : ''}</div>
    <div>${ddayChip(nearest.expiresAt)}</div>
  </a>`;
}

// 폴더 이름 → { info, list } (가까운 만료일 순)
function groupByFolder(list) {
  const map = new Map();
  for (const i of list) {
    const f = folderOf(i);
    if (!map.has(f.key)) map.set(f.key, { info: f, list: [] });
    map.get(f.key).list.push(i);
  }
  return [...map.values()].sort((a, b) => byPriority(a.list.slice().sort(byPriority)[0], b.list.slice().sort(byPriority)[0]));
}

/* ---------- 화면 ---------- */
function renderHome() {
  const list = active();
  const urgent = list.filter(isUrgent).sort(byPriority);
  let h = `<header class="top"><h1 class="title">기프티콘함</h1></header>`;
  if (dbError) {
    h += `<div class="warnbox">기기 저장소를 열지 못했어: ${esc(dbError)}<br>사파리 개인정보 보호 모드면 일반 모드로 열어줘.</div>`;
  }
  if (urgent.length) {
    h += `<section class="alert" aria-label="곧 만료">
      <h3>⏰ ${ALERT_DAYS}일 안에 만료 ${urgent.length}개</h3>
      <div class="list flat">${urgent.map((i) => itemRow(i)).join('')}</div>
    </section>`;
  }
  const total = sumAmount(list);
  h += `<div class="summary">
    <div class="stat"><b>${list.length}개</b><span>보유 중</span></div>
    <div class="stat"><b>${total ? won(total) : '-'}</b><span>총 금액</span></div>
  </div>`;
  if (!list.length) {
    h += `<div class="empty"><div class="big">🎁</div><b>아직 기프티콘이 없어</b><br>아래 버튼으로 하나 등록해봐.</div>`;
  } else {
    h += `<div class="grid">${groupByFolder(list).map(({ info, list: l }) =>
      folderCard({ href: folderHref(info.key), emo: info.emo, label: info.label, color: info.color, list: l })).join('')}</div>`;
  }
  const usedCount = usedList().length;
  h += `<a class="linkrow" href="#/used"><span>🧾 사용 내역</span><span class="sub">${usedCount}개 ›</span></a>`;
  h += `<a class="linkrow" href="#/backup"><span>💾 백업·복원</span><span class="sub">${backupLabel()} ›</span></a>`;
  if (ITEMS.length && (!lastBackupAt || Date.now() - lastBackupAt > 30 * 86400000)) {
    h += `<p class="note">데이터는 이 폰에만 있어. 가끔 백업 파일을 '파일' 앱에 저장해둬.</p>`;
  }
  h += `<div class="privacy">🔒 <span>사진과 바코드는 이 기기 안에서만 처리·저장돼. 어떤 서버로도 보내지 않아.</span></div>`;
  return h;
}

function renderFolder(folderKey, subKey) {
  const inFolder = active().filter((i) => folderOf(i).key === folderKey);
  const back = subKey ? folderHref(folderKey) : '#/';
  const title = subKey ? `${folderKey} › ${subKey}` : folderKey;
  let h = `<a class="back" href="${back}">‹ ${esc(title)}</a>`;
  if (!inFolder.length) return h + `<div class="empty">비어 있어</div>`;

  const isGroup = inFolder.some((i) => folderOf(i).sub);
  if (isGroup && !subKey) {
    // 그룹 폴더: 하위 폴더(브랜드) 목록
    const subs = new Map();
    for (const i of inFolder) {
      const s = folderOf(i).sub;
      if (!subs.has(s)) subs.set(s, []);
      subs.get(s).push(i);
    }
    const info = folderOf(inFolder[0]);
    const sorted = [...subs.entries()].sort((a, b) => byPriority(a[1].slice().sort(byPriority)[0], b[1].slice().sort(byPriority)[0]));
    h += `<p class="note">${inFolder.length}개${sumAmount(inFolder) ? ` · ${won(sumAmount(inFolder))}` : ''}</p>`;
    h += `<div class="grid">${sorted.map(([s, l]) =>
      folderCard({ href: folderHref(folderKey, s), emo: info.emo, label: s, color: info.color, list: l })).join('')}</div>`;
    return h;
  }

  const list = (subKey ? inFolder.filter((i) => folderOf(i).sub === subKey) : inFolder).sort(byPriority);
  if (!list.length) return h + `<div class="empty">비어 있어</div>`;
  const sum = sumAmount(list);
  h += `<p class="note">${list.length}개${sum ? ` · ${won(sum)}` : ''} · 만료 가까운 순</p>`;
  // 브랜드 폴더 안에서는 브랜드 이름을 반복하지 않는다
  h += `<div class="list">${list.map((i) => itemRow(i, { showBrand: false })).join('')}</div>`;
  return h;
}

function renderUsed() {
  const list = usedList();
  let h = `<a class="back" href="#/">‹ 사용 내역</a>
    <p class="note">사용 완료한 건 ${KEEP_USED_DAYS}일 동안 보관했다가 자동으로 지워져. 실수로 눌렀으면 눌러서 되돌릴 수 있어.</p>`;
  if (!list.length) return h + `<div class="empty">아직 사용 내역이 없어</div>`;
  h += `<div class="list">${list.map((i) => {
    const img = imageURL(i);
    const sub = [i.name ? i.brand : '', `${fmtDate(todayStr(new Date(i.usedAt)))} 사용`, won(i.amount)].filter(Boolean).join(' · ');
    return `<button class="item used" data-open="${esc(i.id)}">
      <div class="thumb">${img ? `<img src="${img}" alt="">` : '✅'}</div>
      <div class="info"><div class="nm">${esc(i.name || i.brand || '이름 없음')}</div><div class="sub">${esc(sub)}</div></div>
      <span class="chip">${daysUntilPurge(i)}일 뒤 삭제</span>
    </button>`;
  }).join('')}</div>`;
  return h;
}

const fileSize = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))}KB` : `${(b / 1024 / 1024).toFixed(1)}MB`);
const backupLabel = () => (lastBackupAt ? `마지막 ${fmtDate(todayStr(new Date(lastBackupAt)))}` : '아직 안 함');

function renderBackup() {
  const used = usedList().length;
  return `<a class="back" href="#/">‹ 백업·복원</a>
    <div class="card">
      <b>왜 백업이 필요해?</b>
      <p class="note">데이터는 이 폰 안에만 있어서, 앱을 지우거나 폰을 바꾸면 같이 사라져. 백업 파일을 아이폰 '파일' 앱(iCloud Drive 등)에 저장해둬.</p>
      <div class="kv"><span>보유</span><b>${active().length}개</b></div>
      <div class="kv"><span>사용 내역</span><b>${used}개</b></div>
      <div class="kv"><span>마지막 백업</span><b>${lastBackupAt ? new Date(lastBackupAt).toLocaleString('ko-KR') : '없음'}</b></div>
    </div>
    <div class="card">
      <b>내보내기</b>
      <p class="note">사진까지 들어간 파일 하나(.json)로 만들어. 만든 다음 '저장하기'를 누르고 공유 시트에서 '파일에 저장'을 골라줘.</p>
      ${preparedBackup
        ? `<button class="btn primary" data-act="backup-save">📤 저장하기 (${preparedBackup.count}개, ${fileSize(preparedBackup.file.size)})</button>`
        : `<button class="btn primary" data-act="backup-make" ${ITEMS.length ? '' : 'disabled'}>백업 파일 만들기</button>`}
    </div>
    <div class="card">
      <b>가져오기</b>
      <p class="note">백업 파일을 골라. 지금 있는 건 지우지 않고 합쳐. 같은 기프티콘이 양쪽에 있으면 더 최근에 고친 쪽을 남겨.</p>
      <button class="btn" data-act="backup-import">📥 백업 파일 불러오기</button>
      <input type="file" id="importFile" accept="application/json,.json" class="hidden">
    </div>
    <div class="privacy">🔒 <span>백업 파일은 폰 안에서 만들어지고, 어디에 저장할지는 네가 골라. 앱이 따로 업로드하지 않아.</span></div>`;
}

function render() {
  const r = route();
  $('#app').innerHTML = r.name === 'folder' ? renderFolder(r.folder, r.sub)
    : r.name === 'used' ? renderUsed()
      : r.name === 'backup' ? renderBackup()
        : renderHome();
}

/* ---------- 백업 ---------- */
async function makeBackup(btn) {
  btn.disabled = true;
  btn.textContent = '만드는 중…';
  try {
    preparedBackup = await buildBackup();
  } catch (e) {
    console.warn(e);
    toast('백업 파일을 만들지 못했어');
  }
  render();
}

async function saveBackup() {
  if (!preparedBackup) return;
  const result = await saveBackupFile(preparedBackup.file);
  if (result === 'cancelled') { toast('저장을 취소했어'); return; }
  await markBackedUp();
  lastBackupAt = Date.now();
  preparedBackup = null;
  render();
  toast(result === 'shared' ? '백업 파일을 넘겼어' : '백업 파일을 내려받았어');
}

async function importBackup(file) {
  let plan;
  try {
    plan = await readBackup(file, ITEMS);
  } catch (e) {
    toast(e.message || '불러오지 못했어');
    return;
  }
  const n = plan.add.length + plan.update.length;
  const lines = [
    `새로 추가 <b>${plan.add.length}개</b>`,
    `더 최신이라 덮어쓰기 <b>${plan.update.length}개</b>`,
    `이미 있어서 건너뛰기 ${plan.skip}개`,
    plan.invalid ? `읽을 수 없는 항목 ${plan.invalid}개` : '',
  ].filter(Boolean);
  openSheet(`<h2 class="sheet-title">백업 불러오기</h2>
    ${plan.exportedAt ? `<p class="note">${esc(new Date(plan.exportedAt).toLocaleString('ko-KR'))}에 만든 백업</p>` : ''}
    <div class="card">${lines.map((l) => `<div class="kv"><span>${l}</span></div>`).join('')}</div>
    <div class="btns">
      <button class="btn" id="imNo">취소</button>
      <button class="btn primary" id="imOk" ${n ? '' : 'disabled'}>${n ? `${n}개 가져오기` : '가져올 게 없어'}</button>
    </div>`);
  $('#imNo').onclick = closeSheet;
  $('#imOk').onclick = async () => {
    $('#imOk').disabled = true;
    try {
      await applyBackup(plan);
    } catch (e) {
      console.warn(e);
      toast('가져오다 오류가 났어');
    }
    ITEMS = await allItems();
    closeSheet();
    await purgeOldUsed();
    render();
    toast(`${n}개 가져왔어`);
  };
}

/* ---------- 이벤트 ---------- */
function knownBrands() {
  return [...new Set([...ITEMS.map((i) => i.brand).filter(Boolean), ...knownBrandNames()])];
}

const formHooks = () => ({
  knownBrands: knownBrands(),
  onSaved(item) {
    const idx = ITEMS.findIndex((x) => x.id === item.id);
    if (idx >= 0) ITEMS[idx] = item; else ITEMS.push(item);
    render();
  },
  onDeleted(id) {
    ITEMS = ITEMS.filter((x) => x.id !== id);
    render();
  },
});

async function saveStatus(item, status) {
  const next = { ...item, status, usedAt: status === 'used' ? Date.now() : null, updatedAt: Date.now() };
  try {
    await putItem(next);
  } catch (e) {
    console.warn(e);
    toast('저장 실패');
    return;
  }
  ITEMS = ITEMS.map((x) => (x.id === next.id ? next : x));
  closeSheet();
  render();
  toast(status === 'used' ? `사용 완료! ${KEEP_USED_DAYS}일 뒤 자동 삭제돼` : '되돌렸어');
}

function showDetail(item) {
  openDetail(item, {
    onEdit: (it) => openItemForm(it, {
      ...formHooks(),
      onSaved(saved) { formHooks().onSaved(saved); showDetail(saved); },
    }),
    onUsed: (it) => saveStatus(it, 'used'),
    onRestore: (it) => saveStatus(it, 'active'),
  });
}

// 사용완료 후 30일 지난 건 지운다 (앱 열 때, 다시 볼 때)
async function purgeOldUsed() {
  const now = Date.now();
  const old = ITEMS.filter((i) => shouldPurge(i, now));
  if (!old.length) return;
  for (const i of old) {
    try {
      await deleteItem(i.id);
      forgetImage(i.id);
      ITEMS = ITEMS.filter((x) => x.id !== i.id);
    } catch (e) {
      console.warn('자동 삭제 실패', e);
    }
  }
  render();
}

document.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'backup-make') makeBackup(act);
    else if (a === 'backup-save') saveBackup();
    else if (a === 'backup-import') $('#importFile').click();
    return;
  }
  const t = e.target.closest('[data-open]');
  if (!t) return;
  const item = ITEMS.find((x) => x.id === t.dataset.open);
  if (item) showDetail(item);
});
document.addEventListener('change', (e) => {
  if (e.target.id !== 'importFile') return;
  const f = e.target.files[0];
  e.target.value = '';
  if (f) importBackup(f);
});
$('#fab').onclick = () => openItemForm(null, formHooks());
$('#dim').onclick = closeSheet;
$('#zoom').onclick = closeZoom;
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if ($('#zoom').classList.contains('on')) closeZoom(); else closeSheet();
});
window.addEventListener('hashchange', () => {
  preparedBackup = null; // 화면을 떠나면 만들어 둔 백업은 버린다 (그 사이 데이터가 바뀔 수 있음)
  closeZoom(); closeSheet(); render(); window.scrollTo(0, 0);
});
// 날짜가 바뀌었을 수 있으니 다시 보일 때 D-day 갱신
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  render();
  purgeOldUsed();
});

async function load() {
  try {
    ITEMS = await allItems();
    lastBackupAt = (await getMeta('lastBackupAt')) || null;
  } catch (e) {
    console.warn(e);
    dbError = (e && e.message) || String(e);
  }
  render();
  await purgeOldUsed();
  requestPersist();
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
  } catch (e) {
    console.warn('서비스 워커 등록 실패', e);
  }
}

load();
registerSW();
