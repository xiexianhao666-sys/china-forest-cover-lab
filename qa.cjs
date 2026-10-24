const { spawnSync } = require("node:child_process");
// Compatibility entrypoint. Playwright owns browser discovery and isolation.
const result = spawnSync(
  process.execPath,
  [require.resolve("@playwright/test/cli"), "test", ...process.argv.slice(2)],
  { cwd: __dirname, stdio: "inherit", windowsHide: true },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
