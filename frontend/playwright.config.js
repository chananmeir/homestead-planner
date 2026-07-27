const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

// Single source of truth for the backend port. Previously start-backend.bat used
// 5051 while every spec hardcoded 5000, so the suite could not run at all
// without someone manually reconciling the two.
const BACKEND_PORT = process.env.HOMESTEAD_BACKEND_PORT || '5000';
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_URL = 'http://localhost:3000';

const BACKEND_DIR = path.resolve(__dirname, '..', 'backend');
// Windows-first repo, but keep this runnable on POSIX/CI too.
const VENV_PYTHON =
  process.platform === 'win32'
    ? path.join('venv', 'Scripts', 'python.exe')
    : path.join('venv', 'bin', 'python');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],

  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on',
    viewport: { width: 1920, height: 1080 },
    headless: !!process.env.CI,
    slowMo: process.env.CI ? 0 : 250,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start both servers automatically, with the backend on a DISPOSABLE database
  // recreated per run (see backend/scripts/run_e2e_backend.py). Running against
  // the developer database is what made this suite non-idempotent, order
  // dependent, and impossible for CI to reproduce.
  //
  // reuseExistingServer keeps the fast local loop: if you already have servers
  // up, Playwright attaches to them instead of starting its own. In CI it
  // always starts clean.
  webServer: [
    {
      command: `${VENV_PYTHON} scripts/run_e2e_backend.py`,
      cwd: BACKEND_DIR,
      url: `${BACKEND_URL}/api/auth/check`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        HOMESTEAD_BACKEND_PORT: BACKEND_PORT,
        HOMESTEAD_ENABLE_SIMULATION: 'true', // dashboard staleness specs drive the clock
      },
    },
    {
      command: 'npm start',
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        BROWSER: 'none',
        // Overrides .env.local, which points at the developer backend.
        REACT_APP_API_URL: BACKEND_URL,
      },
    },
  ],
});
