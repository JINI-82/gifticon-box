// 앱 안 알림 — 서버 없이 기기 안에서만.
// 1) 하루 한 번 팝업: 3일 안에 만료되는 것
// 2) 앱 아이콘 숫자 배지: 3일 안에 만료되는 개수 (iOS 16.4+ 홈 화면 앱, 알림 권한 필요)
import { $, esc, dday, byExpiry, todayStr, openSheet, closeSheet, ALERT_DAYS } from './util.js';

const label = (i) => [i.brand, i.name].filter(Boolean).join(' ') || '이름 없음';
const ddayText = (n) => (n === 0 ? '오늘 만료' : `D-${n}`);
const within = (items, days) => items
  .filter((i) => i.status !== 'used')
  .filter((i) => { const n = dday(i.expiresAt); return n !== null && n >= 0 && n <= days; })
  .sort(byExpiry);

/* ---------- 아이콘 배지 ---------- */
const badgeSupported = () => 'setAppBadge' in navigator && 'Notification' in window;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// 배지 켜기 버튼을 보여줄지 (홈 화면 앱이고, 아직 허락도 거절도 안 했을 때)
export const canAskBadge = () => badgeSupported() && isStandalone() && Notification.permission === 'default';
export const badgeState = () => {
  if (!badgeSupported()) return 'unsupported';
  if (!isStandalone()) return 'not-installed';
  return Notification.permission; // 'granted' | 'denied' | 'default'
};

export async function updateBadge(items) {
  if (!badgeSupported()) return;
  const n = within(items, ALERT_DAYS).length;
  try {
    if (n) await navigator.setAppBadge(n); else await navigator.clearAppBadge();
  } catch { /* 권한 없으면 조용히 무시 */ }
}

// 반드시 버튼을 누른 직후에 부른다 (아이폰 권한 창 조건)
export async function askBadgePermission(items) {
  if (!badgeSupported()) return 'unsupported';
  let p = 'denied';
  try { p = await Notification.requestPermission(); } catch { /* 무시 */ }
  if (p === 'granted') await updateBadge(items);
  return p;
}

/* ---------- 하루 한 번 팝업 ---------- */
const POPUP_KEY = 'gifticon.popupShown';
const getShown = () => { try { return localStorage.getItem(POPUP_KEY); } catch { return null; } };
const setShown = (v) => { try { localStorage.setItem(POPUP_KEY, v); } catch { /* 무시 */ } };

export function maybeDailyPopup(items, { onBadgeChanged } = {}) {
  const list = within(items, ALERT_DAYS);
  const today = todayStr();
  if (!list.length || getShown() === today) return;
  if ($('#sheet').classList.contains('on')) return; // 다른 작업 중이면 다음에
  setShown(today);
  openSheet(`<h2 class="sheet-title">⏰ 곧 만료돼</h2>
    <p class="note">${ALERT_DAYS}일 안에 만료되는 기프티콘이 ${list.length}개 있어. 누르면 바코드가 열려.</p>
    <div class="list">${list.map((i) => {
      const n = dday(i.expiresAt);
      return `<button class="item" data-open="${esc(i.id)}">
        <div class="info"><div class="nm">${esc(label(i))}</div></div>
        <span class="chip urgent">${ddayText(n)}</span></button>`;
    }).join('')}</div>
    ${canAskBadge() ? `<button class="btn" id="popBadge" style="margin-top:10px">🔴 앱 아이콘에 숫자로도 보기</button>
      <p class="note">아이폰이 '알림 허용'을 물어봐. 허용하면 홈 화면 아이콘에 곧 만료되는 개수가 떠.</p>` : ''}
    <div class="btns one"><button class="btn dark" id="popClose">확인</button></div>`);
  $('#popClose').onclick = closeSheet;
  const b = $('#popBadge');
  if (b) b.onclick = async () => { await askBadgePermission(items); onBadgeChanged && onBadgeChanged(); closeSheet(); };
  // 목록 항목을 누르면 app.js의 [data-open] 처리로 상세가 열린다
}
