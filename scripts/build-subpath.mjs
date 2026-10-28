import { build } from 'vite'

process.env.VITE_BASE_PATH = '/fuel/'
await build({ build: { outDir: 'dist-subpath' } })
