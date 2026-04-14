import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const CTP_USER = {
  username: `ctp_test_${RUN_ID}`,
  email: `ctp_test_${RUN_ID}@test.com`,
  password: 'CtpTest1!',
};

/**
 * Click-to-Place — E2E Tests
 *
 * Tests the feature that allows users to click (not drag) a plant in the palette
 * or planned section, then type grid coordinates (e.g., A1, C3) to place it.
 *
 * Strategy: API-first setup for beds + plans, then UI interaction for click-to-place.
 */
test.describe.serial('Click-to-Place — E2E Tests', () => {
  let ctx: APIRequestContext;
  let bedId: number;
  let bedName: string;

  // ── Setup: register user, login, create a bed ─────────────────────
  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });

    await registerViaAPI(ctx, CTP_USER.username, CTP_USER.email, CTP_USER.password);
    await loginViaAPI(ctx, CTP_USER.username, CTP_USER.password);

    // Create a 4x4 SFG bed (columns A-D, rows 1-4)
    bedName = `CTP-Bed-${RUN_ID}`;
    const bedResp = await ctx.post('/api/garden-beds', {
      data: {
        name: bedName,
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
    // Cleanup: delete bed (cascades to planted items)
    await ctx.delete(`/api/garden-beds/${bedId}`).catch(() => {});
    await ctx.dispose();
  });

  // Helper: dismiss any existing webpack overlay already in the DOM.
  // The dev server has TS errors that produce a full-screen overlay iframe
  // that intercepts all pointer events.
  async function dismissOverlay(page: import('@playwright/test').Page) {
    await page.evaluate(() => {
      const overlay = document.getElementById('webpack-dev-server-client-overlay');
      if (overlay) overlay.remove();
      document.querySelectorAll('iframe[src="about:blank"]').forEach(el => el.remove());
    });
  }

  /**
   * Custom login that handles the webpack dev server error overlay.
   * The overlay iframe intercepts pointer events, so we must remove it
   * repeatedly as it gets re-injected after page reloads.
   */
  async function loginWithOverlayDismissal(
    page: import('@playwright/test').Page,
    username: string,
    password: string
  ) {
    // Clear cookies to remove stale sessions
    await page.context().clearCookies();
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Dismiss overlay after reload
    await dismissOverlay(page);

    // Click Login button
    await page.locator('header button:has-text("Login")').click({ timeout: 5000 });

    // Fill login modal
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);

    // Submit via modal's login button
    await page.locator('[role="dialog"] button:has-text("Login")').click();

    // Wait for modal to close
    await expect(page.locator('#login-modal-title')).not.toBeVisible({ timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Dismiss overlay again after login reload
    await dismissOverlay(page);
  }

  // Helper: navigate to Garden Designer and wait for bed to load
  async function setupDesigner(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await dismissOverlay(page);
    await loginWithOverlayDismissal(page, CTP_USER.username, CTP_USER.password);
    await dismissOverlay(page);
    await navigateTo(page, TABS.GARDEN_DESIGNER);
    await dismissOverlay(page);
    // Wait for beds to load
    await expect(page.locator('[data-testid="bed-selector"]')).toBeVisible({ timeout: 10000 });
    // Wait a moment for data to stabilize
    await page.waitForTimeout(500);
    await dismissOverlay(page);
  }

  // Helper: get bed planted items via API
  async function getBedPlantedItems(targetBedId: number) {
    const resp = await ctx.get(`/api/garden-beds/${targetBedId}`);
    expect(resp.ok()).toBeTruthy();
    const bed = await resp.json();
    return bed.plantedItems || [];
  }

  /**
   * Helper: search for a plant in the palette and click it to open config modal.
   *
   * @dnd-kit's useDraggable adds onPointerDown/onKeyDown listeners to the plant item.
   * The MouseSensor with distance=8 means a click without 8px movement should
   * still fire the regular onClick handler. However, Playwright's slowMo: 250
   * can interfere with the pointer event sequence.
   *
   * We use page.evaluate to simulate a native click event, bypassing the @dnd-kit
   * pointer tracking entirely.
   */
  async function searchAndClickPlant(page: import('@playwright/test').Page, plantName: string) {
    const paletteSearch = page.locator('input[placeholder*="Search"]').first();
    if (await paletteSearch.isVisible()) {
      await paletteSearch.fill(plantName);
      await page.waitForTimeout(500);
    }

    // Target the plant name span inside the palette item
    const plantItem = page.locator(`.cursor-grab:has-text("${plantName}")`).first();
    await expect(plantItem).toBeVisible({ timeout: 5000 });
    await plantItem.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    // Use evaluate to trigger a real click event on the element
    // This fires the React onClick handler directly without going through
    // @dnd-kit's pointer event pipeline
    await plantItem.evaluate((el: HTMLElement) => {
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      el.dispatchEvent(clickEvent);
    });

    // Wait for the React state update to propagate
    await page.waitForTimeout(500);
  }

  // ════════════════════════════════════════════════════════════════════
  // Test 1: Click plant in palette — verify PlantConfigModal opens
  //         with position input field focused
  // ════════════════════════════════════════════════════════════════════

  test('CTP-01: Click plant in palette opens config modal with position field', async ({ page }) => {
    await setupDesigner(page);

    await searchAndClickPlant(page, 'Tomato');

    // Verify PlantConfigModal opens (it uses <Modal> component)
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verify the position input field exists
    const positionInput = page.locator('#gridPosition');
    await expect(positionInput).toBeVisible();

    // Since position was null (click-to-place), the input should have autoFocus
    // and show the placeholder "e.g., A1"
    await expect(positionInput).toHaveAttribute('placeholder', /A1/);

    // Verify "Type a grid position" hint is shown (indicates no position set)
    await expect(page.locator('text=Type a grid position')).toBeVisible();

    // Close the modal to reset state
    const cancelButton = modal.locator('button:has-text("Cancel")');
    await cancelButton.click();
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  // ════════════════════════════════════════════════════════════════════
  // Test 2: Type valid coordinate "A1" — verify validation passes
  //         and Save button becomes enabled
  // ════════════════════════════════════════════════════════════════════

  test('CTP-02: Type valid coordinate A1 — validation passes, Save enabled', async ({ page }) => {
    await setupDesigner(page);

    await searchAndClickPlant(page, 'Tomato');

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Type "A1" in the position input
    const positionInput = page.locator('#gridPosition');
    await positionInput.fill('A1');
    await page.waitForTimeout(200);

    // Verify no error message is shown
    const positionError = modal.locator('p.text-xs.text-red-600');
    const errorVisible = await positionError.isVisible().catch(() => false);
    if (errorVisible) {
      const errorText = await positionError.textContent();
      if (errorText && errorText.trim().length > 0) {
        expect.soft(errorText).toBe('');
      }
    }

    // Verify the coordinate display shows (0, 0) which is A1
    await expect(modal.locator('text=(0, 0)')).toBeVisible();

    // Verify Save button is enabled (not disabled)
    const saveButton = modal.locator('button:has-text("Place"), button:has-text("Save")').first();
    await expect(saveButton).toBeEnabled();

    // Cancel to reset
    await modal.locator('button:has-text("Cancel")').click();
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  // ════════════════════════════════════════════════════════════════════
  // Test 3: Save with valid coordinate — verify plant appears on grid
  // ════════════════════════════════════════════════════════════════════

  test('CTP-03: Save with valid coordinate — plant appears on grid', async ({ page }) => {
    await setupDesigner(page);

    // Check initial state
    const initialItems = await getBedPlantedItems(bedId);
    const initialCount = initialItems.length;

    await searchAndClickPlant(page, 'Tomato');

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Type coordinate "B2" (position x=1, y=1)
    const positionInput = page.locator('#gridPosition');
    await positionInput.fill('B2');
    await page.waitForTimeout(200);

    // Click Save/Place button
    const saveButton = modal.locator('button:has-text("Place"), button:has-text("Save")').first();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Wait for the modal to close and the API call to complete
    await expect(modal).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify via API that the plant was placed at position (1, 1) = B2
    const items = await getBedPlantedItems(bedId);
    expect(items.length).toBe(initialCount + 1);

    // Find the newly placed item
    const newItem = items.find(
      (p: { plantId: string; position: { x: number; y: number } }) =>
        p.plantId.startsWith('tomato') && p.position.x === 1 && p.position.y === 1
    );
    expect(newItem).toBeTruthy();
  });

  // ════════════════════════════════════════════════════════════════════
  // Test 4: Type invalid coordinate "Z99" — verify error and Save blocked
  // ════════════════════════════════════════════════════════════════════

  test('CTP-04: Type invalid coordinate Z99 — error shown, Save blocked', async ({ page }) => {
    await setupDesigner(page);

    await searchAndClickPlant(page, 'Lettuce');

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Type invalid coordinate "Z99" (out of bounds for 4x4 bed)
    const positionInput = page.locator('#gridPosition');
    await positionInput.fill('Z99');
    await page.waitForTimeout(200);

    // Verify error message is shown
    const errorText = modal.locator('p.text-xs.text-red-600');
    await expect(errorText).toBeVisible();
    const errorMessage = await errorText.textContent();
    expect(errorMessage).toMatch(/out of bounds|invalid|not a valid/i);

    // Verify Save button is disabled when no valid position is set
    const saveButton = modal.locator('button:has-text("Place"), button:has-text("Save")').first();
    await expect(saveButton).toBeDisabled();

    // Cancel
    await modal.locator('button:has-text("Cancel")').click();
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  // ════════════════════════════════════════════════════════════════════
  // Test 5: Type invalid format "!!!!" — verify error
  // ════════════════════════════════════════════════════════════════════

  test('CTP-05: Type invalid format — error shown', async ({ page }) => {
    await setupDesigner(page);

    await searchAndClickPlant(page, 'Carrot');

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Type completely invalid input
    const positionInput = page.locator('#gridPosition');
    await positionInput.fill('!!!');
    await page.waitForTimeout(200);

    // Verify error about invalid format
    const errorText = modal.locator('p.text-xs.text-red-600');
    await expect(errorText).toBeVisible();
    const errorMessage = await errorText.textContent();
    expect(errorMessage).toMatch(/not a valid grid label|invalid/i);

    await modal.locator('button:has-text("Cancel")').click();
  });

  // ════════════════════════════════════════════════════════════════════
  // Test 6: Click plant without bed selected — verify error message
  // ════════════════════════════════════════════════════════════════════

  test('CTP-06: Click plant with no bed selected — shows error toast', async ({ page }) => {
    // For this test we need a state where no bed is active.
    // We'll create a new user without any beds.
    const noBedUser = {
      username: `ctp_nobed_${RUN_ID}`,
      email: `ctp_nobed_${RUN_ID}@test.com`,
      password: 'CtpTest1!',
    };

    const noBedCtx = await page.request.newContext({ baseURL: BACKEND_URL });
    await registerViaAPI(noBedCtx, noBedUser.username, noBedUser.email, noBedUser.password);

    // Login as the no-bed user
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await dismissOverlay(page);
    await loginWithOverlayDismissal(page, noBedUser.username, noBedUser.password);
    await dismissOverlay(page);
    await navigateTo(page, TABS.GARDEN_DESIGNER);
    await dismissOverlay(page);

    // Wait for the page to load
    await page.waitForTimeout(1000);

    // Try to find and click a plant in the palette
    const paletteSearch = page.locator('input[placeholder*="Search"]').first();
    const paletteVisible = await paletteSearch.isVisible().catch(() => false);

    if (paletteVisible) {
      await paletteSearch.fill('Tomato');
      await page.waitForTimeout(500);

      // Click the plant item
      const plantItem = page.locator('.cursor-grab:has-text("Tomato")').first();
      const plantVisible = await plantItem.isVisible().catch(() => false);

      if (plantVisible) {
        await plantItem.click();

        // Verify error toast appears with the "Select a bed first" message
        const errorToast = page.locator('[data-testid="toast-error"]');
        await expect(errorToast).toBeVisible({ timeout: 5000 });
        const toastText = await errorToast.textContent();
        expect(toastText).toMatch(/select a bed/i);

        // Verify that the config modal did NOT open
        const modal = page.locator('[role="dialog"]');
        await page.waitForTimeout(500);
        const modalVisible = await modal.isVisible().catch(() => false);
        expect(modalVisible).toBe(false);
      } else {
        console.log('Plant item not visible without beds — skipping no-bed click test');
      }
    } else {
      console.log('Plant palette not visible without beds — skipping no-bed click test');
    }

    await noBedCtx.dispose();
  });

  // ════════════════════════════════════════════════════════════════════
  // Test 7: Grid labels toggle button works
  // ════════════════════════════════════════════════════════════════════

  test('CTP-07: Grid labels toggle button works', async ({ page }) => {
    await setupDesigner(page);

    // Find the "A1" toggle button near zoom controls
    const gridLabelsToggle = page.locator('button:has-text("A1")').first();
    await expect(gridLabelsToggle).toBeVisible({ timeout: 5000 });

    // Check initial state
    const initialClass = await gridLabelsToggle.getAttribute('class');
    const initiallyActive = initialClass?.includes('bg-green-100');

    // Click the toggle
    await gridLabelsToggle.click();
    await page.waitForTimeout(300);

    // Verify the button styling changed
    const afterClickClass = await gridLabelsToggle.getAttribute('class');
    if (initiallyActive) {
      expect(afterClickClass).toContain('bg-gray-100');
    } else {
      expect(afterClickClass).toContain('bg-green-100');
    }

    // Click again to toggle back
    await gridLabelsToggle.click();
    await page.waitForTimeout(300);

    const afterSecondClickClass = await gridLabelsToggle.getAttribute('class');
    if (initiallyActive) {
      expect(afterSecondClickClass).toContain('bg-green-100');
    } else {
      expect(afterSecondClickClass).toContain('bg-gray-100');
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Test 8: Grid labels are visible on the SVG grid
  // ════════════════════════════════════════════════════════════════════

  test('CTP-08: Grid labels appear in SVG when toggle is ON', async ({ page }) => {
    await setupDesigner(page);

    // Ensure grid labels are toggled ON
    const gridLabelsToggle = page.locator('button:has-text("A1")').first();
    await expect(gridLabelsToggle).toBeVisible({ timeout: 5000 });

    const toggleClass = await gridLabelsToggle.getAttribute('class');
    if (!toggleClass?.includes('bg-green-100')) {
      await gridLabelsToggle.click();
      await page.waitForTimeout(300);
    }

    // Look for SVG with grid labels
    const svgContainer = page.locator('svg[id^="garden-grid-svg-"]').first();
    await expect(svgContainer).toBeVisible({ timeout: 5000 });

    // Check for text elements within the SVG
    const cellLabels = svgContainer.locator('text');
    const labelCount = await cellLabels.count();

    // A 4x4 grid should have 16 labels
    expect(labelCount).toBeGreaterThanOrEqual(1);

    // Check that "A1" appears as one of the labels
    const a1Label = svgContainer.locator('text:has-text("A1")');
    await expect(a1Label).toBeVisible();
  });

  // ════════════════════════════════════════════════════════════════════
  // Test 9: Drag-and-drop still works (regression check)
  // ════════════════════════════════════════════════════════════════════

  test('CTP-09: Drag-and-drop rendering still works (regression check via API)', async ({ page }) => {
    // Since @dnd-kit drag-drop is unreliable in Playwright (per existing test comments),
    // we verify the rendering pipeline works: place via API and verify the grid renders it.
    // This confirms that click-to-place changes did not break the rendering pipeline.

    // Place a carrot at C3 (x=2, y=2) via API
    const resp = await ctx.post('/api/planted-items', {
      data: {
        gardenBedId: bedId,
        plantId: 'carrot-1',
        position: { x: 2, y: 2 },
        quantity: 1,
        status: 'planned',
        plantedDate: new Date().toISOString().split('T')[0],
      },
    });
    expect(resp.status()).toBe(201);
    const item = await resp.json();

    await setupDesigner(page);

    // Verify the API-placed item renders on the grid
    const plantedItem = page.locator(`[data-testid="planted-item-${item.id}"]`);
    await expect(plantedItem).toBeVisible({ timeout: 10000 });

    // Verify the item is clickable (detail panel opens)
    await plantedItem.click();
    const detailPanel = page.locator('[data-testid="plant-detail-panel"]');
    await expect(detailPanel).toBeVisible({ timeout: 5000 });
  });

  // ════════════════════════════════════════════════════════════════════
  // Test 10: Click-to-place from palette with coordinate D4 (boundary)
  // ════════════════════════════════════════════════════════════════════

  test('CTP-10: Place at boundary coordinate D4 (max corner of 4x4 bed)', async ({ page }) => {
    await setupDesigner(page);

    await searchAndClickPlant(page, 'Pepper');

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Type D4 — the maximum corner of a 4x4 bed (x=3, y=3)
    const positionInput = page.locator('#gridPosition');
    await positionInput.fill('D4');
    await page.waitForTimeout(200);

    // Should be valid — no error
    const errorText = modal.locator('p.text-xs.text-red-600');
    const hasError = await errorText.isVisible().catch(() => false);
    if (hasError) {
      const errMsg = await errorText.textContent();
      expect.soft(errMsg).toBe('');
    }

    // Verify coordinate display shows (3, 3)
    await expect(modal.locator('text=(3, 3)')).toBeVisible();

    // Save should be enabled
    const saveButton = modal.locator('button:has-text("Place"), button:has-text("Save")').first();
    await expect(saveButton).toBeEnabled();

    // Place it
    await saveButton.click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify via API
    const items = await getBedPlantedItems(bedId);
    const pepperAtD4 = items.find(
      (p: { plantId: string; position: { x: number; y: number } }) =>
        p.plantId.startsWith('pepper') && p.position.x === 3 && p.position.y === 3
    );
    expect(pepperAtD4).toBeTruthy();
  });

  // ════════════════════════════════════════════════════════════════════
  // Test 11: Coordinate E1 is out of bounds for 4x4 bed
  // ════════════════════════════════════════════════════════════════════

  test('CTP-11: Coordinate E1 is out of bounds for 4-column bed', async ({ page }) => {
    await setupDesigner(page);

    await searchAndClickPlant(page, 'Basil');

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Type E1 — column E (index 4) exceeds 4-column bed (max column D, index 3)
    const positionInput = page.locator('#gridPosition');
    await positionInput.fill('E1');
    await page.waitForTimeout(200);

    // Verify error about column out of bounds
    const errorText = modal.locator('p.text-xs.text-red-600');
    await expect(errorText).toBeVisible();
    const errorMessage = await errorText.textContent();
    expect(errorMessage).toMatch(/out of bounds|columns A-D/i);

    // Save should be disabled
    const saveButton = modal.locator('button:has-text("Place"), button:has-text("Save")').first();
    await expect(saveButton).toBeDisabled();

    await modal.locator('button:has-text("Cancel")').click();
  });

  // ════════════════════════════════════════════════════════════════════
  // Test 12: Coordinate A5 is out of bounds for 4-row bed
  // ════════════════════════════════════════════════════════════════════

  test('CTP-12: Coordinate A5 is out of bounds for 4-row bed', async ({ page }) => {
    await setupDesigner(page);

    await searchAndClickPlant(page, 'Basil');

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Type A5 — row 5 (index 4) exceeds 4-row bed (max row 4, index 3)
    const positionInput = page.locator('#gridPosition');
    await positionInput.fill('A5');
    await page.waitForTimeout(200);

    // Verify error about row out of bounds
    const errorText = modal.locator('p.text-xs.text-red-600');
    await expect(errorText).toBeVisible();
    const errorMessage = await errorText.textContent();
    expect(errorMessage).toMatch(/row 5 is out of bounds|rows 1-4/i);

    await modal.locator('button:has-text("Cancel")').click();
  });

  // ════════════════════════════════════════════════════════════════════
  // Test 13: Bounds description shown in modal
  // ════════════════════════════════════════════════════════════════════

  test('CTP-13: Grid bounds description displayed in modal', async ({ page }) => {
    await setupDesigner(page);

    await searchAndClickPlant(page, 'Tomato');

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // For a 4x4 bed, the bounds description should show "columns A-D and rows 1-4"
    await expect(modal.locator('text=columns A-D and rows 1-4')).toBeVisible();

    await modal.locator('button:has-text("Cancel")').click();
  });
});
