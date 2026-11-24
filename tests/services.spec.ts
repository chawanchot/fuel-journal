import { test, expect, type Page } from "@playwright/test";

async function addVehicle(page: Page, name: string) {
  await page.goto("/#vehicles");
  await page.getByRole("button", { name: "เพิ่มรถ", exact: true }).click();
  await page.getByLabel("ชื่อรถ", { exact: true }).fill(name);
  await page.getByRole("button", { name: "บันทึกรถ", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function addService(page: Page, withCost = true) {
  await page.goto("/#services");
  await page.getByRole("button", { name: "เพิ่มบันทึก", exact: true }).click();
  await page.getByLabel("วันที่เข้ารับบริการ", { exact: true }).fill("2026-01-10");
  await page.getByLabel("เลขไมล์ที่เข้ารับบริการ", { exact: true }).fill("20000");
  await page
    .getByLabel("รายการที่ทำ", { exact: true })
    .fill("เปลี่ยนน้ำมันเครื่อง\nเปลี่ยนไส้กรอง\nสลับยาง");
  if (withCost)
    await page.getByLabel("ค่าใช้จ่ายรวม", { exact: true }).fill("1800.50");
  await page.getByLabel("อู่ / ศูนย์บริการ", { exact: true }).fill("อู่ใกล้บ้าน");
  await page
    .getByLabel("หมายเหตุการซ่อมบำรุง", { exact: true })
    .fill("น้ำมันเครื่อง 5W-30");
  await page.getByRole("button", { name: "บันทึกซ่อมบำรุง", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("service history supports create edit filters vehicle isolation backup and cascade delete", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await addVehicle(page, "รถเซอร์วิส");
  await page
    .getByRole("navigation", { name: "เมนูหลัก", exact: true })
    .getByRole("link", { name: "ซ่อมบำรุง", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "สมุดซ่อมบำรุง." }),
  ).toBeVisible();
  await addService(page);
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveCount(7);
  await expect(page.locator(".service-row")).toContainText("20,000");
  await expect(page.locator(".service-items li")).toHaveCount(3);
  await expect(page.locator(".service-row")).toContainText("฿1,800.50");
  await expect(page.locator(".service-row")).toContainText("อู่ใกล้บ้าน");
  await page.reload();
  await expect(page.locator(".service-row")).toHaveCount(1);
  await page.goto("/#overview");
  await expect(page.locator(".spend-value")).toContainText("0.00");
  await page.goto("/#services");
  await page.getByRole("button", { name: /แก้ไขซ่อมบำรุง/ }).click();
  await expect(page.getByLabel("รายการที่ทำ", { exact: true })).toHaveValue(
    "เปลี่ยนน้ำมันเครื่อง\nเปลี่ยนไส้กรอง\nสลับยาง",
  );
  await page.getByLabel("ค่าใช้จ่ายรวม", { exact: true }).fill("2000");
  await page
    .getByLabel("รายการที่ทำ", { exact: true })
    .fill("เปลี่ยนน้ำมันเครื่อง\nเช็กเบรก");
  await page
    .getByRole("button", { name: "บันทึกการแก้ไขซ่อมบำรุง", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".service-items li")).toHaveCount(2);
  await expect(page.locator(".service-row")).toContainText("฿2,000.00");
  await page.getByLabel("ซ่อมบำรุงตั้งแต่วันที่", { exact: true }).fill("2026-02-01");
  await expect(page.locator(".service-row")).toHaveCount(0);
  await page.getByRole("button", { name: "ล้างตัวกรอง", exact: true }).click();
  await expect(page.locator(".service-row")).toHaveCount(1);
  await addVehicle(page, "รถอีกคัน");
  await page.goto("/#services");
  await expect(page.locator(".service-row")).toHaveCount(0);
  await page
    .getByLabel("รถที่ใช้งาน", { exact: true })
    .selectOption({ label: "รถเซอร์วิส" });
  await expect(page.locator(".service-row")).toHaveCount(1);
  await page.goto("/#vehicles");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "ส่งออกไฟล์สำรอง", exact: true })
    .click();
  const backup = await (await downloaded).path();
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/#services");
  await page.getByRole("button", { name: /ลบซ่อมบำรุง/ }).click();
  await expect(page.locator(".service-row")).toHaveCount(0);
  await page.goto("/#vehicles");
  await page.getByLabel("เลือกไฟล์สำรอง", { exact: true }).setInputFiles(backup!);
  await expect(page.getByRole("status")).toContainText("นำเข้าข้อมูลเรียบร้อยแล้ว");
  await page.goto("/#services");
  await expect(page.locator(".service-row")).toContainText("เช็กเบรก");
  await page.goto("/#vehicles");
  await page
    .getByRole("button", { name: "ลบรถ รถเซอร์วิส", exact: true })
    .click();
  await expect(page.locator(".vehicle-card")).toHaveCount(1);
  await page.reload();
  await page.goto("/#services");
  await expect(page.locator(".service-row")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("service records work offline, allow unknown and zero costs, and fit mobile navigation", async ({
  page,
  context,
}) => {
  await addVehicle(page, "รถออฟไลน์");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await page.setViewportSize({ width: 360, height: 800 });
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("navigation", { name: "เมนูมือถือ", exact: true })
    .getByRole("link", { name: "ซ่อมบำรุง", exact: true })
    .click();
  await addService(page, false);
  await expect(page.locator(".service-cost")).toContainText("ยังไม่ระบุ");
  await expect(page.locator(".service-summary")).toContainText("0 จาก 1");
  await page.reload();
  await expect(page.locator(".service-row")).toHaveCount(1);
  await page.getByRole("button", { name: /แก้ไขซ่อมบำรุง/ }).click();
  await page.getByLabel("ค่าใช้จ่ายรวม", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "บันทึกการแก้ไขซ่อมบำรุง", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".service-cost")).toContainText("฿0.00");
  for (const width of [320, 360, 390, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const nav = page.getByRole("navigation", {
      name: width <= 640 ? "เมนูมือถือ" : "เมนูหลัก",
      exact: true,
    });
    await expect(
      nav.getByRole("link", { name: "ซ่อมบำรุง", exact: true }),
    ).toBeVisible();
    if (width <= 640) {
      const boxes = await nav.getByRole("link").evaluateAll((links) =>
        links.map((link) => {
          const r = link.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width };
        }),
      );
      expect(boxes).toHaveLength(6);
      expect(
        boxes.every((b) => b.width >= 44 && b.left >= 0 && b.right <= width),
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const tableRegion = page.getByRole('region', {name:'ตารางประวัติซ่อมบำรุง เลื่อนแนวนอนได้'});
  expect(await tableRegion.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await tableRegion.evaluate(element => {element.scrollLeft = element.scrollWidth;});
  await expect(page.getByRole('button', {name:/แก้ไขซ่อมบำรุง/})).toBeInViewport();
  await tableRegion.evaluate(element => {element.scrollLeft = 0;});
  await page.screenshot({
    path: "test-results/mobile-services.png",
    fullPage: true,
  });
  await context.setOffline(false);
});

test("pre-service snapshots migrate and preserve existing vehicle data", async ({
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
        trips: [],
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
  await page.goto("/#services");
  await page.reload();
  await expect(page.getByLabel("รถที่ใช้งาน", { exact: true })).toContainText(
    "รถเดิม",
  );
  await addService(page);
  await page.reload();
  await expect(page.locator(".service-row")).toHaveCount(1);
  await page.goto("/#vehicles");
  await expect(page.locator(".vehicle-card")).toHaveCount(1);
});
