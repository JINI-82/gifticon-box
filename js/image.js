// 사진 처리 — 전부 기기 안에서. 저장 용량을 줄이려고 긴 변 기준으로 축소한다.

const MAX_SIDE = 1600;
const QUALITY = 0.85;

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했어')); };
    img.src = url;
  });
}

// 파일 → 축소한 JPEG Blob. 실패하면 원본 그대로
export async function shrinkImage(file) {
  let loaded;
  try {
    loaded = await loadImage(file);
    const { img } = loaded;
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.size < 600 * 1024) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', QUALITY));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  } finally {
    if (loaded) URL.revokeObjectURL(loaded.url);
  }
}

// 항목 이미지용 object URL 캐시 (화면에 다시 그릴 때마다 새로 만들지 않게)
const urls = new Map();

export function imageURL(item) {
  if (!item || !item.image) return '';
  const hit = urls.get(item.id);
  if (hit && hit.blob === item.image) return hit.url;
  if (hit) URL.revokeObjectURL(hit.url);
  const url = URL.createObjectURL(item.image);
  urls.set(item.id, { blob: item.image, url });
  return url;
}

export function forgetImage(id) {
  const hit = urls.get(id);
  if (hit) { URL.revokeObjectURL(hit.url); urls.delete(id); }
}
