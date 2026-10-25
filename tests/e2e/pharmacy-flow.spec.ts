import { expect, test, type Page } from "@playwright/test";

// The pharmacy side of the pitch: a patient is routed to the demo pharmacy,
// shares, the pharmacist runs the assessment from the helper, and the $20
// counter goes up whether they prescribe or refer.

async function tap(page: Page, ...labels: string[]) {
  for (const label of labels) await page.getByRole("button", { name: label, exact: true }).click();
}

async function cleanUti(page: Page, firstName: string, phn: "Yes" | "No") {
  await page.goto("/");
  await page.getByRole("textbox", { name: "What's going on?" }).fill("It burns when I pee");
  await tap(page, "Continue", "None of these");
  await page.getByRole("radiogroup", { name: "BC Personal Health Number" }).getByRole("radio", { name: phn, exact: true }).click();
  await page.getByLabel("Your age").fill("29");
  await page.getByRole("radiogroup", { name: "Long-term care" }).getByRole("radio", { name: "No" }).click();
  await page.getByRole("radiogroup", { name: "Lives in BC" }).getByRole("radio", { name: "Yes" }).click();
  await page.getByLabel("Any allergies to medicines?").fill("sulfa drugs");
  await page.getByLabel("Medicines you take now").fill("none");
  await tap(page, "Continue", "Yes");
  await tap(page, "Under 2 days", "Burning", "Urgency", "Continue");
  for (let i = 0; i < 5; i++) await tap(page, "No");
  await tap(page, "None");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Go to a pharmacy");
  await tap(page, "Next");
  await page.getByLabel("First name").fill(firstName);
  await page.getByLabel("Date of birth").fill("1997-02-03");
  await tap(page, "Share with ClinIQ Demo Pharmacy");
  await expect(page).toHaveURL(/\/waiting$/);
}

test("the pharmacist assesses from the helper and the $20 counter goes up", async ({ context }) => {
  const pharmacy = await context.newPage();
  await pharmacy.goto("/pharmacy");
  await pharmacy.getByLabel("I understand").check();
  await pharmacy.getByRole("button", { name: "Continue" }).click();
  const counter = pharmacy.getByTestId("assessment-counter");
  await expect(counter).toContainText("0");

  const patient = await context.newPage();
  await cleanUti(patient, "Priya", "Yes");

  const row = pharmacy.getByRole("button", { name: /Priya/ });
  await expect(row).toContainText("Waiting");
  await row.click();

  await expect(pharmacy.getByRole("heading", { name: "Priya" })).toBeVisible();
  await expect(pharmacy.getByText("In assessment")).toBeVisible();
  await expect(pharmacy.getByTestId("eligibility")).toContainText("Eligible for the $20 PharmaCare assessment fee");
  await expect(pharmacy.getByText("Fever, back pain, or vomiting?")).toBeVisible();
  await expect(pharmacy.getByText("sulfa drugs")).toBeVisible();
  await expect(pharmacy.getByText("What you can prescribe for this condition")).toBeVisible();

  await tap(pharmacy, "Prescribed");
  await expect(pharmacy).toHaveURL(/\/pharmacy$/);
  await expect(row).toContainText("Prescribed");
  await expect(counter).toContainText("1 × $20 PharmaCare fee = $20");

  // A second patient, on their own phone (tab). No PHN: the assessment still
  // counts, but PharmaCare doesn't pay for it.
  const second = await context.newPage();
  await cleanUti(second, "Sam", "No");
  await expect(pharmacy.getByRole("button", { name: /Priya/ })).toContainText("Prescribed");
  await pharmacy.getByRole("button", { name: /Sam/ }).click();
  await expect(pharmacy.getByTestId("eligibility")).toContainText("Not covered by PharmaCare");
  await tap(pharmacy, "Referred to a doctor");
  await expect(pharmacy.getByRole("button", { name: /Sam/ })).toContainText("Referred to a doctor");
  await expect(counter).toContainText("2");
  await expect(counter).toContainText("1 × $20 PharmaCare fee = $20");
});

test("clinic and pharmacy each see only the patients shared with them", async ({ context }) => {
  const patient = await context.newPage();
  await cleanUti(patient, "Priya", "Yes");

  const clinic = await context.newPage();
  await clinic.goto("/clinic");
  await clinic.getByLabel("I understand").check();
  await clinic.getByRole("button", { name: "Continue" }).click();
  await expect(clinic.getByText("No patients yet")).toBeVisible();
});
