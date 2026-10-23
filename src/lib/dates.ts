// Date helpers that work on plain "YYYY-MM-DD" strings in America/Sao_Paulo.
// All arithmetic uses UTC-noon Date objects so no timezone shift can change the day.

export const TIMEZONE = "America/Sao_Paulo";

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const MONTHS_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAYS_INITIAL = ["D", "S", "T", "Q", "Q", "S", "S"];

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toISO(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseISO(iso: string) {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return { y, m, d };
}

function toUTC(iso: string) {
  const { y, m, d } = parseISO(iso);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function fromUTC(date: Date) {
  return toISO(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Today's date in São Paulo, YYYY-MM-DD. */
export function todayISO(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

/** Current time in São Paulo, HH:mm. */
export function nowTime(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export function currentHour(now: Date = new Date()) {
  return Number(nowTime(now).slice(0, 2));
}

export function addDays(iso: string, days: number) {
  const date = toUTC(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUTC(date);
}

export function diffDays(a: string, b: string) {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86_400_000);
}

export function weekday(iso: string) {
  return toUTC(iso).getUTCDay();
}

export function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function shiftMonth(y: number, m: number, delta: number) {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

/** 6x7 grid (weeks start on Sunday). Cells outside the month carry inMonth=false. */
export function monthGrid(y: number, m: number) {
  const first = toISO(y, m, 1);
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 42 }, (_, i) => {
    const iso = addDays(start, i);
    return { iso, day: parseISO(iso).d, inMonth: parseISO(iso).m === m };
  });
}

export function monthLabel(y: number, m: number) {
  const name = MONTHS[m - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

/** "14 de outubro de 2026" */
export function formatLong(iso: string) {
  const { y, m, d } = parseISO(iso);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

/** "terça, 14 de outubro" */
export function formatWeekdayLong(iso: string) {
  const { m, d } = parseISO(iso);
  return `${WEEKDAYS[weekday(iso)]}, ${d} de ${MONTHS[m - 1]}`;
}

/** "14 out" */
export function formatShort(iso: string) {
  const { m, d } = parseISO(iso);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** "Ter" */
export function formatWeekdayShort(iso: string) {
  return WEEKDAYS_SHORT[weekday(iso)];
}

/** "14/10/2026" */
export function formatNumeric(iso: string) {
  const { y, m, d } = parseISO(iso);
  return `${pad(d)}/${pad(m)}/${y}`;
}

export function relativeDayLabel(iso: string, today: string) {
  const diff = diffDays(iso, today);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  return null;
}

export function greeting(now: Date = new Date()) {
  const h = currentHour(now);
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidISO(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { y, m, d } = parseISO(value);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}
