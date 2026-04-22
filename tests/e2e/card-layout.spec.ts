import * as path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from './fixtures';
import { LAYOUT_CARD_DEFS } from './helpers/layoutCardFixtures';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/layout');

const VIEWPORT_WIDTHS = [1280, 1920, 3840];

for (const width of VIEWPORT_WIDTHS) {
  test(`card layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 2000 });
    await page.goto('/');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${width}px.png`),
      fullPage: true,
    });

    for (const card of LAYOUT_CARD_DEFS) {
      const cardEl = page
        .locator('[data-testid="card"]')
        .filter({
          has: page.locator('[data-testid="card-summary"]').filter({ hasText: card.summary }),
        })
        .first();

      await expect(cardEl).toBeVisible({ timeout: 10000 });

      const cardBox = await cardEl.boundingBox();
      const titleBox = await cardEl.locator('[data-testid="card-summary"]').boundingBox();
      const dateBox = await cardEl.locator('[data-testid="due-date"]').boundingBox();

      expect(cardBox, `[${card.uid}] card bounding box should exist`).not.toBeNull();
      expect(titleBox, `[${card.uid}] title bounding box should exist`).not.toBeNull();
      expect(dateBox, `[${card.uid}] date bounding box should exist`).not.toBeNull();

      const cardRight = cardBox!.x + cardBox!.width;
      const tolerance = 1;

      expect(
        dateBox!.x + dateBox!.width,
        `[${card.uid}] date badge should not overflow card right edge`
      ).toBeLessThanOrEqual(cardRight + tolerance);

      expect(
        titleBox!.x + titleBox!.width,
        `[${card.uid}] title should not overflow card right edge`
      ).toBeLessThanOrEqual(cardRight + tolerance);

      const titleTextOverflows = await cardEl
        .locator('[data-testid="card-summary"]')
        .evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const elRect = el.getBoundingClientRect();
          for (const rect of range.getClientRects()) {
            if (rect.right > elRect.right + 1) return true;
          }
          return false;
        });
      expect(
        titleTextOverflows,
        `[${card.uid}] title text should not visually overflow its container`
      ).toBe(false);

      const dateRightOfTitle = dateBox!.x >= titleBox!.x + titleBox!.width - tolerance;
      const dateBelowTitle = dateBox!.y >= titleBox!.y + titleBox!.height - tolerance;

      expect(
        dateRightOfTitle || dateBelowTitle,
        `[${card.uid}] title and date should not overlap: title=[${titleBox!.x.toFixed(1)},${titleBox!.y.toFixed(1)},${(titleBox!.x + titleBox!.width).toFixed(1)},${(titleBox!.y + titleBox!.height).toFixed(1)}] date=[${dateBox!.x.toFixed(1)},${dateBox!.y.toFixed(1)},${(dateBox!.x + dateBox!.width).toFixed(1)},${(dateBox!.y + dateBox!.height).toFixed(1)}]`
      ).toBe(true);
    }
  });
}
