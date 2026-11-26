// 기프티콘함 — 앱 진입점
// 모든 데이터는 이 기기(IndexedDB)에만 저장한다. 외부 서버로 보내지 않는다.
import { $, esc, won, fmtDate, dday, ddayChip, byExpiry, closeSheet, ALERT_DAYS } from './util.js';
import { allItems, requestPersist } from './db.js';
import { imageURL } from './image.js';
import { openItemForm } from './form.js';
import { folderOf, knownBrandNames } from './brands.js';

let ITEMS = [];
let dbError = null;

const active = () => ITEMS.filter((i) => i.status !== 'used');
const isExpired = (i) => { const n = dday(i.expiresAt); return n !== null && n < 0; };
const isUrgent = (i) => { const n = dday(i.expiresAt); return n !== null && n >= 0 && n <= ALERT_DAYS; };
// 정렬: 쓸 수 있는 것 먼저(만료 가까운 순), 만료된 건 맨 뒤
const byPriority = (a, b) => (isExpired(a) - isExpired(b)) || byExpiry(a, b);
// 금액 합계는 만료되지 않은 것만
const sumAmount = (list) => list.filter((i) => !isExpired(i)).reduce((s, i) => s + (i.amount || 0), 0);

/* ---------- 라우팅 (#/f/폴더 , #/f/폴더/하위폴더) ---------- */
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
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

function render() {
  const r = route();
  $('#app').innerHTML = r.name === 'folder' ? renderFolder(r.folder, r.sub) : renderHome();
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

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-open]');
  if (!t) return;
  const item = ITEMS.find((x) => x.id === t.dataset.open);
  if (item) openItemForm(item, formHooks());
});
$('#fab').onclick = () => openItemForm(null, formHooks());
$('#dim').onclick = closeSheet;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0, 0); });
// 날짜가 바뀌었을 수 있으니 다시 보일 때 D-day 갱신
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

async function load() {
  try {
    ITEMS = await allItems();
  } catch (e) {
    console.warn(e);
    dbError = (e && e.message) || String(e);
  }
  render();
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
