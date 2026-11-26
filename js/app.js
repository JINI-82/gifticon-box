// 기프티콘함 — 앱 진입점
// 모든 데이터는 이 기기(IndexedDB)에만 저장한다. 외부 서버로 보내지 않는다.
import { $, esc, won, fmtDate, ddayChip, byExpiry, closeSheet } from './util.js';
import { allItems, requestPersist } from './db.js';
import { imageURL } from './image.js';
import { openItemForm } from './form.js';

let ITEMS = [];
let dbError = null;

const active = () => ITEMS.filter((i) => i.status !== 'used');

function itemRow(i) {
  const img = imageURL(i);
  const title = i.name || i.brand || '이름 없음';
  const sub = [i.name ? i.brand : '', i.expiresAt ? `${fmtDate(i.expiresAt)}까지` : '', won(i.amount)].filter(Boolean).join(' · ');
  return `<button class="item" data-open="${esc(i.id)}">
    <div class="thumb">${img ? `<img src="${img}" alt="">` : '🎁'}</div>
    <div class="info"><div class="nm">${esc(title)}</div><div class="sub">${esc(sub)}</div></div>
    ${ddayChip(i.expiresAt)}
  </button>`;
}

function render() {
  const list = active().sort(byExpiry);
  const total = list.reduce((s, i) => s + (i.amount || 0), 0);
  let h = `<header class="top"><h1 class="title">기프티콘함</h1></header>`;
  if (dbError) {
    h += `<div class="warnbox">기기 저장소를 열지 못했어: ${esc(dbError)}<br>사파리 개인정보 보호 모드면 일반 모드로 열어줘.</div>`;
  }
  h += `<div class="summary">
    <div class="stat"><b>${list.length}개</b><span>보유 중</span></div>
    <div class="stat"><b>${total ? won(total) : '-'}</b><span>총 금액</span></div>
  </div>`;
  if (!list.length) {
    h += `<div class="empty"><div class="big">🎁</div><b>아직 기프티콘이 없어</b><br>아래 버튼으로 하나 등록해봐.</div>`;
  } else {
    h += `<div class="list">${list.map(itemRow).join('')}</div>`;
  }
  h += `<div class="privacy">🔒 <span>사진과 바코드는 이 기기 안에서만 처리·저장돼. 어떤 서버로도 보내지 않아.</span></div>`;
  $('#app').innerHTML = h;
}

function knownBrands() {
  return [...new Set(ITEMS.map((i) => i.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
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
