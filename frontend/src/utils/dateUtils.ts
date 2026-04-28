/**
 * Parse either a civil date (YYYY-MM-DD) or an ISO datetime.
 *
 * For date-only strings, JavaScript parses `YYYY-MM-DD` as UTC midnight, which
 * can shift to the previous day in western timezones. Appending `T00:00:00`
 * forces local interpretation.
 *
 * For full ISO datetimes (already containing a time component), preserve the
 * original timestamp and let the built-in parser handle it as-is.
 */
export const parseLocalDate = (dateStr: string): Date =>
  new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);

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
