import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const chromium = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
const launch = chromium ? { executablePath: chromium } : {};
const use = {
  viewport: { width: 1280, height: 860 },
  launchOptions: launch,
  permissions: ['clipboard-read', 'clipboard-write'],
};

export default defineConfig({
  testDir: 'tests',
  timeout: 45_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list']],
  projects: [
    { name: 'app', testIgnore: /site-build\.spec\.js|perf\.spec\.js|heavy\.spec\.js/, use: { ...use, baseURL: 'http://localhost:4174' } },
    { name: 'site-build', testMatch: /site-build\.spec\.js/, use: { ...use, baseURL: 'http://localhost:4175' } },
    // After installer tests so the existing CI retry is not racing Next.js.
    {
      name: 'perf',
      testMatch: /perf\.spec\.js|heavy\.spec\.js/,
      fullyParallel: false,
      workers: 1,
      timeout: 90_000,
      dependencies: ['app'],
      use: { ...use, baseURL: 'http://localhost:4174' },
    },
  ],
  webServer: [
    { command: 'node scripts/serve.mjs 4174', url: 'http://localhost:4174/', reuseExistingServer: true },
    { command: 'node scripts/serve-public.mjs 4175', url: 'http://localhost:4175/', reuseExistingServer: true },
  ],
});
