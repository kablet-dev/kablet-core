import { expect, test } from '@playwright/test';

test('assigns stable control and treatment compositions on the disposable experiment store', async ({ browser }) => {
  test.setTimeout(180000);
  const contexts = await Promise.all(Array.from({ length: 16 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  try {
    const compositions = await Promise.all(pages.map(async page => {
      const intelligence = page.waitForResponse(response => response.url().includes('/api/store/browser-experiment-store/intelligence') && response.request().method() === 'GET' && response.ok());
      await page.goto('/store/browser-experiment-store');
      return (await intelligence).json() as Promise<{ composition?: string }>;
    }));
    const resolvedArms = compositions.map(value => value.composition === 'discovery' ? 'treatment' : 'control');
    expect(resolvedArms).toContain('control');
    expect(resolvedArms).toContain('treatment');
    const controlIndex = resolvedArms.indexOf('control');
    const treatmentIndex = resolvedArms.indexOf('treatment');
    await expect(pages[controlIndex].getByRole('heading', { name: 'Native Experiment Store' })).toBeVisible();
    await pages[controlIndex].getByRole('button', { name: 'Help me find something' }).click();
    await expect(pages[controlIndex].getByRole('heading', { name: 'Native Experiment Store' })).toBeVisible();
    const treatmentResponse = pages[treatmentIndex].waitForResponse(response => response.url().includes('/api/store/browser-experiment-store/intelligence') && response.request().method() === 'POST' && response.ok());
    await pages[treatmentIndex].getByRole('button', { name: 'Help me find something' }).click();
    await expect((await treatmentResponse).json()).resolves.toMatchObject({ composition: 'discovery' });
    const stable = pages[0];
    const initialArm = resolvedArms[0];
    await stable.reload();
    await expect(stable.getByRole('heading', { name: 'Native Experiment Store' })).toBeVisible();
    const stableResponse = stable.waitForResponse(response => response.url().includes('/api/store/browser-experiment-store/intelligence') && response.request().method() === 'POST' && response.ok());
    await stable.getByRole('button', { name: 'Help me find something' }).click();
    if (initialArm === 'control') await expect(stable.getByRole('heading', { name: 'Native Experiment Store' })).toBeVisible();
    await expect((await stableResponse).json()).resolves.toMatchObject({ composition: initialArm === 'control' ? 'entry' : 'discovery' });
  } finally { await Promise.all(contexts.map(context => context.close())); }
}, 120000);
