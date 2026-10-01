import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir:'tests/e2e', webServer:{command:'pnpm --filter @kablet/web dev',url:'http://127.0.0.1:3000',reuseExistingServer:false}, use:{baseURL:'http://127.0.0.1:3000'} });
