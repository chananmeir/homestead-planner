import { DateFilterValue } from '../components/common/DateFilter';

/**
 * Get date filter value from URL query parameters
 * Supports format: ?date=2025-07-15
 * Default: today's date if no param provided
 */
export const getDateFilterFromUrl = (): DateFilterValue => {
  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get('date');

  if (dateParam) {
    return { mode: 'single', date: dateParam };
  }

  // Default to today
  const today = new Date().toISOString().split('T')[0];
  return { mode: 'single', date: today };
};

/**
 * Update URL with date filter value (using browser history API)
 * This enables shareable links and browser back/forward navigation
 */
export const updateDateFilterUrl = (filter: DateFilterValue): void => {
  const url = new URL(window.location.href);

  // Set the date param
  url.searchParams.set('date', filter.date);

  // Update URL without reload (pushState)
  window.history.pushState({}, '', url);
};
