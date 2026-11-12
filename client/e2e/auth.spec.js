import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('a protected route redirects to sign in when there is no session', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('the seeded demo owner signs in and sees their notes', async ({ page }) => {
  await signIn(page);

  await expect(page.getByRole('button', { name: /Welcome to Otion/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Launch checklist/ })).toBeVisible();
});

test('invalid credentials keep the user on the sign-in page with an error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('demo@otion.app');
  await page.getByLabel('Password').fill('definitely-not-the-password');
  await page.getByRole('button', { name: /Sign in/ }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('alert')).toBeVisible();
});
