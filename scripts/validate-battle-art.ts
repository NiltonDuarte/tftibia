import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const css = await readFile(resolve(root, 'src/App.module.css'), 'utf8')
const mappedPaths = [...css.matchAll(/--battle-scene:\s*url\('([^']+\.png)'\)/g)]
  .map((match) => match[1])
const assets = [...new Set(mappedPaths)]

if (assets.length !== 5) {
  throw new Error(`Expected 5 unique mapped battle scenes, found ${assets.length}.`)
}

for (const assetPath of assets) {
  if (!assetPath) throw new Error('A battle scene mapping has no asset path.')
  const file = await readFile(resolve(root, 'public', assetPath.replace(/^\//, '')))
  const isPng = file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (!isPng || file.length < 24) throw new Error(`${assetPath} is not a valid PNG.`)
  const width = file.readUInt32BE(16)
  const height = file.readUInt32BE(20)
  if (width < 1024 || height < 1024 || width !== height) {
    throw new Error(`${assetPath} must be a square PNG at least 1024×1024; found ${width}×${height}.`)
  }
  console.log(`${assetPath}: ${width}×${height} square`)
}

console.log(`Validated ${assets.length} mapped square battle backgrounds.`)
