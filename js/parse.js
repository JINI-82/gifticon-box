// OCR 글자에서 기프티콘 정보 뽑기 (규칙 기반, 기기 안에서)
// 결과는 추측이라 저장 전에 사람이 꼭 확인한다.
import { findBrandIn, canonicalBrand, norm } from './brands.js';

const pad = (n) => String(n).padStart(2, '0');

// 한글 글자 사이에 끼어든 공백 정리: '스 타 벅 스' → '스타벅스'
function tidy(line) {
  let s = line.replace(/[|_~`'"“”‘’]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const tokens = s.split(' ');
  const singles = tokens.filter((t) => /^[가-힣]$/.test(t)).length;
  if (tokens.length >= 3 && singles / tokens.length >= 0.5) s = s.replace(/(?<=[가-힣]) (?=[가-힣])/g, '');
  return s;
}

function validDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1) return null; // 2월 30일 같은 것
  if (y < 2015 || y > 2045) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

const EXPIRY_WORDS = /유효|기한|기간|만료|까지|~|사용기한|valid/i;

export function findExpiry(lines) {
  const full = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g;
  const short = /(?<!\d)(\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?!\d)/g;
  const withKw = [];
  const all = [];
  lines.forEach((line, i) => {
    const ctx = `${lines[i - 1] || ''} ${line}`;
    const kw = EXPIRY_WORDS.test(ctx);
    let m;
    full.lastIndex = 0;
    while ((m = full.exec(line))) {
      const s = validDate(+m[1], +m[2], +m[3]);
      if (s) { all.push(s); if (kw) withKw.push(s); }
    }
    if (kw) { // 26.12.31 같은 두 자리 연도는 기한 단어가 있을 때만
      short.lastIndex = 0;
      while ((m = short.exec(line))) {
        const s = validDate(2000 + +m[1], +m[2], +m[3]);
        if (s) withKw.push(s);
      }
    }
  });
  // '2026.11.26 ~ 2027.11.26'처럼 여러 개면 가장 늦은 날짜가 만료일
  const pick = (withKw.length ? withKw : all).sort().pop();
  return pick || '';
}

export function findAmount(lines) {
  const found = [];
  for (const line of lines) {
    const hint = /금액|잔액|가격|권|충전|상품권|원권/.test(line);
    if (/주문|번호|전화|사업자/.test(line)) continue;
    let m;
    const won = /(\d{1,3}(?:[,.]\d{3})+|\d{3,7})\s*원/g;
    while ((m = won.exec(line))) found.push({ v: +m[1].replace(/[,.]/g, ''), hint });
    const man = /(\d{1,3})\s*만\s*원/g;
    while ((m = man.exec(line))) found.push({ v: +m[1] * 10000, hint: true });
    const cheon = /(\d{1,2})\s*천\s*원/g;
    while ((m = cheon.exec(line))) found.push({ v: +m[1] * 1000, hint: true });
  }
  const ok = found.filter((a) => a.v >= 100 && a.v <= 5000000 && a.v % 10 === 0);
  if (!ok.length) return null;
  const hinted = ok.filter((a) => a.hint);
  return (hinted.length ? hinted[0] : ok.reduce((a, b) => (b.v > a.v ? b : a))).v;
}

export function findBarcodeNumber(lines) {
  const cands = [];
  for (const line of lines) {
    if (/주문|문의|전화|고객|사업자|TEL|유효|기간|금액/i.test(line)) continue;
    const pure = /^[\d\s-]{10,}$/.test(line);
    for (const x of line.replace(/[\s-]/g, '').match(/\d{10,20}/g) || []) cands.push({ x, pure });
  }
  cands.sort((a, b) => (b.pure - a.pure) || (b.x.length - a.x.length));
  return cands[0] ? cands[0].x : '';
}

export function findBrand(lines, raw) {
  const exchange = lines.find((l) => /교환처|사용처|브랜드|매장/.test(l));
  return (exchange && findBrandIn(exchange)) || findBrandIn(raw) || '';
}

// 상품명이 아닌 줄. ('금액권 5천원'처럼 상품명에 '금액'이 들어갈 수 있어서 '금액 4,700원' 같은 항목 줄만 뺀다)
const NOT_NAME = /유효|기간|기한|교환처|사용처|주문|번호|사용|문의|선물|보낸|받는|만료|바코드|고객|발행|일시|쿠폰|까지|매장|님(\s|$)|^(금액|잔액|가격|결제)\s*[:：]?\s*[\d,.]+\s*원?$|^[\d\s\-.:~,원]+$/;

// 판매 상품 이름에 자주 나오는 말 (점수 가산)
const PRODUCT_WORDS = /권|상품권|금액권|교환권|이용권|세트|라떼|아메리카노|커피|음료|케이크|버거|치킨|피자|도넛|아이스|컵|우유|\d+\s*(ml|g|kg|개|개월|일|매|인)|천\s*원|만\s*원|\b[TGVL]$/i;

// 화면 캡처에 섞이는 잡음: 상태 표시줄, 주소창, 앱 버튼·탭 이름
const SCREEN_NOISE = new RegExp([
  '\\b\\d{1,2}:\\d{2}\\b', '\\bLTE\\b', '\\b5G\\b', 'wi-?fi',
  '\\.(com|co\\.kr|net|kr)\\b', 'www', 'https?',
  '모바일\\s*쿠폰', '상품\\s*정보', '유의\\s*사항', '확대', '선물함', '복사', '공유', '저장', '다운로드',
  '기프티쇼', 'giftishow', '카카오', 'kakao', '기프티콘', '내\\s*마음', '이용\\s*안내', '은행',
  '선물\\s*하기', '나에게', '추가\\s*결제', '친구에게', '크게\\s*보기', '\\bpay\\b',
  '쇼핑', '축제', '이벤트', '광고', '할인', '혜택', '놓칠', '받기', '보내기', '\\d+\\s*%',
].join('|'), 'i');

const isDateLine = (l) => EXPIRY_WORDS.test(l) || /20\d{2}\s*[.\-/년]/.test(l);

export function findName(lines, brand) {
  // '[스타벅스] 아메리카노 T' 형태가 가장 확실
  const bracket = lines.find((l) => /^\[[^\]]+\]\s*\S/.test(l) && !SCREEN_NOISE.test(l));
  if (bracket) return bracket.replace(/^\[[^\]]*\]\s*/, '').trim();
  const b = norm(brand);
  const isBrandLine = (l) => !!l && !!b && (norm(l) === b || canonicalBrand(l) === brand);

  // 줄마다 점수를 매겨 가장 상품명다운 줄을 고른다
  let best = null;
  lines.forEach((raw, i) => {
    const l = raw.replace(/^\[[^\]]*\]\s*/, '').trim();
    if (l.length < 2 || l.length > 40) return;
    if (!/[가-힣A-Za-z]{2,}/.test(l) || NOT_NAME.test(l) || SCREEN_NOISE.test(l)) return;
    if (isBrandLine(l)) return; // 브랜드 이름만 있는 줄('지에스25', 'CU')
    const hangul = (l.match(/[가-힣]/g) || []).length;
    const latin = (l.match(/[A-Za-z]/g) || []).length;
    if (hangul + latin < 3) return;                             // 'op. 님' 같은 부스러기
    const odd = (l.match(/[^가-힣A-Za-z0-9\s()\-+&.,/%]/g) || []).length;
    let score = Math.min(hangul, 15) * 2 + Math.min(latin, 6) - odd * 3;
    if (!hangul) score -= 8;                                    // 상품명은 대개 한글
    if (isBrandLine(lines[i - 1])) score += 15;                 // 브랜드 바로 다음 줄
    if (isDateLine(lines[i + 1] || '') || isDateLine(lines[i + 2] || '')) score += 8; // 유효기간 바로 위
    if (/[가-힣]\)/.test(l)) score += 3;                        // '농심)육개장' 같은 제조사 표기
    if (PRODUCT_WORDS.test(l)) score += 6;                      // 권·라떼·개월 같은 상품 단어
    if (score > 0 && (!best || score > best.score)) best = { name: l, score };
  });
  if (!best) return '';
  // 브랜드 이름이 앞에 붙어 있으면 뗀다: '스타벅스 아메리카노' → '아메리카노'
  let name = best.name;
  if (brand && norm(name).startsWith(b) && name.length > brand.length) {
    const rest = name.replace(new RegExp(`^${brand.split('').join('\\s*')}\\s*`, 'i'), '').trim();
    // 'CU 3,000원권'처럼 남는 게 숫자로 시작하면 브랜드를 그대로 둔다
    if (rest.length >= 2 && !/^\d/.test(rest)) name = rest;
  }
  return name;
}

/**
 * @param {string} raw OCR 결과 전체
 * @returns {{brand: string, name: string, expiresAt: string, amount: number|null, barcode: string}}
 */
export function parseGifticon(raw) {
  const lines = String(raw || '').split(/\r?\n/).map(tidy).filter(Boolean);
  const text = lines.join('\n');
  const brand = canonicalBrand(findBrand(lines, text));
  return {
    brand,
    name: findName(lines, brand),
    expiresAt: findExpiry(lines),
    amount: findAmount(lines),
    barcode: findBarcodeNumber(lines),
  };
}
