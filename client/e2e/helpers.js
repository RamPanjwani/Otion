import { expect } from '@playwright/test';

export const DEMO_OWNER = { email: 'demo@otion.app', password: 'OtionDemo123!' };

export async function signIn(page, account = DEMO_OWNER) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
