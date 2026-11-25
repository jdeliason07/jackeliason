import { expect, type Page, test } from "@playwright/test";

/**
 * The complete loop, in demo mode on an iPhone-sized viewport:
 * template → evidence + schedule → verify minimum → XP → stop without optional work → chest →
 * equip → estate upgrade → business battle (start, play, reload/resume, finish).
 * Along the way it checks that nothing but a verified minimum raises character XP.
 */

/** Opens the demo once the sign-in page is interactive (its status note renders after hydration). */
async function enterDemo(page: Page) {
  await page.goto("/meros/sign-in");
  await page.getByText("The live app isn’t configured").waitFor();
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByRole("region", { name: "Your block" })).toBeVisible({ timeout: 90_000 });
}

async function xp(page: Page): Promise<number> {
  await page.goto("/meros/progress");
  const text = await page.getByText(/Level \d+ · \d+ XP/).first().innerText();
  return Number(text.match(/· (\d+) XP/)![1]);
}

/** Taps a building on Home and returns its sheet. */
async function openPlace(page: Page, place: string) {
  if (!/\/meros\/?$/.test(new URL(page.url()).pathname)) await page.goto("/meros");
  await page.getByRole("button", { name: new RegExp(`^${place}`) }).click();
  const sheet = page.getByRole("dialog", { name: place });
  await expect(sheet).toBeVisible();
  return sheet;
}

async function snapWithTestCard(page: Page, place: string, title: string) {
  const sheet = await openPlace(page, place);
  await sheet.getByRole("article", { name: title }).getByRole("button", { name: /Snap it/ }).click();
  const check = page.getByRole("dialog", { name: "Snap it" });
  await check.getByRole("button", { name: /Demo test card/ }).click();
  await check.getByRole("button", { name: "Send" }).click();
  await expect(check.getByText("Done.")).toBeVisible();
  return check;
}

