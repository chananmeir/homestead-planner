/**
 * Dashboard stale Missed-bucket E2E (Slice C).
 *
 * Verifies the end-to-end path for an aged-out indoor-start reminder:
 *   1. Create a PlantingEvent with seed_start_date 30 days before the
 *      simulated "today".
 *   2. Set the backend simulation clock to that "today" so the dashboard
 *      computes target_date the same way the user will see it.
 *   3. Load the Dashboard tab.
 *   4. Assert the primary "Needs Attention Today" feed does NOT contain
 *      the stale row (it's been filtered into the Missed bucket).
 *   5. Expand the "Missed (N)" <details> section.
 *   6. Assert the row is present, click it, and verify the app deep-links
 *      to the Indoor Starts tab (same deep-link behavior as the live feed).
 *
 * Plan: dev/active/production-readiness-audit/dashboard-stale-needs-attention-plan.md §3 Slice C
 * Requires both servers running (backend :5000, frontend :3000).
 */
import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateToSubTab } from './helpers/navigation';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const TEST_USER = {
  username: `dash_stale_${RUN_ID}`,
  email: `dash_stale_${RUN_ID}@test.com`,
  password: 'DashStale1!',
};

// Simulated "today" (stable within the test, unrelated to real calendar date).
const SIM_TODAY = '2026-04-24';
// 30 days before SIM_TODAY → well past STALE_INDOOR_START_DAYS (14).
const SEED_START_DATE = '2026-03-25';

test.describe('Dashboard stale Missed bucket — E2E', () => {
  let ctx: APIRequestContext;
  let createdEventId: number;

  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });
    await registerViaAPI(ctx, TEST_USER.username, TEST_USER.email, TEST_USER.password);
    await loginViaAPI(ctx, TEST_USER.username, TEST_USER.password);

    // Create an indoor-start PlantingEvent 30 days in the past (relative to
    // the simulated today). The backend dashboard service will classify this
    // as `missed.indoorStartsDue` because 30 > STALE_INDOOR_START_DAYS (14).
    const resp = await ctx.post('/api/planting-events', {
      data: {
        eventType: 'planting',
        plantId: 'tomato-1',
        variety: `StaleTomato ${RUN_ID}`,
        seedStartDate: SEED_START_DATE,
        // expectedHarvestDate is required by the POST endpoint. 90d past SIM_TODAY
        // keeps the event from also becoming a harvestReady row (which would
        // clutter the primary feed and obscure the stale-bucket assertion).
        expectedHarvestDate: '2026-08-01',
        quantity: 4,
      },
    });
    if (!resp.ok()) {
      const body = await resp.text();
      throw new Error(`Failed to create planting event: ${resp.status()} - ${body}`);
    }
    expect([200, 201]).toContain(resp.status());
    const event = await resp.json();
    createdEventId = event.id;
    expect(createdEventId).toBeGreaterThan(0);
  });

  test.afterAll(async () => {
    // Clear simulation clock so other tests aren't affected.
    await ctx.post('/api/simulation/set-date', { data: { date: null } }).catch(() => {});
    if (createdEventId) {
      await ctx.delete(`/api/planting-events/${createdEventId}`).catch(() => {});
    }
    await ctx.dispose();
  });

  test('stale indoor-start is absent from primary feed, present in Missed bucket, deep-links to Indoor Starts', async ({ page }) => {
    // Set simulation clock BEFORE the UI loads so useToday picks up the
    // simulated value on mount.
    const simResp = await ctx.post('/api/simulation/set-date', {
      data: { date: SIM_TODAY },
    });
    expect(simResp.ok()).toBeTruthy();

    // Sanity check the API directly: stale item in missed, not signals.
    const apiResp = await ctx.get(`/api/dashboard/today?date=${SIM_TODAY}`);
    expect(apiResp.ok()).toBeTruthy();
    const apiBody = await apiResp.json();
    expect(apiBody.missed).toBeDefined();
    const missedStarts = apiBody.missed.indoorStartsDue as Array<{ plantingEventId: number }>;
    const signalsStarts = apiBody.signals.indoorStartsDue as Array<{ plantingEventId: number }>;
    expect(missedStarts.some((r) => r.plantingEventId === createdEventId)).toBe(true);
    expect(signalsStarts.some((r) => r.plantingEventId === createdEventId)).toBe(false);

    // Now exercise the UI. Log in and navigate to Dashboard.
    await page.goto('/');
    await login(page, TEST_USER.username, TEST_USER.password);

    // Dashboard is the default landing tab; click it explicitly for
    // idempotency in case a prior session landed elsewhere.
    await page.getByRole('button', { name: /^Dashboard$/ }).first().click();
    await page.waitForLoadState('networkidle');

    // Verify the Needs Attention Today panel renders.
    await expect(page.getByText(/Needs Attention Today/i)).toBeVisible({ timeout: 10000 });

    // The stale row must NOT appear in the primary feed. We search for the
    // variety in its "Indoor start due" row rendering.
    const primaryFeedRegion = page.locator('text=/Needs Attention Today/i').locator('xpath=ancestor::div[1]');
    // Assert the stale variety does not render in the primary feed area.
    // We use a broader check: the entire panel minus the <details> section.
    const staleLabel = `Indoor start due — Tomato (StaleTomato ${RUN_ID})`;

    // Wait a beat for the fetch to resolve and rows to render.
    await page.waitForTimeout(500);

    // The Missed summary is the only place this variety appears. Look for
    // the "Missed (N)" summary first.
    const missedSummary = page.getByText(/^Missed \(\d+\)$/);
    await expect(missedSummary).toBeVisible({ timeout: 5000 });

    // Confirm row not yet visible (collapsed by default).
    await expect(page.getByText(staleLabel)).not.toBeVisible();

    // Expand the Missed section.
    await missedSummary.click();

    // Row should now be visible.
    await expect(page.getByText(staleLabel)).toBeVisible({ timeout: 3000 });

    // Click the row — should deep-link to Indoor Starts tab.
    await page.getByText(staleLabel).click();
    await page.waitForLoadState('networkidle');

    // Indoor Starts tab should now be active. We detect this by checking
    // for a known Indoor Starts heading / breadcrumb that's only present
    // on that tab. The button "Start Seeds" is a stable Indoor Starts
    // signal (Indoor Starts screen header, see IndoorSeedStarts.tsx).
    await expect(
      page.getByRole('button', { name: /Start Seeds|From Garden Plan/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });
});
