// 등록·수정 폼 (하단 시트)
import { $, esc, uid, openSheet, closeSheet, confirmSheet, toast } from './util.js';
import { putItem, deleteItem } from './db.js';
import { shrinkImage, imageURL, forgetImage } from './image.js';
import { canonicalBrand } from './brands.js';

const digitsOnly = (s) => String(s ?? '').replace(/[^\d]/g, '');

/**
 * @param {object|null} item  수정할 항목 (null이면 새로 등록)
 * @param {object} hooks      { onSaved(item), onDeleted(id), knownBrands: string[] }
 */
export function openItemForm(item, hooks = {}) {
  const { onSaved, onDeleted, knownBrands = [] } = hooks;
  const editing = !!item;
  const it = item ? { ...item } : { id: uid(), image: null };
  let image = it.image || null;
  let previewURL = editing ? imageURL(it) : '';
  let pendingImage = null; // 사진 축소 진행 중이면 저장 전에 기다린다

  openSheet(`
    <h2 class="sheet-title">${editing ? '정보 수정' : '기프티콘 등록'}</h2>
    <img id="fImg" class="orig preview ${previewURL ? '' : 'hidden'}" src="${previewURL}" alt="첨부한 사진">
    <button type="button" class="btn" id="fPhotoBtn">🖼️ ${previewURL ? '사진 바꾸기' : '사진 첨부'}</button>
    <input type="file" id="fPhoto" accept="image/*" class="hidden">
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
      <label class="f" for="fMemo">메모</label>
      <textarea class="in" id="fMemo" name="memo" placeholder="예: 엄마가 준 거">${esc(it.memo)}</textarea>
      <p class="formerr hidden" id="fErr"></p>
      <div class="btns">
        <button type="button" class="btn ghost" id="fCancel">취소</button>
        <button type="submit" class="btn primary" id="fSave">저장</button>
      </div>
      ${editing ? '<button type="button" class="btn ghost danger" id="fDelete">삭제</button>' : ''}
    </form>`);

  const form = $('#itemForm');

  $('#fPhotoBtn').onclick = () => $('#fPhoto').click();
  $('#fPhoto').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
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
  };

  $('#fCancel').onclick = closeSheet;

  form.onsubmit = async (e) => {
    e.preventDefault();
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
    const now = Date.now();
    const next = {
      ...it,
      brand,
      name,
      amount: amountDigits ? Number(amountDigits) : null,
      expiresAt: String(fd.get('expiresAt') || ''),
      barcode: String(fd.get('barcode')).replace(/\s/g, ''),
      barcodeFormat: it.barcode === String(fd.get('barcode')).replace(/\s/g, '') ? (it.barcodeFormat || '') : '',
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
    toast('저장했어');
    onSaved && onSaved(next);
  };

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
