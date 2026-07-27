import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateToSubTab, TABS } from './helpers/navigation';

/**
 * Three-User Data Isolation (E2E)
 *
 * The backend suites (test_three_user_isolation.py, test_cross_user_fk_injection.py)
 * cover the endpoint matrix exhaustively and much faster. This spec exists for
 * the things pytest structurally cannot reach:
 *
 *  1. Three *simultaneously live* Flask-Login sessions on a real server, with
 *     real signed cookies over HTTP. pytest drives an in-process test client.
 *  2. Filtering correctness against a POPULATED database. The pytest DB is
 *     dropped and recreated per test, so "return everything" and "return only
 *     mine" are indistinguishable when only one row exists. Here the dev DB is
 *     full of other data, so a broken filter shows up immediately.
 *  3. That the React app's per-session state (bed dropdowns, cached lists)
 *     does not bleed across concurrent browser contexts.
 *
 * Because this runs against the live dev database, every assertion is
 * find-by-name / toBeUndefined rather than toEqual([]) — other rows legitimately
 * exist.
 */

const BACKEND_URL = 'http://localhost:5000';

// Fixed usernames so registerViaAPI stays idempotent across runs. Deliberately
// distinct from isolation_user_a/b used by auth-isolation.spec.ts.
const USERS = {
  A: { username: 'trio_user_a', email: 'trio_a@test.com', password: 'TrioUserA1!' },
  B: { username: 'trio_user_b', email: 'trio_b@test.com', password: 'TrioUserB1!' },
  C: { username: 'trio_user_c', email: 'trio_c@test.com', password: 'TrioUserC1!' },
} as const;

type Letter = keyof typeof USERS;
const LETTERS: Letter[] = ['A', 'B', 'C'];

// All six ordered pairs, so no direction goes unchecked.
const PAIRS: Array<[Letter, Letter]> = [
  ['A', 'B'], ['A', 'C'],
  ['B', 'A'], ['B', 'C'],
  ['C', 'A'], ['C', 'B'],
];

const RUN_ID = Date.now().toString(36);

const bedName = (l: Letter) => `TrioBed-${l}-${RUN_ID}`;
const SHARED_BED = `TrioShared-${RUN_ID}`;
const SECRET_PRICE = 99.99;

const ctx: Record<Letter, APIRequestContext> = {} as any;
const ids: Record<Letter, Record<string, number>> = { A: {}, B: {}, C: {} };

