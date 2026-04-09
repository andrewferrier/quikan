import { test, expect } from './fixtures';
import { dragToColumn } from './helpers/drag';

test.describe('drag and drop', () => {
  test('dragging a card from Todo to In Progress moves it to In Progress', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="column-todo"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'No date todo' });
    await expect(card).toBeVisible({ timeout: 10000 });

    const targetCol = page.locator('[data-testid="column-in-progress"]');
    await dragToColumn(page, card, targetCol);

    await expect(
      page.locator('[data-testid="column-in-progress"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'No date todo' })
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="column-todo"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'No date todo' })
    ).not.toBeVisible();
  });

  test('dragging a card from In Progress to Done moves it to Done', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="column-in-progress"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'In progress task' });
    await expect(card).toBeVisible({ timeout: 10000 });

    const targetCol = page.locator('[data-testid="column-done"]');
    await dragToColumn(page, card, targetCol);

    await expect(
      page.locator('[data-testid="column-done"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'In progress task' })
    ).toBeVisible();
  });

  test('dragging a card from Done back to Todo (No Due Date) returns it to todo', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="column-done"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'Done task' });
    await expect(card).toBeVisible({ timeout: 10000 });

    const targetCol = page.locator('[data-testid="column-todo"]');
    await dragToColumn(page, card, targetCol);

    await expect(
      page.locator('[data-testid="column-todo"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'Done task' })
    ).toBeVisible();
  });
});
