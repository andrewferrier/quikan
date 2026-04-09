import { type Locator, type Page } from '@playwright/test';

/**
 * Drag a card element to a target column using explicit pointer events.
 * Playwright's dragTo() doesn't reliably trigger dnd-kit's PointerSensor
 * activation constraint, so we use low-level mouse moves instead.
 */
export async function dragToColumn(page: Page, card: Locator, target: Locator): Promise<void> {
  const cardBBox = await card.boundingBox();
  const targetBBox = await target.boundingBox();
  if (!cardBBox || !targetBBox) throw new Error('Could not get bounding box for drag operation');

  const startX = cardBBox.x + cardBBox.width / 2;
  const startY = cardBBox.y + cardBBox.height / 2;
  const endX = targetBBox.x + targetBBox.width / 2;
  // Drop near the bottom of the column to avoid landing on existing cards
  const endY = targetBBox.y + targetBBox.height - 30;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Move down first to exceed the 8px activation constraint without entering adjacent columns
  await page.mouse.move(startX, startY + 15, { steps: 3 });
  // Move to target in many steps to allow dnd-kit collision detection to run
  await page.mouse.move(endX, endY, { steps: 30 });
  await page.mouse.up();
}
