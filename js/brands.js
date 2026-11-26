// 브랜드 사전과 폴더 분류
//
// 폴더 규칙
// - 기본: 브랜드 하나 = 폴더 하나
// - 그룹(예: 편의점)에 속한 브랜드는 그룹 폴더 안의 하위 폴더가 된다
// - 브랜드가 비어 있으면 '기타' 폴더

// 그룹: 하위 폴더로 나누는 묶음
export const GROUPS = {
  cvs: { label: '편의점', emo: '🏪', color: '#7C5CFF' },
};

// 분류별 기본 아이콘 (폴더 카드에 표시)
const CAT_EMO = {
  cvs: '🏪', cafe: '☕️', oliveyoung: '🫒', daiso: '🧺', beauty: '💄', bakery: '🍰',
  food: '🍗', mart: '🛒', voucher: '💳', etc: '🎁',
};
const CAT_COLOR = {
  cvs: '#7C5CFF', cafe: '#B07B4F', oliveyoung: '#9ACD32', daiso: '#E60012', beauty: '#FF5C8A',
  bakery: '#F2A93B', food: '#E5484D', mart: '#2E9E6A', voucher: '#3B82F6', etc: '#8A8178',
};

// [정식 이름, 분류, 별칭들]
export const BRANDS = [
  ['CU', 'cvs', ['CU', '씨유', 'CU편의점', 'BGF리테일']],
  ['GS25', 'cvs', ['GS25', 'GS 25', '지에스25', 'GS편의점']],
  ['세븐일레븐', 'cvs', ['세븐일레븐', '7-ELEVEN', '7ELEVEN', '7-11', 'SEVENELEVEN']],
  ['이마트24', 'cvs', ['이마트24', 'EMART24']],
  ['미니스톱', 'cvs', ['미니스톱', 'MINISTOP']],
  ['스타벅스', 'cafe', ['스타벅스', 'STARBUCKS']],
  ['투썸플레이스', 'cafe', ['투썸플레이스', '투썸', 'TWOSOME']],
  ['이디야', 'cafe', ['이디야', 'EDIYA']],
  ['메가MGC커피', 'cafe', ['메가MGC', '메가커피', 'MGC커피', '메가엠지씨']],
  ['컴포즈커피', 'cafe', ['컴포즈', 'COMPOSE']],
  ['빽다방', 'cafe', ['빽다방']],
  ['할리스', 'cafe', ['할리스', 'HOLLYS']],
  ['폴바셋', 'cafe', ['폴바셋', 'PAULBASSETT']],
  ['커피빈', 'cafe', ['커피빈', 'COFFEEBEAN']],
  ['공차', 'cafe', ['공차', 'GONGCHA']],
  ['파스쿠찌', 'cafe', ['파스쿠찌']],
  ['엔제리너스', 'cafe', ['엔제리너스']],
  ['올리브영', 'oliveyoung', ['올리브영', 'OLIVEYOUNG', '올영']],
  ['다이소', 'daiso', ['다이소', 'DAISO', '아성다이소']],
  ['파리바게뜨', 'bakery', ['파리바게뜨', '파리바게트', 'PARISBAGUETTE']],
  ['뚜레쥬르', 'bakery', ['뚜레쥬르', 'TOUSLESJOURS']],
  ['배스킨라빈스', 'bakery', ['배스킨라빈스', '베스킨라빈스', 'BASKIN']],
  ['던킨', 'bakery', ['던킨', 'DUNKIN']],
  ['설빙', 'bakery', ['설빙']],
  ['BBQ', 'food', ['BBQ', '비비큐']],
  ['BHC', 'food', ['BHC']],
  ['교촌치킨', 'food', ['교촌']],
  ['굽네치킨', 'food', ['굽네']],
  ['맥도날드', 'food', ['맥도날드', 'MCDONALD']],
  ['버거킹', 'food', ['버거킹', 'BURGERKING']],
  ['롯데리아', 'food', ['롯데리아', 'LOTTERIA']],
  ['맘스터치', 'food', ['맘스터치']],
  ['KFC', 'food', ['KFC']],
  ['도미노피자', 'food', ['도미노']],
  ['피자헛', 'food', ['피자헛']],
  ['서브웨이', 'food', ['서브웨이', 'SUBWAY']],
  ['아웃백', 'food', ['아웃백', 'OUTBACK']],
  ['배달의민족', 'food', ['배달의민족', '배민']],
  ['요기요', 'food', ['요기요']],
  ['이마트', 'mart', ['이마트', 'EMART']],
  ['홈플러스', 'mart', ['홈플러스']],
  ['롯데마트', 'mart', ['롯데마트']],
  ['신세계상품권', 'voucher', ['신세계상품권', '신세계모바일']],
  ['롯데상품권', 'voucher', ['롯데상품권', '롯데모바일상품권']],
  ['현대백화점', 'voucher', ['현대백화점', '현대상품권']],
  ['컬쳐랜드', 'voucher', ['컬쳐랜드', '컬처랜드', 'CULTURELAND']],
  ['해피머니', 'voucher', ['해피머니']],
  ['문화상품권', 'voucher', ['문화상품권']],
  ['북앤라이프', 'voucher', ['북앤라이프', '도서문화상품권']],
  ['구글플레이', 'voucher', ['구글플레이', 'GOOGLEPLAY']],
  ['네이버페이', 'voucher', ['네이버페이', 'NAVERPAY']],
  ['쿠팡', 'voucher', ['쿠팡', 'COUPANG']],
];

