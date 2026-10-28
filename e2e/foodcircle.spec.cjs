// Use the CommonJS entry so Playwright's runner and tests share one suite context.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { expect, test } = require("@playwright/test");

test.describe("FoodCircle demo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("shows the feed and discloses local demo storage", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Buongiorno/ })).toBeVisible();
    await expect(page.getByText("DEMO LOCALE")).toBeVisible();
    await expect(page.getByText(/salvati solo in questo browser/)).toBeVisible();
  });

  test("creates a meal without inventing missing nutrient values", async ({ page }) => {
    await page.getByRole("button", { name: "Registra un pasto" }).click();
    await page.getByLabel("Che cosa hai mangiato?").fill("Zuppa di stagione");
    await page.getByRole("button", { name: "Salva pasto" }).click();
    await expect(page.getByRole("status")).toContainText("Pasto salvato nel diario privato");
    await page.getByRole("button", { name: "Diario", exact: true }).first().click();
    await expect(page.getByText("Zuppa di stagione")).toBeVisible();
    await expect(page.getByText("—").first()).toBeVisible();
  });

  test("allows a comment on an example post", async ({ page }) => {
    await page.getByRole("button", { name: "Mostra commenti" }).first().click();
    await page.getByRole("textbox", { name: "Aggiungi un commento" }).fill("Che bella idea!");
    await page.getByRole("button", { name: "Invia commento" }).first().click();
    await expect(page.getByText("Che bella idea!")).toBeVisible();
  });

  test("keeps privacy choices independent", async ({ page }) => {
    await page.getByRole("button", { name: "Profilo", exact: true }).first().click();
    const diarySelect = page.getByLabel("Visibilità: Diario alimentare");
    const nutritionSelect = page.getByLabel("Visibilità: Valori nutrizionali");
    await expect(diarySelect).toHaveValue("private");
    await expect(nutritionSelect).toHaveValue("private");
    await diarySelect.selectOption("followers");
    await expect(diarySelect).toHaveValue("followers");
    await expect(nutritionSelect).toHaveValue("private");
  });

  test("persists demo group membership in this browser", async ({ page }) => {
    await page.getByRole("button", { name: "Community", exact: true }).first().click();
    await page.getByRole("button", { name: "Unisciti" }).first().click();
    await expect(page.getByRole("button", { name: "Iscritto" }).first()).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Community", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Iscritto" }).first()).toBeVisible();
  });

  test("opens the diary from the weekly summary", async ({ page }) => {
    await page.getByRole("button", { name: "Apri diario" }).click();
    await expect(page.getByRole("heading", { name: "Diario alimentare" })).toBeVisible();
  });
});
