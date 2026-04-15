import { test, expect } from './fixtures';

test.describe('about dialog', () => {
  test('hamburger menu opens and shows About option', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').filter({ hasText: 'Quikan' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('button', { name: 'About' })).toBeVisible();
  });

  test('clicking About opens the about dialog', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').filter({ hasText: 'Quikan' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: 'About' }).click();

    const dialog = page.getByRole('dialog', { name: 'About Quikan' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'About Quikan' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /github\.com\/andrewferrier\/quikan/ })).toBeVisible();
    await expect(dialog.getByText(/Version:/)).toBeVisible();
  });

  test('about dialog can be closed with the close button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').filter({ hasText: 'Quikan' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: 'About' }).click();

    const dialog = page.getByRole('dialog', { name: 'About Quikan' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('about dialog shows a non-empty version string', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').filter({ hasText: 'Quikan' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: 'About' }).click();

    const dialog = page.getByRole('dialog', { name: 'About Quikan' });
    await expect(dialog).toBeVisible();

    const versionParagraph = dialog.getByText(/Version:/);
    await expect(versionParagraph).toBeVisible();
    const text = await versionParagraph.textContent();
    expect(text).toMatch(/Version: .+/);
    expect(text).not.toMatch(/Version: …/);
  });
});
