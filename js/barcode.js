// 바코드 그리기 — Code 128 직접 구현 (외부 라이브러리 없음)
// 한국 기프티콘은 대부분 숫자 12~16자리 Code 128이라, 숫자는 C 세트로 짧게 만든다.

// 값 0~106의 막대/공백 폭 (모듈 단위). 106은 정지 코드
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104, START_C = 105, CODE_B = 100, CODE_C = 99, STOP = 106;

const isDigit = (c) => c >= '0' && c <= '9';
const digitRun = (s, i) => { let n = 0; while (i + n < s.length && isDigit(s[i + n])) n++; return n; };

// 문자열 → Code 128 값 배열 (체크섬, 정지 코드 포함). 표현 못 하는 문자가 있으면 null
export function encodeCode128(text) {
  const s = String(text);
  if (!s.length) return null;
  for (const ch of s) { const c = ch.charCodeAt(0); if (c < 32 || c > 126) return null; }

  const codes = [];
  let i = 0;
  const lead = digitRun(s, 0);
  let set = (lead >= 4 || (lead === s.length && lead % 2 === 0)) ? 'C' : 'B';
  codes.push(set === 'C' ? START_C : START_B);

  while (i < s.length) {
    if (set === 'C') {
      if (digitRun(s, i) >= 2) {
        codes.push(Number(s.substr(i, 2)));
        i += 2;
      } else {
        codes.push(CODE_B); set = 'B';
      }
    } else {
      const run = digitRun(s, i);
      // 숫자가 4개 이상 이어지면 C로 바꾼다 (홀수면 한 글자는 B로 먼저)
      if (run >= 4) {
        if (run % 2 === 1) { codes.push(s.charCodeAt(i) - 32); i++; }
        codes.push(CODE_C); set = 'C';
      } else {
        codes.push(s.charCodeAt(i) - 32);
        i++;
      }
    }
  }

  let sum = codes[0];
  for (let k = 1; k < codes.length; k++) sum += codes[k] * k;
  codes.push(sum % 103, STOP);
  return codes;
}

// 값 배열 → 모듈 폭 배열 (막대부터 시작해서 막대/공백 번갈아)
export function code128Widths(text) {
  const codes = encodeCode128(text);
  if (!codes) return null;
  return codes.flatMap((v) => PATTERNS[v].split('').map(Number));
}

// SVG 문자열. 실패하면 ''
export function barcodeSVG(text, { height = 100, quiet = 10 } = {}) {
  const widths = code128Widths(text);
  if (!widths) return '';
  const total = widths.reduce((a, b) => a + b, 0) + quiet * 2;
  let x = quiet;
  let rects = '';
  widths.forEach((w, idx) => {
    if (idx % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="${height}"/>`;
    x += w;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height}" preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="바코드 ${String(text).replace(/[<>&"]/g, '')}">
    <rect width="${total}" height="${height}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

// 보기 좋게 4자리씩 띄우기
export const formatBarcode = (s) => String(s || '').replace(/(\d{4})(?=\d)/g, '$1 ');
