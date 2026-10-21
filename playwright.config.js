import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const chromium = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
export default defineConfig({
  testDir: 'tests',
  timeout: 45_000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4174',
    viewport: { width: 1280, height: 860 },
    launchOptions: chromium ? { executablePath: chromium } : {},
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  webServer: { command: 'node scripts/serve.mjs 4174', url: 'http://localhost:4174/', reuseExistingServer: true },
});
