import { test, expect } from '@playwright/test';
import { ensureTestUser, login, logout, TEST_USER } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';

test.describe.serial('Smoke Test - Critical Happy Path', () => {
  let bedName: string;

  test.beforeAll(() => {
    // Unique bed name to avoid collisions with prior test runs
    bedName = `Smoke-Bed-${Date.now()}`;
  });

  test('should register test user via API', async ({ request }) => {
    // Ensure our test user exists in the database (idempotent)
    await ensureTestUser(request);

    // Verify the user can authenticate via API
    const loginResponse = await request.post('http://localhost:5000/api/auth/login', {
      data: {
        username: TEST_USER.username,
        password: TEST_USER.password,
      },
    });
    expect(loginResponse.status()).toBe(200);

    const body = await loginResponse.json();
    expect(body.user.username).toBe(TEST_USER.username);
  });

  test('should login via UI', async ({ page }) => {
    await page.goto('/');
    await login(page);
    // Verify welcome message appears
    await expect(page.getByText(`Welcome, ${TEST_USER.username}`)).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Garden Designer and create a bed', async ({ page }) => {
    await page.goto('/');
    await login(page);
    await navigateTo(page, TABS.GARDEN_DESIGNER);

    // Open bed creation modal
    const addBedBtn = page.locator('button:has-text("Add Bed"), button:has-text("Create Your First Bed")');
    await addBedBtn.first().click();

    // Verify modal opened
    await expect(page.getByText('Add Garden Bed')).toBeVisible({ timeout: 5000 });

    // Fill bed name
    await page.locator('#bed-name').fill(bedName);

    // 4x8 is the default preset - just verify it's selected
    await expect(page.locator('input[name="sizePreset"][value="4x8"]')).toBeChecked();

    // Planning method defaults to square-foot
    await expect(page.locator('#planning-method')).toHaveValue('square-foot');

    // Submit
    await page.locator('button:has-text("Create Bed")').click();

    // Wait for modal to close
    await expect(page.getByText('Add Garden Bed')).not.toBeVisible({ timeout: 5000 });

    // Verify bed appears as the active bed (visible in the status/selector area)
    await expect(page.locator(`text=Active:`).first()).toBeVisible({ timeout: 5000 });
    // Confirm the bed name is somewhere on the page
    await expect(page.locator(`div:has-text("${bedName}")`).first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Garden Planner', async ({ page }) => {
    await page.goto('/');
    await login(page);
    await navigateTo(page, TABS.GARDEN_PLANNER);

    // Verify planner loaded - look for year selector or plan content
    await expect(
      page.getByText('Garden Planner').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Seed Inventory', async ({ page }) => {
    await page.goto('/');
    await login(page);
    await navigateTo(page, TABS.MY_SEEDS);

    // Verify seeds page loaded
    await expect(page.locator('text=My Seeds').first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Planting Calendar', async ({ page }) => {
    await page.goto('/');
    await login(page);
    await navigateTo(page, TABS.PLANTING_CALENDAR);

    // Verify calendar loaded
    await expect(page.locator('text=Planting Calendar').first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Harvests', async ({ page }) => {
    await page.goto('/');
    await login(page);
    await navigateTo(page, TABS.HARVESTS);

    // Verify harvests page loaded
    await expect(page.locator('text=Harvests').first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Weather', async ({ page }) => {
    await page.goto('/');
    await login(page);
    await navigateTo(page, TABS.WEATHER);

    // Verify weather page loaded
    await expect(page.locator('text=Weather').first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to all remaining tabs', async ({ page }) => {
    await page.goto('/');
    await login(page);

    const remainingTabs = [
      TABS.PROPERTY_DESIGNER,
      TABS.INDOOR_STARTS,
      TABS.SEED_CATALOG,
      TABS.LIVESTOCK,
      TABS.NUTRITION,
      TABS.COMPOST,
      TABS.PHOTOS,
    ];

    for (const tab of remainingTabs) {
      await navigateTo(page, tab);
      // Each tab should render without error - just verify we didn't crash
      await expect(page.locator('header')).toBeVisible();
    }
  });

  test('should verify bed persists after navigation', async ({ page }) => {
    await page.goto('/');
    await login(page);
    await navigateTo(page, TABS.GARDEN_DESIGNER);

    // The bed we created earlier should still exist (visible as active bed or in selector)
    await expect(page.locator(`div:has-text("${bedName}")`).first()).toBeVisible({ timeout: 5000 });
  });

  test('should logout successfully', async ({ page }) => {
    await page.goto('/');
    await login(page);
    await logout(page);

    // Verify returned to unauthenticated state - login button visible again
    await expect(page.locator('header button:has-text("Login")')).toBeVisible({ timeout: 5000 });
    // Welcome message should be gone
    await expect(page.getByText(`Welcome, ${TEST_USER.username}`)).not.toBeVisible();
  });
});
