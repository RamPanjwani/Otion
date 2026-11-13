import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('a password-protected public link shows the note read-only', async ({ page, browser }) => {
  await signIn(page);
  await page.getByRole('button', { name: /Launch checklist/ }).click();
  await expect(page).toHaveURL(/\/notes\/[a-f0-9]{24}$/);

  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await page.getByPlaceholder('At least 8 characters').fill('e2e-public-pass');
  await page.getByRole('button', { name: /(Create read-only link|Create & Copy link)/ }).click();

  const shareLink = page.locator('span.truncate').filter({ hasText: '/public/' });
  await expect(shareLink).toBeVisible();
  const url = (await shareLink.textContent()).trim();
  expect(url).toMatch(/\/public\/[A-Za-z0-9_-]+$/);

  // A signed-out reader gets the password gate, never the note.
  const reader = await browser.newContext();
  const readerPage = await reader.newPage();
  await readerPage.goto(url);
  await expect(readerPage.getByRole('heading', { name: 'Protected note' })).toBeVisible();

  await readerPage.getByPlaceholder('Password').fill('e2e-public-pass');
  await readerPage.getByRole('button', { name: 'Open note' }).click();

  await expect(readerPage.getByRole('heading', { name: 'Launch checklist' })).toBeVisible();
  await expect(readerPage.getByText('Verify the public link password flow')).toBeVisible();
  await expect(readerPage.locator('[data-editable-block="true"]').first()).toHaveAttribute(
    'contenteditable',
    'false',
  );

  await reader.close();
});
