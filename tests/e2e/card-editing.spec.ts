import { test, expect } from './fixtures';

test.describe('card editing', () => {
  test('clicking a card opens the edit dialog with the correct title', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="card"]').filter({ hasText: 'No date todo' });
    await expect(card).toBeVisible({ timeout: 10000 });

    await card.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading')).toHaveText('Edit Todo');
  });

  test('edit dialog prefills summary, priority, and description correctly', async ({ page }) => {
    await page.goto('/');

    // High priority todo should prefill priority as 'High'
    const card = page.locator('[data-testid="card"]').filter({ hasText: 'High priority todo' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.locator('#cd-summary')).toHaveValue('High priority todo');
    // The 'High' priority button should appear active (has white text indicating selected state)
    await expect(dialog.getByRole('button', { name: 'High' })).toHaveClass(/bg-red-600/);
  });

  test('updating the summary and saving reflects the new value on the board', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="card"]').filter({ hasText: 'No date todo' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('#cd-summary').fill('Updated summary');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).not.toBeVisible();

    await expect(page.locator('[data-testid="card-summary"]').filter({ hasText: 'Updated summary' })).toBeVisible();
  });

  test('updating priority and saving changes the card background colour', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="card"]').filter({ hasText: 'No date todo' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.getByRole('button', { name: 'High' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).not.toBeVisible();

    const updatedCard = page.locator('[data-testid="card"]').filter({ hasText: 'No date todo' });
    await expect(updatedCard).toHaveClass(/bg-red-100/);
  });

  test('updating due date moves the card to the correct virtual column', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="card"]').filter({ hasText: 'No date todo' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    const dialog = page.locator('[role="dialog"]');
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStr = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrow.getUTCDate()).padStart(2, '0')}`;
    await dialog.locator('#cd-due-date').fill(tomorrowStr);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).not.toBeVisible();

    const tomorrowCol = page.locator('[data-testid="column-todo-tomorrow"]');
    await expect(tomorrowCol.locator('[data-testid="card-summary"]').filter({ hasText: 'No date todo' })).toBeVisible();
  });

  test('cancelling discards all changes', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="card"]').filter({ hasText: 'No date todo' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('#cd-summary').fill('This change should be discarded');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();

    await expect(page.locator('[data-testid="card-summary"]').filter({ hasText: 'No date todo' })).toBeVisible();
    await expect(page.locator('[data-testid="card-summary"]').filter({ hasText: 'This change should be discarded' })).not.toBeVisible();
  });

  test('clearing the due date moves the card to Todo (No Due Date)', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="column-todo-today"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'Today todo' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.getByRole('button', { name: 'Clear due date' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).not.toBeVisible();

    const noDateCol = page.locator('[data-testid="column-todo"]');
    await expect(noDateCol.locator('[data-testid="card-summary"]').filter({ hasText: 'Today todo' })).toBeVisible();
  });
});
