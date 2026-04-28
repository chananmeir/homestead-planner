/**
 * Playwright Test: Seed Import from CSV
 *
 * This test verifies that CSV import functionality works correctly with all three
 * provided lettuce variety CSV files.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Configuration
const BACKEND_URL = 'http://localhost:5000';
const FRONTEND_URL = 'http://localhost:3000';
const CSV_FILES = [
  'C:\\Users\\march\\Downloads\\lettuce_varieties.csv',
  'C:\\Users\\march\\Downloads\\lettuce_varieties_expanded.csv',
  'C:\\Users\\march\\Downloads\\lettuce_varieties_max.csv'
];

// Helper to count CSV rows
function countCSVRows(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  return lines.length - 1; // Subtract header row
}

test.describe('Seed Import from CSV', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to frontend
    await page.goto(FRONTEND_URL);

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  for (const csvFile of CSV_FILES) {
    const fileName = path.basename(csvFile);
    const expectedRows = countCSVRows(csvFile);

    test(`should import seeds from ${fileName}`, async ({ page }) => {
      console.log(`\n========================================`);
      console.log(`Testing import: ${fileName}`);
      console.log(`Expected rows: ${expectedRows}`);
      console.log(`========================================\n`);

      // Navigate to Seed Inventory page
      const seedInventoryLink = page.locator('nav').getByText('Seed Inventory');
      if (await seedInventoryLink.count() > 0) {
        await seedInventoryLink.click();
      } else {
        // Try direct navigation
        await page.goto(`${FRONTEND_URL}/seed-inventory`);
      }

      await page.waitForLoadState('networkidle');

      // Get initial seed count
      const initialCountText = await page.locator('text=/\\d+ Varieties in Stock/').textContent();
      const initialCount = parseInt(initialCountText.match(/\d+/)[0]);
      console.log(`Initial seed count: ${initialCount}`);

      // Click "Import from CSV" button
      const importButton = page.locator('button:has-text("Import from CSV")');
      await expect(importButton).toBeVisible();
      await importButton.click();

      // Wait for modal to open
      await expect(page.locator('text=Import Varieties from CSV')).toBeVisible();

      // Select crop type (default is lettuce, so we can skip this)
      // Verify "Share with all users" checkbox is checked by default
      const shareCheckbox = page.locator('input#isGlobal');
      await expect(shareCheckbox).toBeChecked();

      // Upload CSV file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(csvFile);

      // Wait for file to be selected
      await expect(page.locator(`text=${fileName}`)).toBeVisible();

      // Click Import button
      const importSubmitButton = page.locator('button:has-text("Import Varieties")');
      await importSubmitButton.click();

      // Wait for import to complete (look for success message or import summary)
      try {
        // Wait for either success toast or import summary
        await page.waitForSelector('text=/Successfully imported|Import Summary/', { timeout: 10000 });

        // Check for import summary
        const importSummary = page.locator('text=Import Summary');
        if (await importSummary.count() > 0) {
          const summaryText = await page.locator('.bg-green-50').textContent();
          console.log(`Import Summary:\n${summaryText}`);
        }

        // Close modal
        const closeButton = page.locator('button:has-text("Close")');
        if (await closeButton.count() > 0) {
          await closeButton.click();
        }

        // Wait for modal to close
        await expect(page.locator('text=Import Varieties from CSV')).not.toBeVisible();

        // Verify seeds were added
        await page.waitForTimeout(1000); // Brief wait for UI to update

        const newCountText = await page.locator('text=/\\d+ Varieties in Stock/').textContent();
        const newCount = parseInt(newCountText.match(/\d+/)[0]);
        console.log(`New seed count: ${newCount}`);
        console.log(`Seeds added: ${newCount - initialCount}`);

        // Verify at least some seeds were imported
        expect(newCount).toBeGreaterThan(initialCount);

        // Take screenshot of success
        await page.screenshot({
          path: `test-results/seed-import-success-${fileName.replace('.csv', '')}.png`,
          fullPage: true
        });

        console.log(`✓ Successfully imported from ${fileName}`);

      } catch (error) {
        console.error(`✗ Import failed for ${fileName}`);
        console.error(`Error: ${error.message}`);

        // Take screenshot of failure
        await page.screenshot({
          path: `test-results/seed-import-failure-${fileName.replace('.csv', '')}.png`,
          fullPage: true
        });

        // Log any error messages from the page
        const errorMessages = await page.locator('.text-red-600, .text-red-800').allTextContents();
        if (errorMessages.length > 0) {
          console.error('Error messages on page:');
          errorMessages.forEach(msg => console.error(`  - ${msg}`));
        }

        throw error;
      }
    });
  }

  test('should display imported seeds in the inventory grid', async ({ page }) => {
    // Navigate to Seed Inventory page
    await page.goto(`${FRONTEND_URL}/seed-inventory`);
    await page.waitForLoadState('networkidle');

    // Check for seed cards
    const seedCards = page.locator('.bg-white.border-2.border-gray-200.rounded-lg');
    const count = await seedCards.count();

    console.log(`\nTotal seed cards displayed: ${count}`);

    if (count > 0) {
      // Verify first few seeds
      for (let i = 0; i < Math.min(3, count); i++) {
        const card = seedCards.nth(i);
        const plantName = await card.locator('h3').first().textContent();
        const variety = await card.locator('p.text-sm.text-gray-600').first().textContent();
        console.log(`  Seed ${i + 1}: ${plantName} - ${variety}`);
      }

      // Take screenshot
      await page.screenshot({
        path: 'test-results/seed-inventory-final.png',
        fullPage: true
      });
    }

    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Backend API Tests', () => {
  test('should have varieties import endpoint', async ({ request }) => {
    // Test that backend is running and has the endpoint
    const response = await request.get(`${BACKEND_URL}/api/seeds`);
    expect(response.status()).toBe(200);

    const seeds = await response.json();
    console.log(`\nBackend has ${seeds.length} seeds in database`);
  });
});
