import { test, expect } from './fixtures';

test.describe('card deletion', () => {
  test('edit dialog shows a "Delete Todo" button', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="card"]').filter({ hasText: 'No date todo' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-testid="delete-card-btn"]')).toBeVisible();
  });

  test('Delete Todo button has the correct label', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="card"]').filter({ hasText: 'No date todo' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.locator('[data-testid="delete-card-btn"]')).toHaveText('Delete Todo');
  });

  test('dismissing the confirmation dialog leaves the card intact', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="card"]').filter({ hasText: 'No date todo' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    page.on('dialog', (d) => d.dismiss());
    await dialog.locator('[data-testid="delete-card-btn"]').click();

    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('[data-testid="card-summary"]').filter({ hasText: 'No date todo' })).toBeVisible();
  });

  test('confirming deletion removes the card from the board', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="card"]').filter({ hasText: 'No date todo' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    page.on('dialog', (d) => d.accept());
    await dialog.locator('[data-testid="delete-card-btn"]').click();

    await expect(dialog).not.toBeVisible();
    await expect(page.locator('[data-testid="card-summary"]').filter({ hasText: 'No date todo' })).not.toBeVisible();
  });
});
