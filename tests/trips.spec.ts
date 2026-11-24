import { test, expect, type Page } from "@playwright/test";

test("unnamed trip can start with mileage only, survive backup, then finish later", async ({
  page,
}) => {
  await vehicle(page, "รถเริ่มทริป");
  await page.goto("/#trips");
  await page.getByRole("button", { name: "เพิ่มทริป", exact: true }).click();
  await expect(page.getByLabel("ระบุระยะทาง", { exact: true })).toHaveValue("distance");
  const startOnly = page.getByRole("checkbox", { name: "บันทึกเลขไมล์เริ่มต้นไว้ก่อน" });
  await expect(startOnly).toBeVisible();
  const checkboxBox = await startOnly.boundingBox();
  const dateBox = await page.getByLabel("วันเริ่มทริป", { exact: true }).boundingBox();
  expect(checkboxBox!.y).toBeLessThan(dateBox!.y);
  await page
    .getByRole("checkbox", { name: "บันทึกเลขไมล์เริ่มต้นไว้ก่อน" })
    .check();
  await expect(page.getByLabel("ระบุระยะทาง", { exact: true })).toHaveValue("odometer");
  await page.getByLabel("เลขไมล์เริ่มทริป", { exact: true }).fill("10000");
  await page
    .getByRole("button", { name: "บันทึกทริปที่ยังไม่จบ", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".trip-card")).toContainText("ทริปวันที่");
  await expect(page.locator(".trip-card")).toContainText("กำลังเดินทาง");
  await expect(page.locator(".trip-card")).toContainText("รอเลขไมล์จบ");
  await expect(page.locator(".trip-metrics")).toContainText("—");
  await page.reload();
  await expect(page.locator(".trip-card")).toContainText("กำลังเดินทาง");
  await page.goto("/#vehicles");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "ส่งออกไฟล์สำรอง", exact: true })
    .click();
  const backup = await (await downloaded).path();
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByLabel("เลือกไฟล์สำรอง", { exact: true })
    .setInputFiles(backup!);
  await expect(page.getByRole("status")).toContainText(
    "นำเข้าข้อมูลเรียบร้อยแล้ว",
  );
  await page.goto("/#trips");
  await page
    .getByRole("button", { name: "กรอกเลขไมล์จบทริป", exact: true })
    .click();
  await expect(page.getByLabel("ชื่อทริป", { exact: true })).toHaveValue("");
  await expect(
    page.getByLabel("เลขไมล์เริ่มทริป", { exact: true }),
  ).toHaveValue("10000");
  await page
    .getByRole("button", { name: "จบทริปและกรอกเลขไมล์", exact: true })
    .click();
  await page.getByLabel("เลขไมล์จบทริป", { exact: true }).fill("10300");
  await page.getByRole("button", { name: "บันทึกจบทริป", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".trip-card")).toContainText("300.00");
  await expect(page.locator(".trip-card")).not.toContainText("กำลังเดินทาง");
  await expect(page.locator(".trip-card")).toContainText(
    "ยังไม่มีข้อมูลน้ำมัน",
  );
  await page
    .locator(".trip-card")
    .getByRole("button", { name: /แก้ไขทริป/ })
    .click();
  await page.getByLabel("อัตราสิ้นเปลืองของทริป", { exact: true }).fill("15");
  await page
    .getByRole("button", { name: "บันทึกการแก้ไขทริป", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".trip-card")).toContainText("20.00");
  await page.reload();
  await expect(page.locator(".trip-card")).toContainText("300.00");
  await expect(page.locator(".trip-card")).toContainText("20.00");
});

