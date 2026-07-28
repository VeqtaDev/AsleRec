/**
 * Génère toutes les ressources graphiques d'AsleRec sans dépendance externe :
 *   build/icon.ico              — icône de l'application et de l'installeur
 *   build/tray.png              — icône de la zone de notification
 *   build/tray-recording.png    — variante affichée pendant un enregistrement
 *   build/installerSidebar.bmp  — bandeau latéral de l'installeur NSIS
 *
 * Le rendu se fait en suréchantillonnage 4×4 puis moyenne, ce qui donne un
 * anticrénelage propre jusqu'à 16 px.
 */
import { deflateSync } from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BUILD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'build')

/* ------------------------------------------------------------------ */
/* Rendu                                                               */
/* ------------------------------------------------------------------ */

const SAMPLES = 4

/**
 * @param {number} size
 * @param {(x: number, y: number) => [number, number, number, number] | null} shade
 *   Reçoit des coordonnées normalisées (0→1) et renvoie [r, g, b, alpha 0→1].
 * @returns {Buffer} pixels RGBA
 */
function render(size, shade) {
  const pixels = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let sumR = 0
      let sumG = 0
      let sumB = 0
      let sumA = 0

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const nx = (x + (sx + 0.5) / SAMPLES) / size
          const ny = (y + (sy + 0.5) / SAMPLES) / size
          const color = shade(nx, ny)
          if (!color) continue
          const [r, g, b, a] = color
          sumR += r * a
          sumG += g * a
          sumB += b * a
          sumA += a
        }
      }

      const total = SAMPLES * SAMPLES
      const offset = (y * size + x) * 4
      if (sumA > 0) {
        pixels[offset] = Math.round(sumR / sumA)
        pixels[offset + 1] = Math.round(sumG / sumA)
        pixels[offset + 2] = Math.round(sumB / sumA)
      }
      pixels[offset + 3] = Math.round((sumA / total) * 255)
    }
  }

  return pixels
}

/** Test d'appartenance à un rectangle à coins arrondis, en coordonnées 0→1. */
function insideRoundedRect(x, y, inset, radius) {
  const x0 = inset
  const y0 = inset
  const x1 = 1 - inset
  const y1 = 1 - inset
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + radius), x1 - radius)
  const cy = Math.min(Math.max(y, y0 + radius), y1 - radius)
  return Math.hypot(x - cx, y - cy) <= radius
}

function insideCircle(x, y, cx, cy, radius) {
  return Math.hypot(x - cx, y - cy) <= radius
}

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ]
}

const RED_LIGHT = [255, 75, 92]
const RED_DARK = [200, 12, 34]
const WHITE = [255, 255, 255]

/** Icône applicative : carré arrondi rouge dégradé, pastille blanche centrée. */
function appIcon(x, y) {
  if (insideCircle(x, y, 0.5, 0.5, 0.185)) return [...WHITE, 1]
  if (insideRoundedRect(x, y, 0.055, 0.235)) {
    const t = Math.min(1, Math.max(0, (x + y) / 2))
    return [...mix(RED_LIGHT, RED_DARK, t), 1]
  }
  return null
}

