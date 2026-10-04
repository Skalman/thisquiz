import { test, expect, s, cell, DAY_ONE, DAY_ONE_L1 } from "./fixtures.ts";

test("the level tabs switch puzzles and the URL follows", async ({ page }) => {
  await page.goto(DAY_ONE_L1);

  await page.getByRole("tab", { name: s.difficulty[3] }).click();

  await expect(page).toHaveURL(new RegExp(`/daily/${DAY_ONE}/3$`));
  await expect(page.getByRole("tab", { name: s.difficulty[3] })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("the archive links through to a day", async ({ page }) => {
  await page.goto("/daily/archive");

  await expect(page.getByRole("heading", { name: s.daily.archive })).toBeVisible();

  // The day's accessible name is a locale-formatted date, so address it by the
  // href — that's the navigation contract the grid actually promises.
  await page.locator(`a[href="/daily/${DAY_ONE}/1"]`).click();

  await expect(page).toHaveURL(new RegExp(`/daily/${DAY_ONE}/1$`));
});

for (const slug of ["/archive", "/past", "/archive/"]) {
  test(`the old ${slug} slug redirects to the archive`, async ({ page }) => {
    await page.goto(slug);

    await expect(page).toHaveURL(/\/daily\/archive$/);
    await expect(page.getByRole("heading", { name: s.daily.archive })).toBeVisible();
  });
}

test("a puzzle's old address redirects under /daily, with its query and board", async ({
  page,
}) => {
  await page.goto(`/${DAY_ONE}/1?from=old#v1.1A`);

  await expect(page).toHaveURL(new RegExp(`/daily/${DAY_ONE}/1\\?from=old#v1\\.1A$`));
  await expect(cell(page, 0, 0)).toHaveAttribute("data-mark", "correct");
});

test("an unknown two-part address is not taken for a day", async ({ page }) => {
  await page.goto("/foo/bar");

  await expect(page).toHaveURL(/\/foo\/bar$/);
  await expect(page.getByText(s.notFound.pageNotFound)).toBeVisible();
});

test("the header's brand leads to the overview", async ({ page }) => {
  await page.goto(DAY_ONE_L1);
  await page.getByTestId("home").click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("overview-daily")).toBeVisible();
});

test("an out-of-range date is refused", async ({ page }) => {
  // Before START_DATE, so isValidDate rejects it.
  await page.goto("/daily/2020-01-01/1");

  await expect(page.getByRole("heading", { name: s.notFound.noPuzzle })).toBeVisible();
});

test("an unknown route shows the 404", async ({ page }) => {
  await page.goto("/no-such-page");

  await expect(page.getByRole("heading", { name: s.notFound.title })).toBeVisible();
  await expect(page.getByText(s.notFound.pageNotFound)).toBeVisible();
});

test("each section has its own design", async ({ page }) => {
  // The page's frame, ahead of anything inside it that sets its own.
  const frame = page.locator("[data-design]").first();
  for (const [path, design] of [
    ["/", "play"],
    ["/adventure", "play"],
    ["/tutorial", "play"],
    ["/daily", "zen"],
    ["/daily/archive", "zen"],
    [DAY_ONE_L1, "zen"],
  ]) {
    await page.goto(path);
    await expect(frame, path).toHaveAttribute("data-design", design);
  }
});

test("the overview shows each window in its place's design", async ({ page }) => {
  await page.goto("/");
  // The windows share the page's frame; their contents take each section's look.
  const contents = (id: string) => page.getByTestId(id).locator("[data-design]");
  await expect(contents("overview-adventure")).toHaveAttribute("data-design", "play");
  await expect(contents("overview-daily")).toHaveAttribute("data-design", "zen");
});
