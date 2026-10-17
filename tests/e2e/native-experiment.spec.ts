import { expect, test } from '@playwright/test';

test('assigns stable control and treatment compositions on the disposable experiment store', async ({ browser }) => {
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
    await expect(pages[treatmentIndex].getByRole('heading', { name: 'A useful place to begin.' })).toBeVisible();
    const stable = pages[0];
    const initialArm = resolvedArms[0];
    await stable.reload();
    if (initialArm === 'control') await expect(stable.getByRole('heading', { name: 'Native Experiment Store' })).toBeVisible();
    if (initialArm === 'treatment') await expect(stable.getByRole('heading', { name: 'A useful place to begin.' })).toBeVisible();
    await stable.getByRole('button', { name: initialArm === 'control' ? 'Help me find something' : 'Compare products' }).click();
    if (initialArm === 'control') await expect(stable.getByRole('heading', { name: 'Native Experiment Store' })).toBeVisible();
    if (initialArm === 'treatment') await expect(stable.getByRole('heading', { name: 'A useful place to begin.' })).toBeVisible();
  } finally { await Promise.all(contexts.map(context => context.close())); }
}, 120000);
