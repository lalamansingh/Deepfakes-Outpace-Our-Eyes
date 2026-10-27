import { expect, test } from "@playwright/test";

test("a teacher creates a class, a student joins and plays, the teacher sees them", async ({ browser }) => {
  const teacherCtx = await browser.newContext();
  const teacher = await teacherCtx.newPage();
  const email = `teacher-${Date.now()}@school.test`;

  await teacher.goto("/staff/register");
  await teacher.getByLabel("Your name").fill("Ms Rivera");
  await teacher.getByLabel("School email").fill(email);
  await teacher.getByLabel("Password", { exact: true }).fill("a-very-long-password");
  await teacher.getByRole("button", { name: /create account|sign up|register/i }).click();
  await expect(teacher).toHaveURL(/\/teacher/);

  await teacher.getByLabel("Class name").fill("10B Media literacy");
  await teacher.getByRole("button", { name: "Create class" }).click();
  const codeText = await teacher.getByText(/^[A-HJ-NP-Z2-9]{6}$/).first().textContent();
  const code = codeText!.trim();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

  const studentCtx = await browser.newContext();
  const student = await studentCtx.newPage();
  await student.goto("/join");
  await student.getByLabel(/code/i).fill(code);
  await student.getByLabel(/nickname/i).fill("Alex");
  await student.getByRole("button", { name: /join/i }).click();
  await expect(student.getByText("10B Media literacy").first()).toBeVisible();

  await student.goto("/practice");
  for (let i = 0; i < 3; i++) {
    await student.getByRole("button", { name: /^Rendered/ }).click();
    await student.getByRole("button", { name: "Lock in answer" }).click();
    await expect(student.locator("#reveal-heading")).toBeVisible();
    await student.getByRole("button", { name: "Next item" }).click();
  }

  await teacher.getByRole("link", { name: /Open dashboard for 10B Media literacy/ }).click();
  await expect(teacher.getByText("Alex").first()).toBeVisible();

  await teacherCtx.close();
  await studentCtx.close();
});

test("the admin studio is protected and works for admins", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/staff\/login/);
  await page.getByLabel("Email").fill("admin@e2e.test");
  await page.getByLabel("Password").fill("e2e-admin-password");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/admin/);
  await page.goto("/admin/items");
  await expect(page.getByRole("link", { name: /new item/i })).toBeVisible();
});
