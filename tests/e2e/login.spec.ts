import { expect, test } from '@playwright/test';

test('shows the internal login screen', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Entrar no CRM' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});
