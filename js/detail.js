// 상세 화면 (하단 시트): 바코드 크게, 번호 복사, 원본 사진, 정보
import { $, esc, won, fmtDate, ddayChip, openSheet, closeSheet, toast, todayStr, daysUntilPurge } from './util.js';
import { imageURL } from './image.js';
import { barcodeSVG, formatBarcode } from './barcode.js';
import { folderOf } from './brands.js';

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* 아래 방법으로 */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

// 전체 화면 보기 (바코드 또는 사진)
export function openZoom(html, { white = false } = {}) {
  const z = $('#zoom');
  $('#zoomBody').innerHTML = html;
  z.classList.toggle('white', white);
  z.classList.add('on');
  z.setAttribute('aria-hidden', 'false');
}
export function closeZoom() {
  const z = $('#zoom');
  z.classList.remove('on');
  z.setAttribute('aria-hidden', 'true');
  $('#zoomBody').innerHTML = '';
}

/**
 * @param {object} item
 * @param {object} hooks { onEdit(item), onUsed(item), onRestore(item) }
 */
export function openDetail(item, { onEdit, onUsed, onRestore } = {}) {
  const f = folderOf(item);
  const img = imageURL(item);
  const svg = item.barcode ? barcodeSVG(item.barcode) : '';
  const where = f.sub ? `${f.label} · ${f.sub}` : f.label;
  const used = item.status === 'used';
  const left = used ? daysUntilPurge(item) : 0;

  let barcodeBlock;
  if (item.barcode) {
    barcodeBlock = `<div class="card">
      <button class="bc" id="dBarcode" aria-label="바코드 크게 보기">
        ${svg || '<p class="note">이 번호는 바코드로 그릴 수 없어. 원본 사진을 보여줘.</p>'}
        <div class="bcnum">${esc(formatBarcode(item.barcode))}</div>
      </button>
      <div class="btns">
        <button class="btn dark" id="dCopy">📋 번호 복사</button>
        <button class="btn" id="dBig" ${svg ? '' : 'disabled'}>🔍 크게 보기</button>
      </div>
    </div>`;
  } else {
    barcodeBlock = `<div class="warnbox">바코드 번호가 없어. 원본 사진으로 결제하거나 '수정'에서 입력해줘.</div>`;
  }

  openSheet(`
    <div class="dhead">
      <div class="dtitle">
        <div class="note">${f.emo} ${esc(where)}</div>
        <h2>${esc(item.name || item.brand || '이름 없음')}</h2>
      </div>
      ${used ? '<span class="chip">사용 완료</span>' : ddayChip(item.expiresAt)}
    </div>
    ${barcodeBlock}
    ${img ? `<div class="card photo"><button id="dPhoto" aria-label="원본 사진 크게 보기"><img class="orig" src="${img}" alt="원본 사진"></button>
      <p class="note center">탭하면 원본 크게 보기</p></div>` : ''}
    <div class="card">
      <div class="kv"><span>유효기간</span><b>${item.expiresAt ? fmtDate(item.expiresAt) : '미입력'}</b></div>
      <div class="kv"><span>금액</span><b>${item.amount ? won(item.amount) : '-'}</b></div>
      ${item.memo ? `<div class="kv"><span>메모</span><b class="memo">${esc(item.memo)}</b></div>` : ''}
    </div>
    ${used
      ? `<div class="warnbox">${fmtDate(todayStr(new Date(item.usedAt)))}에 사용 완료 · ${left}일 뒤 자동 삭제돼</div>
         <button class="btn primary" id="dRestore">↩️ 사용 안 함으로 되돌리기</button>`
      : '<button class="btn primary" id="dUsed">✅ 사용 완료</button>'}
    <div class="btns">
      <button class="btn" id="dEdit">✏️ 수정</button>
      <button class="btn ghost" id="dClose">닫기</button>
    </div>`);

  const showBig = () => openZoom(`<div class="bigbc">${barcodeSVG(item.barcode, { height: 160 })}
    <div class="bcnum big">${esc(formatBarcode(item.barcode))}</div>
    <p class="note center">화면 밝기를 올리면 더 잘 찍혀. 탭하면 닫혀.</p></div>`, { white: true });

  if (item.barcode) {
    $('#dCopy').onclick = async () => toast(await copyText(item.barcode) ? '번호를 복사했어' : '복사가 막혀 있어. 번호를 길게 눌러 복사해줘');
    if (svg) {
      $('#dBig').onclick = showBig;
      $('#dBarcode').onclick = showBig;
    }
  }
  if (img) $('#dPhoto').onclick = () => openZoom(`<img src="${img}" alt="원본 사진">`);
  $('#dEdit').onclick = () => onEdit && onEdit(item);
  if (used) $('#dRestore').onclick = () => onRestore && onRestore(item);
  else $('#dUsed').onclick = () => onUsed && onUsed(item);
  $('#dClose').onclick = closeSheet;
}
