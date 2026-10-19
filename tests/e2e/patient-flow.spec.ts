import { expect, test, type Page } from "@playwright/test";

const STEP_URLS = ["/", "/safety", "/eligibility", "/confirm", "/questions", "/destination", "/share", "/waiting"];

async function describe(page: Page, text: string) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "What's going on?" }).fill(text);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/safety$/);
}

async function basics(page: Page) {
  await page.getByRole("button", { name: "None of these" }).click();
  await expect(page).toHaveURL(/\/eligibility$/);
  await page.getByRole("radiogroup", { name: "BC Personal Health Number" }).getByRole("radio", { name: "Yes" }).click();
  await page.getByLabel("Your age").fill("34");
  await page.getByRole("radiogroup", { name: "Long-term care" }).getByRole("radio", { name: "No" }).click();
  await page.getByRole("radiogroup", { name: "Lives in BC" }).getByRole("radio", { name: "Yes" }).click();
  await page.getByLabel("Any allergies to medicines?").fill("penicillin");
  await page.getByLabel("Medicines you take now").fill("none today");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/confirm$/);
}

async function tap(page: Page, ...labels: string[]) {
  for (const label of labels) await page.getByRole("button", { name: label, exact: true }).click();
}

test("a clean UTI reaches a pharmacy, shares, and waits", async ({ page }) => {
  await describe(page, "It burns when I pee");
  await basics(page);
  await expect(page.getByRole("heading")).toContainText("urinary tract infection");
  await tap(page, "Yes");

  await tap(page, "Under 2 days", "Burning", "Urgency", "Continue");
  for (let i = 0; i < 5; i++) await tap(page, "No");
  await tap(page, "None");

  await expect(page).toHaveURL(/\/destination$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Go to a pharmacy");
  await expect(page.getByText("Test Pharmacy A")).toBeVisible();
  await expect(page.getByTestId("reference-code")).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/);

  await tap(page, "Next");
  await expect(page).toHaveURL(/\/share$/);
  await page.getByLabel("First name").fill("Testy");
  await page.getByLabel("Date of birth").fill("1990-01-01");
  await tap(page, "Share with Test Pharmacy A");
  await expect(page).toHaveURL(/\/waiting$/);
  await expect(page.getByText("nothing was actually sent")).toBeVisible();
});

test("an emergency tick cannot be bypassed by deep link, reload or back", async ({ page }) => {
  await describe(page, "uti");
  await tap(page, "Chest pain or pressure");
  await expect(page).toHaveURL(/\/call-911$/);
  await expect(page.getByRole("link", { name: "Call 911" })).toHaveAttribute("href", "tel:911");

  for (const url of STEP_URLS) {
    await page.goto(url);
    await expect(page).toHaveURL(/\/call-911$/);
  }
  await page.reload();
  await expect(page).toHaveURL(/\/call-911$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/call-911$/);

  await tap(page, "I checked this by mistake");
  await expect(page).toHaveURL(/\/safety$/);
});

test("cannot skip the safety check", async ({ page }) => {
  await describe(page, "uti");
  await page.goto("/destination");
  await expect(page).toHaveURL(/\/safety$/);
});

test("an emergency answer stops the questions", async ({ page }) => {
  await describe(page, "my head hurts");
  await basics(page);
  await tap(page, "Yes");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Did this headache come on suddenly and severely?");
  await tap(page, "Yes");
  await expect(page).toHaveURL(/\/call-911$/);
  await expect(page.getByText("Headache came on suddenly and severely")).toBeVisible();

  await tap(page, "I answered this by mistake");
  await expect(page).toHaveURL(/\/questions$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Did this headache come on suddenly and severely?");
});

test("a problem not on the list routes to a doctor", async ({ page }) => {
  await describe(page, "sore throat");
  await basics(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Which of these is closest?");
  await page.getByRole("button", { name: /^Something else/ }).click();
  await expect(page).toHaveURL(/\/destination$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("See a doctor at a walk-in clinic");
  await expect(page.getByText("Test Walk-in Far")).toBeVisible();
});
