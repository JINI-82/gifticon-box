// 등록·수정 폼 (하단 시트)
import { $, esc, uid, openSheet, closeSheet, confirmSheet, toast } from './util.js';
import { putItem, deleteItem } from './db.js';
import { shrinkImage, imageURL, forgetImage } from './image.js';
import { canonicalBrand } from './brands.js';
import { scanBarcode } from './scan.js';
import { recognizeText } from './ocr.js';
import { parseGifticon } from './parse.js';

const digitsOnly = (s) => String(s ?? '').replace(/[^\d]/g, '');

/**
 * @param {object|null} item  수정할 항목 (null이면 새로 등록)
 * @param {object} hooks      {
 *   onSaved(item), onDeleted(id), knownBrands: string[],
 *   initialFile: File,            // 열자마자 인식할 사진 (여러 장 등록)
 *   queue: { index, total },      // 여러 장 등록 중 몇 번째인지
 *   onSkip(),                     // 여러 장 등록에서 이 사진 건너뛰기
 *   findByBarcode(code, selfId),  // 같은 바코드로 이미 등록된 항목
 * }
 */
export function openItemForm(item, hooks = {}) {
  const { onSaved, onDeleted, knownBrands = [], initialFile = null, queue = null, onSkip, findByBarcode } = hooks;
  const editing = !!item;
  const it = item ? { ...item } : { id: uid(), image: null };
  let image = it.image || null;
  let previewURL = editing ? imageURL(it) : '';
  let pendingImage = null; // 사진 축소 진행 중이면 저장 전에 기다린다

  openSheet(`
    <h2 class="sheet-title">${editing ? '정보 수정' : '기프티콘 등록'}${queue ? ` <span class="qcount">${queue.index}/${queue.total}</span>` : ''}</h2>
    <img id="fImg" class="orig preview ${previewURL ? '' : 'hidden'}" src="${previewURL}" alt="첨부한 사진">
    <button type="button" class="btn" id="fPhotoBtn">🖼️ ${previewURL ? '사진 바꾸기' : '사진 첨부'}</button>
    <input type="file" id="fPhoto" accept="image/*" class="hidden">
    <div class="scanmsg hidden" id="fScan" role="status"></div>
    <div class="scanmsg hidden" id="fOcr" role="status"></div>
    <form id="itemForm" novalidate>
      <div class="row2">
        <div><label class="f" for="fBrand">브랜드</label>
          <input class="in" id="fBrand" name="brand" list="brandList" value="${esc(it.brand)}" placeholder="예: 스타벅스" autocomplete="off"></div>
        <div><label class="f" for="fAmount">금액(원)</label>
          <input class="in" id="fAmount" name="amount" inputmode="numeric" value="${it.amount ?? ''}" placeholder="선택"></div>
      </div>
      <datalist id="brandList">${knownBrands.map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
      <label class="f" for="fName">상품명</label>
      <input class="in" id="fName" name="name" value="${esc(it.name)}" placeholder="예: 아메리카노 T" autocomplete="off">
      <label class="f" for="fExp">유효기간</label>
      <input class="in" id="fExp" type="date" name="expiresAt" value="${esc(it.expiresAt)}">
      <label class="f" for="fBarcode">바코드 번호</label>
      <input class="in mono" id="fBarcode" name="barcode" inputmode="numeric" value="${esc(it.barcode)}" placeholder="숫자만" autocomplete="off">
      <div id="fDup"></div>
      <label class="f" for="fMemo">메모</label>
      <textarea class="in" id="fMemo" name="memo" placeholder="예: 엄마가 준 거">${esc(it.memo)}</textarea>
      <p class="formerr hidden" id="fErr"></p>
      <div class="btns">
        <button type="button" class="btn ghost" id="fCancel">${queue ? (queue.index < queue.total ? '건너뛰기' : '이건 빼기') : '취소'}</button>
        <button type="submit" class="btn primary" id="fSave">저장</button>
      </div>
      ${editing ? '<button type="button" class="btn ghost danger" id="fDelete">삭제</button>' : ''}
    </form>`);

  const form = $('#itemForm');

  $('#fPhotoBtn').onclick = () => $('#fPhoto').click();
  $('#fPhoto').onchange = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) handlePhoto(file);
  };

  // 같은 바코드가 이미 있으면 알려준다 (같은 쿠폰을 두 번 올리는 실수 방지)
  function checkDup() {
    const box = $('#fDup');
    if (!box || !findByBarcode) return;
    const code = $('#fBarcode').value.replace(/\s/g, '');
    const dup = code && findByBarcode(code, it.id);
    box.innerHTML = dup
      ? `<div class="warnbox">이미 등록된 바코드야: ${esc([dup.brand, dup.name].filter(Boolean).join(' '))}${dup.status === 'used' ? ' (사용 완료)' : ''}</div>`
      : '';
  }
  $('#fBarcode').addEventListener('input', checkDup);

  function handlePhoto(file) {
    $('#fPhotoBtn').textContent = '🖼️ 사진 처리 중…';
    pendingImage = shrinkImage(file).then((blob) => {
      image = blob;
      if (previewURL && previewURL !== imageURL(it)) URL.revokeObjectURL(previewURL);
      previewURL = URL.createObjectURL(image);
      const el = $('#fImg');
      if (!el) return;
      el.src = previewURL;
      el.classList.remove('hidden');
      $('#fPhotoBtn').textContent = '🖼️ 사진 바꾸기';
    });
    const token = ++photoToken;
    pendingScan = runScan(file); // 축소 전 원본으로 읽어야 잘 읽힌다
    // 바코드 다음에 글자 인식 (저장은 이걸 기다리지 않는다: 오래 걸릴 수 있어서)
    pendingScan.then(() => runOcr(file, token));
  }

  // 사진에서 글자 읽어서 빈 칸 채우기
  let photoToken = 0; // 사진을 또 바꾸면 이전 인식 결과는 버린다
  async function runOcr(file, token) {
    const box = $('#fOcr');
    if (!box) return;
    const show = (html, cls = '') => { box.className = `scanmsg ${cls}`; box.innerHTML = html; };
    show('📝 글자 읽는 중… <span class="prog"><i id="fOcrBar"></i></span>');
    let text;
    try {
      text = await recognizeText(file, (msg, ratio) => {
        const bar = $('#fOcrBar');
        if (bar && token === photoToken) bar.style.width = `${Math.round(ratio * 100)}%`;
      });
    } catch (ex) {
      console.warn(ex);
      if (token === photoToken && $('#fOcr')) show(`글자 인식이 안 됐어: ${esc(ex.message || ex)}. 직접 입력해줘.`, 'bad');
      return;
    }
    if (token !== photoToken || !$('#itemForm')) return;
    const p = parseGifticon(text);
    const filled = [];
    const fill = (id, value, label) => {
      const el = $(id);
      if (!el || value === null || value === '' || el.value.trim()) return; // 이미 쓴 칸은 건드리지 않는다
      el.value = value;
      el.classList.add('auto');
      filled.push(label);
    };
    fill('#fBrand', p.brand, '브랜드');
    fill('#fName', p.name, '상품명');
    fill('#fExp', p.expiresAt, '유효기간');
    fill('#fAmount', p.amount ? String(p.amount) : '', '금액');
    fill('#fBarcode', p.barcode, '바코드 번호');
    checkDup();
    if (filled.length) show(`📝 글자를 읽어서 <b>${filled.join(', ')}</b>을(를) 채웠어. 노란 칸이 맞는지 꼭 확인해줘.`, 'ok');
    else show('글자에서 새로 채울 정보를 못 찾았어. 비어 있는 칸은 직접 입력해줘.', 'bad');
  }
  form.addEventListener('input', (e) => e.target.classList.remove('auto'));

  // 사진에서 바코드 읽어서 칸 채우기
  let scanned = null;      // { text, format }
  let pendingScan = null;
  async function runScan(file) {
    const msg = $('#fScan');
    const show = (html, cls = '') => { msg.className = `scanmsg ${cls}`; msg.innerHTML = html; };
    show('🔎 사진에서 바코드 찾는 중…');
    await new Promise((r) => setTimeout(r, 30)); // 안내 문구가 먼저 그려지게
    let result = null;
    try {
      result = await scanBarcode(file);
    } catch (ex) {
      console.warn(ex);
      show(`바코드를 읽지 못했어: ${esc(ex.message || ex)}. 번호를 직접 입력해줘.`, 'bad');
      return;
    }
    if (!$('#fBarcode')) return; // 그새 시트가 닫힘
    if (!result) {
      show('⚠️ 사진에서 바코드를 못 찾았어. 번호를 직접 입력해줘.', 'bad');
      return;
    }
    const input = $('#fBarcode');
    const current = input.value.replace(/\s/g, '');
    const prevScan = scanned && scanned.text;
    scanned = result;
    if (!current || current === prevScan || current === result.text) {
      input.value = result.text;
      show(`✅ 바코드를 읽었어 (${esc(result.format)}). 번호가 맞는지 확인해줘.`, 'ok');
    } else {
      show(`사진의 바코드는 <b class="mono">${esc(result.text)}</b>인데 입력한 번호와 달라.
        <button type="button" class="linkbtn" id="fUseScan">사진 번호로 바꾸기</button>`, 'bad');
      $('#fUseScan').onclick = () => {
        input.value = result.text;
        show(`✅ 사진의 바코드로 바꿨어 (${esc(result.format)}).`, 'ok');
        checkDup();
      };
    }
    checkDup();
  }

  $('#fCancel').onclick = () => { if (queue && onSkip) onSkip(); else closeSheet(); };

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (pendingScan) { $('#fSave').disabled = true; await pendingScan; $('#fSave').disabled = false; }
    const fd = new FormData(form);
    const brand = canonicalBrand(fd.get('brand')); // '씨유', 'gs 25' → 'CU', 'GS25'
    const name = String(fd.get('name')).trim();
    const err = $('#fErr');
    if (!brand && !name) {
      err.textContent = '브랜드나 상품명 중 하나는 적어줘.';
      err.classList.remove('hidden');
      return;
    }
    $('#fSave').disabled = true;
    if (pendingImage) await pendingImage;
    const amountDigits = digitsOnly(fd.get('amount'));
    const barcode = String(fd.get('barcode')).replace(/\s/g, '');
    const now = Date.now();
    const next = {
      ...it,
      brand,
      name,
      amount: amountDigits ? Number(amountDigits) : null,
      expiresAt: String(fd.get('expiresAt') || ''),
      barcode,
      barcodeFormat: scanned && scanned.text === barcode ? scanned.format
        : it.barcode === barcode ? (it.barcodeFormat || '') : '',
      memo: String(fd.get('memo')).trim(),
      image,
      status: it.status || 'active',
      usedAt: it.usedAt ?? null,
      createdAt: it.createdAt || now,
      updatedAt: now,
    };
    try {
      await putItem(next);
    } catch (ex) {
      console.warn(ex);
      $('#fSave').disabled = false;
      toast(`저장 실패: ${(ex && ex.name) || '알 수 없는 오류'}`);
      return;
    }
    closeSheet();
    toast(queue && queue.index < queue.total ? `저장했어. 다음 사진 (${queue.index + 1}/${queue.total})` : '저장했어');
    onSaved && onSaved(next);
  };

  checkDup();
  if (initialFile) handlePhoto(initialFile);

  if (editing) {
    $('#fDelete').onclick = async () => {
      const ok = await confirmSheet('완전히 삭제할까? 되돌릴 수 없어.', '삭제', true);
      if (!ok) { openItemForm(item, hooks); return; }
      await deleteItem(it.id);
      forgetImage(it.id);
      closeSheet();
      toast('삭제했어');
      onDeleted && onDeleted(it.id);
    };
  }
}
