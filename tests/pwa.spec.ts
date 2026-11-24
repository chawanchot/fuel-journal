import { test, expect } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'

const mime:Record<string,string>={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2'}
async function host(directory:string,base:string) {
  let version=1
  const root=resolve(directory)
  const server=createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url??'/', 'http://localhost').pathname)
      if(!pathname.startsWith(base)){res.writeHead(404);res.end();return}
      const relative=pathname.slice(base.length)||'index.html'
      const file=resolve(root,relative)
      if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
      const body=await readFile(file)
      res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store'})
      res.end(relative==='sw.js'?`${body.toString()}\n// integration build ${version}\n`:body)
    }catch{res.writeHead(404);res.end()}
  })
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done))
  const address=server.address() as {port:number}
  return {server,url:`http://127.0.0.1:${address.port}${base}`,next:()=>version++}
}
async function close(server:Server){server.closeAllConnections();await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()))}

test('GitHub Pages subpath serves assets manifest hash routes and offline reopen',async({page,context})=>{
  const app=await host('dist-subpath','/fuel/')
  try{
    const failures:string[]=[]
    page.on('response',r=>{if(r.status()>=400)failures.push(r.url())})
    await page.goto(app.url+'#calculator')
    await expect(page.getByRole('heading',{name:'คำนวณก่อนออกเดินทาง.'})).toBeVisible()
    const manifest=await page.evaluate(async()=>{const link=document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!;return (await fetch(link.href)).json()})
    expect(manifest.start_url).toBe('/fuel/')
    expect(manifest.scope).toBe('/fuel/')
    await page.evaluate(async()=>{await navigator.serviceWorker.ready})
    await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true)
    const scope=await page.evaluate(async()=>(await navigator.serviceWorker.ready).scope)
    expect(scope).toBe(app.url)
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading',{name:'คำนวณก่อนออกเดินทาง.'})).toBeVisible()
    await page.getByLabel('ระยะทางเที่ยวเดียว',{exact:true}).fill('120')
    await page.getByLabel('อัตราสิ้นเปลือง',{exact:true}).fill('12')
    await page.getByLabel('ราคาน้ำมัน',{exact:true}).fill('40')
    await expect(page.locator('.result-number')).toContainText('400.00')
    expect(failures).toEqual([])
  }finally{await context.setOffline(false);await close(app.server)}
})

test('manual check finds rapid updates and preserves saved data',async({page})=>{
  const app=await host('dist','/')
  try{
    await page.goto(app.url+'#vehicles')
    await page.evaluate(async()=>{await navigator.serviceWorker.ready})
    await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true)
    await page.getByRole('button',{name:'ตรวจสอบอัปเดต',exact:true}).click()
    await expect(page.getByRole('status')).toContainText('เวอร์ชันล่าสุดที่เผยแพร่แล้ว')
    app.next()
    await page.getByRole('button',{name:'ตรวจสอบอัปเดต',exact:true}).click()
    await expect(page.getByRole('button',{name:'อัปเดตตอนนี้',exact:true})).toBeVisible()
    await expect(page.getByRole('status')).toContainText('พบเวอร์ชันใหม่')
    await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'อัปเดตตอนนี้',exact:true}).click()])
    await expect(page.getByRole('button',{name:'อัปเดตตอนนี้',exact:true})).toHaveCount(0)
  }finally{await close(app.server)}
})

test('new service worker waits for form save and preserves IndexedDB after update',async({page})=>{
  const app=await host('dist','/')
  try{
    // Avoid Workbox's first-minute external-update heuristic without a real time delay.
    await page.addInitScript(()=>{const NativeDate=Date;let current=NativeDate.now();let offset=0;Object.defineProperty(window,'__advanceSwClock',{value:()=>{offset=120000}});Date.now=()=>NativeDate.now()+offset;void current})
    await page.goto(app.url)
    await page.evaluate(async()=>{await navigator.serviceWorker.ready})
    await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true)
    await page.getByRole('button',{name:'เพิ่มรถคันแรก',exact:true}).click()
    await page.getByLabel('ชื่อรถ',{exact:true}).fill('รถหลังอัปเดต')
    app.next()
    await page.evaluate(async()=>{(window as unknown as {__advanceSwClock:()=>void}).__advanceSwClock();await (await navigator.serviceWorker.ready).update()})
    await expect(page.getByRole('button',{name:'อัปเดตตอนนี้'})).toBeDisabled()
    await expect(page.getByLabel('ชื่อรถ',{exact:true})).toHaveValue('รถหลังอัปเดต')
    await page.getByRole('button',{name:'บันทึกรถ',exact:true}).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button',{name:'อัปเดตตอนนี้'})).toBeEnabled()
    await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'อัปเดตตอนนี้'}).click()])
    await expect(page.getByLabel('รถที่ใช้งาน',{exact:true})).toContainText('รถหลังอัปเดต')
    await expect(page.getByRole('button',{name:'อัปเดตตอนนี้'})).toHaveCount(0)
  }finally{await close(app.server)}
})
