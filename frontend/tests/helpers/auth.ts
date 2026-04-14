import { Page, APIRequestContext, expect } from '@playwright/test';

const BACKEND_URL = 'http://localhost:5000';

// Test user credentials - fresh user created per test run
export const TEST_USER = {
  username: 'smoketest',
  email: 'smoketest@test.com',
  password: 'SmokeTest1!',
};

/**
 * Register the test user via the backend API.
 * Idempotent: if the user already exists (400), it silently succeeds.
 */
export async function ensureTestUser(request: APIRequestContext) {
  const response = await request.post(`${BACKEND_URL}/api/auth/register`, {
    data: {
      username: TEST_USER.username,
      email: TEST_USER.email,
      password: TEST_USER.password,
    },
  });

  const status = response.status();
  if (status === 201) {
    console.log(`Registered test user "${TEST_USER.username}"`);
  } else if (status === 400) {
    // User already exists - that's fine
    console.log(`Test user "${TEST_USER.username}" already exists`);
  } else {
    const body = await response.text();
    throw new Error(`Failed to ensure test user: ${status} - ${body}`);
  }
}

/**
 * Login via the UI. Clears any existing session first to ensure
 * we always log in as the specified user (not a stale session).
 */
export async function login(page: Page, username = TEST_USER.username, password = TEST_USER.password) {
  // Clear cookies to remove any stale sessions
  await page.context().clearCookies();
  // Reload the page so the app picks up the cleared session
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Now the Login button should be visible (unauthenticated state)
  await page.locator('header button:has-text("Login")').click();
  // Fill login modal
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  // Submit via modal's login button
  await page.locator('[role="dialog"] button:has-text("Login")').click();
  // Wait for modal to close
  await expect(page.locator('#login-modal-title')).not.toBeVisible({ timeout: 5000 });
  await page.waitForLoadState('networkidle');
}

export async function register(page: Page, username: string, email: string, password: string) {
  await page.locator('header button:has-text("Register")').click();
  await page.locator('#reg-username').fill(username);
  await page.locator('#reg-email').fill(email);
  await page.locator('#reg-password').fill(password);
  await page.locator('#reg-confirm-password').fill(password);
  await page.locator('[role="dialog"] button:has-text("Create Account")').click();
  await expect(page.locator('#register-modal-title')).not.toBeVisible({ timeout: 5000 });
  await page.waitForLoadState('networkidle');
}

export async function logout(page: Page) {
  await page.locator('button:has-text("Logout")').click();
  await page.waitForLoadState('networkidle');
}

/**
 * Register a user via API. Idempotent: 400 (already exists) is treated as success.
 */
export async function registerViaAPI(
  context: APIRequestContext,
  username: string,
  email: string,
  password: string,
) {
  const response = await context.post(`${BACKEND_URL}/api/auth/register`, {
    data: { username, email, password },
  });
  const status = response.status();
  if (status !== 201 && status !== 400) {
    const body = await response.text();
    throw new Error(`Registration failed for ${username}: ${status} - ${body}`);
  }
}

/**
 * Login via API. The session cookie is stored on the APIRequestContext,
 * so subsequent requests on the same context are authenticated.
 */
export async function loginViaAPI(
  context: APIRequestContext,
  username: string,
  password: string,
) {
  const response = await context.post(`${BACKEND_URL}/api/auth/login`, {
    data: { username, password },
  });
  if (response.status() !== 200) {
    const body = await response.text();
    throw new Error(`Login failed for ${username}: ${response.status()} - ${body}`);
  }
  return response;
}
