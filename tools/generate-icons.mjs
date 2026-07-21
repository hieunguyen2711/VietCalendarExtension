/*
 * Generates the extension icon set (16/32/48/128 px) as PNGs.
 *
 * Dependency-free: encodes PNG directly using Node's built-in zlib. Run with
 *   node tools/generate-icons.mjs
 *
 * Design: a rounded red square (Vietnamese red) with a gold crescent moon —
 * the moon standing for âm lịch (the lunar calendar).
 */

import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const SIZES = [16, 32, 48, 128];
const SS = 4; // supersampling factor per axis, for anti-aliasing

const RED = [0xb9, 0x1c, 0x1c];
const GOLD = [0xff, 0xd5, 0x4f];

/** True if the point lies inside a rounded rectangle filling the unit square. */
function insideRoundedRect(x, y, radius) {
  const dx = Math.abs(x - 0.5) - (0.5 - radius);
  const dy = Math.abs(y - 0.5) - (0.5 - radius);
  // Inside the plus-shaped core (either axis still within the straight edges).
  if (dx <= 0 || dy <= 0) return true;
  // Otherwise we're in a corner quadrant: fall back to the corner arc.
  return dx * dx + dy * dy <= radius * radius;
}

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

/** Colour + alpha at a point in the unit square, or null for transparent. */
function sample(x, y) {
  if (!insideRoundedRect(x, y, 0.22)) return null;
  // Crescent: a disc with an offset disc bitten out of it.
  const moon = inCircle(x, y, 0.44, 0.5, 0.28) && !inCircle(x, y, 0.58, 0.41, 0.26);
  // A small star clear of the crescent's outer edge.
  const star = inCircle(x, y, 0.75, 0.7, 0.055);
  return moon || star ? GOLD : RED;
}

function renderRGBA(size) {
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const c = sample(x, y);
          if (c) {
            r += c[0]; g += c[1]; b += c[2]; a += 255;
          }
        }
      }
      const n = SS * SS;
      const i = (py * size + px) * 4;
      // Un-premultiply so edge pixels keep their colour as alpha falls off.
      const cov = a / n;
      buf[i] = cov ? Math.round(r / (a / 255)) : 0;
      buf[i + 1] = cov ? Math.round(g / (a / 255)) : 0;
      buf[i + 2] = cov ? Math.round(b / (a / 255)) : 0;
      buf[i + 3] = Math.round(cov);
    }
  }
  return buf;
}

// --- Minimal PNG encoder -----------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function encodePNG(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10..12 = compression, filter, interlace — all 0

  // Each scanline is prefixed with filter byte 0 (None).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Run ---------------------------------------------------------------------

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = path.join(OUT_DIR, `icon${size}.png`);
  fs.writeFileSync(file, encodePNG(renderRGBA(size), size));
  console.log(`wrote ${path.relative(process.cwd(), file)} (${size}x${size})`);
}
