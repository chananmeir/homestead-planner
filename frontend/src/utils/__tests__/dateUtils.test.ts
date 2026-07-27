import {
  addLocalDays,
  formatDateInputValue,
  formatDisplayDate,
  formatLocalDate,
  parseDateInputValue,
  parseLocalDate,
} from '../dateUtils';

describe('dateUtils', () => {
  test('parseLocalDate preserves date-only civil dates', () => {
    const parsed = parseLocalDate('2026-05-10');

    expect(Number.isNaN(parsed.getTime())).toBe(false);
    expect(formatLocalDate(parsed)).toBe('2026-05-10');
  });

  test('parseLocalDate accepts backend ISO datetimes without producing Invalid Date', () => {
    const parsed = parseLocalDate('2026-05-10T00:00:00');

    expect(Number.isNaN(parsed.getTime())).toBe(false);
    expect(formatLocalDate(parsed)).toBe('2026-05-10');
  });

  test('date input helpers preserve selected civil dates', () => {
    const parsed = parseDateInputValue('2026-05-10');

    expect(formatDateInputValue(parsed)).toBe('2026-05-10');
  });

  test('addLocalDays uses local date arithmetic', () => {
    const parsed = parseLocalDate('2026-05-10');

    expect(formatLocalDate(addLocalDays(parsed, 14))).toBe('2026-05-24');
  });

  test('formatDisplayDate does not UTC-shift date-only values', () => {
    const label = formatDisplayDate('2026-05-10', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    expect(label).toContain('10');
    expect(label).toContain('2026');
  });
});
