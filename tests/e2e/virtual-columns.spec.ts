import { test, expect } from './fixtures';
import { resetData } from './helpers/resetData';
import { dragToColumn } from './helpers/drag';
import type { APIRequestContext } from '@playwright/test';

// TZ=UTC in test environment (see playwright.config.ts)
// Reference week: Mon 2026-03-30 … Fri 2026-04-03, Sat 2026-04-04, Sun 2026-04-05
const NOW_WED = '2026-04-01T12:00:00.000Z'; // Wednesday
const NOW_THU = '2026-04-02T12:00:00.000Z'; // Thursday
const NOW_FRI = '2026-04-03T12:00:00.000Z'; // Friday
const NOW_SAT = '2026-04-04T12:00:00.000Z'; // Saturday
const NOW_SUN = '2026-04-05T12:00:00.000Z'; // Sunday

async function setTestNow(request: APIRequestContext, iso: string): Promise<void> {
  const res = await request.post('/graphql', {
    data: { query: `mutation { setTestNow(iso: "${iso}") { id } }` },
  });
  const json = await res.json();
  if (json.errors) throw new Error(`setTestNow failed: ${JSON.stringify(json.errors)}`);
}

async function clearTestNow(request: APIRequestContext): Promise<void> {
  await request.post('/graphql', {
    data: { query: 'mutation { clearTestNow { id } }' },
  });
}

