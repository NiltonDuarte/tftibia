import { Buffer } from 'node:buffer'
import { log } from 'node:console'
import { deflateSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const width = 1280
const height = 1024
const board = { x: 192, y: 192, columns: 7, rows: 5, tile: 128 }
const pixels = Buffer.alloc(width * height * 3)

function color(hex) {
  return [1, 3, 5].map((shift) => Number.parseInt(hex.slice(shift, shift + 2), 16))
}

const margin = color('#343532')
const floor = color('#625b4b')
const floorAlternate = color('#5e5849')
const seam = color('#aaa080')
const border = color('#d0b86f')

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const withinBoard = x >= board.x && x < board.x + board.columns * board.tile &&
      y >= board.y && y < board.y + board.rows * board.tile
    const localX = x - board.x
    const localY = y - board.y
    const onOuterEdge = withinBoard && (
      localX < 3 || localX >= board.columns * board.tile - 3 ||
      localY < 3 || localY >= board.rows * board.tile - 3
    )
    const onTileSeam = withinBoard && (
      localX % board.tile < 2 || localY % board.tile < 2
    )
    const isAlternate = withinBoard && (Math.floor(localX / board.tile) + Math.floor(localY / board.tile)) % 2 === 0
    const pixel = onOuterEdge ? border : onTileSeam ? seam : withinBoard ? (isAlternate ? floor : floorAlternate) : margin
    const offset = (y * width + x) * 3
    pixels[offset] = pixel[0]
    pixels[offset + 1] = pixel[1]
    pixels[offset + 2] = pixel[2]
  }
}

const rows = Buffer.alloc((width * 3 + 1) * height)
for (let y = 0; y < height; y += 1) {
  const rowOffset = y * (width * 3 + 1)
  rows[rowOffset] = 0
  pixels.copy(rows, rowOffset + 1, y * width * 3, (y + 1) * width * 3)
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})

function chunk(type, data) {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  let crc = 0xffffffff
  for (const byte of Buffer.concat([name, data])) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([length, name, data, checksum])
}

const header = Buffer.alloc(13)
header.writeUInt32BE(width, 0)
header.writeUInt32BE(height, 4)
header[8] = 8
header[9] = 2
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(rows)),
  chunk('IEND', Buffer.alloc(0)),
])

const output = resolve(root, 'docs/art/battle-grid-guide.png')
await mkdir(dirname(output), { recursive: true })
await writeFile(output, png)
log(`Wrote ${output} (${width}×${height}; ${board.columns}×${board.rows} cells; ${board.tile}px each).`)
