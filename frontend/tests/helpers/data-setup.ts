import { APIRequestContext, expect } from '@playwright/test';

const BACKEND_URL = 'http://localhost:5000';

// ── Factory Functions ──────────────────────────────────────────────────

export async function createBed(
  ctx: APIRequestContext,
  runId: string,
  options: {
    name?: string;
    width?: number;
    length?: number;
    gridSize?: number;
    planningMethod?: string;
  } = {},
): Promise<{ id: number; name: string }> {
  const name = options.name || `Test Bed ${runId}`;
  const resp = await ctx.post('/api/garden-beds', {
    data: {
      name,
      width: options.width ?? 4,
      length: options.length ?? 8,
      gridSize: options.gridSize ?? 12,
      planningMethod: options.planningMethod ?? 'square-foot',
    },
  });
  expect(resp.ok()).toBeTruthy();
  const bed = await resp.json();
  return { id: bed.id, name: bed.name };
}

export async function createPlan(
  ctx: APIRequestContext,
  runId: string,
  options: { name?: string; year?: number; season?: string } = {},
): Promise<{ id: number }> {
  const resp = await ctx.post('/api/garden-plans', {
    data: {
      name: options.name || `Test Plan ${runId}`,
      year: options.year ?? 2026,
      season: options.season ?? 'spring',
    },
  });
  expect(resp.ok()).toBeTruthy();
  const plan = await resp.json();
  return { id: plan.id };
}

export async function addPlanItem(
  ctx: APIRequestContext,
  planId: number,
  bedId: number,
  plantData: {
    plantId: string;
    variety?: string;
    quantity?: number;
    successionCount?: number;
    successionIntervalDays?: number;
    firstPlantDate?: string;
    trellisStructureId?: number;
  },
): Promise<{ id: number }> {
  const qty = plantData.quantity ?? 4;
  const resp = await ctx.post(`/api/garden-plans/${planId}/items`, {
    data: {
      plantId: plantData.plantId,
      variety: plantData.variety ?? '',
      plantEquivalent: qty,
      targetValue: qty,
      unitType: 'plants',
      successionCount: plantData.successionCount ?? 1,
      successionEnabled: (plantData.successionCount ?? 1) > 1,
      successionIntervalDays: plantData.successionIntervalDays ?? 14,
      firstPlantDate: plantData.firstPlantDate ?? '2026-05-01',
      bedAssignments: [{ bedId, quantity: qty }],
      allocationMode: 'custom',
      ...(plantData.trellisStructureId
        ? { trellisStructureId: plantData.trellisStructureId }
        : {}),
    },
  });
  if (!resp.ok()) {
    console.error('addPlanItem failed:', resp.status(), await resp.text());
  }
  expect(resp.ok()).toBeTruthy();
  const item = await resp.json();
  return { id: item.id };
}

export async function exportPlan(
  ctx: APIRequestContext,
  planId: number,
): Promise<void> {
  const resp = await ctx.post(`/api/garden-plans/${planId}/export-to-calendar`);
  expect(resp.ok()).toBeTruthy();
}

export async function placePlant(
  ctx: APIRequestContext,
  bedId: number,
  plantData: {
    plantId: string;
    variety?: string;
    quantity?: number;
    plantedDate?: string;
    position?: { x: number; y: number };
    sourcePlanItemId?: number;
  },
): Promise<{ id: number }> {
  const resp = await ctx.post('/api/planted-items', {
    data: {
      plantId: plantData.plantId,
      variety: plantData.variety ?? '',
      gardenBedId: bedId,
      plantedDate: plantData.plantedDate ?? '2026-05-01',
      quantity: plantData.quantity ?? 1,
      position: plantData.position ?? { x: 0, y: 0 },
      ...(plantData.sourcePlanItemId
        ? { sourcePlanItemId: plantData.sourcePlanItemId }
        : {}),
    },
  });
  if (!resp.ok()) {
    console.error('placePlant failed:', resp.status(), await resp.text());
  }
  expect(resp.ok()).toBeTruthy();
  const planted = await resp.json();
  return { id: planted.id };
}

// ── File Generators ────────────────────────────────────────────────────

/**
 * Create a valid 10x10 red PNG image in memory.
 * Extracted from site-review-p0.spec.ts for reuse.
 */
