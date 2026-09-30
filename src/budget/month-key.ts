// Budget months are `YYYY-MM` keys (capability `api-conventions`). Keys compare correctly as
// plain strings, which is what sorting relies on.
export type MonthKey = string;

export const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === 'string' && MONTH_KEY_PATTERN.test(value);
}

export function assertMonthKey(value: unknown): MonthKey {
  if (!isMonthKey(value)) {
    throw new RangeError(`Invalid month key: ${String(value)}`);
  }
  return value;
}

function toParts(month: MonthKey): { year: number; month: number } {
  assertMonthKey(month);
  return { year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) };
}

function fromIndex(index: number): MonthKey {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

function toIndex(month: MonthKey): number {
  const parts = toParts(month);
  return parts.year * 12 + (parts.month - 1);
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  return fromIndex(toIndex(month) + delta);
}

export function compareMonths(a: MonthKey, b: MonthKey): number {
  return toIndex(a) - toIndex(b);
}

// Inclusive range from `from` to `to`; empty when `from` is after `to`.
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  for (let i = toIndex(from); i <= toIndex(to); i++) {
    months.push(fromIndex(i));
  }
  return months;
}

// Budget month of an instant in the plan's time zone, so an expense on the 30th at 23:30 local
// time never lands in the next month because of UTC.
export function monthOfInstant(instant: Date, timeZone: string): MonthKey {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(instant);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return assertMonthKey(`${year}-${month}`);
}

export function currentMonth(
  timeZone: string,
  now: Date = new Date(),
): MonthKey {
  return monthOfInstant(now, timeZone);
}
