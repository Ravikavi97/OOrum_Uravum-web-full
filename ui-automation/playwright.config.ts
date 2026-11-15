import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const publicUrl = process.env.OBITUARY_PUBLIC_URL || 'http://localhost:3000';
const dashboardUrl = process.env.OBITUARY_DASHBOARD_URL || 'http://localhost:3001';
const storageState = process.env.OBITUARY_STORAGE_STATE
  ? path.resolve(__dirname, process.env.OBITUARY_STORAGE_STATE)
  : undefined;

function assertLocalUrl(value: string, name: string) {
  const { hostname } = new URL(value);
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  if (!isLocal && process.env.ALLOW_NONLOCAL_TARGET !== 'true') {
    throw new Error(`${name} must target localhost unless ALLOW_NONLOCAL_TARGET=true.`);
  }
}

assertLocalUrl(publicUrl, 'OBITUARY_PUBLIC_URL');
assertLocalUrl(dashboardUrl, 'OBITUARY_DASHBOARD_URL');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: publicUrl,
    storageState,
    launchOptions: {
      slowMo: 500,
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