export function createValidPNG(): Buffer {
  const zlib = require('zlib');

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: 10x10 pixel, 8-bit RGB
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(10, 0);
  ihdrData.writeUInt32BE(10, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makePNGChunk('IHDR', ihdrData);

  const rowSize = 1 + 10 * 3;
  const rawData = Buffer.alloc(rowSize * 10);
  for (let y = 0; y < 10; y++) {
    rawData[y * rowSize] = 0;
    for (let x = 0; x < 10; x++) {
      const offset = y * rowSize + 1 + x * 3;
      rawData[offset] = 255;
      rawData[offset + 1] = 0;
      rawData[offset + 2] = 0;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idat = makePNGChunk('IDAT', compressed);
  const iend = makePNGChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makePNGChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuffer, data]);

  let crc = 0xffffffff;
  for (let i = 0; i < crcInput.length; i++) {
    crc ^= crcInput[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  crc ^= 0xffffffff;

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

/**
 * Create a valid CSV buffer for seed import testing.
 */
export function createValidCSV(
  headers: string[],
  rows: string[][],
): Buffer {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(cell => (cell.includes(',') ? `"${cell}"` : cell)).join(','));
  }
  return Buffer.from(lines.join('\n'), 'utf-8');
}

// ── Indoor Seed Start Helpers ──────────────────────────────────────────

/**
 * Progress an indoor seed start through its lifecycle and transplant it.
 * Simulates a real user advancing statuses over time.
 */
export async function progressAndTransplant(
  ctx: APIRequestContext,
  seedStartId: number,
  bedId: number,
  transplantDate: string,
  positionX: number,
  positionY: number,
): Promise<void> {
  // Progress through statuses
  for (const status of ['seeded', 'germinating', 'growing']) {
    const resp = await ctx.put(`/api/indoor-seed-starts/${seedStartId}`, {
      data: { status },
    });
    if (!resp.ok()) {
      console.error(`Status update to ${status} failed:`, resp.status());
    }
  }

  // Mark as hardening with transplantReady
  await ctx.put(`/api/indoor-seed-starts/${seedStartId}`, {
    data: { status: 'hardening', transplantReady: true },
  });

  // Transplant into bed
  const resp = await ctx.post(`/api/indoor-seed-starts/${seedStartId}/transplant`, {
    data: {
      transplantDate,
      gardenBedId: bedId,
      positionX,
      positionY,
    },
  });
  if (!resp.ok()) {
    console.error('Transplant failed:', resp.status(), await resp.text());
  }
}

/**
 * Find an indoor seed start by plantId and variety.
 */
export async function findSeedStart(
  ctx: APIRequestContext,
  plantId: string,
  variety?: string,
): Promise<number | null> {
  const resp = await ctx.get('/api/indoor-seed-starts');
  if (!resp.ok()) return null;
  const starts = await resp.json();
  const match = starts.find((s: any) =>
    s.plantId === plantId &&
    (!variety || s.variety === variety) &&
    s.status !== 'transplanted',
  );
  return match?.id ?? null;
}

// ── Grid Planting Helpers ──────────────────────────────────────────────

/**
 * Fill a rectangular region of a bed grid with a plant, one item per cell.
 * This simulates a real user clicking each cell to place plants.
 *
 * Returns the number of items placed.
 */
export async function fillBedRegion(
  ctx: APIRequestContext,
  bedId: number,
  plantId: string,
  variety: string,
  plantedDate: string,
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
): Promise<number> {
  let count = 0;
  let conflicts = 0;
  const failures: string[] = [];

  // Place in batches of one row at a time for efficiency
  for (let row = startRow; row <= endRow; row++) {
    const rowPromises = [];
    for (let col = startCol; col <= endCol; col++) {
      rowPromises.push(
        ctx
          .post('/api/planted-items', {
            data: {
              plantId,
              variety,
              gardenBedId: bedId,
              plantedDate,
              quantity: 1,
              position: { x: col, y: row },
            },
          })
          .then(async (resp) => {
            if (resp.ok()) {
              count++;
            } else if (resp.status() === 409) {
              // The app refusing an overlapping planting — a real answer, not
              // a broken request. Happens where this scenario sows every cell
              // of a crop whose spacing spans several cells, or relays onto
              // ground the previous crop still occupies. Counted and reported,
              // not fatal, because it reflects the garden plan's density
              // choices rather than a defect.
              conflicts++;
            } else if (failures.length < 5) {
              // Keep only the first few — a whole-region failure would
              // otherwise produce hundreds of identical lines.
              failures.push(`(${col},${row}) → ${resp.status()} ${(await resp.text()).slice(0, 120)}`);
            } else {
              failures.push('');
            }
          }),
      );
    }
    // Execute one row in parallel
    await Promise.all(rowPromises);
  }

  // Fail loudly on malformed requests rather than returning a short count.
  //
  // This helper used to ignore responses entirely, so a region addressing
  // cells outside the bed was silently discarded — the Row and MIGardener beds
  // were sized 4x12 and 4x8 while their sowings addressed 8x24 and 16x32, so
  // most of every sowing vanished and no test noticed, because as far as the
  // suite was concerned the placements had "succeeded". A setup step that
  // cannot fail is a setup step that hides bugs.
  //
  // 409s are excluded above: those are the app correctly enforcing spacing.
  if (failures.length > 0) {
    const shown = failures.filter(Boolean);
    throw new Error(
      `fillBedRegion: ${failures.length} of ${failures.length + count + conflicts} placements failed ` +
        `for ${plantId} in bed ${bedId} over cols ${startCol}-${endCol}, rows ${startRow}-${endRow}.\n` +
        `First failures:\n  ${shown.join('\n  ')}`,
    );
  }

  if (conflicts > 0) {
    // Visible so density problems in the scenario stay noticeable instead of
    // silently shrinking a planting.
    console.warn(
      `[fillBedRegion] ${plantId} in bed ${bedId}: ${count} placed, ` +
        `${conflicts} refused as overlapping (cols ${startCol}-${endCol}, rows ${startRow}-${endRow}).`,
    );
  }

  return count;
}

// ── UI Helpers ─────────────────────────────────────────────────────────

/**
 * Ensure the Garden Designer is showing its DETAIL view.
 *
 * The designer opens in OVERVIEW mode — a grid of BedSummaryCards. Everything
 * specs typically reach for (the `bed-selector` dropdown, `active-bed-indicator`,
 * the plant grid, the "Active:" label, the future-plantings toggle) only exists
 * in DETAIL mode, which you enter by picking a bed.
 *
 * Specs written before the overview existed assume navigating to the designer
 * lands them in detail view. Call this straight after navigating to bridge that
 * gap, rather than each spec waiting on an element that will never appear.
 *
 * Pass `bedName` to open a specific bed; omit it to open the first one.
 * Safe to call when already in detail view — it returns immediately.
 */
export async function openDesignerDetailView(
  page: any,
  bedName?: string,
): Promise<void> {
  // Wait for whichever view rendered before deciding which one we're in;
  // checking counts immediately would race the initial render.
  await page
    .locator('[data-testid^="bed-card-"], [data-testid="bed-selector"]')
    .first()
    .waitFor({ state: 'visible', timeout: 15000 });

  if (await page.locator('[data-testid="bed-selector"]').count()) {
    return; // already in detail view
  }

  const cards = page.locator('[data-testid^="bed-card-"]');
  const target = bedName ? cards.filter({ hasText: bedName }).first() : cards.first();
  await target.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300); // let React settle before assertions
}

/**
 * Open the Garden Designer's collapsible settings panel.
 *
 * Controls such as the future-plantings toggle live inside this panel, which is
 * closed by default (its state persists in localStorage under
 * `designerSettingsOpen`). Requires DETAIL view — the toggle button itself only
 * renders there — so call after openDesignerDetailView/selectBedByName.
 *
 * Idempotent: returns immediately if the panel is already open, so it will not
 * accidentally close it.
 */
export async function openDesignerSettingsPanel(page: any): Promise<void> {
  const panelToggle = page.locator('[data-testid="designer-settings-toggle"]');
  await panelToggle.waitFor({ state: 'visible', timeout: 10000 });

  // The future-plantings control is the panel's first child; use it to tell
  // whether the panel is already expanded.
  if (await page.locator('[data-testid="future-plantings-toggle"]').count()) {
    return;
  }

  await panelToggle.click();
  await page.waitForTimeout(300);
}

/**
 * Select a garden bed from the bed selector dropdown by partial name match.
 * Bed labels include dimensions like "My Bed (4' x 8')" so exact label match won't work.
 */
export async function selectBedByName(
  page: any,
  bedName: string,
): Promise<void> {
  // The Garden Designer opens in OVERVIEW mode, which renders one
  // BedSummaryCard per bed and no dropdown — the bed-selector <select> only
  // exists in DETAIL mode. Clicking a bed card selects that bed and switches
  // to detail mode, so do that first when we're on the overview.
  //
  // Wait for EITHER view to render before deciding which one we're in.
  // Checking .count() straight away would race the initial render: zero cards
  // would look like "detail mode" and send us to a dropdown that never exists.
  await page
    .locator('[data-testid^="bed-card-"], [data-testid="bed-selector"]')
    .first()
    .waitFor({ state: 'visible', timeout: 15000 });

  const bedCard = page
    .locator('[data-testid^="bed-card-"]')
    .filter({ hasText: bedName })
    .first();

  if (await bedCard.count()) {
    await bedCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500); // Allow React state to settle
    return;
  }

  // Already in detail mode: use the dropdown.
  const bedSelector = page.locator('[data-testid="bed-selector"]').first();
  await bedSelector.waitFor({ state: 'visible', timeout: 15000 });

  // Find the option that contains our bed name and get its value
  const options = bedSelector.locator('option');
  const count = await options.count();
  for (let i = 0; i < count; i++) {
    const text = await options.nth(i).textContent();
    if (text?.includes(bedName)) {
      const value = await options.nth(i).getAttribute('value');
      if (value) {
        await bedSelector.selectOption(value);
      } else {
        await bedSelector.selectOption({ index: i });
      }
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500); // Allow React state to settle
      return;
    }
  }
  // Fallback: try with a generic select
  const fallbackSelector = page.locator('select').first();
  const fallbackOptions = fallbackSelector.locator('option');
  const fallbackCount = await fallbackOptions.count();
  for (let i = 0; i < fallbackCount; i++) {
    const text = await fallbackOptions.nth(i).textContent();
    if (text?.includes(bedName)) {
      await fallbackSelector.selectOption({ index: i });
      await page.waitForLoadState('networkidle');
      return;
    }
  }
  throw new Error(`Bed "${bedName}" not found in selector options`);
}

