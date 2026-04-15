import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from './fixtures';
import { dragToColumn } from './helpers/drag';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');

function writeExternalCard(uid: string, summary: string): void {
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Quikan//Kanban Board//EN',
    'BEGIN:VTODO',
    `UID:${uid}`,
    `SUMMARY:${summary}`,
    'CREATED:20260101T000000Z',
    'LAST-MODIFIED:20260101T000000Z',
    'DTSTAMP:20260101T000000Z',
    'END:VTODO',
    'END:VCALENDAR',
  ].join('\n');
  fs.writeFileSync(path.join(DATA_DIR, `${uid}.ics`), content, 'utf-8');
}

test.describe('external sync', () => {
  test('a card added externally to the data directory appears on the board after a mutation', async ({
    page,
  }) => {
    await page.goto('/');

    const noDateCard = page
      .locator('[data-testid="column-todo"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'No date todo' });
    await expect(noDateCard).toBeVisible({ timeout: 10000 });

    await expect(
      page.locator('[data-testid="card-summary"]').filter({ hasText: 'Externally synced task' }),
    ).not.toBeVisible();

    writeExternalCard('external-sync-test', 'Externally synced task');

    const targetCol = page.locator('[data-testid="column-in-progress"]');
    await dragToColumn(page, noDateCard, targetCol);

    await expect(
      page
        .locator('[data-testid="column-in-progress"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'No date todo' }),
    ).toBeVisible();

    await expect(
      page.locator('[data-testid="card-summary"]').filter({ hasText: 'Externally synced task' }),
    ).toBeVisible();
  });

  test('the board remains visible while a mutation-triggered refresh happens', async ({ page }) => {
    await page.goto('/');

    const noDateCard = page
      .locator('[data-testid="column-todo"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'No date todo' });
    await expect(noDateCard).toBeVisible({ timeout: 10000 });

    const targetCol = page.locator('[data-testid="column-in-progress"]');

    const anyCard = page.locator('[data-testid="card"]').first();
    let cardWentHidden = false;
    anyCard
      .waitFor({ state: 'hidden', timeout: 5000 })
      .then(() => {
        cardWentHidden = true;
      })
      .catch(() => {});

    await dragToColumn(page, noDateCard, targetCol);

    await expect(
      page
        .locator('[data-testid="column-in-progress"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'No date todo' }),
    ).toBeVisible();

    expect(cardWentHidden).toBe(false);
  });
});
