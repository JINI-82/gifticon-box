// 캘린더 일정(.ics) 만들기 — 기기 안에서 파일을 만들어 아이폰 캘린더에 넘긴다.
// 일정: 만료일 하루 종일. 알림: 만료 3일 전 오전 9시 + 당일 오전 9시.
// 바코드 번호와 사진은 넣지 않는다 (캘린더가 iCloud로 동기화될 수 있어서).
import { won, todayStr, ALERT_DAYS } from './util.js';

const CRLF = '\r\n';
const enc = new TextEncoder();

// RFC 5545 텍스트 이스케이프
const escText = (s) => String(s ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

// 한 줄은 75바이트(UTF-8)까지. 넘으면 CRLF + 공백으로 접는다 (한글이 중간에 잘리지 않게)
function fold(line) {
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
      limit = 74; // 이어지는 줄은 앞 공백 1바이트
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join(`${CRLF} `);
}

const ymd = (s) => s.replace(/-/g, '');
function nextDay(s) {
  const [y, m, d] = s.split('-').map(Number);
  return todayStr(new Date(y, m - 1, d + 1));
}
const utcStamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

export function eventTitle(item) {
  const what = [item.brand, item.name].filter(Boolean).join(' ') || '기프티콘';
  return `🎁 ${what} 만료`;
}

function eventLines(item, stamp) {
  const desc = [
    `${item.brand || ''} ${item.name || ''}`.trim(),
    item.amount ? `금액 ${won(item.amount)}` : '',
    `유효기간 ${item.expiresAt.replace(/-/g, '.')}까지`,
    '기프티콘함 앱에서 바코드를 열어 써.',
  ].filter(Boolean).join('\n');
  // 하루 종일 일정은 자정 기준이라: -2일 15시간 = 3일 전 오전 9시, +9시간 = 당일 오전 9시
  const before = `-P${ALERT_DAYS - 1}DT15H`;
  return [
    'BEGIN:VEVENT',
    `UID:${item.id}@gifticon-box`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(item.expiresAt)}`,
    `DTEND;VALUE=DATE:${ymd(nextDay(item.expiresAt))}`,
    `SUMMARY:${escText(eventTitle(item))}`,
    `DESCRIPTION:${escText(desc)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escText(`${eventTitle(item)} ${ALERT_DAYS}일 전`)}`,
    `TRIGGER:${before}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escText(`${eventTitle(item)} 오늘`)}`,
    'TRIGGER:PT9H',
    'END:VALARM',
    'END:VEVENT',
  ];
}

// 만료일 있는 항목만 들어간다
export function buildICS(items) {
  const stamp = utcStamp();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//gifticon-box//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...items.filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.expiresAt || '')).flatMap((i) => eventLines(i, stamp)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join(CRLF) + CRLF;
}

export function icsFile(items, name) {
  return new File([buildICS(items)], name, { type: 'text/calendar' });
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// 캘린더로 넘기기. 아이폰은 .ics를 열면 '캘린더에 추가' 화면이 뜬다.
// 반드시 사용자가 버튼을 누른 직후에 부른다.
export function openICS(file) {
  const url = URL.createObjectURL(file);
  if (isIOS()) {
    // 홈 화면 앱에서도 미리보기 창으로 열리게 새 창으로
    const w = window.open(url, '_blank');
    if (!w) location.href = url;
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
