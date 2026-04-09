import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from './fixtures';
import { dragToColumn } from './helpers/drag';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');

function writeIcsFile(uid: string, content: string): void {
  fs.writeFileSync(path.join(DATA_DIR, `${uid}.ics`), content, 'utf-8');
}

test.describe('recurring task completion', () => {
  test('completing a recurring task via drag creates a clone in Done and advances the master', async ({
    page,
  }) => {
    await page.goto('/');

    // Find the recurring card in "Todo Today" (seeded with today's due date)
    const todoTodayCol = page.locator('[data-testid="column-todo-today"]');
    const card = todoTodayCol
      .locator('[data-testid="card"]')
      .filter({ hasText: 'Weekly recurring todo' });
    await expect(card).toBeVisible({ timeout: 10000 });

    const doneCol = page.locator('[data-testid="column-done"]');
    await dragToColumn(page, card, doneCol);

    // A completed clone should appear in Done
    await expect(
      doneCol.locator('[data-testid="card-summary"]').filter({ hasText: 'Weekly recurring todo' })
    ).toBeVisible({ timeout: 10000 });

    // The master should still exist in a todo column — it advances to next week
    // (could be todo-this-week or todo-tomorrow depending on day; use any todo column)
    const masterInTodo = page
      .locator('[data-testid^="column-todo"]')
      .locator('[data-testid="card-summary"]')
      .filter({ hasText: 'Weekly recurring todo' });
    await expect(masterInTodo).toBeVisible({ timeout: 10000 });
  });

  test('completed recurring clone shows the recurring icon', async ({ page }) => {
    await page.goto('/');

    const todoTodayCol = page.locator('[data-testid="column-todo-today"]');
    const card = todoTodayCol
      .locator('[data-testid="card"]')
      .filter({ hasText: 'Weekly recurring todo' });
    await expect(card).toBeVisible({ timeout: 10000 });

    const doneCol = page.locator('[data-testid="column-done"]');
    await dragToColumn(page, card, doneCol);

    const cloneCard = doneCol
      .locator('[data-testid="card"]')
      .filter({ hasText: 'Weekly recurring todo' });
    await expect(cloneCard).toBeVisible({ timeout: 10000 });

    // The clone is a recurring child so it should show the recurring icon
    await expect(cloneCard.locator('[data-testid="recurring-icon"]')).toBeVisible();
  });
});

test.describe('data validation error', () => {
  test('board shows error when a .ics file contains RECURRENCE-ID', async ({ page }) => {
    // Write a bad file to the data directory after reset
    const badIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//EN',
      'BEGIN:VTODO',
      'UID:bad-recurrence-id',
      'SUMMARY:Bad card',
      'RECURRENCE-ID;VALUE=DATE:20260401',
      'STATUS:COMPLETED',
      'DTSTART;VALUE=DATE:20260401',
      'END:VTODO',
      'END:VCALENDAR',
    ].join('\r\n');

    writeIcsFile('bad-recurrence-id', badIcs);

    await page.goto('/');

    // The board should show the full-page error, not the Kanban columns
    await expect(page.getByText('Could not connect to the server.')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/RECURRENCE-ID/)).toBeVisible();

    // Kanban columns should NOT be shown
    await expect(page.locator('[data-testid="column-todo"]')).not.toBeVisible();
  });

  test('board shows error when a .ics file contains multiple VTODO components', async ({
    page,
  }) => {
    const badIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//EN',
      'BEGIN:VTODO',
      'UID:multi-todo-1',
      'SUMMARY:First',
      'END:VTODO',
      'BEGIN:VTODO',
      'UID:multi-todo-2',
      'SUMMARY:Second',
      'END:VTODO',
      'END:VCALENDAR',
    ].join('\r\n');

    writeIcsFile('multi-vtodo', badIcs);

    await page.goto('/');

    await expect(page.getByText('Could not connect to the server.')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/multiple VTODO/)).toBeVisible();

    await expect(page.locator('[data-testid="column-todo"]')).not.toBeVisible();
  });
});
