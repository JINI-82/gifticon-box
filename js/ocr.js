// 글자 인식(OCR) — Tesseract를 기기 안에서 돌린다. 모든 파일은 vendor/tesseract에서만 읽는다.
import { loadImage } from './image.js';

const BASE = new URL('../vendor/tesseract/', import.meta.url).href;
const PATHS = {
  workerPath: `${BASE}worker.min.js`,
  corePath: `${BASE}tesseract-core-simd-lstm.js`, // .js로 끝나면 이 파일을 그대로 쓴다 (CDN 안 감)
  langPath: `${BASE}lang`,                       // kor.traineddata.gz, eng.traineddata.gz
};
const IDLE_MS = 60000; // 1분 동안 안 쓰면 메모리 정리

let libPromise = null;
let workerPromise = null;
let idleTimer = null;
let progressCb = null;

function loadLib() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${BASE}tesseract.min.js`;
      s.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error('Tesseract 없음')));
      s.onerror = () => { libPromise = null; reject(new Error('글자 인식 프로그램을 불러오지 못했어')); };
      document.head.appendChild(s);
    });
  }
  return libPromise;
}

async function getWorker() {
  clearTimeout(idleTimer);
  if (!workerPromise) {
    workerPromise = (async () => {
      const T = await loadLib();
      const w = await T.createWorker(['kor', 'eng'], T.OEM.LSTM_ONLY, {
        ...PATHS,
        // blob 워커로 띄우면 엔진이 옆의 .wasm 경로를 못 찾는다 → 실제 파일 주소로 띄운다
        workerBlobURL: false,
        gzip: true,
        cacheMethod: 'none', // 서비스 워커가 이미 캐시함 (IndexedDB에 또 넣지 않음)
        logger: (m) => progressCb && progressCb(m),
        errorHandler: (e) => console.warn('OCR', e),
      });
      await w.setParameters({ preserve_interword_spaces: '1' });
      return w;
    })().catch((e) => { workerPromise = null; throw e; });
  }
  return workerPromise;
}

function scheduleIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    const p = workerPromise;
    workerPromise = null;
    try { (await p).terminate(); } catch { /* 무시 */ }
  }, IDLE_MS);
}

// 인식 잘 되게: 긴 변 2000px, 흑백
async function prepare(file) {
  const { img, url } = await loadImage(file);
  try {
    const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const g = p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114;
      p[i] = p[i + 1] = p[i + 2] = g;
    }
    ctx.putImageData(d, 0, 0);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 사진 → 글자
 * @param {File|Blob} file
 * @param {(msg: string, ratio: number) => void} onProgress
 */
export async function recognizeText(file, onProgress) {
  progressCb = (m) => {
    if (!onProgress) return;
    if (m.status === 'recognizing text') onProgress('글자 읽는 중…', 0.3 + 0.7 * (m.progress || 0));
    else onProgress('인식 프로그램 준비 중…', 0.3 * (m.progress || 0));
  };
  try {
    onProgress && onProgress('인식 프로그램 준비 중…', 0);
    const [w, canvas] = await Promise.all([getWorker(), prepare(file)]);
    const { data } = await w.recognize(canvas);
    return data.text || '';
  } finally {
    progressCb = null;
    scheduleIdle();
  }
}
