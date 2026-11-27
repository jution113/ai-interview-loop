import { defineConfig } from '@playwright/test';

const url = 'http://127.0.0.1:18080';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: url,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: {
    command: "./gradlew bootRun --args='--server.address=127.0.0.1 --server.port=18080'",
    cwd: '../backend',
    url,
    timeout: 120_000,
  },
});
