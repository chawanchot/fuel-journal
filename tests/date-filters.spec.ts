import { expect, test } from '@playwright/test';

for (const width of [320, 360, 390, 430]) {
  test(`trip and history dates stay on one row at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['trips', 'history']) {
      await page.goto(`/#${route}`);
      const dates = page.locator('.date-range-controls input[type="date"]');
      await expect(dates).toHaveCount(2);
      for (const populated of [false, true]) {
        if (populated) {
          await dates.first().fill('2026-01-01');
          await dates.last().fill('2026-10-01');
        }
        const first = (await dates.first().boundingBox())!;
        const last = (await dates.last().boundingBox())!;
        expect(Math.abs(first.y - last.y)).toBeLessThan(1);
        expect(first.height).toBe(44);
        expect(last.height).toBe(44);
        expect(first.x + first.width).toBeLessThan(last.x);
        expect(last.x + last.width).toBeLessThanOrEqual(width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
  });
}