export const norm = (s) => String(s || '').toUpperCase().replace(/[\s\-·._]/g, '');

const BY_NAME = new Map(BRANDS.map(([name, cat]) => [name, cat]));
// 정확히 일치하는 별칭 (입력 칸 정규화용)
const EXACT = new Map();
for (const [name, , aliases] of BRANDS) {
  EXACT.set(norm(name), name);
  for (const a of aliases) EXACT.set(norm(a), name);
}
// 긴 별칭부터 (본문 검색용: '이마트24'가 '이마트'보다 먼저 잡히게)
const ALIASES = BRANDS
  .flatMap(([name, , aliases]) => aliases.map((a) => ({ a: norm(a), name, raw: a })))
  .sort((x, y) => y.a.length - x.a.length);

// 입력한 브랜드를 정식 이름으로 (모르는 브랜드면 입력 그대로)
export function canonicalBrand(input) {
  const s = String(input || '').trim();
  return EXACT.get(norm(s)) || s;
}

// 긴 텍스트(OCR 결과 등)에서 브랜드 찾기
// 3글자 이하 짧은 별칭('CU', 'BHC', '7-11')은 앞뒤가 끊긴 단어일 때만 인정한다
// ('CUP'의 CU, '2027.11.30'의 711 같은 오인식 방지)
export function findBrandIn(text) {
  const n = norm(text);
  const upper = String(text || '').toUpperCase();
  for (const { a, name, raw } of ALIASES) {
    if (!a) continue;
    if (a.length <= 3) {
      const re = new RegExp(`(^|[^A-Z0-9가-힣])${raw.toUpperCase().replace(/[-.]/g, '\\$&')}(?=$|[^A-Z0-9가-힣])`);
      if (re.test(upper)) return name;
    } else if (n.includes(a)) {
      return name;
    }
  }
  return '';
}

export const categoryOf = (brand) => BY_NAME.get(canonicalBrand(brand)) || 'etc';

// 항목이 들어갈 폴더
// { key, label, emo, color, sub } — sub는 그룹 폴더 안 하위 폴더 이름 (없으면 null)
export function folderOf(item) {
  const brand = canonicalBrand(item.brand);
  if (!brand) return { key: '기타', label: '기타', emo: CAT_EMO.etc, color: CAT_COLOR.etc, sub: null };
  const cat = categoryOf(brand);
  const g = GROUPS[cat];
  if (g) return { key: g.label, label: g.label, emo: g.emo, color: g.color, sub: brand };
  return { key: brand, label: brand, emo: CAT_EMO[cat] || CAT_EMO.etc, color: CAT_COLOR[cat] || CAT_COLOR.etc, sub: null };
}

export const knownBrandNames = () => BRANDS.map(([name]) => name);
