import { test, expect } from './fixtures';
import { dragToColumn } from './helpers/drag';

test.describe('virtual todo columns', () => {
  test('card with no due date appears in Todo (No Due Date)', async ({ page }) => {
    await page.goto('/');
    const col = page.locator('[data-testid="column-todo"]');
    await expect(
      col.locator('[data-testid="card-summary"]').filter({ hasText: 'No date todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('card due today appears in Todo (Today)', async ({ page }) => {
    await page.goto('/');
    const col = page.locator('[data-testid="column-todo-today"]');
    await expect(
      col.locator('[data-testid="card-summary"]').filter({ hasText: 'Today todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('card due tomorrow appears in Todo (Tomorrow)', async ({ page }) => {
    await page.goto('/');
    const col = page.locator('[data-testid="column-todo-tomorrow"]');
    await expect(
      col.locator('[data-testid="card-summary"]').filter({ hasText: 'Tomorrow todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('card due in 3 days appears in Todo (This Week)', async ({ page }) => {
    await page.goto('/');
    const col = page.locator('[data-testid="column-todo-this-week"]');
    await expect(
      col.locator('[data-testid="card-summary"]').filter({ hasText: 'This week todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('card due in 30 days appears in Todo (Dated)', async ({ page }) => {
    await page.goto('/');
    const col = page.locator('[data-testid="column-todo-dated"]');
    await expect(
      col.locator('[data-testid="card-summary"]').filter({ hasText: 'Dated todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('dragging to Todo (Today) sets due date to today', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="column-todo"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'No date todo' });
    await expect(card).toBeVisible({ timeout: 10000 });

    const targetCol = page.locator('[data-testid="column-todo-today"]');
    await dragToColumn(page, card, targetCol);

    await expect(
      page.locator('[data-testid="column-todo-today"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'No date todo' })
    ).toBeVisible();

    // Badge should now show a date and be green (today)
    const movedCard = page.locator('[data-testid="column-todo-today"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'No date todo' });
    await expect(movedCard.locator('[data-testid="due-date"]')).toHaveClass(/text-green-600/);
  });

  test('dragging to Todo (Tomorrow) sets due date to tomorrow', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="column-todo"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'No date todo' });
    await expect(card).toBeVisible({ timeout: 10000 });

    const targetCol = page.locator('[data-testid="column-todo-tomorrow"]');
    await dragToColumn(page, card, targetCol);

    await expect(
      page.locator('[data-testid="column-todo-tomorrow"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'No date todo' })
    ).toBeVisible();

    const movedCard = page.locator('[data-testid="column-todo-tomorrow"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'No date todo' });
    await expect(movedCard.locator('[data-testid="due-date"]')).toHaveClass(/text-gray-400/);
  });

  test('dragging to Todo (No Due Date) removes the due date badge', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-testid="column-todo-today"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'Today todo' });
    await expect(card).toBeVisible({ timeout: 10000 });

    const targetCol = page.locator('[data-testid="column-todo"]');
    await dragToColumn(page, card, targetCol);

    const movedCard = page.locator('[data-testid="column-todo"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'Today todo' });
    await expect(movedCard).toBeVisible();
    await expect(movedCard.locator('[data-testid="due-date"]')).not.toBeVisible();
  });
});
