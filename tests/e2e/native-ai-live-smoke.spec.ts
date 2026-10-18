import { expect, test } from '@playwright/test';

test.skip(process.env.KABLET_AI_LIVE_SMOKE !== 'true', 'Opt-in live-provider smoke; requires explicitly configured provider credentials.');

test('uses the configured provider for ambiguous text and renders the governed result', async ({ page }) => {
  await page.goto('/store/solenne-demo');
  await page.getByLabel('What would be useful next?').fill('I am torn between two routines and need help choosing.');
  const responsePromise = page.waitForResponse(response => response.url().includes('/api/store/solenne-demo/intelligence') && response.request().method() === 'POST' && response.ok());
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const body = await responsePromise.then(response => response.json()) as {
    composition?: string;
    interpretation?: {
      source?: string;
      output?: { normalizedIntent?: string } | null;
      fallbackReason?: string | null;
      providerDiagnostic?: { category?: string; status?: number } | null;
      routingDiagnostic?: { stage?: string; reason?: string } | null;
    };
  };
  const interpretation = body.interpretation;
  const sanitizedDiagnostic = interpretation ? {
    source: interpretation.source ?? null,
    fallbackReason: interpretation.fallbackReason ?? null,
    providerCategory: interpretation.providerDiagnostic?.category ?? null,
    providerStatus: interpretation.providerDiagnostic?.status ?? null,
    routingStage: interpretation.routingDiagnostic?.stage ?? null,
    routingReason: interpretation.routingDiagnostic?.reason ?? null,
  } : { source: null, fallbackReason: null, providerCategory: null, providerStatus: null };
  expect(interpretation?.source, `Live provider smoke returned a sanitized fallback diagnostic: ${JSON.stringify(sanitizedDiagnostic)}`).toBe('provider');
  expect(['explore_offerings', 'request_information', 'select_offering', 'unclear']).toContain(interpretation?.output?.normalizedIntent);
  expect(['entry', 'discovery', 'comparison']).toContain(body.composition);
  await expect(page.getByText(/could not be updated|transition failed/i)).toHaveCount(0);
});
