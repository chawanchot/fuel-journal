import assert from 'node:assert/strict'
import { preview } from 'vite'
import { chromium } from '@playwright/test'

const server = await preview({ base: '/fuel/', build: { outDir: 'dist-subpath' }, preview: { host: '127.0.0.1', port: 4174, strictPort: true } })
const browser = await chromium.launch()
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const failures = []
  page.on('pageerror', error => failures.push(error.message))
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`) })
  await page.goto('http://127.0.0.1:4174/fuel/#calculator')
  await page.getByLabel('ระยะทางเที่ยวเดียว', { exact: true }).fill('300')
  await page.getByLabel('อัตราสิ้นเปลือง', { exact: true }).fill('15')
  await page.getByLabel('ราคาน้ำมัน', { exact: true }).fill('40')
  await page.locator('.result-number').filter({ hasText: '800.00' }).waitFor()
  const manifest = await (await context.request.get('http://127.0.0.1:4174/fuel/manifest.webmanifest')).json()
  assert.equal(manifest.scope, '/fuel/')
  assert.equal(manifest.start_url, '/fuel/')
  assert(manifest.icons.every(icon => icon.src.startsWith('/fuel/')))
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  assert.equal(scope, 'http://127.0.0.1:4174/fuel/')
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await page.getByLabel('ระยะทางเที่ยวเดียว', { exact: true }).waitFor()
  assert.equal(await page.getByLabel('ระยะทางเที่ยวเดียว', { exact: true }).inputValue(), '300')
  assert.equal(await page.locator('.result-number').innerText(), '800.00')
  await page.screenshot({ path: 'test-results/subpath-offline-calculator.png', fullPage: true })
  assert.deepEqual(failures, [])
  console.log('PASS: /fuel/ assets, manifest, SW scope, deep link, remembered inputs and offline reload')
} finally {
  await browser.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
