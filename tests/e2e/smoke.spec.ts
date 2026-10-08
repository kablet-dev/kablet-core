import { test, expect } from '@playwright/test';
test('renders Kablet home', async ({page})=>{await page.goto('/', { waitUntil: 'domcontentloaded' }); await expect(page.getByRole('heading')).toContainText('Kablet');});
test('reports application health', async ({page})=>{const response=await page.request.get('/api/health'); await expect(response).toBeOK(); expect(await response.json()).toEqual({status:'ok', application:'ready', database:'not_checked'});});
