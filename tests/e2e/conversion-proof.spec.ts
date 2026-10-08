import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import pg from 'pg';

test('completes the browser conversion journey with durable lineage', async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const finishedRequests: string[] = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', request => { failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'unknown failure'}`); });
  page.on('requestfinished', request => { if (request.url().includes('/api/interaction/start')) finishedRequests.push(`${request.method()} ${request.url()}`); });
  const startResponsePromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/interaction/start');
  await page.goto('/experience/interactive', { waitUntil: 'domcontentloaded' });
  const startResponse = await startResponsePromise;
  const headerStatus = startResponse.status();
  if (!startResponse.ok()) {
    throw new Error(`interaction start headers received with status ${headerStatus}; finishedRequests=${JSON.stringify(finishedRequests)}; failedRequests=${JSON.stringify(failedRequests)}; consoleErrors=${JSON.stringify(consoleErrors)}`);
  }
  let startBody: string;
  try {
    startBody = await Promise.race([
      startResponse.text(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('response body did not complete within 3000ms')), 3000)),
    ]);
  } catch (error) {
    throw new Error(`interaction start headers received with status ${headerStatus}, but response body did not complete: ${error instanceof Error ? error.message : String(error)}; finishedRequests=${JSON.stringify(finishedRequests)}; failedRequests=${JSON.stringify(failedRequests)}; consoleErrors=${JSON.stringify(consoleErrors)}`);
  }
  const redactedBody = startBody.replace(/(postgres(?:ql)?:\/\/|https?:\/\/)[^\s"']+/gi, '$1[redacted]')
    .replace(/("?(?:cookie|authorization|token|password|secret|email|name)"?\s*:\s*)"?[^"]+"?/gi, '$1"[redacted]"');
  let startPayload: { experience?: unknown };
  try { startPayload = JSON.parse(startBody) as { experience?: unknown }; } catch { throw new Error(`interaction start returned invalid JSON: ${redactedBody.slice(0, 1000)}`); }
  if (!startPayload.experience) {
    throw new Error(`interaction start returned no experience; consoleErrors=${JSON.stringify(consoleErrors)}; failedRequests=${JSON.stringify(failedRequests)}`);
  }
  await expect(page.getByText('What would be most useful?')).toBeVisible();
  await page.getByRole('button', { name: 'Explore your services' }).click();
  const intentResponsePromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/interaction/intent');
  await page.getByRole('button', { name: 'Continue' }).click();
  const intentResponse = await intentResponsePromise;
  if (!intentResponse.ok()) {
    let body = '';
    try { body = await Promise.race([intentResponse.text(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('response body did not complete within 3000ms')), 3000))]); } catch (error) { body = `[body unavailable: ${error instanceof Error ? error.message : String(error)}]`; }
    const redactedBody = body.replace(/(postgres(?:ql)?:\/\/|https?:\/\/)[^\s"']+/gi, '$1[redacted]').replace(/("?(?:cookie|authorization|token|password|secret|email|name)"?\s*:\s*)"?[^"]+"?/gi, '$1"[redacted]"');
    throw new Error(`interaction intent failed (${intentResponse.status()}): ${redactedBody.slice(0, 1000)}; consoleErrors=${JSON.stringify(consoleErrors)}; failedRequests=${JSON.stringify(failedRequests)}`);
  }
  await expect(page.getByRole('button', { name: 'Choose this option' })).toBeVisible();
  await page.getByRole('button', { name: 'Choose this option' }).click();
  await expect(page.getByLabel('Name')).toBeVisible();
  await page.getByLabel('Name').fill('Browser Visitor');
  await page.getByLabel('Email').fill('browser@example.test');
  await page.getByLabel('I agree to be contacted about this request.').check();
  await page.getByRole('button', { name: 'Continue' }).last().click();
  await expect(page.getByRole('button', { name: 'Continue securely' })).toBeVisible();
  const actionResponsePromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/interaction/action');
  await page.getByRole('button', { name: 'Continue securely' }).click();
  const actionResponse = await actionResponsePromise;
  if (!actionResponse.ok()) {
    let body = '';
    try { body = await Promise.race([actionResponse.text(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('response body did not complete within 3000ms')), 3000))]); } catch (error) { body = `[body unavailable: ${error instanceof Error ? error.message : String(error)}]`; }
    const redactedBody = body.replace(/(postgres(?:ql)?:\/\/|https?:\/\/)[^\s"']+/gi, '$1[redacted]').replace(/("?(?:cookie|authorization|token|password|secret|email|name)"?\s*:\s*)"?[^"]+"?/gi, '$1"[redacted]"');
    throw new Error(`interaction action failed (${actionResponse.status()}): ${redactedBody.slice(0, 1000)}`);
  }
  await expect(page.getByText('Your request was securely delivered and verified.')).toBeVisible();

  const statePath = process.env.KABLET_E2E_STATE_FILE;
  if (!statePath) throw new Error('KABLET_E2E_STATE_FILE is required');
  const state = JSON.parse(await readFile(statePath, 'utf8')) as { runtimeUrl: string; organizationId: string; businessId: string; offeringId: string; offeringRevisionId: string };
  const pool = new pg.Pool({ connectionString: state.runtimeUrl });
  try {
    const connection = await pool.connect();
    try {
      await connection.query('begin');
      await connection.query("select set_config('kablet.organization_id',$1,true),set_config('kablet.business_id',$2,true)", [state.organizationId, state.businessId]);
      const result = await connection.query(`select
      (select count(*) from visitor_observations where organization_id=$1 and business_id=$2 and kind='offering.selected') as selections,
      (select count(*) from visitor_decisions where organization_id=$1 and business_id=$2 and decision_type='offer_next_step') as next_steps,
      (select count(*) from interaction_facts where organization_id=$1 and business_id=$2 and interaction_kind='action_confirmed') as confirmations,
      (select count(*) from action_requests where organization_id=$1 and business_id=$2) as requests,
      (select count(*) from execution_attempts where organization_id=$1 and business_id=$2) as attempts,
      (select count(*) from action_outcomes where organization_id=$1 and business_id=$2 and status='verified') as outcomes,
      (select count(*) from conversion_facts where organization_id=$1 and business_id=$2) as conversions`, [state.organizationId, state.businessId]);
      expect(result.rows[0]).toMatchObject({ selections: '1', next_steps: '1', confirmations: '1', requests: '1', attempts: '1', outcomes: '1', conversions: '1' });
      await connection.query('commit');
    } catch (error) { await connection.query('rollback').catch(() => undefined); throw error; } finally { connection.release(); }
  } finally { await pool.end(); }
});
