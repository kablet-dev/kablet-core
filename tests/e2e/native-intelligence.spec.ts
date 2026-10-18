import { expect, test } from '@playwright/test';

test('renders different governed native compositions for isolated visitors', async ({ browser }) => {
  test.setTimeout(30000);
  const discoveryContext = await browser.newContext();
  const comparisonContext = await browser.newContext();
  const discovery = await discoveryContext.newPage();
  const comparison = await comparisonContext.newPage();
  try {
    await Promise.all([discovery.goto('/store/browser-native-store'), comparison.goto('/store/browser-native-store')]);
    await discovery.getByRole('button', { name: 'Help me find something' }).click();
    await expect(discovery.getByText('Browser Native Product').first()).toBeVisible({ timeout: 15000 });
    await comparison.getByRole('button', { name: 'Compare products' }).click();
    await expect(comparison.getByRole('heading', { name: 'Compare the collection' })).toBeVisible();
    await expect(discovery.getByRole('heading', { name: 'Compare the collection' })).toHaveCount(0);
  } finally {
    await discoveryContext.close();
    await comparisonContext.close();
  }
});

test('resumes the server-authorized native composition after reload', async ({ page }) => {
  await page.goto('/store/browser-native-store');
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByText('Browser Native Product').first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Native Store Collection' })).toBeVisible();
  await expect(page.getByText('Browser Native Product')).toHaveCount(0);
});

test('uses the active versioned merchant rule in the real canvas response', async ({ page }) => {
  let selectedRule: { ruleId?: string; ruleKey?: string; version?: number; composition?: string; reasonCode?: string; reason?: string } | null = null;
  page.on('response', async response => {
    if (response.url().includes('/api/store/browser-native-store/intelligence') && response.request().method() === 'POST' && response.ok()) {
      const body = await response.json() as { rule?: typeof selectedRule };
      selectedRule = body.rule ?? null;
    }
  });
  await page.goto('/store/browser-native-store');
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByText('Browser Native Product').first()).toBeVisible();
  await expect.poll(() => selectedRule).toEqual({
    ruleKey: 'native.discovery', version: 1, composition: 'discovery',
    reason: 'The visitor explicitly asked to explore the published collection.',
    ruleId: expect.any(String), reasonCode: 'explicit_intent',
  });
});

test('changes the selected rule when an explicit availability preference is chosen', async ({ page }) => {
  let selectedRule: { ruleKey?: string; reasonCode?: string } | null = null;
  page.on('response', async response => {
    if (response.url().includes('/api/store/browser-native-store/intelligence') && response.request().method() === 'POST' && response.ok()) {
      const body = await response.json() as { rule?: typeof selectedRule };
      if (body.rule?.ruleKey === 'native.discovery.available') selectedRule = body.rule;
    }
  });
  await page.goto('/store/browser-native-store');
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await page.getByRole('button', { name: 'Show available options' }).click();
  await expect(page.getByRole('heading', { name: 'These products match that direction.' })).toBeVisible();
  await expect.poll(() => selectedRule).toMatchObject({ ruleKey: 'native.discovery.available', reasonCode: 'merchant_truth_match' });
});

test('routes known text deterministically without provider configuration', async ({ page }) => {
  let interpretation: { source?: string; output?: { normalizedIntent?: string } } | null = null;
  await page.goto('/store/browser-native-store');
  await page.getByLabel('What would be useful next?').fill('compare these products');
  const responsePromise = page.waitForResponse(response => response.url().includes('/api/store/browser-native-store/intelligence') && response.request().method() === 'POST' && response.ok());
  await page.getByRole('button', { name: 'Explore' }).click();
  interpretation = (await responsePromise.then(response => response.json()) as { interpretation?: typeof interpretation }).interpretation ?? null;
  await expect(page.getByRole('heading', { name: 'Compare the collection' })).toBeVisible();
  expect(interpretation?.source).toBe('deterministic');
  expect(interpretation?.output?.normalizedIntent).toBe('select_offering');
});

test('falls back safely for ambiguous text when AI interpretation is disabled', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-kablet-e2e-ai-mode': 'disabled' });
  let interpretation: { source?: string; fallbackReason?: string } | null = null;
  await page.goto('/store/browser-native-store');
  await page.getByLabel('What would be useful next?').fill('I am not sure what I need');
  const responsePromise = page.waitForResponse(response => response.url().includes('/api/store/browser-native-store/intelligence') && response.request().method() === 'POST' && response.ok());
  await page.getByRole('button', { name: 'Explore' }).click();
  interpretation = (await responsePromise.then(response => response.json()) as { interpretation?: typeof interpretation }).interpretation ?? null;
  expect(interpretation?.source).toBe('disabled');
  expect(interpretation?.fallbackReason).toBe('disabled');
  await expect(page.getByRole('heading', { name: 'What should guide the first choice?' })).toBeVisible();
});

test('records bounded browser evidence idempotently and rejects forged purchase evidence', async ({ page }) => {
  await page.goto('/store/browser-native-store');
  await page.getByRole('button', { name: 'Help me find something' }).click();
  await expect(page.getByText('Browser Native Product').first()).toBeVisible();
  const result = await page.evaluate(async () => {
    const payload = { eventKind: 'product_viewed', idempotencyKey: 'browser-evidence-route-1', metadata: { source: 'connected-test' } };
    const first = await fetch('/api/store/browser-native-store/evidence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const replay = await fetch('/api/store/browser-native-store/evidence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const forged = await fetch('/api/store/browser-native-store/evidence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventKind: 'verified_purchase', idempotencyKey: 'browser-evidence-forged-1' }) });
    return { first: { status: first.status, body: await first.json() }, replay: { status: replay.status, body: await replay.json() }, forged: { status: forged.status, body: await forged.json() } };
  });
  expect(result.first.status).toBe(200);
  expect(result.first.body).toMatchObject({ inserted: true });
  expect(result.replay.status).toBe(200);
  expect(result.replay.body).toMatchObject({ inserted: false });
  expect(result.forged.status).toBe(403);
  expect(result.forged.body).toEqual({ code: 'authoritative_event_required' });
});
