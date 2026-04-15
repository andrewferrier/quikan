import { test, expect } from './fixtures';

// These columns appear on every day of the week
const CONSTANT_COLUMN_NAMES = [
  'Todo (Today)',
  'Todo (Tomorrow)',
  'Todo (No Due Date)',
  'In Progress',
  'Done',
];

test.describe('board layout', () => {
  test('constant column headers are always visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="card"]').first()).toBeVisible({ timeout: 10000 });

    for (const name of CONSTANT_COLUMN_NAMES) {
      await expect(page.locator('h2').filter({ hasText: name })).toBeVisible();
    }
  });

  test('In Progress column shows 1 card', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="card"]').first()).toBeVisible({ timeout: 10000 });

    const col = page.locator('[data-testid="column-in-progress"]');
    await expect(col.locator('p').first()).toHaveText('1 card');
  });

  test('Done column shows visible card count and hidden count', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="card"]').first()).toBeVisible({ timeout: 10000 });

    const col = page.locator('[data-testid="column-done"]');
    await expect(col.locator('p').first()).toHaveText('1 card (1 not shown as >30 days)');
  });
});
