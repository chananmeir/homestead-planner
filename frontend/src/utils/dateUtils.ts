/**
 * Parse a date string (YYYY-MM-DD) as a local date, avoiding timezone shifts.
 *
 * JavaScript's `new Date('2026-03-23')` parses as UTC midnight, which can shift
 * to the previous day in western timezones. Appending 'T00:00:00' forces local
 * interpretation.
 */
export const parseLocalDate = (dateStr: string): Date => new Date(dateStr + 'T00:00:00');
