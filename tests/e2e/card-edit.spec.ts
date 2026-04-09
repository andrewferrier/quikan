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

test('edit dialog shows Delete Todo button', async ({ page }) => {
  await page.goto('/');

  const firstCard = page.locator('[data-testid="card"]').first();
  await expect(firstCard).toBeVisible({ timeout: 10000 });

  await firstCard.click();

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  await expect(dialog.locator('[data-testid="delete-card-btn"]')).toBeVisible();
  await expect(dialog.locator('[data-testid="delete-card-btn"]')).toHaveText('Delete Todo');
});

test('delete todo — cancel confirmation leaves todo intact', async ({ page }) => {
  await page.goto('/');

  const firstCard = page.locator('[data-testid="card"]').first();
  await expect(firstCard).toBeVisible({ timeout: 10000 });

  const cardSummary = await firstCard.locator('[data-testid="card-summary"]').textContent();

  await firstCard.click();

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  page.on('dialog', (d) => d.dismiss());
  await dialog.locator('[data-testid="delete-card-btn"]').click();

  // Dialog should still be open and card still exists
  await expect(dialog).toBeVisible();
  await page.locator('[role="dialog"] button', { hasText: 'Cancel' }).click();
  await expect(page.locator('[data-testid="card-summary"]').filter({ hasText: cardSummary!.trim() })).toBeVisible();
});

test('delete todo — confirm removes todo from board', async ({ page }) => {
  await page.goto('/');

  const firstCard = page.locator('[data-testid="card"]').first();
  await expect(firstCard).toBeVisible({ timeout: 10000 });

  const cardSummary = await firstCard.locator('[data-testid="card-summary"]').textContent();
  expect(cardSummary).toBeTruthy();

  await firstCard.click();

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  page.on('dialog', (d) => d.accept());
  await dialog.locator('[data-testid="delete-card-btn"]').click();

  // Dialog should close and todo should no longer appear on the board
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('[data-testid="card-summary"]').filter({ hasText: cardSummary!.trim() })).not.toBeVisible();
});
