import { test, expect } from '@playwright/test';

test.use({ hasTouch: true });

test('trip menu restores the page when the URL already points to trips', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'ทุกการเติม มีเรื่องให้รู้.'})).toBeVisible();
  // A replaced URL does not dispatch hashchange, leaving the rendered route stale.
  await page.evaluate(() => history.replaceState(null, '', '#trips'));
  await page.getByRole('navigation', {name:'เมนูหลัก',exact:true}).getByRole('link',{name:'ทริป',exact:true}).click();
  await expect(page.getByRole('heading',{name:'ทริปของเรา.'})).toBeVisible();
});

for (const width of [360, 390, 768, 1024, 1280]) {
  test(`trip menu opens from every page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: width <= 640 ? 'เมนูมือถือ' : 'เมนูหลัก', exact: true });
    const trips = nav.getByRole('link', { name: 'ทริป', exact: true });
    for (const label of ['ภาพรวม', 'คำนวณ', 'ประวัติ', 'รถของฉัน']) {
      await nav.getByRole('link', { name: label, exact: true }).click();
      if (width <= 640) await trips.tap();
      else await trips.click();
      await expect(page).toHaveURL(/#trips$/);
      await expect(page.getByRole('heading', { name: 'ทริปของเรา.' })).toBeVisible();
      await expect(trips).toHaveAttribute('aria-current', 'page');
    }
    await page.reload();
    await expect(page.getByRole('heading', { name: 'ทริปของเรา.' })).toBeVisible();
    await nav.getByRole('link', { name: 'คำนวณ', exact: true }).click();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'ทริปของเรา.' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
