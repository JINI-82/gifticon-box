// 사진에서 바코드 읽기 — zxing(vendor/에 포함)으로 기기 안에서만 처리
import { loadImage } from './image.js';

let zxingPromise = null;

// 필요할 때만 불러온다 (앱 시작을 느리게 하지 않게)
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!zxingPromise) {
    zxingPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('../vendor/zxing/zxing.min.js', import.meta.url).href;
      s.onload = () => (window.ZXing ? resolve(window.ZXing) : reject(new Error('zxing 없음')));
      s.onerror = () => { zxingPromise = null; reject(new Error('바코드 인식 프로그램을 불러오지 못했어')); };
      document.head.appendChild(s);
    });
  }
  return zxingPromise;
}

function toCanvas(img, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/**
 * 사진(File/Blob)에서 바코드 찾기
 * @returns {Promise<{text: string, format: string} | null>}
 */
export async function scanBarcode(file) {
  const Z = await loadZXing();
  const { img, url } = await loadImage(file);
  try {
    const hints = new Map();
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
      Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.CODE_39,
      Z.BarcodeFormat.ITF, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.QR_CODE, Z.BarcodeFormat.DATA_MATRIX,
      Z.BarcodeFormat.PDF_417,
    ]);
    const reader = new Z.MultiFormatReader();
    reader.setHints(hints);
    // 크기와 이진화 방식을 바꿔가며 여러 번 시도
    for (const side of [1600, 1000, 2400]) {
      const canvas = toCanvas(img, side);
      for (const Bin of [Z.HybridBinarizer, Z.GlobalHistogramBinarizer]) {
        try {
          const src = new Z.HTMLCanvasElementLuminanceSource(canvas);
          // decode()는 힌트를 지워버려서 decodeWithState()를 쓴다
          const result = reader.decodeWithState(new Z.BinaryBitmap(new Bin(src)));
          const text = result.getText().replace(/\s/g, '');
          if (text) return { text, format: Z.BarcodeFormat[result.getBarcodeFormat()] || '' };
        } catch { /* 못 찾음 → 다음 시도 */ }
      }
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
