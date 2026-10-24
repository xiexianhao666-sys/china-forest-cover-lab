const { test: base, expect } = require("@playwright/test");
const { createServer } = require("../scripts/serve.cjs");
const fs = require("node:fs/promises");
const test = base.extend({
  serverURL: [
    async ({}, use) => {
      const server = createServer();
      await new Promise((r) => server.listen(0, "127.0.0.1", r));
      try {
        await use("http://127.0.0.1:" + server.address().port);
      } finally {
        await new Promise((r) => server.close(r));
      }
    },
    { scope: "worker" },
  ],
  baseURL: async ({ serverURL }, use) => use(serverURL),
  page: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/appeears.earthdatacloud.nasa.gov/**", (r) =>
      r.abort(),
    );
    await use(page);
    expect(errors).toEqual([]);
  },
});
async function ready(page, mode) {
  await expect(page.locator("body")).toHaveAttribute("data-mode", mode);
}
async function mount(page, search, data) {
  await page.evaluate(
    async ({ search, data }) => {
      const app = await import("/app.js");
      await app.mountApp({ search, ...(data ? { data } : {}) });
    },
    { search, data },
  );
}

test("demo: region selection, years, ranking, comparison and export", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await ready(page, "demo");
  await expect(page.locator("#map .province")).toHaveCount(34);
  await page.locator('#map .province[data-id="330000"]').dispatchEvent("click");
  await expect(page.locator("#trendSubtitle")).toContainText("浙江");
  await page.selectOption("#start", "2010");
  await page.locator("#changeMode").click();
  await expect(page.locator("#mapSubtitle")).toContainText("百分点");
  await page.locator("#rankingPanel summary").click();
  await expect(page.locator(".rank-row")).toHaveCount(8);
  await page.locator("#comparison summary").click();
  await expect(page.locator("#miniStart svg")).toHaveCount(2);
  const event = page.waitForEvent("download");
  await page.locator("#exportBtn").click();
  const file = await (await event).path();
  expect(await fs.readFile(file, "utf8")).toContain("合成演示非实际数据");
  await page.locator("#sourceBtn").click();
  await expect(page.locator("#sourceDialog")).toBeVisible();
  await page.locator("#closeDialog").click();
  await page.locator("#resetBtn").click();
  await expect(page.locator("#region")).toHaveValue("all");
});

test("real: actual snapshot, raster, method and JSON export", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page, "real");
  await expect(page.locator("#rate")).toContainText("12.35");
  await expect(page.locator(".share-pie")).toHaveAttribute(
    "aria-label",
    /12\.35%.*87\.65%/,
  );
  const chartDownload = page.waitForEvent("download");
  await page.locator("#chartExport").click();
  expect(
    await fs.readFile(await (await chartDownload).path(), "utf8"),
  ).toContain("分母：通过质量筛选的有效分类面积");
  await expect(page.locator("#map .real-raster")).toHaveAttribute(
    "href",
    "forest-2025.png",
  );
  await expect(page.locator("#map [role=button]")).toHaveCount(0);
  await expect(page.locator("#rankingPanel")).toBeHidden();
  const event = page.waitForEvent("download");
  await page.locator("#exportBtn").click();
  const json = JSON.parse(
    await fs.readFile(await (await event).path(), "utf8"),
  );
  expect(json.records[0].is_official_forest_coverage).toBe(false);
  await page.locator("#sourceBtn").click();
  await expect(page.locator("#sourceDialog")).toContainText(
    "不是官方森林覆盖率",
  );
  await page.locator("#closeApiDialog").click();
  await page.locator("#refreshAPI").click();
  await expect(page.locator("#apiStatus")).toContainText("实时查询未成功");
});

test("pending: no synthetic values or usable export, including absent data", async ({
  page,
}) => {
  await page.goto("/?mode=pending");
  await ready(page, "pending");
  await expect(page.locator("#rate")).toHaveText("—");
  await expect(page.locator("#exportBtn")).toBeDisabled();
  await expect(page.locator("#trend")).toContainText("尚未取得全国统计");
  await expect(page.locator("#map .real-raster")).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.ForestDemo)).toBe("undefined");
  await mount(page, "", { records: [] });
  await ready(page, "pending");
});

test("mode lifecycles clean timers, controls and catalog across repeated mounts", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await ready(page, "demo");
  await page.locator("#playBtn").click();
  await mount(page, "");
  await ready(page, "real");
  await page.waitForTimeout(1800);
  await expect(page.locator("#mapTitle")).toHaveText("2025年森林类空间分布");
  await mount(page, "?mode=pending");
  await expect(page.locator("#rate")).toHaveText("—");
  await page.route("**/forest-2024.png", (route) =>
    route.fulfill({ path: "dist/forest-2025.png", contentType: "image/png" }),
  );
  // Two-year fixture is test-only: exercise the real-mode playback cleanup.
  await page.evaluate(async () => {
    const app = await import("/app.js");
    const data = structuredClone(window.FOREST_REAL_DATA);
    data.records.unshift({ ...data.records[0], year: 2024 });
    await app.mountApp({ search: "", data });
  });
  await page.locator("#playBtn").click();
  await mount(page, "?mode=pending");
  await page.waitForTimeout(1600);
  await expect(page.locator("#mapTitle")).toHaveText("全国研究范围");
  await expect(page.locator("#rate")).toHaveText("—");
  await mount(page, "?demo=1");
  await expect(page.locator("#exportBtn")).toBeEnabled();
  await expect(page.locator("#rankingPanel")).not.toHaveAttribute("hidden");
  await mount(page, "");
  await expect(page.locator(".api-details")).toHaveCount(1);
  await expect(page.locator("#map .real-raster")).toHaveCount(1);
});

test("layout and reduced motion", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?demo=1");
  await ready(page, "demo");
  await page.selectOption("#end", "2020");
  await expect(page.locator("#sliderYear")).toHaveText("2020");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (info.project.name === "desktop")
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
  await page.screenshot({ path: info.outputPath("demo.png"), fullPage: true });
  await page.goto("/");
  await ready(page, "real");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("real.png"), fullPage: true });
  if (info.project.name === "desktop") {
    await page.setViewportSize({ width: 983, height: 1244 });
    await expect(page.locator(".share-pie")).toBeVisible();
    await page.screenshot({
      path: info.outputPath("tablet.png"),
      fullPage: true,
    });
  }
});
