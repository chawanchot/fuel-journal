import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const publicDirectory = new URL('../public/', import.meta.url)
const source = await readFile(new URL('icon.svg', publicDirectory))
const background = '#F6F2E7'

await Promise.all([
  ...[
    ['pwa-192x192.png', 192],
    ['pwa-512x512.png', 512],
    ['apple-touch-icon.png', 180],
  ].map(([filename, size]) =>
    sharp(source, { density: 192 })
      .resize(size, size)
      .flatten({ background })
      .png()
      .toFile(fileURLToPath(new URL(filename, publicDirectory))),
  ),
  // Padding keeps the complete mark inside the maskable icon's safe circle.
  sharp(source, { density: 192 })
    .resize(384, 384)
    .extend({ top: 64, right: 64, bottom: 64, left: 64, background })
    .flatten({ background })
    .png()
    .toFile(fileURLToPath(new URL('maskable-512x512.png', publicDirectory))),
])

console.log('Generated PWA icons (192, 512, maskable 512) and Apple touch icon (180).')
