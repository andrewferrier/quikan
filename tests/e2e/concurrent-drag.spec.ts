import { test, expect } from './fixtures';
import { dragToColumn } from './helpers/drag';

test.describe('concurrent drag', () => {
  test('two cards dragged in quick succession both move correctly', async ({ page }) => {
    let moveCount = 0;

    await page.route('**/graphql', async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}') as { operationName?: string };
      if (body.operationName === 'MoveCard') {
        moveCount++;
        if (moveCount === 1) {
          // Delay the first mutation so the second drag happens while it's in-flight
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      await route.continue();
    });

    await page.goto('/');

    const noDateCard = page
      .locator('[data-testid="column-todo"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'No date todo' });
    await expect(noDateCard).toBeVisible({ timeout: 10000 });

    const inProgressCard = page
      .locator('[data-testid="column-in-progress"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'In progress task' });
    await expect(inProgressCard).toBeVisible();

    const inProgressCol = page.locator('[data-testid="column-in-progress"]');
    const doneCol = page.locator('[data-testid="column-done"]');

    // Drag the first card — mutation is delayed 800ms so it stays pending
    await dragToColumn(page, noDateCard, inProgressCol);

    // The first card should appear in-progress immediately (optimistic) and be pending
    const firstCardPending = page
      .locator('[data-testid="column-in-progress"]')
      .locator('[data-testid="card"][data-pending="true"]')
      .filter({ hasText: 'No date todo' });
    await expect(firstCardPending).toBeVisible();

    // Drag the second card while the first mutation is still in-flight
    const secondCard = page
      .locator('[data-testid="column-in-progress"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'In progress task' });
    await dragToColumn(page, secondCard, doneCol);

    // Both cards should appear in their target columns (optimistically)
    await expect(
      page
        .locator('[data-testid="column-in-progress"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'No date todo' })
    ).toBeVisible();
    await expect(
      page
        .locator('[data-testid="column-done"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'In progress task' })
    ).toBeVisible();

    // Wait for all pending indicators to clear (mutations settled)
    await expect(page.locator('[data-testid="card"][data-pending="true"]')).toHaveCount(0, {
      timeout: 5000,
    });

    // Final state: both cards in the correct columns
    await expect(
      page
        .locator('[data-testid="column-in-progress"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'No date todo' })
    ).toBeVisible();
    await expect(
      page
        .locator('[data-testid="column-done"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'In progress task' })
    ).toBeVisible();
  });
});
