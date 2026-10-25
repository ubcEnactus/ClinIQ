import { expect, test, type Page } from "@playwright/test";

// The pitch-video flow: the clinic screen is open, a patient is routed to
// the demo clinic, shares, and appears on the clinic's screen without a reload.

async function tap(page: Page, ...labels: string[]) {
  for (const label of labels) await page.getByRole("button", { name: label, exact: true }).click();
}

async function patientRoutedToDemoClinic(page: Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "What's going on?" }).fill("It burns when I pee and I have a fever");
  await tap(page, "Continue", "None of these");
  await page.getByRole("radiogroup", { name: "BC Personal Health Number" }).getByRole("radio", { name: "Yes" }).click();
  await page.getByLabel("Your age").fill("34");
  await page.getByRole("radiogroup", { name: "Long-term care" }).getByRole("radio", { name: "No" }).click();
  await page.getByRole("radiogroup", { name: "Lives in BC" }).getByRole("radio", { name: "Yes" }).click();
  await page.getByLabel("Any allergies to medicines?").fill("penicillin, gives me hives");
  await page.getByLabel("Medicines you take now").fill("birth control pill");
  await tap(page, "Continue", "Yes");
  await tap(page, "2 to 7 days", "Burning", "Frequency", "Continue");
  await tap(page, "Yes"); // fever, back pain or vomiting -> physician
  for (let i = 0; i < 4; i++) await tap(page, "No");
  await page.getByRole("textbox", { name: "Your answer" }).fill("penicillin");
  await tap(page, "Continue");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("See a doctor at a walk-in clinic");
  await expect(page.getByText("ClinIQ Demo Clinic").first()).toBeVisible();
  return (await page.getByTestId("reference-code").textContent())!;
}

test("a patient shares with the demo clinic and appears on its screen live", async ({ context }) => {
  const clinic = await context.newPage();
  await clinic.goto("/clinic");
  await expect(clinic.getByRole("heading", { name: "Before you start today" })).toBeVisible();
  await expect(clinic.getByRole("button", { name: "Continue" })).toBeDisabled();
  await clinic.getByLabel("I understand").check();
  await clinic.getByRole("button", { name: "Continue" }).click();
  await expect(clinic.getByText("No patients yet")).toBeVisible();

  const patient = await context.newPage();
  const code = await patientRoutedToDemoClinic(patient);
  await tap(patient, "Next");
  await patient.getByLabel("First name").fill("Maya");
  await patient.getByLabel("Date of birth").fill("1991-04-12");
  await tap(patient, "Share with ClinIQ Demo Clinic");
  await expect(patient).toHaveURL(/\/waiting$/);

  // No reload: the clinic list updates on its own.
  const row = clinic.getByRole("button", { name: /Maya/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Urinary tract infection");
  await expect(row).toContainText(code);
  await expect(row).toContainText("Waiting");

  await row.click();
  await expect(clinic).toHaveURL(/\/clinic\/patient\?id=/);
  await expect(clinic.getByRole("heading", { name: "Maya" })).toBeVisible();
  await expect(clinic.getByText("34-year-old with urinary symptoms (burning and frequency) for 2 to 7 days.")).toBeVisible();
  await expect(clinic.getByText("Fever, back pain or vomiting suggests a possible kidney infection")).toBeVisible();
  await expect(clinic.getByText("penicillin, gives me hives")).toBeVisible();
  await expect(clinic.getByText("It burns when I pee and I have a fever")).toBeVisible();

  await clinic.getByRole("button", { name: "Seen" }).click();
  await expect(clinic).toHaveURL(/\/clinic$/);
  await expect(clinic.getByRole("button", { name: /Maya/ })).toContainText("Seen");
  await expect(clinic.getByText("0 waiting · 1 seen today")).toBeVisible();
});

test("a walk-in's code opens their answers only with matching name and date of birth", async ({ context }) => {
  const patient = await context.newPage();
  const code = await patientRoutedToDemoClinic(patient);
  await tap(patient, "Next");
  await patient.getByLabel("First name").fill("Maya");
  await patient.getByLabel("Date of birth").fill("1991-04-12");
  await tap(patient, "Share with ClinIQ Demo Clinic");

  const clinic = await context.newPage();
  await clinic.goto("/clinic");
  await clinic.getByLabel("I understand").check();
  await clinic.getByRole("button", { name: "Continue" }).click();

  await clinic.getByLabel("Enter a patient's code").fill(code.toLowerCase());
  await clinic.getByRole("button", { name: "Look up" }).click();
  await clinic.getByLabel("Patient's first name").fill("Maya");
  await clinic.getByLabel("Patient's date of birth").fill("1990-01-01");
  await clinic.getByRole("button", { name: "Open answers" }).click();
  await expect(clinic.getByText("doesn't match")).toBeVisible();
  await expect(clinic).toHaveURL(/\/clinic$/);

  await clinic.getByLabel("Patient's date of birth").fill("1991-04-12");
  await clinic.getByRole("button", { name: "Open answers" }).click();
  await expect(clinic.getByRole("heading", { name: "Maya" })).toBeVisible();
});

test("the clinic summary can't be opened before today's confirmation", async ({ page }) => {
  await page.goto("/clinic/patient?id=anything");
  await expect(page).toHaveURL(/\/clinic$/);
  await expect(page.getByRole("heading", { name: "Before you start today" })).toBeVisible();
});
