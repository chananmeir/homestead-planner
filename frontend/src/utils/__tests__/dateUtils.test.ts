import { formatLocalDate, parseLocalDate } from '../dateUtils';

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
});
