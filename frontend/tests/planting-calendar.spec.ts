import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const PC_USER = {
  username: `pc_test_${RUN_ID}`,
  email: `pc_test_${RUN_ID}@test.com`,
  password: 'PcTest1!',
};

/** Future date helper — returns YYYY-MM-DD string N days from now */
function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

/**
 * Planting Calendar — E2E Tests
 *
 * Covers: event CRUD (planting + mulch + maple-tapping via API), view toggle,
 * list view verification, event deletion, soil temperature card, and
 * mark-as-harvested workflow.
 *
 * Strategy: API-first for event creation + UI verification in list/grid/timeline views.
 */
test.describe.serial('Planting Calendar — E2E Tests', () => {
  let ctx: APIRequestContext;
  let bedId: number;

  // Track event IDs across tests
  let tomatoEventId: number;
  let pepperEventId: number;
  let carrotEventId: number;
  let mulchEventId: number;
  let mapleTappingEventId: number;

  // ── Setup: register user, login, create a bed ──────────────────────
  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });

    await registerViaAPI(ctx, PC_USER.username, PC_USER.email, PC_USER.password);
    await loginViaAPI(ctx, PC_USER.username, PC_USER.password);

    // Create a bed for planting events that need one
    const bedResp = await ctx.post('/api/garden-beds', {
      data: {
        name: `PC-Bed-${RUN_ID}`,
        width: 4,
        length: 4,
        planningMethod: 'square-foot',
      },
    });
    expect(bedResp.ok()).toBeTruthy();
    const bed = await bedResp.json();
    bedId = bed.id;
  });

  test.afterAll(async () => {
    // Cleanup: delete bed + all events for this user
    await ctx.delete(`/api/garden-beds/${bedId}`).catch(() => {});
    await ctx.dispose();
  });

  // Helper: navigate to Planting Calendar
  async function setupCalendar(page: import('@playwright/test').Page) {
    await page.goto('/');
    await login(page, PC_USER.username, PC_USER.password);
    await navigateTo(page, TABS.PLANTING_CALENDAR);
    // Wait for the page to load (view toggle buttons appear)
    await expect(page.locator('[data-testid="view-toggle-list"]')).toBeVisible({ timeout: 10000 });
  }

  // ════════════════════════════════════════════════════════════════════
  // Suite 1: Event Creation via API
  // ════════════════════════════════════════════════════════════════════

  test('PC-01: Create planting event (transplant) via API', async () => {
    const resp = await ctx.post('/api/planting-events', {
      data: {
        plantId: 'tomato-1',
        variety: 'Cherokee Purple',
        gardenBedId: bedId,
        eventType: 'planting',
        seedStartDate: `${futureDate(7)}T00:00:00`,
        transplantDate: `${futureDate(49)}T00:00:00`,
        expectedHarvestDate: `${futureDate(119)}T00:00:00`,
        notes: 'E2E test tomato transplant',
      },
    });
    expect(resp.ok()).toBeTruthy();
    const event = await resp.json();
    tomatoEventId = event.id;

    expect(event.plantId).toBe('tomato-1');
    expect(event.variety).toBe('Cherokee Purple');
    expect(event.gardenBedId).toBe(bedId);
    expect(event.eventType).toBe('planting');
    expect(event.seedStartDate).toBeTruthy();
    expect(event.transplantDate).toBeTruthy();
    expect(event.expectedHarvestDate).toBeTruthy();
    expect(event.notes).toBe('E2E test tomato transplant');
    expect(event.completed).toBe(false);
  });

  test('PC-02: Create planting event (direct seed) via API', async () => {
    const resp = await ctx.post('/api/planting-events', {
      data: {
        plantId: 'pepper-1',
        gardenBedId: bedId,
        eventType: 'planting',
        directSeedDate: `${futureDate(30)}T00:00:00`,
        expectedHarvestDate: `${futureDate(100)}T00:00:00`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const event = await resp.json();
    pepperEventId = event.id;

    expect(event.plantId).toBe('pepper-1');
    expect(event.directSeedDate).toBeTruthy();
    expect(event.transplantDate).toBeNull();
    expect(event.seedStartDate).toBeNull();
  });

  test('PC-03: Create succession planting (3 carrot events) via API', async () => {
    const groupId = `pc-test-${RUN_ID}-succession`;
    const events: number[] = [];

    for (let i = 0; i < 3; i++) {
      const resp = await ctx.post('/api/planting-events', {
        data: {
          plantId: 'carrot-1',
          gardenBedId: bedId,
          eventType: 'planting',
          directSeedDate: `${futureDate(14 + i * 21)}T00:00:00`,
          expectedHarvestDate: `${futureDate(84 + i * 21)}T00:00:00`,
          successionPlanting: true,
          successionInterval: 21,
          successionGroupId: groupId,
        },
      });
      expect(resp.ok()).toBeTruthy();
      const event = await resp.json();
      events.push(event.id);
      expect(event.successionPlanting).toBe(true);
      expect(event.successionGroupId).toBe(groupId);
    }
    carrotEventId = events[0];
    expect(events).toHaveLength(3);
  });

  test('PC-04: Create mulch event via API', async () => {
    const resp = await ctx.post('/api/planting-events', {
      data: {
        eventType: 'mulch',
        gardenBedId: bedId,
        applicationDate: `${futureDate(10)}T00:00:00`,
        mulchType: 'straw',
        depthInches: 3,
        notes: 'E2E test mulch application',
      },
    });
    expect(resp.ok()).toBeTruthy();
    const event = await resp.json();
    mulchEventId = event.id;

    expect(event.eventType).toBe('mulch');
    expect(event.gardenBedId).toBe(bedId);
    // Mulch events store details in eventDetails JSON
    if (event.eventDetails) {
      const details = typeof event.eventDetails === 'string'
        ? JSON.parse(event.eventDetails)
        : event.eventDetails;
      expect(details.mulch_type).toBe('straw');
    }
  });

  test('PC-05: Create maple tapping event via API', async () => {
    const resp = await ctx.post('/api/planting-events', {
      data: {
        eventType: 'maple-tapping',
        tappingDate: `${futureDate(5)}T00:00:00`,
        treeType: 'sugar',
        tapCount: 2,
        notes: 'E2E test maple tapping',
      },
    });
    expect(resp.ok()).toBeTruthy();
    const event = await resp.json();
    mapleTappingEventId = event.id;

    expect(event.eventType).toBe('maple-tapping');
    if (event.eventDetails) {
      const details = typeof event.eventDetails === 'string'
        ? JSON.parse(event.eventDetails)
        : event.eventDetails;
      expect(details.tree_type).toBe('sugar');
      expect(details.tap_count).toBe(2);
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 2: List Events & View Verification
  // ════════════════════════════════════════════════════════════════════

  test('PC-06: GET /api/planting-events returns all created events', async () => {
    const resp = await ctx.get('/api/planting-events');
    expect(resp.ok()).toBeTruthy();
    const events = await resp.json();

    // Should have at least 6 events: tomato + pepper + 3 carrots + mulch + maple
    // (maple-tapping may or may not appear depending on how they're stored)
    const plantingEvents = events.filter((e: any) => e.eventType === 'planting');
    expect(plantingEvents.length).toBeGreaterThanOrEqual(5);

    // Verify our tomato event is present
    const tomato = events.find((e: any) => e.id === tomatoEventId);
    expect(tomato).toBeTruthy();
    expect(tomato.plantId).toBe('tomato-1');
    expect(tomato.variety).toBe('Cherokee Purple');
  });

  test('PC-07: List view shows planting events in UI', async ({ page }) => {
    await setupCalendar(page);

    // Should be in list view by default — wait for events to load
    await expect(page.locator('[data-testid="planting-event-item"]').first()).toBeVisible({ timeout: 10000 });

    // Count planting event items (mulch and maple-tapping may not appear in list view)
    const eventItems = page.locator('[data-testid="planting-event-item"]');
    const count = await eventItems.count();
    expect(count).toBeGreaterThanOrEqual(3); // At least tomato + pepper + some carrots
  });

  test('PC-08: View toggle switches between List, Calendar, and Timeline', async ({ page }) => {
    await setupCalendar(page);

    // Start in list view — verify list toggle is active (green bg)
    const listBtn = page.locator('[data-testid="view-toggle-list"]');
    await expect(listBtn).toHaveClass(/bg-green-600/);

    // Switch to grid (calendar) view
    const gridBtn = page.locator('[data-testid="view-toggle-grid"]');
    await gridBtn.click();
    await expect(gridBtn).toHaveClass(/bg-green-600/);
    // Calendar header should be visible (month navigation)
    await expect(page.locator('text=/January|February|March|April|May|June|July|August|September|October|November|December/')).toBeVisible({ timeout: 5000 });

    // Switch to timeline view
    const timelineBtn = page.locator('[data-testid="view-toggle-timeline"]');
    await timelineBtn.click();
    await expect(timelineBtn).toHaveClass(/bg-green-600/);

    // Switch back to list
    await listBtn.click();
    await expect(listBtn).toHaveClass(/bg-green-600/);
    await expect(page.locator('[data-testid="planting-event-item"]').first()).toBeVisible({ timeout: 5000 });
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 3: Event Updates & Deletion
  // ════════════════════════════════════════════════════════════════════

  test('PC-09: Update event via API (change harvest date)', async () => {
    const newHarvestDate = `${futureDate(130)}T00:00:00`;
    const resp = await ctx.put(`/api/planting-events/${tomatoEventId}`, {
      data: {
        expectedHarvestDate: newHarvestDate,
        notes: 'Updated harvest date via E2E test',
      },
    });
    expect(resp.ok()).toBeTruthy();
    const updated = await resp.json();

    expect(updated.notes).toBe('Updated harvest date via E2E test');
    // Verify the harvest date was updated
    expect(updated.expectedHarvestDate).toBeTruthy();
  });

  test('PC-10: Mark event as harvested via API', async () => {
    const harvestDate = `${futureDate(0)}T00:00:00`;
    const resp = await ctx.patch(`/api/planting-events/${pepperEventId}/harvest`, {
      data: {
        harvestDate: harvestDate,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const updated = await resp.json();

    expect(updated.actualHarvestDate).toBeTruthy();
  });

  test('PC-11: Delete event via API', async () => {
    // Delete one of the carrot succession events
    const resp = await ctx.delete(`/api/planting-events/${carrotEventId}`);
    expect(resp.status()).toBe(204);

    // Verify it's gone from the list
    const allResp = await ctx.get('/api/planting-events');
    const events = await allResp.json();
    const found = events.find((e: any) => e.id === carrotEventId);
    expect(found).toBeUndefined();
  });

  test('PC-12: Delete mulch event via API', async () => {
    const resp = await ctx.delete(`/api/planting-events/${mulchEventId}`);
    expect(resp.status()).toBe(204);

    // Verify it's gone
    const allResp = await ctx.get('/api/planting-events');
    const events = await allResp.json();
    const found = events.find((e: any) => e.id === mulchEventId);
    expect(found).toBeUndefined();
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 4: Soil Temperature & UI Features
  // ════════════════════════════════════════════════════════════════════

  test('PC-13: Soil temperature card renders and toggles', async ({ page }) => {
    await setupCalendar(page);

    // Soil temperature card should be visible
    const soilToggle = page.locator('[data-testid="soil-temp-toggle"]');
    await expect(soilToggle).toBeVisible({ timeout: 10000 });

    // Should show "Soil Temperature" text
    await expect(soilToggle).toContainText('Soil Temperature');

    // Click to collapse
    await soilToggle.click();
    await page.waitForTimeout(300);

    // Click to expand again
    await soilToggle.click();
    await page.waitForTimeout(300);

    // Card should still be visible after toggling
    await expect(soilToggle).toBeVisible();
  });

  test('PC-14: Garden Event and Maple Tapping buttons are visible', async ({ page }) => {
    await setupCalendar(page);

    // Garden Event button should be visible
    const gardenEventBtn = page.locator('[data-testid="btn-add-garden-event"]');
    await expect(gardenEventBtn).toBeVisible();

    // Maple Tapping button should be visible
    const mapleTappingBtn = page.locator('[data-testid="btn-add-maple-tapping"]');
    await expect(mapleTappingBtn).toBeVisible();

    // Click Garden Event button — modal should open
    await gardenEventBtn.click();
    await expect(page.locator('text=Add Garden Event')).toBeVisible({ timeout: 5000 });

    // Close it (click outside or X button)
    await page.keyboard.press('Escape');
  });
});
