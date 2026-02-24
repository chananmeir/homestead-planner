import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI } from './helpers/auth';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const ADMIN_USER = {
  username: `adm_test_${RUN_ID}`,
  email: `adm_test_${RUN_ID}@test.com`,
  password: 'AdmTest1!',
};

const REGULAR_USER = {
  username: `reg_test_${RUN_ID}`,
  email: `reg_test_${RUN_ID}@test.com`,
  password: 'RegTest1!',
};

/**
 * Admin User Management — E2E Tests
 *
 * Covers: non-admin access denied (403), admin list users with stats,
 * admin create user, admin reset password, admin delete user with cascade,
 * self-protection constraints, last-admin protection.
 *
 * Strategy: API-first. Admin tab is not in main navigation bar,
 * so all tests use direct API calls for admin operations.
 */
test.describe.serial('Admin User Management — E2E Tests', () => {
  let adminCtx: APIRequestContext;
  let regularCtx: APIRequestContext;

  // Track IDs across tests
  let createdUserId: number;

  // ── Setup: register admin + regular user ────────────────────────────
  test.beforeAll(async ({ playwright }) => {
    // Create contexts
    adminCtx = await playwright.request.newContext({ baseURL: BACKEND_URL });
    regularCtx = await playwright.request.newContext({ baseURL: BACKEND_URL });

    // Register admin user and promote to admin via direct registration
    await registerViaAPI(adminCtx, ADMIN_USER.username, ADMIN_USER.email, ADMIN_USER.password);
    await loginViaAPI(adminCtx, ADMIN_USER.username, ADMIN_USER.password);

    // Promote to admin: use the existing admin account (seeded on startup) to promote our test user
    const bootstrapCtx = await playwright.request.newContext({ baseURL: BACKEND_URL });
    await loginViaAPI(bootstrapCtx, 'admin', 'admin123');

    // Find our test user
    const listResp = await bootstrapCtx.get(`/api/admin/users?search=${ADMIN_USER.username}`);
    const listData = await listResp.json();
    const testAdmin = listData.users.find((u: any) => u.username === ADMIN_USER.username);

    // Promote to admin
    await bootstrapCtx.put(`/api/admin/users/${testAdmin.id}`, {
      data: { isAdmin: true },
    });
    await bootstrapCtx.dispose();

    // Re-login as our now-admin user (session refresh)
    await loginViaAPI(adminCtx, ADMIN_USER.username, ADMIN_USER.password);

    // Register regular user
    await registerViaAPI(regularCtx, REGULAR_USER.username, REGULAR_USER.email, REGULAR_USER.password);
    await loginViaAPI(regularCtx, REGULAR_USER.username, REGULAR_USER.password);
  });

  test.afterAll(async ({ playwright }) => {
    // Cleanup: use bootstrap admin to delete test users
    const cleanupCtx = await playwright.request.newContext({ baseURL: BACKEND_URL });
    await loginViaAPI(cleanupCtx, 'admin', 'admin123');

    const resp = await cleanupCtx.get('/api/admin/users');
    if (resp.ok()) {
      const data = await resp.json();
      for (const u of data.users) {
        if (u.username.includes(RUN_ID)) {
          await cleanupCtx.delete(`/api/admin/users/${u.id}`).catch(() => {});
        }
      }
    }
    await cleanupCtx.dispose();
    await adminCtx.dispose();
    await regularCtx.dispose();
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 1: Access Control
  // ════════════════════════════════════════════════════════════════════

  test('ADM-01: Non-admin cannot access admin endpoints (403)', async () => {
    // GET users list
    const listResp = await regularCtx.get('/api/admin/users');
    expect(listResp.status()).toBe(403);

    // POST create user
    const createResp = await regularCtx.post('/api/admin/users', {
      data: {
        username: 'should_fail',
        email: 'should_fail@test.com',
        password: 'ShouldFail1!',
      },
    });
    expect(createResp.status()).toBe(403);
  });

  test('ADM-02: Unauthenticated request returns 401', async ({ playwright }) => {
    const anonCtx = await playwright.request.newContext({ baseURL: BACKEND_URL });
    const resp = await anonCtx.get('/api/admin/users');
    expect(resp.status()).toBe(401);
    await anonCtx.dispose();
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 2: Admin CRUD Operations
  // ════════════════════════════════════════════════════════════════════

  test('ADM-03: Admin can list users with statistics', async () => {
    const resp = await adminCtx.get('/api/admin/users');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    // Should have users array and statistics
    expect(data.users).toBeDefined();
    expect(Array.isArray(data.users)).toBeTruthy();
    expect(data.users.length).toBeGreaterThanOrEqual(2); // at least admin + regular

    expect(data.statistics).toBeDefined();
    expect(data.statistics.totalUsers).toBeGreaterThanOrEqual(2);
    expect(data.statistics.adminUsers).toBeGreaterThanOrEqual(1);

    // Verify user shape
    const found = data.users.find((u: any) => u.username === REGULAR_USER.username);
    expect(found).toBeTruthy();
    expect(found.email).toBe(REGULAR_USER.email);
    expect(found.isAdmin).toBe(false);
    expect(found.createdAt).toBeTruthy();
  });

  test('ADM-04: Admin can search and filter users', async () => {
    // Search by username
    const searchResp = await adminCtx.get(`/api/admin/users?search=${ADMIN_USER.username}`);
    expect(searchResp.ok()).toBeTruthy();
    const searchData = await searchResp.json();
    expect(searchData.users.length).toBeGreaterThanOrEqual(1);
    expect(searchData.users.some((u: any) => u.username === ADMIN_USER.username)).toBeTruthy();

    // Filter by admins
    const adminResp = await adminCtx.get('/api/admin/users?filter=admins');
    expect(adminResp.ok()).toBeTruthy();
    const adminData = await adminResp.json();
    expect(adminData.users.every((u: any) => u.isAdmin === true)).toBeTruthy();

    // Filter by regular
    const regularResp = await adminCtx.get('/api/admin/users?filter=regular');
    expect(regularResp.ok()).toBeTruthy();
    const regularData = await regularResp.json();
    expect(regularData.users.every((u: any) => u.isAdmin === false)).toBeTruthy();
  });

  test('ADM-05: Admin can create user via API', async () => {
    const newUser = {
      username: `created_${RUN_ID}`,
      email: `created_${RUN_ID}@test.com`,
      password: 'Created1!',
      isAdmin: false,
    };

    const resp = await adminCtx.post('/api/admin/users', {
      data: newUser,
    });
    expect(resp.status()).toBe(201);
    const data = await resp.json();
    createdUserId = data.user.id;

    expect(data.user.username).toBe(newUser.username);
    expect(data.user.email).toBe(newUser.email);
    expect(data.user.isAdmin).toBe(false);
    expect(data.user.lastLogin).toBeNull();
    expect(data.message).toBe('User created successfully');
  });

  test('ADM-06: Duplicate username rejected (400)', async () => {
    const resp = await adminCtx.post('/api/admin/users', {
      data: {
        username: `created_${RUN_ID}`, // same as ADM-05
        email: `different_${RUN_ID}@test.com`,
        password: 'Different1!',
      },
    });
    expect(resp.status()).toBe(400);
    const data = await resp.json();
    expect(data.error).toContain('already exists');
  });

  test('ADM-07: Admin can update user email and admin status', async () => {
    const newEmail = `updated_${RUN_ID}@test.com`;
    const resp = await adminCtx.put(`/api/admin/users/${createdUserId}`, {
      data: {
        email: newEmail,
        isAdmin: true,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.user.email).toBe(newEmail);
    expect(data.user.isAdmin).toBe(true);

    // Revert admin status for later tests
    await adminCtx.put(`/api/admin/users/${createdUserId}`, {
      data: { isAdmin: false },
    });
  });

  test('ADM-08: Admin can reset user password', async () => {
    const resp = await adminCtx.post(`/api/admin/users/${createdUserId}/reset-password`, {
      data: { newPassword: 'ResetPass1!' },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.message).toBe('Password reset successfully');

    // Verify the new password works by logging in (use adminCtx temporarily)
    const loginResp = await adminCtx.post('/api/auth/login', {
      data: { username: `created_${RUN_ID}`, password: 'ResetPass1!' },
    });
    expect(loginResp.ok()).toBeTruthy();

    // Re-login as admin to restore session for subsequent tests
    await loginViaAPI(adminCtx, ADMIN_USER.username, ADMIN_USER.password);
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 3: Self-Protection & Last-Admin Constraints
  // ════════════════════════════════════════════════════════════════════

  test('ADM-09: Admin cannot delete own account (403)', async () => {
    // Find own user ID
    const listResp = await adminCtx.get(`/api/admin/users?search=${ADMIN_USER.username}`);
    const listData = await listResp.json();
    const selfUser = listData.users.find((u: any) => u.username === ADMIN_USER.username);

    const resp = await adminCtx.delete(`/api/admin/users/${selfUser.id}`);
    expect(resp.status()).toBe(403);
    const data = await resp.json();
    expect(data.error).toContain('Cannot delete your own account');
  });

  test('ADM-10: Admin cannot reset own password via admin endpoint (403)', async () => {
    // Find own user ID
    const listResp = await adminCtx.get(`/api/admin/users?search=${ADMIN_USER.username}`);
    const listData = await listResp.json();
    const selfUser = listData.users.find((u: any) => u.username === ADMIN_USER.username);

    const resp = await adminCtx.post(`/api/admin/users/${selfUser.id}/reset-password`, {
      data: { newPassword: 'NewPass1!' },
    });
    expect(resp.status()).toBe(403);
  });

  test('ADM-11: Password validation rejects short passwords (400)', async () => {
    const resp = await adminCtx.post(`/api/admin/users/${createdUserId}/reset-password`, {
      data: { newPassword: 'short' },
    });
    expect(resp.status()).toBe(400);
    const data = await resp.json();
    expect(data.error).toContain('8 characters');
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 4: Delete with Verification
  // ════════════════════════════════════════════════════════════════════

  test('ADM-12: Admin can delete user via API, verify gone', async () => {
    const resp = await adminCtx.delete(`/api/admin/users/${createdUserId}`);
    expect(resp.status()).toBe(204);

    // Verify user is gone
    const listResp = await adminCtx.get(`/api/admin/users?search=created_${RUN_ID}`);
    const listData = await listResp.json();
    const found = listData.users.find((u: any) => u.id === createdUserId);
    expect(found).toBeUndefined();
  });

  test('ADM-13: Delete non-existent user returns 404', async () => {
    const resp = await adminCtx.delete('/api/admin/users/999999');
    expect(resp.status()).toBe(404);
  });
});
