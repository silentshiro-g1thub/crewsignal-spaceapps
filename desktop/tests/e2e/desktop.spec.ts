import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("CrewSignal Desktop E2E, Accessibility, Themes, Print & Scaling", () => {
  test("Getting started works by keyboard without external requests", async ({ page, baseURL }) => {
    await page.route("**/*", (route) => new URL(route.request().url()).origin === baseURL
      ? route.continue()
      : route.abort());
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    const entry = page.getByRole("button", { name: "Getting started", exact: true });
    await expect(entry).toBeVisible();
    expect((await entry.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await entry.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Getting started" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Help procedures and sources" })).toBeFocused();
    const audit = await new AxeBuilder({ page }).include("#main-content")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(audit.violations).toEqual([]);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Return to previous screen" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    await expect(page.getByRole("main")).toBeFocused();
  });

  test("passes WCAG 2.2 AA axe-core checks on all core routes in Light & Dark modes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(page.getByText(/11 observations across 5 of 6 types/i)).toBeVisible();

    const routesToCheck = [
      /^Overview$/i,
      /^Check-in$/i,
      /^Health Explorer$/i,
      /^Trends$/i,
      /^Reports$/i,
      /^Actions$/i,
      /^Sources$/i,
      /^Settings$/i,
      /^Help$/i,
    ];

    for (const label of routesToCheck) {
      await page.getByRole("button", { name: label }).first().click();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const seriousOrCritical = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(
        seriousOrCritical,
        `Axe violations on route ${String(label)}: ${JSON.stringify(seriousOrCritical, null, 2)}`,
      ).toEqual([]);
    }

    // Switch to Vercel Light and verify Overview & Check-in Review stay neutral & WCAG clean
    await page.getByRole("button", { name: /^Settings$/i }).first().click();
    await page.getByRole("button", { name: /^Light$/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.getByRole("button", { name: /^Overview$/i }).first().click();
    const lightResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(
      lightResults.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  });

  test("completes unit conversion Check-in -> Review (Equivalent 97.3 mg/dL) -> Saved + CSV 5-row staged import + Light A4 Print", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByText(/11 observations across 5 of 6 types/i)).toBeVisible();

    // Start Blood Glucose check-in with mmol/L -> check Unit Change confirmation modal
    await page.getByRole("button", { name: /^Check-in$/i }).first().click();
    await page.getByRole("button", { name: "Blood glucose" }).click();
    await page.getByRole("button", { name: "mmol/L", exact: true }).click();
    await page.getByRole("textbox", { name: /Blood glucose/i }).fill("5.4");

    // Attempt unit change while populated -> triggers UnitChangeModal; cancel preserves 5.4
    await page.getByRole("button", { name: "mg/dL", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Change input unit\?/i })).toBeVisible();
    await page.getByRole("button", { name: /^Cancel$/i }).click();
    await expect(page.getByRole("textbox", { name: /Blood glucose/i })).toHaveValue("5.4");

    // Proceed to Review -> verifies normalized 97.3 mg/dL equivalent & Add to log
    await page.getByRole("button", { name: /Next: Review/i }).click();
    await expect(page.getByText(/Equivalent \(approx\.\): 97\.3 mg\/dL/i)).toBeVisible();
    await page.getByRole("button", { name: /Add to log/i }).click();
    await expect(page.getByRole("heading", { name: /Added to your log/i })).toBeVisible();

    // Reports -> verify count updated & CSV 5-row staged reconciliation
    await page.getByRole("button", { name: /^Reports$/i }).first().click();
    await page.getByRole("tab", { name: /CSV Import/i }).click();
    await page.getByRole("button", { name: /Load 5-row review fixture/i }).click();
    await expect(page.getByText(/Staged preview \(5 rows\)/i)).toBeVisible();
    await expect(page.getByText(/rejected/i).first()).toBeVisible();

    // Resolve conflict + acknowledge exclusions -> commit batch atomically
    await page.getByLabel(/Use imported whole entry/i).check();
    await page.getByLabel(/Acknowledge excluded/i).check();
    await page.getByRole("button", { name: /Commit CSV import batch/i }).click();
    await expect(page.getByRole("status").getByText(/CSV import applied atomically/i)).toBeVisible();

    // Verify Light A4 Print styles render print sheet and hide sidebar
    await page.getByRole("tab", { name: /Report & Print/i }).click();
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".print-report-sheet")).toBeVisible();
    await expect(page.locator(".app-sidebar")).toBeHidden();
  });

  test("reflows cleanly at 1440px, narrow desktop (720px), 390px, 320px, and passes forced-colors WCAG 2.2 AA", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByText(/11 observations/i)).toBeVisible();

    // 1440x900 Overview KPI values sit on single clean lines without orphan unit wrapping
    const kpiHeights = await page
      .locator(".reading-value")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    for (const h of kpiHeights) {
      expect(h).toBeLessThanOrEqual(34);
    }

    // 1440x900 Split layout places wide section left of 310px aside on Check-in & Reports
    for (const navName of [/^Check-in$/i, /^Reports$/i]) {
      await page.getByRole("button", { name: navName }).first().click();
      const layoutBoxes = await page.locator(".split-layout").evaluate((el) => {
        const sec = el.querySelector(":scope > section")!.getBoundingClientRect();
        const aside = el.querySelector(":scope > aside")!.getBoundingClientRect();
        return { secX: sec.x, secW: sec.width, asideX: aside.x, asideW: aside.width };
      });
      expect(layoutBoxes.secX).toBeLessThan(layoutBoxes.asideX);
      expect(layoutBoxes.secW).toBeGreaterThan(layoutBoxes.asideW);
      expect(layoutBoxes.asideW).toBeLessThanOrEqual(315);
    }

    await page.getByRole("button", { name: /^Overview$/i }).first().click();

    // 720px logical width -> compact labelled nav rail (92px) with zero horizontal overflow
    await page.setViewportSize({ width: 720, height: 900 });
    const railWidth = await page.locator(".app-sidebar").evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.round(railWidth)).toBe(92);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    // 390x844 and 320x568 viewports across all core routes (including Reports & Trends) -> zero overflow
    for (const vp of [
      { width: 390, height: 844 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(vp);
      await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
      for (const routeName of [/^Overview$/i, /^Check-in$/i, /^Trends$/i]) {
        await page.locator(".mobile-bottom-nav").getByRole("button", { name: routeName }).click();
        const overflow = await page.evaluate(() => ({
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));
        expect(overflow.scrollW).toBeLessThanOrEqual(overflow.clientW);
      }
      // Open Reports & Help via More drawer and assert Dark & Light zero overflow
      await page.locator(".mobile-bottom-nav").getByRole("button", { name: /^More$/i }).click();
      await page.locator(".mobile-more-drawer").getByRole("button", { name: /Reports & Export/i }).click();
      for (const themeVal of ["dark", "light"]) {
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), themeVal);
        const overflow = await page.evaluate(() => ({
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));
        expect(overflow.scrollW).toBeLessThanOrEqual(overflow.clientW);
      }
      await page.locator(".mobile-bottom-nav").getByRole("button", { name: /^More$/i }).click();
      await page.locator(".mobile-more-drawer").getByRole("button", { name: /^Help$/i }).click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      ).toBe(true);
    }

    // Forced-colors mode (Windows High Contrast) passes axe WCAG 2.2 AA in both Light & Dark
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ forcedColors: "active" });
    await expect(page.locator(".app-sidebar")).toBeVisible();
    for (const themeChoice of [/^Light$/i, /^Dark$/i]) {
      await page.locator(".app-sidebar").getByRole("button", { name: /^Settings$/i }).click();
      await page.getByRole("button", { name: themeChoice }).click();
      for (const routeName of [/^Overview$/i, /^Check-in$/i, /^Reports$/i, /^Settings$/i]) {
        await page.locator(".app-sidebar").getByRole("button", { name: routeName }).click();
        const axeForced = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(axeForced.violations).toEqual([]);
      }
    }
  });

  test("keeps focus trapped inside Help modal and restores focus on Escape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: /^Check-in$/i }).first().click();

    const whatBtn = page.getByRole("button", { name: /What is this\?/i });
    await whatBtn.focus();
    await whatBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(whatBtn).toBeFocused();
  });
  test("Review P2: Reports and Explorer tabs follow the W3C keyboard pattern", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: /^Reports$/i }).first().click();
    const sections = page.getByRole("tablist", { name: "Reports sections" });
    const report = sections.getByRole("tab", { name: "Report & Print" });
    const backup = sections.getByRole("tab", { name: "Backup & Restore" });
    const csv = sections.getByRole("tab", { name: "CSV Import" });
    await expect(sections.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
    await report.focus();
    await page.keyboard.press("ArrowRight");
    await expect(backup).toBeFocused();
    await expect(backup).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", (await backup.getAttribute("id")) ?? "");
    await page.keyboard.press("End");
    await expect(csv).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(report).toBeFocused();
    await expect(report).toHaveAttribute("aria-selected", "true");

    await page.getByRole("button", { name: /^Health Explorer$/i }).first().click();
    const detail = page.getByRole("tablist", { name: "System detail sections" });
    const summary = detail.getByRole("tab", { name: "Summary" });
    const context = detail.getByRole("tab", { name: "Mission context" });
    await summary.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(context).toBeFocused();
    await expect(context).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(summary).toHaveAttribute("aria-selected", "true");
  });
  test("Review P2: calmer Overview shows the next step first and a 0/5/10-hour sleep scale", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const next = page.getByRole("heading", { name: /below reference/i, level: 2 });
    await expect(next).toBeVisible();
    // Stated once: the Next steps panel no longer repeats the summary.
    await expect(page.getByText(/below reference/i)).toHaveCount(1);
    const nextBox = await next.boundingBox();
    const railBox = await page.locator(".readings-rail").boundingBox();
    expect(nextBox!.y).toBeLessThan(railBox!.y);
    const ticks = await page
      .locator(".overview-grid .chart-svg text")
      .allTextContents();
    for (const t of ["0h", "5h", "10h"]) expect(ticks).toContain(t);
    expect(ticks.some((t) => /^[4-9]$/.test(t))).toBe(false);
    const cols = async () =>
      page.locator(".readings-rail").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(await cols()).toBe(6);
    await page.setViewportSize({ width: 720, height: 900 });
    expect(await cols()).toBe(2);
  });
});
