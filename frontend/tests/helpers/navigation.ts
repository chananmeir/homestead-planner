import { Page } from '@playwright/test';

/**
 * Navigation helpers.
 *
 * The app's chrome is a two-level nav plus, in one case, an in-page tab strip:
 *
 *   <nav>   Dashboard | Plan | Design | Grow | Track | Manage | (Admin)
 *   <main>  └─ section landing row: the active group's sub-tabs
 *             └─ SeedsHub only: My Inventory | Seed Catalog
 *
 * Clicking a group button auto-selects that group's FIRST sub-tab, and the
 * sub-tab row stays visible for the whole group. So reaching any destination is
 * "click the group, then click the sub-tab" — which is what NAV_ROUTES encodes.
 *
 * Callers should keep using `navigateTo(page, TABS.X)`; it resolves the full
 * click path itself. `navigateToSubTab` is retained for existing call sites.
 */

/**
 * Full click path for each destination, outermost first.
 *
 * Keyed by the same strings as TABS below. When the app's nav is restructured,
 * this table is the only thing that needs updating.
 */
const NAV_ROUTES: Record<string, string[]> = {
  Dashboard: ['Dashboard'],

  // Group buttons on their own — clicking one lands on its first sub-tab.
  Plan: ['Plan'],
  Design: ['Design'],
  Grow: ['Grow'],
  Track: ['Track'],
  Manage: ['Manage'],

  'Garden Plans': ['Plan', 'Garden Plans'],
  'Garden Snapshot': ['Plan', 'Garden Snapshot'],

  'Garden Designer': ['Design', 'Garden Designer'],
  'Property Designer': ['Design', 'Property Designer'],

  'Planting Calendar': ['Grow', 'Planting Calendar'],
  'Indoor Starts': ['Grow', 'Indoor Starts'],
  'Soil Temperature': ['Grow', 'Soil Temperature'],
  'Weather & Alerts': ['Grow', 'Weather & Alerts'],

  Harvests: ['Track', 'Harvests'],
  Photos: ['Track', 'Photos'],
  Nutrition: ['Track', 'Nutrition'],

  Seeds: ['Manage', 'Seeds'],
  'My Inventory': ['Manage', 'Seeds', 'My Inventory'],
  'Seed Catalog': ['Manage', 'Seeds', 'Seed Catalog'],
  Livestock: ['Manage', 'Livestock'],
  Compost: ['Manage', 'Compost'],
  Settings: ['Manage', 'Settings'],

  Admin: ['Admin'],
};

// Top-level group buttons, which live in <nav> rather than <main>.
const NAV_GROUPS = new Set([
  'Dashboard', 'Plan', 'Design', 'Grow', 'Track', 'Manage', 'Admin',
]);

/**
 * Click one nav button by its exact accessible name.
 *
 * `exact: true` matters: Playwright's `name` option is substring-matching by
 * default, so a loose 'Seeds' would also match 'My Seeds', and 'Harvests' would
 * match page content. Scoping group clicks to <nav> removes the remaining
 * ambiguity; sub-tabs use .first() because the section-landing row renders
 * ahead of the tab's own content in the DOM.
 */
async function clickNavButton(page: Page, name: string) {
  const scope = NAV_GROUPS.has(name) ? page.locator('nav') : page.locator('main');
  await scope.getByRole('button', { name, exact: true }).first().click();
}

/**
 * Navigate to a destination by its TABS name.
 *
 * Unknown names fall back to a plain button click, preserving the old
 * behaviour for any caller passing a literal that isn't in NAV_ROUTES.
 */
export async function navigateTo(page: Page, tabName: string) {
  const route = NAV_ROUTES[tabName];

  if (!route) {
    await page.getByRole('button', { name: tabName }).first().click();
    await page.waitForLoadState('networkidle');
    return;
  }

  for (const step of route) {
    await clickNavButton(page, step);
  }
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to a sub-tab under a parent group.
 *
 * Kept for existing call sites. When the sub-tab is a known destination its own
 * route is authoritative — the parent argument is then redundant, and ignoring
 * it means a stale parent name cannot break the call.
 */
export async function navigateToSubTab(page: Page, parentTab: string, subTab: string) {
  if (NAV_ROUTES[subTab]) {
    await navigateTo(page, subTab);
    return;
  }

  // Unknown sub-tab: walk the parent's route, then click the sub-tab by name.
  await navigateTo(page, parentTab);
  await page.getByRole('button', { name: subTab, exact: true }).first().click();
  await page.waitForLoadState('networkidle');
}

/**
 * Destination names. Values are the button labels the app actually renders —
 * keep them in sync with NAV_ROUTES above.
 */
export const TABS = {
  DASHBOARD: 'Dashboard',

  GARDEN_PLANNER: 'Garden Plans',
  GARDEN_SNAPSHOT: 'Garden Snapshot',

  GARDEN_DESIGNER: 'Garden Designer',
  PROPERTY_DESIGNER: 'Property Designer',

  // The "Grow" nav group. Some specs pass this as the parent of a sub-tab.
  GROWING: 'Grow',
  PLANTING_CALENDAR: 'Planting Calendar',
  INDOOR_STARTS: 'Indoor Starts',
  SOIL_TEMPERATURE: 'Soil Temperature',
  WEATHER: 'Weather & Alerts',

  HARVESTS: 'Harvests',
  PHOTOS: 'Photos',
  NUTRITION: 'Nutrition',

  SEEDS: 'Seeds',
  // In-page tabs of the Seeds hub.
  MY_SEEDS: 'My Inventory',
  SEED_CATALOG: 'Seed Catalog',
  LIVESTOCK: 'Livestock',
  COMPOST: 'Compost',
  SETTINGS: 'Settings',

  ADMIN: 'Admin',
} as const;
