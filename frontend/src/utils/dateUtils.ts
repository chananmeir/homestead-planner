/**
 * Parse a date string (YYYY-MM-DD) as a local date, avoiding timezone shifts.
 *
 * JavaScript's `new Date('2026-03-23')` parses as UTC midnight, which can shift
 * to the previous day in western timezones. Appending 'T00:00:00' forces local
 * interpretation.
 */
export const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(NaN);

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date(dateStr);

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

/**
 * Format a Date as a YYYY-MM-DD string using local time components.
 *
 * JavaScript's `Date.toISOString().split('T')[0]` formats using UTC, which can
 * shift to the next/previous day in western timezones. This uses local getters
 * to produce a civil-date string that matches what the user sees in their TZ.
 */
export const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse an <input type="date"> value as a local civil date.
 */
export const parseDateInputValue = (value: string): Date => parseLocalDate(value);

/**
 * Format a Date for an <input type="date"> value.
 */
export const formatDateInputValue = (date: Date): string => formatLocalDate(date);

/**
 * Add days using local date fields, preserving the user's civil date semantics.
 */
export const addLocalDays = (date: Date, days: number): Date => {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

/**
 * Display a date-only or ISO date string without UTC shifting.
 */
export const formatDisplayDate = (
  value: string | Date,
  options?: Intl.DateTimeFormatOptions
): string => {
  const date = value instanceof Date ? value : parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, options);
};
