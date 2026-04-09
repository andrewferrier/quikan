import { test, expect } from './fixtures';

test.describe('card creation', () => {
  test('clicking "+ Add Todo" opens a dialog with title "Add Todo"', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '+ Add Todo' }).click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading')).toHaveText('Add Todo');
  });

  test('submitting with empty summary does not create a card', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '+ Add Todo' }).click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.getByRole('button', { name: 'Add Todo' }).click();

    await expect(dialog).toBeVisible();
  });

  test('creating a todo with summary only appears in Todo (No Due Date)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '+ Add Todo' }).click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('#cd-summary').fill('Brand new task');
    await dialog.locator('#cd-due-date').fill('');
    await dialog.getByRole('button', { name: 'Add Todo' }).click();
    await expect(dialog).not.toBeVisible();

    const col = page.locator('[data-testid="column-todo"]');
    await expect(col.locator('[data-testid="card-summary"]').filter({ hasText: 'Brand new task' })).toBeVisible();
  });

  test('creating a todo with due date = today appears in Todo (Today)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '+ Add Todo' }).click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('#cd-summary').fill('Due today task');

    const today = new Date();
    const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
    await dialog.locator('#cd-due-date').fill(todayStr);
    await dialog.getByRole('button', { name: 'Add Todo' }).click();
    await expect(dialog).not.toBeVisible();

    const col = page.locator('[data-testid="column-todo-today"]');
    await expect(col.locator('[data-testid="card-summary"]').filter({ hasText: 'Due today task' })).toBeVisible();
  });

  test('creating a todo with due date = tomorrow appears in Todo (Tomorrow)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '+ Add Todo' }).click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('#cd-summary').fill('Due tomorrow task');

    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStr = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrow.getUTCDate()).padStart(2, '0')}`;
    await dialog.locator('#cd-due-date').fill(tomorrowStr);
    await dialog.getByRole('button', { name: 'Add Todo' }).click();
    await expect(dialog).not.toBeVisible();

    const col = page.locator('[data-testid="column-todo-tomorrow"]');
    await expect(col.locator('[data-testid="card-summary"]').filter({ hasText: 'Due tomorrow task' })).toBeVisible();
  });

  test('creating a todo with high priority shows a red background', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '+ Add Todo' }).click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('#cd-summary').fill('Urgent task');
    await dialog.getByRole('button', { name: 'High' }).click();
    await dialog.getByRole('button', { name: 'Add Todo' }).click();
    await expect(dialog).not.toBeVisible();

    const card = page.locator('[data-testid="card"]').filter({ hasText: 'Urgent task' });
    await expect(card).toHaveClass(/bg-red-100/);
  });

  test('creating a todo with a description stores it correctly', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '+ Add Todo' }).click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('#cd-summary').fill('Task with description');
    await dialog.locator('#cd-description').fill('This is the description');
    await dialog.getByRole('button', { name: 'Add Todo' }).click();
    await expect(dialog).not.toBeVisible();

    // Re-open the card to verify the description was saved
    await page.locator('[data-testid="card"]').filter({ hasText: 'Task with description' }).click();
    await expect(page.locator('[role="dialog"]').locator('#cd-description')).toHaveValue('This is the description');
  });

  test('clicking Cancel discards the form without creating a card', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '+ Add Todo' }).click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('#cd-summary').fill('Should not appear');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();

    await expect(page.locator('[data-testid="card-summary"]').filter({ hasText: 'Should not appear' })).not.toBeVisible();
  });

  test('created card persists after page refresh', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '+ Add Todo' }).click();

    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('#cd-summary').fill('Persistent task');
    await dialog.getByRole('button', { name: 'Add Todo' }).click();
    await expect(dialog).not.toBeVisible();

    await page.reload();
    await expect(page.locator('[data-testid="card"]').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="card-summary"]').filter({ hasText: 'Persistent task' })).toBeVisible();
  });
});