test.describe.serial('Three-User Data Isolation', () => {
  test.beforeAll(async ({ playwright }) => {
    for (const l of LETTERS) {
      // A separate request context per user == a separate cookie jar.
      ctx[l] = await playwright.request.newContext({ baseURL: BACKEND_URL });
      await registerViaAPI(ctx[l], USERS[l].username, USERS[l].email, USERS[l].password);
      await loginViaAPI(ctx[l], USERS[l].username, USERS[l].password);
    }
  });

  test.afterAll(async () => {
    // Child rows first, then parents. Wrapped so a mid-suite failure cannot
    // make teardown throw and mask the real error.
    for (const l of LETTERS) {
      const own = ids[l];
      const deletions: Array<[string, number | undefined]> = [
        ['/api/livestock', own.livestock],
        ['/api/chickens', own.chicken],
        ['/api/compost-piles', own.compost],
        ['/api/garden-plans', own.plan],
        ['/api/seeds', own.seed],
        ['/api/garden-beds', own.bed],
        ['/api/garden-beds', own.sharedBed],
      ];
      for (const [base, id] of deletions) {
        if (id === undefined) continue;
        try {
          // Bed deletion is confirmation-gated; the extra body is ignored elsewhere.
          await ctx[l].delete(`${base}/${id}`, { data: { confirmation: 'delete' } });
        } catch {
          /* best-effort cleanup */
        }
      }
    }
    for (const l of LETTERS) await ctx[l]?.dispose();
    // The three user rows themselves need admin to remove; they are stable
    // fixtures reused across runs, exactly like isolation_user_a/b.
  });

  // ── 1. Each user builds their own homestead ──

  test('all three users create their own data', async () => {
    for (const l of LETTERS) {
      const bed = await ctx[l].post('/api/garden-beds', {
        data: { name: bedName(l), width: 4, length: 8, planningMethod: 'square-foot' },
      });
      expect(bed.status(), `${l} bed create`).toBe(201);
      ids[l].bed = (await bed.json()).id;

      const seed = await ctx[l].post('/api/seeds', {
        data: {
          plantId: 'tomato-1',
          variety: `TrioSeed-${l}-${RUN_ID}`,
          isGlobal: false,
          // A's packet carries a distinctive price so a cross-user read-back
          // through the shopping list would be unmistakable.
          price: l === 'A' ? SECRET_PRICE : 1.5,
          quantity: 7,
          seedsPerPacket: 13,
        },
      });
      expect(seed.status(), `${l} seed create`).toBe(201);
      ids[l].seed = (await seed.json()).id;

      const plan = await ctx[l].post('/api/garden-plans', {
        data: { name: `TrioPlan-${l}-${RUN_ID}`, year: 2026 },
      });
      expect(plan.status(), `${l} plan create`).toBe(201);
      ids[l].plan = (await plan.json()).id;

      const compost = await ctx[l].post('/api/compost-piles', {
        // location and size are required by the endpoint (direct key access).
        data: {
          name: `TrioPile-${l}-${RUN_ID}`,
          location: 'Back corner',
          size: { width: 3, length: 3, height: 3 },
        },
      });
      expect(compost.status(), `${l} compost create`).toBe(201);
      ids[l].compost = (await compost.json()).id;

      const chicken = await ctx[l].post('/api/chickens', {
        data: { name: `TrioHen-${l}-${RUN_ID}`, breed: 'Rhode Island Red', quantity: 1 },
      });
      expect(chicken.status(), `${l} chicken create`).toBe(201);
      ids[l].chicken = (await chicken.json()).id;

      const animal = await ctx[l].post('/api/livestock', {
        data: { name: `TrioGoat-${l}-${RUN_ID}`, species: 'goat', breed: 'Nubian' },
      });
      expect(animal.status(), `${l} livestock create`).toBe(201);
      ids[l].livestock = (await animal.json()).id;
    }

    // Sanity: three genuinely distinct rows, not one row seen three times.
    expect(new Set(LETTERS.map((l) => ids[l].bed)).size).toBe(3);
  });

  // ── 2. Three-way list partition ──

  test('each user sees only their own bed in the list', async () => {
    for (const observer of LETTERS) {
      const beds = await (await ctx[observer].get('/api/garden-beds')).json();
      const names: string[] = beds.map((b: { name: string }) => b.name);

      expect(names, `${observer} should see own bed`).toContain(bedName(observer));

      for (const other of LETTERS.filter((l) => l !== observer)) {
        expect(names, `${observer} must not see ${other}'s bed`)
          .not.toContain(bedName(other));
      }
    }
  });

  test('each user sees only their own private seed', async () => {
    for (const observer of LETTERS) {
      const seeds = await (await ctx[observer].get('/api/my-seeds')).json();
      const varieties: string[] = seeds.map((s: { variety: string }) => s.variety);

      for (const other of LETTERS.filter((l) => l !== observer)) {
        expect(varieties, `${observer} must not see ${other}'s seed`)
          .not.toContain(`TrioSeed-${other}-${RUN_ID}`);
      }
    }
  });

  // ── 3. Direct-ID access, all six directions ──

  test('direct-ID cross-read is denied in all six directions', async () => {
    for (const [owner, attacker] of PAIRS) {
      // These blueprints answer 403; garden-plans answers 404 by design
      // (it does not reveal that the row exists).
      const cases: Array<[string, number, number]> = [
        [`/api/garden-beds/${ids[owner].bed}`, 403, ids[owner].bed],
        [`/api/compost-piles/${ids[owner].compost}`, 403, ids[owner].compost],
        [`/api/chickens/${ids[owner].chicken}`, 403, ids[owner].chicken],
        [`/api/garden-plans/${ids[owner].plan}`, 404, ids[owner].plan],
      ];

      for (const [url, expected] of cases) {
        const res = await ctx[attacker].get(url);
        expect(res.status(), `${attacker} reading ${owner}'s ${url}`).toBe(expected);
      }
    }
  });

  // ── 4. Cross-user FK injection ──

  test('cannot attach a health record to another user\'s animal', async () => {
    for (const [owner, attacker] of PAIRS) {
      const res = await ctx[attacker].post('/api/health-records', {
        data: {
          livestockId: ids[owner].livestock,
          type: 'vaccination',
          treatment: `INJECTED-${attacker}-${RUN_ID}`,
        },
      });
      expect(res.status(), `${attacker} -> ${owner}'s animal`).toBe(403);
    }

    // And nothing landed in anyone's list.
    for (const l of LETTERS) {
      const records = await (await ctx[l].get('/api/health-records')).json();
      const treatments: string[] = records.map((r: { treatment: string }) => r.treatment);
      expect(treatments.some((t) => t?.includes(`INJECTED`) && t?.includes(RUN_ID))).toBe(false);
    }
  });

  test('cannot reference another user\'s seed from a plan, and no price leaks', async () => {
    const res = await ctx.B.post(`/api/garden-plans/${ids.B.plan}/items`, {
      data: {
        plantId: 'tomato-1',
        plantEquivalent: 10,
        targetValue: 10,
        seedInventoryId: ids.A.seed,
      },
    });
    expect(res.status()).toBe(400);

    const list = await ctx.B.get(`/api/garden-plans/${ids.B.plan}/shopping-list`);
    expect(list.status()).toBe(200);
    const body = await list.json();
    const entries: any[] = Array.isArray(body) ? body : body.items ?? [];
    for (const entry of entries) {
      expect(entry.estimatedCost).not.toBe(SECRET_PRICE);
    }
  });

  // ── 5. Shared catalog stays shared (negative control) ──

  test('global catalog seeds remain visible to all three users', async () => {
    const seedsC = await (await ctx.C.get('/api/seeds')).json();
    const globalSeed = seedsC.find((s: { isGlobal?: boolean }) => s.isGlobal);
    test.skip(!globalSeed, 'no global catalog seed present in the dev database');

    for (const l of LETTERS) {
      const seeds = await (await ctx[l].get('/api/seeds')).json();
      const ids_ = seeds.map((s: { id: number }) => s.id);
      expect(ids_, `${l} should see the shared catalog seed`).toContain(globalSeed.id);

      // ...and may attach it to their own plan. This is what proves the
      // cross-user seed fix did not over-restrict.
      const res = await ctx[l].post(`/api/garden-plans/${ids[l].plan}/items`, {
        data: {
          plantId: globalSeed.plantId ?? 'tomato-1',
          plantEquivalent: 1,
          targetValue: 1,
          seedInventoryId: globalSeed.id,
        },
      });
      expect(res.status(), `${l} using the shared catalog seed`).toBe(201);
    }
  });

  // ── 6. Mutation independence ──

  test('one user\'s rename and delete never touch the other two', async () => {
    for (const l of LETTERS) {
      const res = await ctx[l].post('/api/garden-beds', {
        data: { name: SHARED_BED, width: 4, length: 8, planningMethod: 'square-foot' },
      });
      expect(res.status()).toBe(201);
      ids[l].sharedBed = (await res.json()).id;
    }

    // B renames its own.
    const renamed = `${SHARED_BED}-RenamedByB`;
    expect((await ctx.B.put(`/api/garden-beds/${ids.B.sharedBed}`, {
      data: { name: renamed },
    })).status()).toBe(200);

    for (const l of ['A', 'C'] as Letter[]) {
      const bed = await (await ctx[l].get(`/api/garden-beds/${ids[l].sharedBed}`)).json();
      expect(bed.name, `${l}'s bed was renamed by B`).toBe(SHARED_BED);
    }

    // B deletes its own.
    expect((await ctx.B.delete(`/api/garden-beds/${ids.B.sharedBed}`, {
      data: { confirmation: 'delete' },
    })).status()).toBeLessThan(300);
    delete ids.B.sharedBed;

    for (const l of ['A', 'C'] as Letter[]) {
      const res = await ctx[l].get(`/api/garden-beds/${ids[l].sharedBed}`);
      expect(res.status(), `${l}'s bed disappeared when B deleted theirs`).toBe(200);
    }
  });

  // ── 7. Three concurrent real browser sessions ──

  test('three concurrent browser sessions stay separate', async ({ browser }) => {
    // Three UI logins plus navigation; well past the 30s default, and local
    // runs add slowMo on top.
    test.setTimeout(180000);

    const contexts = await Promise.all(LETTERS.map(() => browser.newContext()));
    const pages = await Promise.all(contexts.map((c) => c.newPage()));

    try {
      // Log all three in concurrently — faster, and it is genuinely what this
      // test is about: three sessions live at the same time, not in sequence.
      await Promise.all(
        LETTERS.map(async (l, i) => {
          await pages[i].goto('/');
          await login(pages[i], USERS[l].username, USERS[l].password);
          // The designer lives under the "Design" nav group, not at top level.
          await navigateToSubTab(pages[i], 'Design', TABS.GARDEN_DESIGNER);
        }),
      );

      // With all three sessions live at once, each page must still render only
      // its own bed. The designer opens in overview mode, where every bed is a
      // BedSummaryCard keyed by its database id — asserting on that id (rather
      // than on displayed text) proves exactly which rows reached this browser.
      for (let i = 0; i < LETTERS.length; i++) {
        const l = LETTERS[i];

        await expect(
          pages[i].getByTestId(`bed-card-${ids[l].bed}`),
          `${l}'s own bed missing from their designer`,
        ).toBeVisible({ timeout: 20000 });

        for (const other of LETTERS.filter((x) => x !== l)) {
          await expect(
            pages[i].getByTestId(`bed-card-${ids[other].bed}`),
            `${l} can see ${other}'s bed in the designer`,
          ).toHaveCount(0);
        }
      }
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });
});
