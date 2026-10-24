const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.cjs",
  timeout: 30000,
  globalTimeout: 180000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {},
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1894, height: 1244 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
});
