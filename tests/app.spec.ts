import { test, expect, type Page } from "@playwright/test";

async function addVehicle(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "เมนูหลัก", exact: true })
    .getByRole("link", { name: "รถของฉัน" })
    .click();
  await page.getByRole("button", { name: "เพิ่มรถ", exact: true }).click();
  await page.getByLabel("ชื่อรถ", { exact: true }).fill(name);
  await page.getByLabel("อัตราสิ้นเปลืองที่ทราบ (ไม่บังคับ)").fill("15");
  await page.getByRole("button", { name: "บันทึกรถ", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function fillup(
  page: Page,
  odometer: string,
  amount: string,
  litres: string,
  full: boolean,
) {
  await page
    .getByRole("navigation", { name: "เมนูหลัก", exact: true })
    .getByRole("link", { name: "ประวัติ", exact: true })
    .click();
  await page
    .getByRole("button", { name: "บันทึกเติมน้ำมัน", exact: true })
    .first()
    .click();
  await page.getByLabel("เลขไมล์", { exact: true }).fill(odometer);
  await page.getByLabel("ยอดจ่าย", { exact: true }).fill(amount);
  await page.getByRole("button", { name: "จำนวนลิตร", exact: true }).click();
  await page.getByLabel("จำนวนลิตร", { exact: true }).fill(litres);
  if (full) await page.getByRole("checkbox", { name: "เติมเต็มถัง" }).check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "บันทึกเติมน้ำมัน", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
test("vehicles, full/partial cycles, editing, persistence and backups", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await addVehicle(page, "รถไปทำงาน");
  await fillup(page, "10000", "1200", "30", true);
  await fillup(page, "10100", "400", "10", false);
  await fillup(page, "10400", "800", "20", true);
  await page.goto("/#overview");
  await expect(page.locator(".stat-card").first()).toContainText("13.33");
  await expect(page.locator(".stat-card").nth(1)).toContainText("3.00");
  await page.reload();
  await expect(page.locator(".stat-card").first()).toContainText("13.33");
  await addVehicle(page, "มอเตอร์ไซค์");
  await expect(page.locator(".vehicle-card")).toHaveCount(2);
  await page.goto("/#history");
  await expect(page.locator(".record-row")).toHaveCount(0);
  await page
    .getByLabel("รถที่ใช้งาน", { exact: true })
    .selectOption({ label: "รถไปทำงาน" });
  await expect(page.locator(".record-row")).toHaveCount(3);
  await page
    .locator(".record-row")
    .first()
    .getByRole("button", { name: /แก้ไขรายการ/ })
    .click();
  await page.getByLabel("ยอดจ่าย", { exact: true }).fill("1000");
  await page
    .getByRole("button", { name: "บันทึกการแก้ไข", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/#vehicles");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "ส่งออกไฟล์สำรอง", exact: true })
    .click();
  const download = await downloaded;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();
  await page.getByLabel("เลือกไฟล์สำรอง", { exact: true }).setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{bad"),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".vehicle-card")).toHaveCount(2);
  page.on("dialog", (d) => d.accept());
  await page
    .getByLabel("เลือกไฟล์สำรอง", { exact: true })
    .setInputFiles(backupPath!);
  await expect(page.getByRole("status")).toContainText(
    "นำเข้าข้อมูลเรียบร้อยแล้ว",
  );
  await page.goto("/#history");
  await expect(page.locator(".record-row")).toHaveCount(3);
  await page
    .locator(".record-row")
    .nth(1)
    .getByRole("button", { name: /ลบรายการ/ })
    .click();
  await expect(page.locator(".record-row")).toHaveCount(2);
  await page.goto("/#overview");
  await expect(page.locator(".stat-card").first()).toContainText(
    "รอรอบเต็มถัง",
  );
  expect(errors).toEqual([]);
});

test("all calculators show expected estimates and remember inputs", async ({
  page,
}) => {
  await page.goto("/#calculator");
  await page.getByLabel("ระยะทางเที่ยวเดียว", { exact: true }).fill("300");
  await page.getByLabel("อัตราสิ้นเปลือง", { exact: true }).fill("15");
  await page.getByLabel("ราคาน้ำมัน", { exact: true }).fill("40");
  await page.getByLabel("ทางด่วน / จอดรถ", { exact: true }).fill("200");
  await page.getByLabel("จำนวนคน", { exact: true }).fill("2");
  await expect(page.locator(".result-number")).toContainText("1,000.00");
  await expect(page.locator(".result-breakdown")).toContainText("500.00 บาท");
  await page.getByRole("checkbox", { name: "คำนวณไป–กลับ" }).check();
  await expect(page.locator(".result-number")).toContainText("1,800.00");
  await page.reload();
  await expect(
    page.getByLabel("ระยะทางเที่ยวเดียว", { exact: true }),
  ).toHaveValue("300");
  await page.getByRole("button", { name: "ความประหยัด", exact: true }).click();
  await page.getByLabel("ระยะทางที่วิ่ง", { exact: true }).fill("400");
  await page.getByLabel("น้ำมันที่ใช้", { exact: true }).fill("30");
  await expect(page.locator(".result-number")).toContainText("13.33");
  await page
    .getByRole("button", { name: "ระยะทาง / น้ำมัน", exact: true })
    .click();
  await page.getByLabel("ระยะทางที่วิ่ง", { exact: true }).fill("300");
  await page.getByLabel("อัตราสิ้นเปลือง", { exact: true }).fill("15");
  await expect(page.locator(".result-number")).toContainText("20.00");
  await page.getByLabel("ต้องการคำนวณ", { exact: true }).selectOption("budget");
  await page.getByLabel("งบน้ำมัน", { exact: true }).fill("800");
  await page.getByLabel("ราคาน้ำมัน", { exact: true }).fill("40");
  await expect(page.locator(".result-number")).toContainText("300");
});

test("trip efficiency units convert, persist and keep identical costs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#calculator");
  const efficiency = page.getByLabel("อัตราสิ้นเปลือง", { exact: true });
  const unit = page.getByLabel("หน่วยอัตราสิ้นเปลือง", { exact: true });
  await page.getByLabel("ระยะทางเที่ยวเดียว", { exact: true }).fill("300");
  await efficiency.fill("20");
  await page.getByLabel("ราคาน้ำมัน", { exact: true }).fill("40");
  await expect(page.locator(".result-number")).toContainText("600.00");
  await unit.selectOption("l100km");
  await expect(efficiency).toHaveValue("5");
  await expect(page.locator(".result-number")).toContainText("600.00");
  await expect(page.locator(".calculation-note")).toContainText(
    "ลิตร/100กม. ÷ 100",
  );
  await efficiency.fill("8");
  await expect(page.locator(".result-number")).toContainText("960.00");
  await page.reload();
  await expect(unit).toHaveValue("l100km");
  await expect(efficiency).toHaveValue("8");
  await expect(page.locator(".result-number")).toContainText("960.00");
  await unit.selectOption("kmpl");
  await expect(efficiency).toHaveValue("12.5");
  await expect(page.locator(".result-number")).toContainText("960.00");
  await unit.selectOption("l100km");
  await efficiency.fill("0");
  await expect(page.getByRole("alert")).toContainText("มากกว่า 0");
  await expect(page.locator(".result-number")).toContainText("—");
  await efficiency.fill("-5");
  await expect(page.getByRole("alert")).toContainText("มากกว่า 0");
  await efficiency.fill("");
  await expect(page.locator(".result-number")).toContainText("—");
  await page
    .getByRole("button", { name: "ระยะทาง / น้ำมัน", exact: true })
    .click();
  await expect(unit).toHaveCount(0);
});

test("trip units display vehicle and history rates without changing stored rates", async ({
  page,
}) => {
  await page.goto("/");
  await addVehicle(page, "รถทดสอบหน่วย");
  await fillup(page, "10000", "1200", "30", true);
  await fillup(page, "10400", "800", "20", true);
  await page.goto("/#calculator");
  await page.getByLabel("ระยะทางเที่ยวเดียว", { exact: true }).fill("300");
  await page.getByLabel("ราคาน้ำมัน", { exact: true }).fill("40");
  await page
    .getByLabel("หน่วยอัตราสิ้นเปลือง", { exact: true })
    .selectOption("l100km");
  await page
    .getByLabel("ใช้อัตราสิ้นเปลืองจาก", { exact: true })
    .selectOption("history");
  await expect(page.locator(".source-value")).toContainText("5.00");
  await expect(page.locator(".source-value")).toContainText("ลิตร/100กม.");
  await expect(page.locator(".result-number")).toContainText("600.00");
  await page
    .getByLabel("ใช้อัตราสิ้นเปลืองจาก", { exact: true })
    .selectOption("vehicle");
  await expect(page.locator(".source-value")).toContainText("6.67");
  await expect(page.locator(".result-number")).toContainText("800.00");
  await page
    .getByLabel("หน่วยอัตราสิ้นเปลือง", { exact: true })
    .selectOption("kmpl");
  await expect(page.locator(".source-value")).toContainText("15.00");
  await expect(page.locator(".result-number")).toContainText("800.00");
});

test("mobile and tablet views fit viewport and dialogs remain accessible", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [360, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      "overview",
      "calculator",
      "trips",
      "history",
      "vehicles",
    ]) {
      await page.goto(`/#${route}`);
      await expect(page.locator("h1")).toBeVisible();
      const fits = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(fits, `${route} width ${width}`).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#overview");
  await page.screenshot({
    path: "test-results/mobile-overview.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "เพิ่มรถคันแรก", exact: true })
    .click();
  await page.getByLabel("ชื่อรถ", { exact: true }).fill("รถมือถือ");
  await page.getByRole("button", { name: "บันทึกรถ", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "บันทึกเติมน้ำมัน", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-fillup.png",
    fullPage: true,
  });
});

test("offline app reopens and persists new records without network", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await addVehicle(page, "รถออฟไลน์");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("h1")).toBeVisible();
  await fillup(page, "1000", "400", "10", true);
  await page.reload();
  await expect(page.locator(".record-row")).toHaveCount(1);
  await expect(page.locator(".connection")).toContainText("ออฟไลน์");
  await context.setOffline(false);
});

test("concurrent tabs preserve both vehicle writes", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  await Promise.all([
    addVehicle(page, "รถแท็บแรก"),
    addVehicle(other, "รถแท็บสอง"),
  ]);
  await page.reload();
  await page.goto("/#vehicles");
  await expect(page.locator(".vehicle-card")).toHaveCount(2);
});

test("save failure keeps the form and does not report success", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (
      ...args: Parameters<IDBDatabase["transaction"]>
    ) {
      if (args[1] === "readwrite")
        throw new DOMException("Storage full", "QuotaExceededError");
      return transaction.apply(this, args);
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "เพิ่มรถคันแรก", exact: true })
    .click();
  await page.getByLabel("ชื่อรถ", { exact: true }).fill("รถที่ยังไม่บันทึก");
  await page.getByRole("button", { name: "บันทึกรถ", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("บันทึกไม่ได้");
  await expect(page.getByLabel("ชื่อรถ", { exact: true })).toHaveValue(
    "รถที่ยังไม่บันทึก",
  );
});
