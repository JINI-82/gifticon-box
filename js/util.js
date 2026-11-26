// 공통 유틸

export const APP_VERSION = 'v12'; // sw.js의 VERSION과 같게 유지
export const ALERT_DAYS = 3;
export const KEEP_USED_DAYS = 30; // 사용완료 건 보관 기간

const DAY = 86400000;
// 사용완료 후 자동 삭제까지 남은 일수 (0이면 오늘 정리 대상)
export function daysUntilPurge(item, now = Date.now()) {
  return Math.max(0, KEEP_USED_DAYS - Math.floor((now - item.usedAt) / DAY));
}
export const shouldPurge = (item, now = Date.now()) =>
  item.status === 'used' && item.usedAt && now - item.usedAt >= KEEP_USED_DAYS * DAY;

export const $ = (s, root = document) => root.querySelector(s);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const won = (n) => (n || n === 0) && n !== '' ? `${Number(n).toLocaleString('ko-KR')}원` : '';

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 오늘 기준 남은 일수 (오늘 만료 = 0, 지남 = 음수). 날짜 없으면 null
export function dday(exp) {
  if (!exp) return null;
  const [y, m, d] = exp.split('-').map(Number);
  const t = new Date();
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000);
}

export function ddayChip(exp) {
  const n = dday(exp);
  if (n === null) return '<span class="chip">기한 미입력</span>';
  if (n < 0) return '<span class="chip expired">만료됨</span>';
  if (n === 0) return '<span class="chip urgent">오늘 만료</span>';
  if (n <= ALERT_DAYS) return `<span class="chip urgent">D-${n}</span>`;
  if (n <= 14) return `<span class="chip warn">D-${n}</span>`;
  return `<span class="chip">D-${n}</span>`;
}

export const fmtDate = (s) => (s ? s.replace(/-/g, '.') : '-');

// 만료일 가까운 순, 날짜 없는 건 맨 뒤
export const byExpiry = (a, b) => (a.expiresAt || '9999').localeCompare(b.expiresAt || '9999');

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('on'), 1800);
}

// 하단 시트
export function openSheet(html) {
  $('#sheetBody').innerHTML = html;
  $('#sheet').scrollTop = 0;
  $('#dim').classList.add('on');
  $('#sheet').classList.add('on');
  $('#sheet').setAttribute('aria-hidden', 'false');
}

export function closeSheet() {
  $('#dim').classList.remove('on');
  $('#sheet').classList.remove('on');
  $('#sheet').setAttribute('aria-hidden', 'true');
}

// 확인 시트 — 확인 누르면 true
export function confirmSheet(title, okLabel, danger = false) {
  return new Promise((resolve) => {
    openSheet(`<h2 class="sheet-title">${esc(title)}</h2>
      <div class="btns">
        <button class="btn" id="cfNo">취소</button>
        <button class="btn ${danger ? 'danger-fill' : 'primary'}" id="cfOk">${esc(okLabel)}</button>
      </div>`);
    $('#cfNo').onclick = () => { closeSheet(); resolve(false); };
    $('#cfOk').onclick = () => { resolve(true); };
  });
}