test.describe('virtual todo columns — Mon–Wed layout', () => {
  test.beforeEach(async ({ request }) => {
    await setTestNow(request, NOW_WED);
    resetData(new Date(NOW_WED));
  });

  test.afterEach(async ({ request }) => {
    await clearTestNow(request);
  });

  test('shows Todo (Today), (Tomorrow), (This Week), (This Weekend), (Next Week), (Future), (No Due Date) columns', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="column-todo-today"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="column-todo-tomorrow"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-todo-this-week"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-todo-this-weekend"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-todo-next-week"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-todo-future"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-todo"]')).toBeVisible();
    // Sat/Sun-only columns must not appear
    await expect(page.locator('[data-testid="column-todo-coming-week"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="column-todo-next-weekend"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="column-todo-following-week"]')).not.toBeVisible();
  });

  test('card due today appears in Todo (Today)', async ({ page }) => {
    await page.goto('/');
    await expect(
      page
        .locator('[data-testid="column-todo-today"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'Today todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('card due tomorrow appears in Todo (Tomorrow)', async ({ page }) => {
    await page.goto('/');
    await expect(
      page
        .locator('[data-testid="column-todo-tomorrow"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'Tomorrow todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('card due thisWeekFriday (Apr 3) appears in Todo (This Week)', async ({ page }) => {
    await page.goto('/');
    await expect(
      page
        .locator('[data-testid="column-todo-this-week"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'This week todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('card due thisSaturday (Apr 4) appears in Todo (This Weekend)', async ({ page }) => {
    await page.goto('/');
    await expect(
      page
        .locator('[data-testid="column-todo-this-weekend"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'This weekend todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('card due nextMonday (Apr 6) appears in Todo (Next Week)', async ({ page }) => {
    await page.goto('/');
    await expect(
      page
        .locator('[data-testid="column-todo-next-week"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'Next week todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('card due today+30 appears in Todo (Future)', async ({ page }) => {
    await page.goto('/');
    await expect(
      page
        .locator('[data-testid="column-todo-future"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'Future todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('card with no due date appears in Todo (No Due Date)', async ({ page }) => {
    await page.goto('/');
    await expect(
      page
        .locator('[data-testid="column-todo"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'No date todo' })
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('virtual todo columns — Thu–Fri layout', () => {
  test.beforeEach(async ({ request }) => {
    await setTestNow(request, NOW_THU);
    resetData(new Date(NOW_THU));
  });

  test.afterEach(async ({ request }) => {
    await clearTestNow(request);
  });

  test('shows This Weekend and Next Week but not This Week on Thursday', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="column-todo-today"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="column-todo-tomorrow"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-todo-this-weekend"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-todo-next-week"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-todo-future"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-todo"]')).toBeVisible();
    // todo-this-week must NOT appear on Thursday
    await expect(page.locator('[data-testid="column-todo-this-week"]')).not.toBeVisible();
  });

  test('card due thisSaturday (Apr 4) appears in This Weekend from Thursday', async ({ page }) => {
    await page.goto('/');
    await expect(
      page
        .locator('[data-testid="column-todo-this-weekend"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'This weekend todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('card due nextMonday (Apr 6) appears in Next Week from Thursday', async ({ page }) => {
    await page.goto('/');
    await expect(
      page
        .locator('[data-testid="column-todo-next-week"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'Next week todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('shows This Weekend on Friday with only Sunday eligible', async ({ page, request }) => {
    await setTestNow(request, NOW_FRI);
    resetData(new Date(NOW_FRI));
    await page.goto('/');
    await expect(page.locator('[data-testid="column-todo-this-weekend"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('[data-testid="column-todo-this-week"]')).not.toBeVisible();
    // seed-this-weekend (due thisSaturday = Apr 4) goes to todo-tomorrow on Friday
    await expect(
      page
        .locator('[data-testid="column-todo-tomorrow"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'This weekend todo' })
    ).toBeVisible();
  });
});

test.describe('virtual todo columns — Sat–Sun layout', () => {
  test.beforeEach(async ({ request }) => {
    await setTestNow(request, NOW_SAT);
    resetData(new Date(NOW_SAT));
  });

  test.afterEach(async ({ request }) => {
    await clearTestNow(request);
  });

  test('shows Coming Week, Next Weekend, Following Week on Saturday', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="column-todo-today"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="column-todo-tomorrow"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-todo-this-weekend"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-todo-coming-week"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-todo-next-weekend"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-todo-following-week"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-todo-future"]')).toBeVisible();
    // Mon–Fri columns must not appear
    await expect(page.locator('[data-testid="column-todo-this-week"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="column-todo-next-week"]')).not.toBeVisible();
  });

  test('card due nextMonday (Apr 6) appears in Coming Week from Saturday', async ({ page }) => {
    await page.goto('/');
    await expect(
      page
        .locator('[data-testid="column-todo-coming-week"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'Next week todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('card due nextSaturday (Apr 11) appears in Next Weekend from Saturday', async ({ page }) => {
    await page.goto('/');
    await expect(
      page
        .locator('[data-testid="column-todo-next-weekend"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'Next weekend todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('card due nextNextMonday (Apr 13) appears in Following Week from Saturday', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page
        .locator('[data-testid="column-todo-following-week"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'Following week todo' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('shows Coming Week and Next Weekend on Sunday', async ({ page, request }) => {
    await setTestNow(request, NOW_SUN);
    resetData(new Date(NOW_SUN));
    await page.goto('/');
    await expect(page.locator('[data-testid="column-todo-coming-week"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('[data-testid="column-todo-next-weekend"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-todo-following-week"]')).toBeVisible();
  });
});

test.describe('drag to virtual todo columns', () => {
  // No fake time — drag tests need real time for correct badge color classes

  test('dragging to Todo (Today) sets due date to today', async ({ page }) => {
    await page.goto('/');
    const card = page
      .locator('[data-testid="column-todo"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'No date todo' });
    await expect(card).toBeVisible({ timeout: 10000 });

    const targetCol = page.locator('[data-testid="column-todo-today"]');
    await dragToColumn(page, card, targetCol);

    const movedCard = page
      .locator('[data-testid="column-todo-today"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'No date todo' });
    await expect(movedCard).toBeVisible();
    await expect(movedCard.locator('[data-testid="due-date"]')).toHaveClass(/text-green-600/);
  });

  test('dragging to Todo (Tomorrow) sets due date to tomorrow', async ({ page }) => {
    await page.goto('/');
    const card = page
      .locator('[data-testid="column-todo"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'No date todo' });
    await expect(card).toBeVisible({ timeout: 10000 });

    const targetCol = page.locator('[data-testid="column-todo-tomorrow"]');
    await dragToColumn(page, card, targetCol);

    const movedCard = page
      .locator('[data-testid="column-todo-tomorrow"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'No date todo' });
    await expect(movedCard).toBeVisible();
    await expect(movedCard.locator('[data-testid="due-date"]')).toHaveClass(/text-gray-400/);
  });

  test('dragging to Todo (No Due Date) removes the due date badge', async ({ page }) => {
    await page.goto('/');
    const card = page
      .locator('[data-testid="column-todo-today"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'Today todo' });
    await expect(card).toBeVisible({ timeout: 10000 });

    const targetCol = page.locator('[data-testid="column-todo"]');
    await dragToColumn(page, card, targetCol);

    const movedCard = page
      .locator('[data-testid="column-todo"]')
      .locator('[data-testid="card"]')
      .filter({ hasText: 'Today todo' });
    await expect(movedCard).toBeVisible();
    await expect(movedCard.locator('[data-testid="due-date"]')).not.toBeVisible();
  });
});

test.describe('time-boundary crossing', () => {
  test.afterEach(async ({ request }) => {
    await clearTestNow(request);
  });

  test('board re-renders with new column layout when day boundary is crossed during session', async ({
    page,
    request,
  }) => {
    // Start on Wednesday: board shows "This Week" column
    await setTestNow(request, NOW_WED);
    resetData(new Date(NOW_WED));

    await page.goto('/');

    // On Wednesday, "This week todo" (due thisWeekFriday = Apr 3) is in todo-this-week
    await expect(page.locator('[data-testid="column-todo-this-week"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page
        .locator('[data-testid="column-todo-this-week"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'This week todo' })
    ).toBeVisible();

    // Advance fake time to Thursday — the day boundary is now crossed
    await setTestNow(request, NOW_THU);

    // Trigger a board mutation (create a card via the dialog) — this causes the server to return
    // the new Thursday layout, which the client writes to the Apollo cache
    await page.locator('[data-testid="column-todo-today"] [data-testid="add-task-btn"]').click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('#cd-summary').fill('Boundary test card');
    await dialog.getByRole('button', { name: 'Add Todo' }).click();
    await expect(dialog).not.toBeVisible();

    // Board should now reflect Thursday layout: todo-this-week is gone
    await expect(page.locator('[data-testid="column-todo-this-week"]')).not.toBeVisible({
      timeout: 10000,
    });

    // "This week todo" (Apr 3) was in todo-this-week on Wednesday.
    // On Thursday, Apr 3 = tomorrow → it moves to todo-tomorrow
    await expect(
      page
        .locator('[data-testid="column-todo-tomorrow"]')
        .locator('[data-testid="card-summary"]')
        .filter({ hasText: 'This week todo' })
    ).toBeVisible();
  });
});