// ── Admin Helpers ──────────────────────────────────────────────────────

/**
 * Promote a user to admin using the bootstrap admin account.
 * Bootstrap admin: username="admin", password="admin123"
 */
/**
 * Set a user's admin flag via the bootstrap admin account.
 *
 * NOTE: this logs `ctx` in as the bootstrap admin, replacing whatever session
 * it held. Pass a dedicated context when the caller's own session matters.
 *
 * Throws rather than using `expect()` so it is safe to call from afterAll
 * hooks, where a failed expectation would be reported confusingly.
 */
export async function setUserAdminFlag(
  ctx: APIRequestContext,
  targetUsername: string,
  isAdmin: boolean,
): Promise<void> {
  const loginResp = await ctx.post(`${BACKEND_URL}/api/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
  });
  if (!loginResp.ok()) {
    throw new Error(`Bootstrap admin login failed: ${loginResp.status()}`);
  }

  const searchResp = await ctx.get(
    `${BACKEND_URL}/api/admin/users?search=${targetUsername}`,
  );
  if (!searchResp.ok()) {
    throw new Error(`Admin user search failed: ${searchResp.status()}`);
  }

  // Endpoint has returned both a bare array and { users: [...] } — accept either.
  const body = await searchResp.json();
  const users = Array.isArray(body) ? body : body.users ?? [];
  const user = users.find((u: any) => u.username === targetUsername);
  if (!user) {
    throw new Error(`User ${targetUsername} not found`);
  }

  const updateResp = await ctx.put(`${BACKEND_URL}/api/admin/users/${user.id}`, {
    data: { isAdmin },
  });
  if (!updateResp.ok()) {
    throw new Error(
      `Failed to set isAdmin=${isAdmin} on ${targetUsername}: ${updateResp.status()}`,
    );
  }
}

export async function promoteToAdmin(
  ctx: APIRequestContext,
  targetUsername: string,
): Promise<void> {
  await setUserAdminFlag(ctx, targetUsername, true);
}
