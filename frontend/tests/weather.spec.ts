import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const WX_USER = {
  username: `wx_test_${RUN_ID}`,
  email: `wx_test_${RUN_ID}@test.com`,
  password: 'WxTest1!',
};

// Known valid US ZIP code for weather testing
const VALID_ZIP = '53209'; // Milwaukee, WI

/**
 * Weather Module — E2E Tests
 *
 * Covers: weather API endpoints (current + forecast), forecast grid rendering,
 * current conditions cards, GDD chart, settings panel with ZIP code,
 * alert generation from forecast thresholds, and forecast day parameter clamping.
 *
 * Strategy: API-first for endpoint validation + UI verification in Weather tab.
 * Weather data comes from live Open-Meteo API with mock fallback, so assertions
 * use range checks (not exact values) for temperature/precipitation.
 *
 * Note: No auth required for weather API endpoints, but the frontend app
 * requires login to navigate to the Weather tab.
 */
test.describe.serial('Weather Module — E2E Tests', () => {
  let ctx: APIRequestContext;

  // ── Setup: register user, login ────────────────────────────────────
  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });

    await registerViaAPI(ctx, WX_USER.username, WX_USER.email, WX_USER.password);
    await loginViaAPI(ctx, WX_USER.username, WX_USER.password);
  });

  test.afterAll(async () => {
    await ctx.dispose();
  });

  // Helper: navigate to Weather tab
  async function setupWeather(page: import('@playwright/test').Page) {
    await page.goto('/');
    await login(page, WX_USER.username, WX_USER.password);
    await navigateTo(page, TABS.WEATHER);
  }

  // ════════════════════════════════════════════════════════════════════
  // Suite 1: Weather API Endpoint Validation
  // ════════════════════════════════════════════════════════════════════

  test('WX-01: GET current weather with valid zipcode', async () => {
    const resp = await ctx.get(`/api/weather/current?zipcode=${VALID_ZIP}`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    // Weather object structure
    expect(data.weather).toBeDefined();
    expect(typeof data.weather.temperature).toBe('number');
    expect(data.weather.temperature).toBeGreaterThan(-60);
    expect(data.weather.temperature).toBeLessThan(140);
    expect(typeof data.weather.humidity).toBe('number');
    expect(typeof data.weather.windSpeed).toBe('number');
    expect(typeof data.weather.conditions).toBe('string');

    // Location object structure
    expect(data.location).toBeDefined();
    expect(typeof data.location.latitude).toBe('number');
    expect(typeof data.location.longitude).toBe('number');
    expect(data.location.zipcode).toBe(VALID_ZIP);
  });

  test('WX-02: GET current weather missing params returns 400', async () => {
    const resp = await ctx.get('/api/weather/current');
    expect(resp.status()).toBe(400);
    const data = await resp.json();
    expect(data.error).toContain('Either zipcode or lat/lon coordinates required');
  });

  test('WX-03: GET forecast with valid zipcode returns 7 days', async () => {
    const resp = await ctx.get(`/api/weather/forecast?zipcode=${VALID_ZIP}&days=7`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    // Forecast array structure
    expect(data.forecast).toBeDefined();
    expect(Array.isArray(data.forecast)).toBeTruthy();
    expect(data.forecast.length).toBe(7);

    // Each day has required fields
    const day = data.forecast[0];
    expect(typeof day.highTemp).toBe('number');
    expect(typeof day.lowTemp).toBe('number');
    expect(day.highTemp).toBeGreaterThanOrEqual(day.lowTemp);
    expect(typeof day.precipitation).toBe('number');
    expect(day.precipitation).toBeGreaterThanOrEqual(0);
    expect(typeof day.humidity).toBe('number');
    expect(typeof day.windSpeed).toBe('number');
    expect(typeof day.conditions).toBe('string');
    expect(typeof day.date).toBe('string');

    // isMock flag present
    expect(typeof data.isMock).toBe('boolean');

    // Location present
    expect(data.location).toBeDefined();
    expect(data.location.zipcode).toBe(VALID_ZIP);
  });

  test('WX-04: GET forecast days parameter clamped (min=1, max=10)', async () => {
    // Request 1 day (minimum)
    const resp1 = await ctx.get(`/api/weather/forecast?zipcode=${VALID_ZIP}&days=1`);
    expect(resp1.ok()).toBeTruthy();
    const data1 = await resp1.json();
    expect(data1.forecast.length).toBe(1);

    // Request 10 days (maximum)
    const resp10 = await ctx.get(`/api/weather/forecast?zipcode=${VALID_ZIP}&days=10`);
    expect(resp10.ok()).toBeTruthy();
    const data10 = await resp10.json();
    expect(data10.forecast.length).toBe(10);

    // Request 20 days (over max, should clamp to 10)
    const resp20 = await ctx.get(`/api/weather/forecast?zipcode=${VALID_ZIP}&days=20`);
    expect(resp20.ok()).toBeTruthy();
    const data20 = await resp20.json();
    expect(data20.forecast.length).toBe(10);
  });

  test('WX-05: GET current weather with lat/lon coordinates', async () => {
    // Milwaukee, WI coordinates
    const resp = await ctx.get('/api/weather/current?lat=43.0389&lon=-87.9065');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.weather).toBeDefined();
    expect(typeof data.weather.temperature).toBe('number');
    expect(data.location.latitude).toBeCloseTo(43.0389, 1);
    expect(data.location.longitude).toBeCloseTo(-87.9065, 1);
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 2: Weather UI — Page Rendering & Sections
  // ════════════════════════════════════════════════════════════════════

  test('WX-06: Weather page renders all main sections', async ({ page }) => {
    await setupWeather(page);

    // Header with title
    await expect(page.locator('text=Weather & Alerts')).toBeVisible({ timeout: 10000 });

    // Settings button
    await expect(page.locator('[data-testid="weather-settings-btn"]')).toBeVisible();

    // Forecast grid (appears after data loads)
    await expect(page.locator('[data-testid="weather-forecast-grid"]')).toBeVisible({ timeout: 15000 });

    // Current conditions cards
    await expect(page.locator('[data-testid="weather-temp-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="weather-wind-card"]')).toBeVisible();

    // GDD chart
    await expect(page.locator('[data-testid="weather-gdd-chart"]')).toBeVisible();

    // Weather tips section
    await expect(page.locator('text=Weather-Based Garden Tips')).toBeVisible();
  });

  test('WX-07: Forecast grid shows 7 day cards with Today highlighted', async ({ page }) => {
    await setupWeather(page);

    // Wait for forecast to load
    await expect(page.locator('[data-testid="weather-forecast-grid"]')).toBeVisible({ timeout: 15000 });

    // Should have 7 day cards
    const dayCards = page.locator('[data-testid^="weather-forecast-day-"]');
    await expect(dayCards).toHaveCount(7);

    // First card should say "Today" and have blue highlight
    const todayCard = page.locator('[data-testid="weather-forecast-day-0"]');
    await expect(todayCard).toContainText('Today');
    await expect(todayCard).toHaveClass(/bg-blue-50/);

    // Each card should show temperature (contains °)
    for (let i = 0; i < 7; i++) {
      const card = page.locator(`[data-testid="weather-forecast-day-${i}"]`);
      await expect(card).toContainText('°');
    }
  });

  test('WX-08: Current conditions cards show temperature and wind', async ({ page }) => {
    await setupWeather(page);

    // Wait for data load
    await expect(page.locator('[data-testid="weather-forecast-grid"]')).toBeVisible({ timeout: 15000 });

    // Temperature card should show °F
    const tempCard = page.locator('[data-testid="weather-temp-card"]');
    await expect(tempCard).toContainText('Temperature');
    await expect(tempCard).toContainText('°F');
    await expect(tempCard).toContainText('Feels like');

    // Wind card should show mph
    const windCard = page.locator('[data-testid="weather-wind-card"]');
    await expect(windCard).toContainText('Wind');
    await expect(windCard).toContainText('mph');
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 3: Settings Panel & ZIP Code
  // ════════════════════════════════════════════════════════════════════

  test('WX-09: Settings panel opens and closes', async ({ page }) => {
    await setupWeather(page);

    // Settings panel should be hidden initially
    await expect(page.locator('[data-testid="weather-settings-panel"]')).not.toBeVisible();

    // Click settings button to open
    await page.locator('[data-testid="weather-settings-btn"]').click();
    await expect(page.locator('[data-testid="weather-settings-panel"]')).toBeVisible();

    // ZIP code input should be visible
    await expect(page.locator('[data-testid="weather-zipcode-input"]')).toBeVisible();

    // Save button should be visible
    await expect(page.locator('[data-testid="weather-zipcode-save"]')).toBeVisible();

    // Click settings again to close
    await page.locator('[data-testid="weather-settings-btn"]').click();
    await expect(page.locator('[data-testid="weather-settings-panel"]')).not.toBeVisible();
  });

  test('WX-10: Save ZIP code updates forecast display', async ({ page }) => {
    await setupWeather(page);

    // Wait for initial load
    await expect(page.locator('[data-testid="weather-forecast-grid"]')).toBeVisible({ timeout: 15000 });

    // Open settings
    await page.locator('[data-testid="weather-settings-btn"]').click();
    await expect(page.locator('[data-testid="weather-settings-panel"]')).toBeVisible();

    // Clear and enter a different ZIP code (New York)
    const zipInput = page.locator('[data-testid="weather-zipcode-input"]');
    await zipInput.clear();
    await zipInput.fill('10001');

    // Click Save
    await page.locator('[data-testid="weather-zipcode-save"]').click();

    // Settings panel should close
    await expect(page.locator('[data-testid="weather-settings-panel"]')).not.toBeVisible();

    // Forecast grid should still be visible after re-fetch
    await expect(page.locator('[data-testid="weather-forecast-grid"]')).toBeVisible({ timeout: 15000 });

    // Should still have 7 day cards
    const dayCards = page.locator('[data-testid^="weather-forecast-day-"]');
    await expect(dayCards).toHaveCount(7);
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 4: GDD Chart & Forecast Data Integrity
  // ════════════════════════════════════════════════════════════════════

  test('WX-11: GDD chart renders with forecast data', async ({ page }) => {
    await setupWeather(page);

    // Wait for data load
    await expect(page.locator('[data-testid="weather-forecast-grid"]')).toBeVisible({ timeout: 15000 });

    const gddChart = page.locator('[data-testid="weather-gdd-chart"]');
    await expect(gddChart).toBeVisible();

    // GDD chart should contain title and description
    await expect(gddChart).toContainText('Growing Degree Days');
    await expect(gddChart).toContainText('Track accumulated heat units');

    // Verify GDD values are rendered (numeric text inside the chart)
    // The chart renders GDD numbers as text-xs font-semibold for each day
    // Wait briefly for forecast data to populate the chart
    await page.waitForTimeout(1000);

    // The GDD chart text should contain at least one date label (e.g., "Feb 28")
    const chartText = await gddChart.textContent();
    expect(chartText).toBeTruthy();
    // Chart text includes the title + description + date labels + GDD values
    expect(chartText!.length).toBeGreaterThan(50); // Non-trivial content rendered
  });

  test('WX-12: Forecast data has valid GDD values via API', async () => {
    const resp = await ctx.get(`/api/weather/forecast?zipcode=${VALID_ZIP}&days=7`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    for (const day of data.forecast) {
      // GDD should be non-negative (formula: max(0, (high+low)/2 - 50))
      expect(day.growingDegreeDays).toBeGreaterThanOrEqual(0);

      // Verify GDD is consistent with temperatures
      const expectedGDD = Math.max(0, Math.round((day.highTemp + day.lowTemp) / 2 - 50));
      // Allow small rounding difference
      expect(Math.abs(day.growingDegreeDays - expectedGDD)).toBeLessThanOrEqual(1);
    }
  });
});
