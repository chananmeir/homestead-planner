/**
 * Shared test user for all P2 site-review tests.
 *
 * One fixed user, reused across all test files AND across runs.
 * Data accumulates just like a real user — if adding livestock
 * breaks the garden plan, the tests catch it.
 *
 * RUN_ID is per-run so test data (bed names, etc.) stays unique
 * and doesn't collide with data from previous runs.
 */

// Fixed RUN_ID so all test files share the same suffix across imports.
// This ensures Part 2 can find beds created in Part 1.
export const RUN_ID = 'season2025';

export const SHARED_USER = {
  username: 'sitetest',
  email: 'sitetest@test.com',
  password: 'SiteTest1!',
};

export const BACKEND_URL = 'http://localhost:5000';
