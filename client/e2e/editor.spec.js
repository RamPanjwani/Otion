import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('a new note keeps its title and body across a reload', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'New note' }).first().click();
  await expect(page).toHaveURL(/\/notes\/[a-f0-9]{24}$/);

  await page.getByPlaceholder('Untitled note').fill('E2E scratch note');
  const body = page.locator('[data-editable-block="true"]').first();
  await body.click();
  await page.keyboard.type('Written by the Playwright suite.');

  await expect(page.getByText('Unsaved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save note now' }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByPlaceholder('Untitled note')).toHaveValue('E2E scratch note');
  await expect(page.locator('[data-editable-block="true"]').first()).toContainText(
    'Written by the Playwright suite.',
  );
});
