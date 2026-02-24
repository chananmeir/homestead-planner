import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const GP_USER = {
  username: `gp_test_${RUN_ID}`,
  email: `gp_test_${RUN_ID}@test.com`,
  password: 'GpTest1!',
};

/**
 * Garden Planner — Full Lifecycle E2E Tests
 *
 * Covers: plan CRUD, succession planting, multi-bed allocation,
 * export-to-calendar, idempotency, rotation checking, nutrition estimates.
 *
 * Strategy: API-first setup for speed + UI verification where needed.
 */
test.describe.serial('Garden Planner — Full Lifecycle', () => {
  let ctx: APIRequestContext;
  const bedIds: number[] = [];
  let planId: number;
  let successionPlanId: number;

  // ── Setup: register user, login, create 3 beds ──────────────────────
  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({
      baseURL: BACKEND_URL,
    });

    await registerViaAPI(ctx, GP_USER.username, GP_USER.email, GP_USER.password);
    await loginViaAPI(ctx, GP_USER.username, GP_USER.password);

    // Create 3 beds for multi-bed tests
    for (let i = 1; i <= 3; i++) {
      const resp = await ctx.post('/api/garden-beds', {
        data: {
          name: `GP-Bed-${i}-${RUN_ID}`,
          width: 4,
          length: 8,
          planningMethod: 'square-foot',
        },
      });
      expect(resp.ok()).toBeTruthy();
      const bed = await resp.json();
      bedIds.push(bed.id);
    }

    expect(bedIds).toHaveLength(3);
  });

  test.afterAll(async () => {
    await ctx.dispose();
  });

  // ── GP-01: Create plan via API → UI verify in plan list ─────────────
  test('GP-01: Create plan via API, verify in plan list UI', async ({ page }) => {
    // Create plan with a single tomato item via API
    const resp = await ctx.post('/api/garden-plans', {
      data: {
        name: `Tomato Plan ${RUN_ID}`,
        year: 2026,
        items: [
          {
            plantId: 'tomato-1',
            unitType: 'plants',
            targetValue: 12,
            plantEquivalent: 12,
            successionEnabled: false,
            successionCount: 1,
            bedAssignments: [{ bedId: bedIds[0], quantity: 12 }],
            firstPlantDate: '2026-05-15',
          },
        ],
      },
    });
    expect(resp.status()).toBe(201);
    const plan = await resp.json();
    planId = plan.id;
    expect(planId).toBeDefined();

    // UI: login + navigate to Garden Planner
    await page.goto('/');
    await login(page, GP_USER.username, GP_USER.password);
    await navigateTo(page, TABS.GARDEN_PLANNER);

    // Verify plan card is visible
    await expect(
      page.locator(`[data-testid="plan-card-${planId}"]`)
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator(`[data-testid="plan-card-${planId}"]`).getByText(`Tomato Plan ${RUN_ID}`)
    ).toBeVisible();
  });

  // ── GP-02: View plan detail — verify tomato item ────────────────────
  test('GP-02: View plan detail, verify tomato item and no succession', async ({ page }) => {
    await page.goto('/');
    await login(page, GP_USER.username, GP_USER.password);
    await navigateTo(page, TABS.GARDEN_PLANNER);

    // Click View button
    await page.locator(`[data-testid="plan-view-${planId}"]`).click();
    await page.waitForLoadState('networkidle');

    // Verify plan detail shows tomato item
    await expect(page.getByText('tomato-1').first()).toBeVisible({ timeout: 10000 });

    // Verify succession column shows "None" (no succession)
    await expect(page.getByText('None').first()).toBeVisible();

    // Verify status is "planned"
    await expect(page.getByText('planned').first()).toBeVisible();
  });

  // ── GP-03: Add lettuce with 4 successions via PUT ───────────────────
  test('GP-03: Add lettuce with 4 successions, verify in UI', async ({ page }) => {
    // Get current plan
    const getResp = await ctx.get(`/api/garden-plans/${planId}`);
    expect(getResp.ok()).toBeTruthy();
    const plan = await getResp.json();

    // Add lettuce item with 4 successions
    const updatedItems = [
      ...plan.items,
      {
        plantId: 'lettuce-1',
        unitType: 'plants',
        targetValue: 32,
        plantEquivalent: 32,
        successionEnabled: true,
        successionCount: 4,
        successionIntervalDays: 14,
        bedAssignments: [{ bedId: bedIds[0], quantity: 32 }],
        firstPlantDate: '2026-04-15',
      },
    ];

    const putResp = await ctx.put(`/api/garden-plans/${planId}`, {
      data: {
        name: plan.name,
        year: plan.year,
        items: updatedItems,
      },
    });
    expect(putResp.ok()).toBeTruthy();

    // UI: verify succession indicator visible in plan detail
    await page.goto('/');
    await login(page, GP_USER.username, GP_USER.password);
    await navigateTo(page, TABS.GARDEN_PLANNER);
    await page.locator(`[data-testid="plan-view-${planId}"]`).click();
    await page.waitForLoadState('networkidle');

    // Verify "4x" succession indicator is shown
    await expect(page.getByText('4x').first()).toBeVisible({ timeout: 10000 });
  });

  // ── GP-04: Create carrot with 8 successions (API-only) ─────────────
  test('GP-04: Create plan with 8 successions, verify response fields', async () => {
    const resp = await ctx.post('/api/garden-plans', {
      data: {
        name: `Succession Plan ${RUN_ID}`,
        year: 2026,
        items: [
          {
            plantId: 'carrot-1',
            unitType: 'plants',
            targetValue: 64,
            plantEquivalent: 64,
            successionEnabled: true,
            successionCount: 8,
            successionIntervalDays: 14,
            bedAssignments: [{ bedId: bedIds[1], quantity: 64 }],
            firstPlantDate: '2026-04-01',
          },
        ],
      },
    });
    expect(resp.status()).toBe(201);
    const plan = await resp.json();
    successionPlanId = plan.id;

    // Verify response has expected structure
    expect(plan.items).toHaveLength(1);
    const item = plan.items[0];
    expect(item.plantId).toBe('carrot-1');
    expect(item.successionCount).toBe(8);
    expect(item.successionIntervalDays).toBe(14);
    expect(item.plantEquivalent).toBe(64);
  });

  // ── GP-05: Multi-bed even allocation 90/3 = 30 each ────────────────
  test('GP-05: Multi-bed even allocation distributes evenly', async () => {
    const resp = await ctx.post('/api/garden-plans', {
      data: {
        name: `Even Alloc ${RUN_ID}`,
        year: 2026,
        items: [
          {
            plantId: 'pepper-1',
            unitType: 'plants',
            targetValue: 90,
            plantEquivalent: 90,
            successionEnabled: false,
            successionCount: 1,
            allocationMode: 'even',
            bedAssignments: [
              { bedId: bedIds[0], quantity: 30 },
              { bedId: bedIds[1], quantity: 30 },
              { bedId: bedIds[2], quantity: 30 },
            ],
            firstPlantDate: '2026-05-20',
          },
        ],
      },
    });
    expect(resp.status()).toBe(201);
    const plan = await resp.json();
    const item = plan.items[0];

    // Verify bed assignments preserved
    const assignments = item.bedAssignments;
    expect(assignments).toHaveLength(3);
    const quantities = assignments.map((a: { quantity: number }) => a.quantity);
    expect(quantities).toEqual([30, 30, 30]);
  });

  // ── GP-06: Multi-bed custom allocation 60/25/15 ────────────────────
  test('GP-06: Multi-bed custom allocation preserves quantities', async () => {
    const resp = await ctx.post('/api/garden-plans', {
      data: {
        name: `Custom Alloc ${RUN_ID}`,
        year: 2026,
        items: [
          {
            plantId: 'cucumber-1',
            unitType: 'plants',
            targetValue: 100,
            plantEquivalent: 100,
            successionEnabled: false,
            successionCount: 1,
            allocationMode: 'custom',
            bedAssignments: [
              { bedId: bedIds[0], quantity: 60 },
              { bedId: bedIds[1], quantity: 25 },
              { bedId: bedIds[2], quantity: 15 },
            ],
            firstPlantDate: '2026-06-01',
          },
        ],
      },
    });
    expect(resp.status()).toBe(201);
    const plan = await resp.json();
    const item = plan.items[0];

    const assignments = item.bedAssignments;
    expect(assignments).toHaveLength(3);
    // Verify custom quantities are preserved (order matches input)
    const quantities = assignments.map((a: { quantity: number }) => a.quantity);
    expect(quantities).toEqual([60, 25, 15]);
  });

  // ── GP-07: Edit plan item quantity 12→20 ────────────────────────────
  test('GP-07: Edit plan item quantity via PUT', async () => {
    // Get current plan
    const getResp = await ctx.get(`/api/garden-plans/${planId}`);
    expect(getResp.ok()).toBeTruthy();
    const plan = await getResp.json();

    // Find tomato item and update quantity
    const items = plan.items.map((item: { plantId: string; targetValue: number; plantEquivalent: number }) => {
      if (item.plantId === 'tomato-1') {
        return { ...item, targetValue: 20, plantEquivalent: 20 };
      }
      return item;
    });

    const putResp = await ctx.put(`/api/garden-plans/${planId}`, {
      data: { name: plan.name, year: plan.year, items },
    });
    expect(putResp.ok()).toBeTruthy();
    const updated = await putResp.json();

    // Verify tomato item now has quantity 20
    const tomato = updated.items.find((i: { plantId: string }) => i.plantId === 'tomato-1');
    expect(tomato).toBeTruthy();
    expect(tomato.plantEquivalent).toBe(20);
  });

  // ── GP-08: Delete plan via UI ───────────────────────────────────────
  test('GP-08: Delete plan via UI click and confirm dialog', async ({ page }) => {
    // Create a throwaway plan via API
    const resp = await ctx.post('/api/garden-plans', {
      data: {
        name: `Throwaway ${RUN_ID}`,
        year: 2026,
        items: [],
      },
    });
    expect(resp.status()).toBe(201);
    const throwaway = await resp.json();
    const throwawayId = throwaway.id;

    // UI: login + navigate
    await page.goto('/');
    await login(page, GP_USER.username, GP_USER.password);
    await navigateTo(page, TABS.GARDEN_PLANNER);

    // Verify throwaway plan is visible
    await expect(
      page.locator(`[data-testid="plan-card-${throwawayId}"]`)
    ).toBeVisible({ timeout: 10000 });

    // Click delete button
    await page.locator(`[data-testid="plan-delete-${throwawayId}"]`).click();

    // Click confirm in dialog
    await page.locator('[data-testid="confirm-dialog-confirm"]').click();

    // Verify plan card is gone
    await expect(
      page.locator(`[data-testid="plan-card-${throwawayId}"]`)
    ).not.toBeVisible({ timeout: 10000 });
  });

  // ── GP-09: Export simple plan → verify in Planting Calendar ─────────
  test('GP-09: Export plan to calendar, verify event in Planting Calendar', async ({ page }) => {
    // Export the main plan (planId) to calendar
    const exportResp = await ctx.post(
      `/api/garden-plans/${planId}/export-to-calendar`,
      { data: { conflictOverride: true } }
    );
    expect(exportResp.ok()).toBeTruthy();
    const exportResult = await exportResp.json();
    expect(exportResult.eventsCreated).toBeGreaterThanOrEqual(1);

    // UI: navigate to Planting Calendar and verify events appear
    await page.goto('/');
    await login(page, GP_USER.username, GP_USER.password);
    await navigateTo(page, TABS.PLANTING_CALENDAR);

    // Wait for calendar to load
    await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 5000 }).catch(() => {});

    // Verify "Tomato" appears somewhere in the calendar
    await expect(page.getByText('Tomato').first()).toBeVisible({ timeout: 10000 });
  });

  // ── GP-10: Export succession plan → verify 4 events with date intervals
  test('GP-10: Export succession plan, verify event count and date intervals', async () => {
    // Create a dedicated succession plan for lettuce (4 successions, 14-day interval)
    const createResp = await ctx.post('/api/garden-plans', {
      data: {
        name: `Succ Export ${RUN_ID}`,
        year: 2026,
        items: [
          {
            plantId: 'lettuce-1',
            variety: `test-succ-${RUN_ID}`,
            unitType: 'plants',
            targetValue: 32,
            plantEquivalent: 32,
            successionEnabled: true,
            successionCount: 4,
            successionIntervalDays: 14,
            bedAssignments: [{ bedId: bedIds[2], quantity: 32 }],
            firstPlantDate: '2026-04-15',
          },
        ],
      },
    });
    expect(createResp.status()).toBe(201);
    const succPlan = await createResp.json();
    const succPlanId = succPlan.id;

    // Export to calendar
    const exportResp = await ctx.post(
      `/api/garden-plans/${succPlanId}/export-to-calendar`,
      { data: { conflictOverride: true } }
    );
    expect(exportResp.ok()).toBeTruthy();
    const exportResult = await exportResp.json();
    expect(exportResult.eventsCreated).toBe(4);

    // Fetch planting events and filter by our unique variety
    const eventsResp = await ctx.get('/api/planting-events');
    expect(eventsResp.ok()).toBeTruthy();
    const allEvents = await eventsResp.json();

    const succEvents = allEvents.filter(
      (e: { variety?: string; plantId?: string }) =>
        e.variety === `test-succ-${RUN_ID}` && e.plantId === 'lettuce-1'
    );
    expect(succEvents).toHaveLength(4);

    // Sort by expected harvest date (or direct seed date) to verify intervals
    // Events should have dates spaced 14 days apart
    const dates = succEvents
      .map((e: { directSeedDate?: string; expectedHarvestDate?: string }) =>
        e.directSeedDate || e.expectedHarvestDate
      )
      .filter(Boolean)
      .sort();

    // Verify we got dates and they are spread out
    expect(dates.length).toBeGreaterThanOrEqual(2);

    // Check intervals between consecutive dates (should be ~14 days)
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(14);
    }

    // Save for idempotency test
    successionPlanId = succPlanId;
  });

  // ── GP-11: Re-export same plan → verify idempotency ─────────────────
  test('GP-11: Re-export same plan, verify eventsCreated=0 (idempotency)', async () => {
    // Re-export the succession plan from GP-10
    const exportResp = await ctx.post(
      `/api/garden-plans/${successionPlanId}/export-to-calendar`,
      { data: { conflictOverride: true } }
    );
    expect(exportResp.ok()).toBeTruthy();
    const result = await exportResp.json();

    // Idempotency: no new events should be created
    expect(result.eventsCreated).toBe(0);
  });

  // ── GP-12: Crop rotation — conflict detection ───────────────────────
  test('GP-12: Crop rotation detects family conflict', async () => {
    // Create a 2025 planting event for tomato (Solanaceae) in bed 1
    const eventResp = await ctx.post('/api/planting-events', {
      data: {
        eventType: 'planting',
        plantId: 'tomato-1',
        gardenBedId: bedIds[0],
        expectedHarvestDate: '2025-09-01',
        directSeedDate: '2025-05-15',
        quantity: 4,
      },
    });
    // Accept 201 (created) or 200
    expect([200, 201]).toContain(eventResp.status());

    // Check rotation for pepper (also Solanaceae) in same bed for 2026
    const rotResp = await ctx.post('/api/rotation/check', {
      data: {
        plantId: 'pepper-1',
        bedId: bedIds[0],
        year: 2026,
      },
    });
    expect(rotResp.ok()).toBeTruthy();
    const rotation = await rotResp.json();

    expect(rotation.has_conflict).toBe(true);
    expect(rotation.family).toBe('Solanaceae');
  });

  // ── GP-13: Nutrition estimate — API structure + UI card ─────────────
  test('GP-13: Nutrition estimate returns valid structure and renders card', async ({ page }) => {
    // API: get nutrition for the main plan
    const nutResp = await ctx.get(`/api/garden-plans/${planId}/nutrition`);
    expect(nutResp.ok()).toBeTruthy();
    const nutrition = await nutResp.json();

    // Verify response structure
    expect(nutrition).toHaveProperty('totals');
    expect(nutrition).toHaveProperty('byPlant');
    expect(nutrition.totals).toHaveProperty('calories');
    expect(nutrition.totals).toHaveProperty('proteinG');
    expect(typeof nutrition.totals.calories).toBe('number');

    // UI: navigate to plan detail, verify nutrition card renders
    await page.goto('/');
    await login(page, GP_USER.username, GP_USER.password);
    await navigateTo(page, TABS.GARDEN_PLANNER);
    await page.locator(`[data-testid="plan-view-${planId}"]`).click();
    await page.waitForLoadState('networkidle');

    // Nutrition card should be visible (either data variant or "unavailable" variant)
    await expect(
      page.locator('[data-testid="plan-nutrition-card"]')
    ).toBeVisible({ timeout: 10000 });
  });
});
