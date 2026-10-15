import { expect, test } from '@playwright/test';

test('supports accessible free-text adaptive interaction without fabricating unsupported intent', async ({ page }) => {
  const initializationResponse = page.waitForResponse(response => {
    const pathname = new URL(response.url()).pathname;
    return response.ok()
      && ((response.request().method() === 'GET' && pathname === '/api/interaction/resume')
        || (response.request().method() === 'POST' && pathname === '/api/interaction/start'));
  });
  await page.goto('/experience/interactive', { waitUntil: 'domcontentloaded' });
  const need = page.getByLabel('Or tell us what you need');
  await expect(need).toBeVisible();
  await expect(need).toHaveAttribute('maxlength', '4000');
  const submit = page.getByRole('button', { name: 'Help me find the right next step' });
  await initializationResponse;
  await expect(submit).toHaveText('Help me find the right next step');
  await expect(submit).toBeDisabled();

  await need.fill('Tell me something surprising.');
  await expect(submit).toBeEnabled();
  const unclearResponse = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/interaction/intent');
  await submit.click();
  expect((await unclearResponse).ok()).toBeTruthy();
  await expect(page.getByLabel('Or tell us what you need')).toHaveValue('');

  await need.fill('My employer just fired me. I need help.');
  const recognizedResponse = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/interaction/intent');
  await submit.click();
  expect((await recognizedResponse).ok()).toBeTruthy();
  await expect(page.getByText('What kind of timeframe are you considering?')).toBeVisible();
});