/** Icône de la zone de notification : pastille pleine, fond transparent. */
function trayIcon(active) {
  return (x, y) => {
    if (insideCircle(x, y, 0.5, 0.5, 0.16)) return [...WHITE, 1]
    if (insideCircle(x, y, 0.5, 0.5, 0.44)) {
      return active ? [255, 45, 63, 1] : [226, 30, 48, 1]
    }
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Encodage PNG                                                        */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // profondeur de bit
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  // Chaque scanline est préfixée par son octet de filtre (0 = aucun).
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    const target = y * (size * 4 + 1)
    raw[target] = 0
    pixels.copy(raw, target + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/* ------------------------------------------------------------------ */
/* Encodage ICO                                                        */
/* ------------------------------------------------------------------ */

/** Conteneur ICO contenant des images PNG (supporté depuis Windows Vista). */
function encodeIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  const directory = Buffer.alloc(16 * images.length)
  let offset = header.length + directory.length

  images.forEach((image, index) => {
    const entry = index * 16
    directory[entry] = image.size >= 256 ? 0 : image.size
    directory[entry + 1] = image.size >= 256 ? 0 : image.size
    directory[entry + 2] = 0
    directory[entry + 3] = 0
    directory.writeUInt16LE(1, entry + 4)
    directory.writeUInt16LE(32, entry + 6)
    directory.writeUInt32LE(image.data.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += image.data.length
  })

  return Buffer.concat([header, directory, ...images.map((image) => image.data)])
}

/* ------------------------------------------------------------------ */
/* Encodage BMP (bandeau NSIS)                                         */
/* ------------------------------------------------------------------ */

/** BMP 24 bits non compressé, stocké de bas en haut comme l'exige le format. */
function encodeBmp(width, height, shade) {
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const pixelArray = Buffer.alloc(rowSize * height)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = shade(x / width, y / height) ?? [0, 0, 0]
      const target = (height - 1 - y) * rowSize + x * 3
      pixelArray[target] = Math.round(color[2])
      pixelArray[target + 1] = Math.round(color[1])
      pixelArray[target + 2] = Math.round(color[0])
    }
  }

  const fileHeader = Buffer.alloc(14)
  const infoHeader = Buffer.alloc(40)
  const offset = fileHeader.length + infoHeader.length

  fileHeader.write('BM', 0, 'ascii')
  fileHeader.writeUInt32LE(offset + pixelArray.length, 2)
  fileHeader.writeUInt32LE(offset, 10)

  infoHeader.writeUInt32LE(40, 0)
  infoHeader.writeInt32LE(width, 4)
  infoHeader.writeInt32LE(height, 8)
  infoHeader.writeUInt16LE(1, 12)
  infoHeader.writeUInt16LE(24, 14)
  infoHeader.writeUInt32LE(0, 16)
  infoHeader.writeUInt32LE(pixelArray.length, 20)
  infoHeader.writeInt32LE(2835, 24)
  infoHeader.writeInt32LE(2835, 28)

  return Buffer.concat([fileHeader, infoHeader, pixelArray])
}

/** Bandeau de l'installeur : fond noir, halo rouge, marque centrée en haut. */
function sidebarShade(x, y) {
  const base = [11, 11, 13]
  const glow = Math.max(0, 1 - Math.hypot(x - 0.5, y - 0.26) * 2.1)
  const withGlow = mix(base, [70, 14, 22], glow * 0.9)

  // Marque : carré arrondi rouge dans le tiers supérieur.
  const markSize = 0.34
  const mx = (x - 0.5) / markSize + 0.5
  const my = (y - 0.26) / (markSize * (164 / 314)) / (314 / 164) + 0.5

  if (mx >= 0 && mx <= 1 && my >= 0 && my <= 1) {
    if (insideCircle(mx, my, 0.5, 0.5, 0.185)) return WHITE
    if (insideRoundedRect(mx, my, 0.055, 0.235)) {
      return mix(RED_LIGHT, RED_DARK, Math.min(1, (mx + my) / 2))
    }
  }

  // Fine bande rouge en pied de bandeau.
  if (y > 0.965) return mix(withGlow, RED_DARK, 0.8)

  return withGlow
}

/* ------------------------------------------------------------------ */
/* Écriture                                                            */
/* ------------------------------------------------------------------ */

fs.mkdirSync(BUILD_DIR, { recursive: true })

const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icoImages = icoSizes.map((size) => ({
  size,
  data: encodePng(size, render(size, appIcon))
}))

fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), encodeIco(icoImages))
fs.writeFileSync(path.join(BUILD_DIR, 'icon.png'), encodePng(512, render(512, appIcon)))
fs.writeFileSync(path.join(BUILD_DIR, 'tray.png'), encodePng(32, render(32, trayIcon(false))))
fs.writeFileSync(
  path.join(BUILD_DIR, 'tray-recording.png'),
  encodePng(32, render(32, trayIcon(true)))
)
fs.writeFileSync(
  path.join(BUILD_DIR, 'installerSidebar.bmp'),
  encodeBmp(164, 314, sidebarShade)
)

console.log('Ressources graphiques générées dans build/')