test("complete loop: tasks live in buildings; verified minimum drives everything; money is real; game loops never grant XP", async ({ page }) => {
  // Mid-morning in Denver, so the demo's daily windows (05:00–23:00) are open.
  await page.clock.setFixedTime(new Date("2026-11-25T17:00:00Z"));
  await enterDemo(page);

  // Home points at the next task with one big button, without scrolling on an iPhone-sized screen.
  await expect(page.locator(".btn-hero").first()).toBeInViewport();

  const xpStart = await xp(page);

  // 1. Add a task from a template: schedule and evidence, then activate.
  await page.goto("/meros/tasks/new");
  await page.getByRole("tab", { name: /Learning/ }).click();
  await page.getByRole("button", { name: /Open a nonfiction book/ }).click();
  await page.getByRole("radio", { name: "Every day" }).click();
  if ((await page.getByRole("button", { name: "Any time" }).getAttribute("aria-pressed")) !== "true") await page.getByRole("button", { name: "Any time" }).click();
  await expect(page.getByLabel("Evidence criterion 1")).toHaveValue(/open printed book/i);
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(page.getByText("Open a nonfiction book")).toBeVisible();

  // 2. It lives in the library: verify the minimum there with a fresh capture.
  const check = await snapWithTestCard(page, "Library", "Open a nonfiction book");
  await check.getByRole("button", { name: "Done" }).click();
  const library = page.getByRole("dialog", { name: "Library" });
  const row = library.getByRole("article", { name: "Open a nonfiction book" });
  await expect(row.getByRole("button", { name: /Extra:/ })).toBeVisible();

  // 3. Skip the optional extra: no pressure, no penalty, the minimum keeps full credit.
  await row.getByRole("button", { name: "Skip the extra" }).click();
  await expect(row.getByRole("button", { name: /Extra:/ })).toHaveCount(0);
  const xpAfterMinimum = await xp(page);
  expect(xpAfterMinimum).toBe(xpStart + 10);

  // 4. A money task: finishing it asks what it really earned, and Home's money moves by exactly that.
  await page.goto("/meros");
  const moneyBefore = Number((await page.getByRole("button", { name: /Money this month/ }).getAttribute("aria-label"))!.match(/(\d+) dollars/)![1]);
  const korvo = await snapWithTestCard(page, "Office", "Pitch one Korvo client");
  await korvo.getByLabel(/Earned for Korvo/).fill("150");
  await korvo.getByRole("button", { name: "Log" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: `Money this month: ${moneyBefore + 150} dollars` })).toBeVisible();

  // Complete the other open minimums so at least one chest is earned (one per three minimums).
  for (const [place, title] of [["House", "Open the scriptures"], ["Library", "Open the assigned textbook"], ["Office", "Open the planning notebook"]] as const) {
    await page.goto("/meros");
    const sheet = await openPlace(page, place);
    if (await sheet.getByRole("article", { name: title }).getByRole("button", { name: /Snap it/ }).count()) {
      await page.keyboard.press("Escape");
      const c = await snapWithTestCard(page, place, title);
      await c.getByRole("button", { name: "Done" }).click();
    }
  }
  const xpBeforeGames = await xp(page);
  expect(xpBeforeGames).toBeGreaterThan(xpAfterMinimum);

  // 5. Open a chest: outcome is saved first, then revealed.
  await page.goto("/meros");
  await page.getByRole("button", { name: /chest ready/ }).click();
  const chest = page.getByRole("dialog", { name: /Chest #/ });
  await chest.getByRole("button", { name: "Open chest" }).click();
  await expect(chest.getByText(/Estate Credits/).first()).toBeVisible();
  await chest.getByRole("button", { name: "Claim" }).click();

  // 6. Equip an item.
  await page.goto("/meros/collection");
  const toggle = page.getByRole("button", { name: /^(Equip|Unequip)$/ }).first();
  const before = await toggle.innerText();
  await toggle.click();
  await expect(page.getByRole("button", { name: /^(Equip|Unequip)$/ }).first()).not.toHaveText(before);

  // 7. Upgrade a building from its sheet.
  await page.goto("/meros");
  const workshop = await openPlace(page, "Workshop");
  await workshop.getByRole("button", { name: /^Build .* credits$/ }).click();
  await expect(page.getByText(/built!/)).toBeVisible();
  await page.keyboard.press("Escape");

  // 8. Start, play, reload (resume without a second ticket), finish a business battle.
  await page.goto("/meros/ventures");
  const ticketsText = await page.getByText(/\d+\/6 tickets/).innerText();
  const ticketsBefore = Number(ticketsText.split("/")[0]);
  await page.getByRole("button", { name: "Start The Harbor Lease" }).click();
  await expect(page.getByRole("heading", { name: "The Harbor Lease" })).toBeVisible();
  const pick = async () => {
    const options = page.locator("section[aria-label^='Round'] ul button:not([disabled])");
    await options.first().click();
  };
  await pick();
  await expect(page.getByText(/Round 1: net/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Round 2/3")).toBeVisible();
  await pick();
  await expect(page.getByText("Round 3/3")).toBeVisible();
  await pick();
  await expect(page.getByRole("region", { name: "Summary" })).toBeVisible();
  await expect(page.getByText(/\+\d+ Estate Credits/).last()).toBeVisible();
  await page.getByRole("button", { name: "Back to Ventures" }).click();
  await expect(page.getByText(`${ticketsBefore - 1}/6 tickets`)).toBeVisible();

  // No game loop (chest, equipment, buildings, battle) or logged money generated character XP.
  expect(await xp(page)).toBe(xpBeforeGames);
});

test("old addresses still land", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/meros/quests");
  await expect(page).toHaveURL(/\/meros\/tasks$/);
  await page.goto("/meros/estate");
  await expect(page).toHaveURL(/\/meros$/);
});

test("no horizontal overflow on any screen at iPhone width", async ({ page }) => {
  await enterDemo(page);
  for (const path of ["/meros", "/meros/house", "/meros/ventures", "/meros/tasks", "/meros/tasks/new", "/meros/tasks/new?place=gym", "/meros/profile", "/meros/rewards", "/meros/collection", "/meros/progress"]) {
    await page.goto(path);
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(0);
  }
});

test("reduced motion and mute persist", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/meros/profile");
  await page.getByLabel("Reduce motion").check();
  await page.getByLabel("Sound effects").uncheck();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
  await expect(page.getByLabel("Sound effects")).not.toBeChecked();
});
