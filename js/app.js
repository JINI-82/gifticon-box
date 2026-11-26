// 기프티콘함 — 앱 진입점
// 모든 데이터는 이 기기(IndexedDB)에만 저장한다. 외부 서버로 보내지 않는다.

const $ = (s) => document.querySelector(s);

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('on'), 1800);
}

function render() {
  $('#app').innerHTML = `
    <header class="top">
      <h1 class="title">기프티콘함</h1>
    </header>
    <div class="empty">
      <div class="big">🎁</div>
      <b>아직 기프티콘이 없어</b><br>
      곧 여기서 등록할 수 있게 만들 거야.
    </div>
    <div class="privacy">🔒 <span>사진과 바코드는 이 기기 안에서만 처리·저장돼. 어떤 서버로도 보내지 않아.</span></div>`;
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
  } catch (e) {
    console.warn('서비스 워커 등록 실패', e);
  }
}

render();
registerSW();
