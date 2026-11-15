// Снимок демо Nova в Chromium: поднимает маленький HTTP-сервер для public/, открывает страницу с ?shot,
// ждёт window.__ready, сохраняет PNG. Запуск: node tools/shot.mjs [выход.png] [ширина] [высота] [масштаб]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'public')
const out = process.argv[2] || 'shots/demo.png'
const W = +(process.argv[3] || 1280), H = +(process.argv[4] || 720), S = +(process.argv[5] || 1)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' }

const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    const idx = path.join(root, 'index.html')
    if (req.url === '/' || req.url.startsWith('/?')) { res.writeHead(200, { 'content-type': 'text/html' }); return fs.createReadStream(idx).pipe(res) }
    res.writeHead(404); return res.end()
  }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})
await new Promise((r) => srv.listen(0, r))
const port = srv.address().port
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: S })
page.on('console', (m) => console.log('[page]', m.text()))
page.on('pageerror', (e) => console.log('[error]', e.message))
await page.goto(`http://127.0.0.1:${port}/?shot`)
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 })
await page.waitForTimeout(300)
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
await page.screenshot({ path: out })
console.log('снимок:', out, await page.evaluate(() => document.getElementById('stats')?.textContent))
await browser.close()
srv.close()
