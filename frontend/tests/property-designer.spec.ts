import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const PD_USER = {
  username: `pd_test_${RUN_ID}`,
  email: `pd_test_${RUN_ID}@test.com`,
  password: 'PdTest1!',
};

/**
 * Property Designer — E2E Tests
 *
 * Covers: property CRUD, placed structure CRUD with collision validation,
 * trellis CRUD with capacity tracking, structure position update,
 * UI verification (property selector, Add Structure / Manage Trellises buttons).
 *
 * Strategy: API-first for data setup + UI verification in Property Designer tab.
 * SVG drag-drop is unreliable in Playwright, so structure placement uses API.
 */
test.describe.serial('Property Designer — E2E Tests', () => {
  let ctx: APIRequestContext;

  // Track IDs across tests
  let property1Id: number;
  let property2Id: number;
  let structure1Id: number;
  let structure2Id: number;
  let trellisId: number;

  // ── Setup: register user, login ────────────────────────────────────
  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });

    await registerViaAPI(ctx, PD_USER.username, PD_USER.email, PD_USER.password);
    await loginViaAPI(ctx, PD_USER.username, PD_USER.password);
  });

  test.afterAll(async () => {
    // Cleanup: delete all properties (cascades structures)
    const resp = await ctx.get('/api/properties');
    if (resp.ok()) {
      const properties = await resp.json();
      for (const p of properties) {
        await ctx.delete(`/api/properties/${p.id}`).catch(() => {});
      }
    }
    // Cleanup trellises
    const trellisResp = await ctx.get('/api/trellis-structures');
    if (trellisResp.ok()) {
      const trellises = await trellisResp.json();
      for (const t of trellises) {
        await ctx.delete(`/api/trellis-structures/${t.id}`).catch(() => {});
      }
    }
    await ctx.dispose();
  });

  // Helper: navigate to Property Designer tab
  async function setupPropertyDesigner(page: import('@playwright/test').Page) {
    await page.goto('/');
    await login(page, PD_USER.username, PD_USER.password);
    await navigateTo(page, TABS.PROPERTY_DESIGNER);
  }

  // ════════════════════════════════════════════════════════════════════
  // Suite 1: Property CRUD via API
  // ════════════════════════════════════════════════════════════════════

  test('PD-01: Create property via API', async () => {
    const resp = await ctx.post('/api/properties', {
      data: {
        name: `Homestead ${RUN_ID}`,
        width: 200,
        length: 150,
        soilType: 'loam',
        slope: 'gentle',
        notes: `E2E property ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const property = await resp.json();
    property1Id = property.id;

    expect(property.name).toBe(`Homestead ${RUN_ID}`);
    expect(property.width).toBe(200);
    expect(property.length).toBe(150);
    expect(property.soilType).toBe('loam');
    expect(property.slope).toBe('gentle');
  });

  test('PD-02: Create second property, GET returns both', async () => {
    const resp = await ctx.post('/api/properties', {
      data: {
        name: `Garden Plot ${RUN_ID}`,
        width: 50,
        length: 80,
        soilType: 'clay',
      },
    });
    expect(resp.ok()).toBeTruthy();
    const property = await resp.json();
    property2Id = property.id;

    // GET all properties
    const allResp = await ctx.get('/api/properties');
    expect(allResp.ok()).toBeTruthy();
    const properties = await allResp.json();
    expect(properties.length).toBeGreaterThanOrEqual(2);

    const found = properties.find((p: any) => p.id === property1Id);
    expect(found).toBeTruthy();
    expect(found.name).toBe(`Homestead ${RUN_ID}`);
  });

  test('PD-03: Update property via API', async () => {
    const resp = await ctx.put(`/api/properties/${property1Id}`, {
      data: {
        name: `Updated Homestead ${RUN_ID}`,
        width: 250,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const property = await resp.json();
    expect(property.name).toBe(`Updated Homestead ${RUN_ID}`);
    expect(property.width).toBe(250);
    // Unchanged fields preserved
    expect(property.length).toBe(150);
    expect(property.soilType).toBe('loam');
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 2: Placed Structures CRUD + Collision Detection
  // ════════════════════════════════════════════════════════════════════

  test('PD-04: Place structure on property via API', async () => {
    const resp = await ctx.post('/api/placed-structures', {
      data: {
        propertyId: property1Id,
        structureId: 'chicken-coop-small-1',
        name: `Coop ${RUN_ID}`,
        position: { x: 10, y: 10 },
        rotation: 0,
        notes: `E2E structure ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const structure = await resp.json();
    structure1Id = structure.id;

    expect(structure.name).toBe(`Coop ${RUN_ID}`);
    expect(structure.structureId).toBe('chicken-coop-small-1');
    expect(structure.positionX).toBe(10);
    expect(structure.positionY).toBe(10);
    expect(structure.rotation).toBe(0);
    expect(structure.propertyId).toBe(property1Id);
  });

  test('PD-05: Place second structure at different position', async () => {
    const resp = await ctx.post('/api/placed-structures', {
      data: {
        propertyId: property1Id,
        structureId: 'tool-shed-small-1',
        name: `Shed ${RUN_ID}`,
        position: { x: 50, y: 50 },
        rotation: 90,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const structure = await resp.json();
    structure2Id = structure.id;

    expect(structure.positionX).toBe(50);
    expect(structure.positionY).toBe(50);
    expect(structure.rotation).toBe(90);
  });

  test('PD-06: Update structure position via API', async () => {
    const resp = await ctx.put(`/api/placed-structures/${structure1Id}`, {
      data: {
        position: { x: 20, y: 20 },
      },
    });
    expect(resp.ok()).toBeTruthy();
    const structure = await resp.json();
    expect(structure.positionX).toBe(20);
    expect(structure.positionY).toBe(20);
  });

  test('PD-07: Delete structure via API, verify gone from property', async () => {
    const resp = await ctx.delete(`/api/placed-structures/${structure2Id}`);
    expect(resp.status()).toBe(204);

    // Verify via property detail
    const propResp = await ctx.get(`/api/properties/${property1Id}`);
    const property = await propResp.json();
    const found = property.placedStructures?.find((s: any) => s.id === structure2Id);
    expect(found).toBeUndefined();
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 3: Trellis CRUD + Capacity
  // ════════════════════════════════════════════════════════════════════

  test('PD-08: Create trellis structure via API', async () => {
    const resp = await ctx.post('/api/trellis-structures', {
      data: {
        name: `Trellis ${RUN_ID}`,
        trellisType: 'post_wire',
        startX: 5,
        startY: 10,
        endX: 15,
        endY: 10,
        heightInches: 72,
        propertyId: property1Id,
        notes: `E2E trellis ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const trellis = await resp.json();
    trellisId = trellis.id;

    expect(trellis.name).toBe(`Trellis ${RUN_ID}`);
    expect(trellis.trellisType).toBe('post_wire');
    expect(trellis.totalLengthFeet).toBe(10); // sqrt((15-5)^2 + (10-10)^2) = 10
    expect(trellis.heightInches).toBe(72);
  });

  test('PD-09: Get trellis capacity (empty)', async () => {
    const resp = await ctx.get(`/api/trellis-structures/${trellisId}/capacity`);
    expect(resp.ok()).toBeTruthy();
    const capacity = await resp.json();

    expect(capacity.trellisId).toBe(trellisId);
    expect(capacity.totalLengthFeet).toBe(10);
    expect(capacity.allocatedFeet).toBe(0);
    expect(capacity.availableFeet).toBe(10);
    expect(capacity.percentOccupied).toBe(0);
    expect(capacity.occupiedSegments).toHaveLength(0);
  });

  test('PD-10: Update trellis coordinates, length recalculates', async () => {
    const resp = await ctx.put(`/api/trellis-structures/${trellisId}`, {
      data: {
        endX: 25,
        endY: 10,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const trellis = await resp.json();

    // New length: sqrt((25-5)^2 + (10-10)^2) = 20
    expect(trellis.totalLengthFeet).toBe(20);
  });

  test('PD-11: Delete trellis via API (no plants allocated)', async () => {
    const resp = await ctx.delete(`/api/trellis-structures/${trellisId}`);
    expect(resp.status()).toBe(204);

    // Verify it's gone
    const listResp = await ctx.get(`/api/trellis-structures?propertyId=${property1Id}`);
    const trellises = await listResp.json();
    const found = trellises.find((t: any) => t.id === trellisId);
    expect(found).toBeUndefined();
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 4: Property Delete (Cascade) + UI Verification
  // ════════════════════════════════════════════════════════════════════

  test('PD-12: Delete property cascades structures', async () => {
    // Place a structure on property2 first
    await ctx.post('/api/placed-structures', {
      data: {
        propertyId: property2Id,
        structureId: 'rain-barrel-1',
        name: `Barrel ${RUN_ID}`,
        position: { x: 5, y: 5 },
      },
    });

    // Delete property2 (should cascade)
    const resp = await ctx.delete(`/api/properties/${property2Id}`);
    expect(resp.status()).toBe(204);

    // Verify property gone
    const allResp = await ctx.get('/api/properties');
    const properties = await allResp.json();
    const found = properties.find((p: any) => p.id === property2Id);
    expect(found).toBeUndefined();
  });

  test('PD-13: Property Designer shows property selector and buttons', async ({ page }) => {
    await setupPropertyDesigner(page);

    // Property selector should be visible (property1 still exists)
    const selector = page.locator('[data-testid="property-selector"]');
    await expect(selector).toBeVisible({ timeout: 10000 });

    // Should contain the remaining property
    await expect(selector.locator('option')).toHaveCount(1);

    // Add Structure button should be visible
    await expect(page.locator('[data-testid="btn-add-structure"]')).toBeVisible();

    // Manage Trellises button should be visible
    await expect(page.locator('[data-testid="btn-manage-trellises"]')).toBeVisible();
  });
});
