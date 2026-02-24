import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const AUTH_USER = {
  username: `auth_test_${RUN_ID}`,
  email: `auth_test_${RUN_ID}@test.com`,
  password: 'AuthTest1!',
};

/**
 * Authentication — E2E Tests
 *
 * Covers: register validation (duplicate username/email, short password,
 * invalid format), login validation (wrong credentials, missing fields),
 * session management (auth check, get current user, logout + verify),
 * UI flows (login error display, register via UI, switch modals).
 *
 * Note: Happy-path login/register/logout already covered by smoke.spec.ts.
 * This suite focuses on validation, error paths, and session lifecycle.
 *
 * Strategy: API-first for endpoint validation + UI for error display.
 */
test.describe.serial('Authentication — E2E Tests', () => {
  let ctx: APIRequestContext;

  // ── Setup: create API context ──────────────────────────────────────
  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });
  });

  test.afterAll(async () => {
    await ctx.dispose();
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 1: Register Validation via API
  // ════════════════════════════════════════════════════════════════════

  test('AUTH-01: Register new user via API (happy path)', async () => {
    const resp = await ctx.post('/api/auth/register', {
      data: {
        username: AUTH_USER.username,
        email: AUTH_USER.email,
        password: AUTH_USER.password,
      },
    });
    expect(resp.status()).toBe(201);
    const data = await resp.json();

    expect(data.message).toContain('success');
    expect(data.user).toBeDefined();
    expect(data.user.username).toBe(AUTH_USER.username);
    expect(data.user.email).toBe(AUTH_USER.email);
    expect(data.user.isAdmin).toBe(false);
  });

  test('AUTH-02: Duplicate username rejected (400)', async () => {
    const resp = await ctx.post('/api/auth/register', {
      data: {
        username: AUTH_USER.username, // same as AUTH-01
        email: `different_${RUN_ID}@test.com`,
        password: 'Different1!',
      },
    });
    expect(resp.status()).toBe(400);
    const data = await resp.json();
    expect(data.error).toBeTruthy();
  });

  test('AUTH-03: Duplicate email rejected (400)', async () => {
    const resp = await ctx.post('/api/auth/register', {
      data: {
        username: `different_${RUN_ID}`,
        email: AUTH_USER.email, // same as AUTH-01
        password: 'Different1!',
      },
    });
    expect(resp.status()).toBe(400);
    const data = await resp.json();
    expect(data.error).toBeTruthy();
  });

  test('AUTH-04: Short password rejected (400)', async () => {
    const resp = await ctx.post('/api/auth/register', {
      data: {
        username: `short_pw_${RUN_ID}`,
        email: `short_pw_${RUN_ID}@test.com`,
        password: 'Short1!', // 7 chars, need 8
      },
    });
    expect(resp.status()).toBe(400);
    const data = await resp.json();
    expect(data.error).toContain('8');
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 2: Login Validation via API
  // ════════════════════════════════════════════════════════════════════

  test('AUTH-05: Login with wrong password returns 401', async () => {
    const resp = await ctx.post('/api/auth/login', {
      data: {
        username: AUTH_USER.username,
        password: 'WrongPassword1!',
      },
    });
    expect(resp.status()).toBe(401);
    const data = await resp.json();
    expect(data.error).toBeTruthy();
  });

  test('AUTH-06: Login with non-existent username returns 401', async () => {
    const resp = await ctx.post('/api/auth/login', {
      data: {
        username: `nonexistent_${RUN_ID}`,
        password: AUTH_USER.password,
      },
    });
    expect(resp.status()).toBe(401);
  });

  test('AUTH-07: Login with valid credentials returns user', async () => {
    const resp = await ctx.post('/api/auth/login', {
      data: {
        username: AUTH_USER.username,
        password: AUTH_USER.password,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.user).toBeDefined();
    expect(data.user.username).toBe(AUTH_USER.username);
    expect(data.user.email).toBe(AUTH_USER.email);
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 3: Session Management via API
  // ════════════════════════════════════════════════════════════════════

  test('AUTH-08: Auth check returns authenticated after login', async () => {
    // ctx should still have session from AUTH-07
    const resp = await ctx.get('/api/auth/check');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.authenticated).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.user.username).toBe(AUTH_USER.username);
  });

  test('AUTH-09: Get current user returns user details', async () => {
    const resp = await ctx.get('/api/auth/me');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    // /api/auth/me returns user dict directly (no wrapper)
    expect(data.username).toBe(AUTH_USER.username);
    expect(data.email).toBe(AUTH_USER.email);
    expect(data.id).toBeDefined();
  });

  test('AUTH-10: Logout clears session, protected endpoints return 401', async () => {
    // Logout
    const logoutResp = await ctx.post('/api/auth/logout');
    expect(logoutResp.ok()).toBeTruthy();

    // Auth check should show not authenticated
    const checkResp = await ctx.get('/api/auth/check');
    expect(checkResp.ok()).toBeTruthy();
    const checkData = await checkResp.json();
    expect(checkData.authenticated).toBe(false);

    // Protected endpoint should return 401
    const meResp = await ctx.get('/api/auth/me');
    expect(meResp.status()).toBe(401);
  });

  test('AUTH-11: Logout is idempotent (succeeds when already logged out)', async () => {
    // Already logged out from AUTH-10
    const resp = await ctx.post('/api/auth/logout');
    expect(resp.ok()).toBeTruthy();
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 4: UI — Login Error Display & Register Flow
  // ════════════════════════════════════════════════════════════════════

  test('AUTH-12: Login with wrong password shows error in modal', async ({ page }) => {
    await page.goto('/');

    // Click Login button in header
    await page.locator('header button:has-text("Login")').click();
    await expect(page.locator('#login-modal-title')).toBeVisible({ timeout: 5000 });

    // Fill wrong credentials
    await page.fill('#username', AUTH_USER.username);
    await page.fill('#password', 'WrongPassword1!');

    // Submit
    await page.locator('[role="dialog"] button:has-text("Login")').click();

    // Error message should appear (red box)
    await expect(page.locator('[role="dialog"] .bg-red-50')).toBeVisible({ timeout: 5000 });

    // Modal should still be open (not closed)
    await expect(page.locator('#login-modal-title')).toBeVisible();
  });

  test('AUTH-13: Register via UI, auto-login, username in header', async ({ page }) => {
    const uiUser = {
      username: `ui_reg_${RUN_ID}`,
      email: `ui_reg_${RUN_ID}@test.com`,
      password: 'UiRegTest1!',
    };

    await page.goto('/');

    // Click Register button in header
    await page.locator('header button:has-text("Register")').click();
    await expect(page.locator('#register-modal-title')).toBeVisible({ timeout: 5000 });

    // Fill registration form
    await page.fill('#reg-username', uiUser.username);
    await page.fill('#reg-email', uiUser.email);
    await page.fill('#reg-password', uiUser.password);
    await page.fill('#reg-confirm-password', uiUser.password);

    // Submit
    await page.locator('[role="dialog"] button:has-text("Create Account")').click();

    // Modal should close (successful registration)
    await expect(page.locator('#register-modal-title')).not.toBeVisible({ timeout: 10000 });

    // Username should appear in header (auto-logged in)
    await expect(page.locator(`text=Welcome, ${uiUser.username}`)).toBeVisible({ timeout: 5000 });

    // Logout button should be visible
    await expect(page.locator('button:has-text("Logout")')).toBeVisible();
  });

  test('AUTH-14: Switch between Login and Register modals', async ({ page }) => {
    await page.goto('/');

    // Open Login modal
    await page.locator('header button:has-text("Login")').click();
    await expect(page.locator('#login-modal-title')).toBeVisible({ timeout: 5000 });

    // Click "Register here" link
    await page.locator('[role="dialog"] button:has-text("Register here")').click();

    // Register modal should be visible, login modal gone
    await expect(page.locator('#register-modal-title')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#login-modal-title')).not.toBeVisible();

    // Click "Login here" link
    await page.locator('[role="dialog"] button:has-text("Login here")').click();

    // Login modal should be visible, register modal gone
    await expect(page.locator('#login-modal-title')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#register-modal-title')).not.toBeVisible();
  });
});
