import { Page } from '@playwright/test';

export async function navigateTo(page: Page, tabName: string) {
  await page.getByRole('button', { name: tabName }).click();
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to a sub-tab that requires clicking a parent tab first.
 * E.g., navigateToSubTab(page, 'Growing', 'Indoor Starts')
 */
export async function navigateToSubTab(page: Page, parentTab: string, subTab: string) {
  await page.getByRole('button', { name: parentTab }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: subTab }).click();
  await page.waitForLoadState('networkidle');
}

export const TABS = {
  GARDEN_PLANNER: 'Garden Planner',
  GARDEN_DESIGNER: 'Garden Designer',
  PROPERTY_DESIGNER: 'Property Designer',
  GROWING: 'Growing',
  INDOOR_STARTS: 'Indoor Starts',
  MY_SEEDS: 'My Seeds',
  SEED_CATALOG: 'Seed Catalog',
  SEEDS: 'Seeds',
  LIVESTOCK: 'Livestock',
  PLANTING_CALENDAR: 'Planting Calendar',
  WEATHER: 'Weather',
  NUTRITION: 'Nutrition',
  COMPOST: 'Compost',
  HARVESTS: 'Harvests',
  PHOTOS: 'Photos',
  ADMIN: 'Admin',
} as const;
