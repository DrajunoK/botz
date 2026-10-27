// Minimal, dependency-free PNG encoder (8-bit RGBA, no filtering beyond "none")
// used to generate the app icon/splash without any external image tooling.
import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** @param {Buffer} rgba length = width*height*4 */
export function encodePNG(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idatData = deflateSync(raw, { level: 9 });

  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idatData), chunk("IEND", Buffer.alloc(0))]);
}

/** Simple RGBA raster canvas with flat-shape drawing helpers (no anti-aliasing except circles). */
export class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4);
  }

  private_setPixel(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    // Simple alpha-over blend against existing pixel.
    const srcA = a / 255;
    const dstR = this.data[i];
    const dstG = this.data[i + 1];
    const dstB = this.data[i + 2];
    const dstA = this.data[i + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    const blend = (s, d) => (outA === 0 ? 0 : (s * srcA + d * dstA * (1 - srcA)) / outA);
    this.data[i] = Math.round(blend(r, dstR));
    this.data[i + 1] = Math.round(blend(g, dstG));
    this.data[i + 2] = Math.round(blend(b, dstB));
    this.data[i + 3] = Math.round(outA * 255);
  }

  fillRect(x0, y0, w, h, [r, g, b, a = 255]) {
    const xStart = Math.max(0, Math.floor(x0));
    const xEnd = Math.min(this.width, Math.ceil(x0 + w));
    const yStart = Math.max(0, Math.floor(y0));
    const yEnd = Math.min(this.height, Math.ceil(y0 + h));
    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        this.private_setPixel(x, y, r, g, b, a);
      }
    }
  }

  fillRoundedRect(x0, y0, w, h, radius, color) {
    const yStart = Math.floor(y0);
    const yEnd = Math.ceil(y0 + h);
    const xStart = Math.floor(x0);
    const xEnd = Math.ceil(x0 + w);
    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        const cx = x < x0 + radius ? x0 + radius : x > x0 + w - radius ? x0 + w - radius : x;
        const cy = y < y0 + radius ? y0 + radius : y > y0 + h - radius ? y0 + h - radius : y;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= radius * radius) {
          this.private_setPixel(x, y, ...this.withAlpha(color));
        }
      }
    }
  }

  fillCircle(cx, cy, radius, color, feather = 1.25) {
    const [r, g, b, a = 255] = color;
    const minX = Math.floor(cx - radius - feather);
    const maxX = Math.ceil(cx + radius + feather);
    const minY = Math.floor(cy - radius - feather);
    const maxY = Math.ceil(cy + radius + feather);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= radius - feather) {
          this.private_setPixel(x, y, r, g, b, a);
        } else if (d <= radius + feather) {
          const coverage = 1 - (d - (radius - feather)) / (feather * 2);
          this.private_setPixel(x, y, r, g, b, Math.round(a * Math.max(0, Math.min(1, coverage))));
        }
      }
    }
  }

  withAlpha(color) {
    return color.length === 4 ? color : [...color, 255];
  }

  toPNG() {
    return encodePNG(this.width, this.height, this.data);
  }
}
