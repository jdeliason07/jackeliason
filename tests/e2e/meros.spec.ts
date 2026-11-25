import { expect, type Page, test } from "@playwright/test";

/**
 * The complete loop, in demo mode on an iPhone-sized viewport:
 * template → evidence + schedule → verify minimum → XP → stop without optional work → chest →
 * equip → estate upgrade → business battle (start, play, reload/resume, finish).
 * Along the way it checks that nothing but a verified minimum raises character XP.
 */

async function xp(page: Page): Promise<number> {
  await page.goto("/meros/progress");
  const text = await page.getByText(/Level \d+ · \d+ XP/).first().innerText();
  return Number(text.match(/· (\d+) XP/)![1]);
}

async function checkInWithTestCard(page: Page, title: string) {
  const card = page.getByRole("article", { name: title });
  await card.getByRole("button", { name: "Check in" }).click();
  const sheet = page.getByRole("dialog", { name: "Photo check-in" });
  await sheet.getByRole("button", { name: /demo test card/ }).click();
  await sheet.getByRole("button", { name: "Submit" }).click();
  await expect(sheet.getByText("Minimum secured.")).toBeVisible();
  await sheet.getByRole("button", { name: "Back to today" }).click();
}

test("complete loop: verified minimum drives everything; game loops never grant XP", async ({ page }) => {
  // Mid-morning in Denver, so the demo's daily windows (05:00–23:00) are open.
  await page.clock.setFixedTime(new Date("2026-11-25T17:00:00Z"));
  await page.goto("/meros/sign-in");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible({ timeout: 90_000 });

  // The first check-in is reachable without scrolling on an iPhone-sized screen.
  const firstCheckIn = page.getByRole("button", { name: "Check in" }).first();
  await expect(firstCheckIn).toBeInViewport();

  const xpStart = await xp(page);

  // 1. Select a template, configure schedule and evidence, activate.
  await page.goto("/meros/quests/new");
  await page.getByRole("tab", { name: /Learning/ }).click();
  await page.getByRole("button", { name: /Open a nonfiction book/ }).click();
  await page.getByRole("radio", { name: "Every day" }).click();
  await page.getByLabel("Any time of day").check();
  await expect(page.getByLabel("Evidence criterion 1")).toHaveValue(/open printed book/i);
  await page.getByRole("button", { name: "Activate quest" }).click();
  await expect(page.getByRole("heading", { name: "Quests" })).toBeVisible();
  await expect(page.getByText("Open a nonfiction book")).toBeVisible();

  // 2. Verify the minimum with a fresh capture (demo test card stands in for a camera here).
  await page.getByRole("link", { name: "Today" }).click();
  await checkInWithTestCard(page, "Open a nonfiction book");
  const card = page.getByRole("article", { name: "Open a nonfiction book" });
  await expect(card.getByText("Done", { exact: true })).toBeVisible();

  // 3. Stop without optional work: no pressure, no penalty, minimum keeps full credit.
  await card.getByRole("button", { name: "Done for today" }).click();
  await expect(card.getByText("Minimum complete. That's the win.")).toBeVisible();
  const xpAfterMinimum = await xp(page);
  expect(xpAfterMinimum).toBe(xpStart + 10);

  // Complete the other open minimums so at least one chest is earned (one per three minimums).
  await page.goto("/meros");
  for (const title of ["Open the scriptures", "Open the assigned textbook", "Open the planning notebook"]) {
    const c = page.getByRole("article", { name: title });
    if (await c.getByRole("button", { name: "Check in" }).count()) await checkInWithTestCard(page, title);
  }
  const xpBeforeGames = await xp(page);
  expect(xpBeforeGames).toBeGreaterThan(xpAfterMinimum);

  // 4. Open a chest: outcome is saved first, then revealed.
  await page.goto("/meros");
  await page.getByRole("button", { name: /Open chest #/ }).click();
  const chest = page.getByRole("dialog", { name: /Chest #/ });
  await chest.getByRole("button", { name: "Open chest" }).click();
  await expect(chest.getByText(/Estate Credits/).first()).toBeVisible();
  await chest.getByRole("button", { name: "Claim" }).click();

  // 5. Equip an item.
  await page.goto("/meros/collection");
  const toggle = page.getByRole("button", { name: /^(Equip|Unequip)$/ }).first();
  const before = await toggle.innerText();
  await toggle.click();
  await expect(page.getByRole("button", { name: /^(Equip|Unequip)$/ }).first()).not.toHaveText(before);

  // 6. Upgrade the estate.
  await page.goto("/meros/estate");
  const ready = page.getByRole("button", { name: /Ready:/ }).first();
  await ready.click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: /^Build / }).click();
  await expect(page.getByText(/built!/)).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).first().click();

  // 7. Start, play, reload (resume without a second ticket), finish a business battle.
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

  // No game loop (chest, equipment, estate, battle) generated character XP.
  expect(await xp(page)).toBe(xpBeforeGames);
});

test("no horizontal overflow on any screen at iPhone width", async ({ page }) => {
  await page.goto("/meros/sign-in");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible({ timeout: 90_000 });
  for (const path of ["/meros", "/meros/estate", "/meros/ventures", "/meros/quests", "/meros/quests/new", "/meros/profile", "/meros/rewards", "/meros/collection", "/meros/progress"]) {
    await page.goto(path);
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(0);
  }
});

test("reduced motion and mute persist", async ({ page }) => {
  await page.goto("/meros/sign-in");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible({ timeout: 90_000 });
  await page.goto("/meros/profile");
  await page.getByLabel("Reduce motion").check();
  await page.getByLabel("Sound effects").uncheck();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
  await expect(page.getByLabel("Sound effects")).not.toBeChecked();
});