async function vehicle(page: Page, name: string) {
  await page.goto("/#vehicles");
  await page.getByRole("button", { name: "เพิ่มรถ", exact: true }).click();
  await page.getByLabel("ชื่อรถ", { exact: true }).fill(name);
  await page.getByLabel("อัตราสิ้นเปลืองที่ทราบ (ไม่บังคับ)").fill("20");
  await page.getByRole("button", { name: "บันทึกรถ", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function newTrip(page: Page) {
  await page.goto("/#trips");
  await page.getByRole("button", { name: "เพิ่มทริป", exact: true }).click();
  await page.getByLabel("ชื่อทริป", { exact: true }).fill("เขาใหญ่กับครอบครัว");
  await page
    .getByLabel("ระบุระยะทาง", { exact: true })
    .selectOption("odometer");
  await page.getByLabel("เลขไมล์เริ่มทริป", { exact: true }).fill("10000");
  await page.getByLabel("เลขไมล์จบทริป", { exact: true }).fill("10400");
  await page
    .getByLabel("ใช้อัตราสิ้นเปลืองจาก", { exact: true })
    .selectOption("vehicle");
  await page
    .getByLabel("หน่วยอัตราสิ้นเปลือง", { exact: true })
    .selectOption("l100km");
  await expect(
    page.getByLabel("อัตราสิ้นเปลืองของทริป", { exact: true }),
  ).toHaveValue("5");
  await page.getByLabel("ราคาน้ำมันของทริป", { exact: true }).fill("40");
  await page.getByLabel("ค่าใช้จ่ายเพิ่มเติม", { exact: true }).fill("200");
  await page
    .getByLabel("บันทึกเกี่ยวกับทริป", { exact: true })
    .fill("แวะคาเฟ่ระหว่างทาง");
  await expect(page.locator(".trip-preview")).toContainText("20.00 ลิตร");
  await page.getByRole("button", { name: "บันทึกทริป", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("trip odometers, snapshot rates, edit actual fuel, backups, filtering and vehicle deletion", async ({
  page,
}) => {
  await vehicle(page, "รถเที่ยว");
  await newTrip(page);
  await expect(page.locator(".trip-card")).toContainText("400.00");
  await expect(page.locator(".trip-card")).toContainText("20.00");
  await expect(page.locator(".trip-cost.total")).toContainText("1,000.00");
  await expect(page.locator(".trip-detail")).toContainText(
    "จากค่าของรถ ณ วันบันทึก",
  );
  await page.reload();
  await expect(page.locator(".trip-card")).toHaveCount(1);
  await page.goto("/#overview");
  await expect(page.locator(".spend-value")).toContainText("0.00");
  await page.goto("/#vehicles");
  await page
    .getByRole("button", { name: "แก้ไขรถ รถเที่ยว", exact: true })
    .click();
  await page.getByLabel("อัตราสิ้นเปลืองที่ทราบ (ไม่บังคับ)").fill("10");
  await page.getByRole("button", { name: "บันทึกรถ", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/#trips");
  await expect(page.locator(".trip-card")).toContainText("20.00");
  await expect(page.locator(".trip-cost.total")).toContainText("1,000.00");
  await page
    .getByRole("button", { name: "แก้ไขทริป เขาใหญ่กับครอบครัว", exact: true })
    .click();
  await page
    .getByLabel("น้ำมันที่ใช้ในทริป", { exact: true })
    .selectOption("actual");
  await page.getByLabel("น้ำมันที่ใช้จริง", { exact: true }).fill("25");
  await page
    .getByRole("button", { name: "บันทึกการแก้ไขทริป", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".trip-card")).toContainText(
    "น้ำมันที่ใช้ (กรอกจริง)",
  );
  await expect(page.locator(".trip-cost.total")).toContainText("1,200.00");
  await page.getByLabel("ทริปถึงวันที่", { exact: true }).fill("2020-01-01");
  await expect(page.locator(".trip-card")).toHaveCount(0);
  await page.getByRole("button", { name: "ล้างตัวกรอง", exact: true }).click();
  await expect(page.locator(".trip-card")).toHaveCount(1);
  await vehicle(page, "รถอีกคัน");
  await page.goto("/#trips");
  await expect(page.locator(".trip-card")).toHaveCount(0);
  await page
    .getByLabel("รถที่ใช้งาน", { exact: true })
    .selectOption({ label: "รถเที่ยว" });
  await expect(page.locator(".trip-card")).toHaveCount(1);
  await page.goto("/#vehicles");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "ส่งออกไฟล์สำรอง", exact: true })
    .click();
  const backup = await (await downloaded).path();
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/#trips");
  await page
    .getByRole("button", { name: "ลบทริป เขาใหญ่กับครอบครัว", exact: true })
    .click();
  await expect(page.locator(".trip-card")).toHaveCount(0);
  await page.goto("/#vehicles");
  await page
    .getByLabel("เลือกไฟล์สำรอง", { exact: true })
    .setInputFiles(backup!);
  await expect(page.getByRole("status")).toContainText(
    "นำเข้าข้อมูลเรียบร้อยแล้ว",
  );
  await page.goto("/#trips");
  await expect(page.locator(".trip-cost.total")).toContainText("1,200.00");
  await page.goto("/#vehicles");
  await page
    .getByRole("button", { name: "ลบรถ รถเที่ยว", exact: true })
    .click();
  await expect(page.locator(".vehicle-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".vehicle-card")).toHaveCount(1);
});

test("mobile trip form works offline with optional price and no horizontal overflow", async ({
  page,
  context,
}) => {
  await vehicle(page, "รถออฟไลน์");
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/#trips");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("navigation", { name: "เมนูมือถือ", exact: true })
    .getByRole("link", { name: "ทริป", exact: true })
    .click();
  await page.getByRole("button", { name: "เพิ่มทริป", exact: true }).click();
  await page.getByLabel("ชื่อทริป", { exact: true }).fill("เที่ยวใกล้บ้าน");
  await page.getByLabel("ระยะทางรวมของทริป", { exact: true }).fill("120");
  await page.getByLabel("อัตราสิ้นเปลืองของทริป", { exact: true }).fill("15");
  await page.getByRole("button", { name: "บันทึกทริป", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".trip-card")).toContainText("8.00");
  await expect(page.locator(".trip-card")).toContainText("ยังไม่ได้ระบุราคา");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-trips.png",
    fullPage: true,
  });
  await context.setOffline(false);
});

test("old stored snapshot and backup without trips retain vehicle data", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const request = indexedDB.open("fuel", 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("snapshots", "readwrite");
    tx.objectStore("snapshots").put(
      {
        vehicles: [
          {
            id: "legacy",
            name: "รถเดิม",
            type: "car",
            fuelType: "E20",
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: "2025-01-01T00:00:00Z",
          },
        ],
        fillups: [],
        settings: {
          schemaVersion: 1,
          calculatorInputs: {},
          activeVehicleId: "legacy",
        },
      },
      "current",
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto("/#trips");
  await page.reload();
  await expect(page.getByLabel("รถที่ใช้งาน", { exact: true })).toContainText(
    "รถเดิม",
  );
  await expect(page.locator(".trip-card")).toHaveCount(0);
  await page.getByRole("button", { name: "เพิ่มทริป", exact: true }).click();
  await page.getByLabel("ชื่อทริป", { exact: true }).fill("ทริปใหม่");
  await page.getByLabel("ระยะทางรวมของทริป", { exact: true }).fill("120");
  await page.getByLabel("อัตราสิ้นเปลืองของทริป", { exact: true }).fill("15");
  await page.getByRole("button", { name: "บันทึกทริป", exact: true }).click();
  await expect(page.locator(".trip-card")).toHaveCount(1);
});
