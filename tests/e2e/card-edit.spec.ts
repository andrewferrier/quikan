import { test, expect } from '@playwright/test';

test('edit dialog prefills with existing card data', async ({ page }) => {
  await page.goto('/');

  // Wait for the board to load and cards to appear
  const firstCard = page.locator('[data-testid="card"]').first();
  await expect(firstCard).toBeVisible({ timeout: 10000 });

  const cardSummary = await firstCard.locator('[data-testid="card-summary"]').textContent();
  expect(cardSummary).toBeTruthy();

  await firstCard.click();

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  const summaryInput = dialog.locator('#cd-summary');
  await expect(summaryInput).toHaveValue(cardSummary!.trim());
});
