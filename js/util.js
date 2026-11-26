// 공통 유틸

export const APP_VERSION = 'v14'; // sw.js의 VERSION과 같게 유지
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
  const sheet = $('#sheet');
  $('#dim').classList.remove('on');
  $('#dim').style.opacity = '';
  sheet.classList.remove('on');
  sheet.style.transform = '';
  sheet.style.transition = '';
  sheet.setAttribute('aria-hidden', 'true');
}

// 아래로 쓸어내려서 닫기 (아이폰 시트처럼)
// 시트 내용이 맨 위까지 올라가 있을 때만 끌린다 → 그 외에는 평소처럼 스크롤
export function enableSheetSwipe() {
  const sheet = $('#sheet');
  const dim = $('#dim');
  let startY = 0;
  let startT = 0;
  let dy = 0;
  let tracking = false; // 손가락이 시트에 닿아 있고 끌 수 있는 상태
  let dragging = false; // 실제로 아래로 끌고 있음

  sheet.addEventListener('touchstart', (e) => {
    if (!sheet.classList.contains('on') || e.touches.length !== 1) return;
    if (e.target.closest('textarea, select')) return; // 글 쓰는 칸 안 스크롤은 그대로
    tracking = sheet.scrollTop <= 0;
    dragging = false;
    startY = e.touches[0].clientY;
    startT = Date.now();
    dy = 0;
  }, { passive: true });

  sheet.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    dy = e.touches[0].clientY - startY;
    if (!dragging) {
      if (dy < 6) { if (dy < -6) tracking = false; return; } // 위로 밀면 그냥 스크롤
      if (sheet.scrollTop > 0) { tracking = false; return; }
      dragging = true;
      sheet.style.transition = 'none';
    }
    e.preventDefault(); // 끄는 동안 화면이 같이 튀지 않게
    const y = Math.max(0, dy);
    sheet.style.transform = `translateY(${y}px)`;
    dim.style.opacity = String(Math.max(0.2, 1 - y / 500));
  }, { passive: false });

  const end = () => {
    if (!dragging) { tracking = false; return; }
    tracking = false;
    dragging = false;
    const fast = dy > 40 && dy / Math.max(1, Date.now() - startT) > 0.6; // 휙 내렸을 때
    sheet.style.transition = '';
    if (dy > 120 || fast) {
      sheet.style.transform = 'translateY(105%)'; // 끌던 자리에서 이어서 내려간다
      dim.style.opacity = '0';
      setTimeout(closeSheet, 220);
    } else {
      sheet.style.transform = ''; // 제자리로
      dim.style.opacity = '';
    }
  };
  sheet.addEventListener('touchend', end);
  sheet.addEventListener('touchcancel', end);
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
