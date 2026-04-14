import { test, expect } from '@playwright/test';
import { registerViaAPI, loginViaAPI } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

test('Debug click v6 - keyboard Enter approach', async ({ page, playwright }) => {
  const ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });
  const user = { username: `dbg6_${RUN_ID}`, email: `dbg6_${RUN_ID}@test.com`, password: 'DebugTest1!' };
  await registerViaAPI(ctx, user.username, user.email, user.password);
  await loginViaAPI(ctx, user.username, user.password);

  const bedResp = await ctx.post('/api/garden-beds', {
    data: { name: `DBG6-${RUN_ID}`, width: 4, length: 4, planningMethod: 'square-foot' },
  });
  expect(bedResp.ok()).toBeTruthy();
  const bed = await bedResp.json();

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  const dismiss = async () => {
    await page.evaluate(() => {
      document.getElementById('webpack-dev-server-client-overlay')?.remove();
      document.querySelectorAll('iframe[src="about:blank"]').forEach(el => el.remove());
    });
  };
  
  await dismiss();
  await page.context().clearCookies();
  await page.reload();
  await page.waitForLoadState('networkidle');
  await dismiss();
  await page.locator('header button:has-text("Login")').click({ timeout: 5000 });
  await page.locator('#username').fill(user.username);
  await page.locator('#password').fill(user.password);
  await page.locator('[role="dialog"] button:has-text("Login")').click();
  await expect(page.locator('#login-modal-title')).not.toBeVisible({ timeout: 5000 });
  await page.waitForLoadState('networkidle');
  await dismiss();

  await navigateTo(page, TABS.GARDEN_DESIGNER);
  await dismiss();
  await expect(page.locator('[data-testid="bed-selector"]')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(500);

  const paletteSearch = page.locator('input[placeholder*="Search"]').first();
  await paletteSearch.fill('Tomato');
  await page.waitForTimeout(500);

  const plantItem = page.locator('.cursor-grab:has-text("Tomato")').first();
  await plantItem.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  
  // Approach 1: Focus the element and press Enter
  // The element has role="button" from @dnd-kit's attributes, so Enter should trigger click
  console.log('--- Approach 1: Focus + Enter ---');
  await plantItem.focus();
  await page.waitForTimeout(100);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  let dialogCount = await page.locator('[role="dialog"]').count();
  console.log(`After Enter: dialog=${dialogCount}`);

  if (dialogCount === 0) {
    // Approach 2: Focus + Space
    console.log('--- Approach 2: Focus + Space ---');
    await plantItem.focus();
    await page.waitForTimeout(100);
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);
    
    dialogCount = await page.locator('[role="dialog"]').count();
    console.log(`After Space: dialog=${dialogCount}`);
  }
  
  if (dialogCount === 0) {
    // Approach 3: Tab to focus, then Enter
    console.log('--- Approach 3: Tab to plant + Enter ---');
    // Clear focus first
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    // Focus the palette search first, then Tab to the plant
    await paletteSearch.focus();
    await page.waitForTimeout(100);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    // Check what's focused now
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? { tag: el.tagName, class: el.className?.substring(0, 80), role: el.getAttribute('role') } : null;
    });
    console.log('Focused element:', JSON.stringify(focused));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    dialogCount = await page.locator('[role="dialog"]').count();
    console.log(`After Tab+Enter: dialog=${dialogCount}`);
  }

  const toastCount = await page.locator('[data-testid^="toast-"]').count();
  console.log(`Toast count: ${toastCount}`);
  if (toastCount > 0) {
    const text = await page.locator('[data-testid^="toast-"]').first().textContent();
    console.log(`Toast: "${text}"`);
  }

  await ctx.delete(`/api/garden-beds/${bed.id}`).catch(() => {});
  await ctx.dispose();
  
  expect(dialogCount).toBeGreaterThan(0);
});
