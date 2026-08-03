/**
 * Natural Earth 110m land shapefile -> data/coastlines.json
 *
 * Dev-only, run once, output committed. No shapefile parsing ships to the
 * browser and this file is excluded from the Jekyll build.
 *
 * Usage:
 *   curl -o ne.zip https://naciscdn.org/naturalearth/110m/physical/ne_110m_land.zip
 *   python -m zipfile -e ne.zip ne/
 *   node tools/build-coastlines.mjs ne/ne_110m_land.shp data/coastlines.json
 *
 * Natural Earth is public domain: "No permission is needed to use Natural
 * Earth", commercial use included. Crediting is appreciated, not required, and
 * we credit it in README.md anyway.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SHAPE_TYPE_POLYGON = 5;
const DECIMALS = 2;   // ~1.1 km at the equator; the 110m source is coarser

const [, , shpPath, outPath] = process.argv;
if (!shpPath || !outPath) {
  console.error('usage: node build-coastlines.mjs <input.shp> <output.json>');
  process.exit(1);
}

const buf = readFileSync(shpPath);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const round = v => Number(v.toFixed(DECIMALS));

const rings = [];
let off = 100;                                   // fixed 100-byte file header
while (off < buf.length) {
  // Record header is big-endian; record content is little-endian.
  const contentWords = dv.getInt32(off + 4, false);
  const p = off + 8;
  if (dv.getInt32(p, true) === SHAPE_TYPE_POLYGON) {
    // p+0 shapeType, p+4..p+35 bounding box, p+36 numParts, p+40 numPoints
    const numParts = dv.getInt32(p + 36, true);
    const numPoints = dv.getInt32(p + 40, true);
    const partsOff = p + 44;
    const ptsOff = partsOff + numParts * 4;

    const starts = [];
    for (let i = 0; i < numParts; i += 1) {
      starts.push(dv.getInt32(partsOff + i * 4, true));
    }
    starts.push(numPoints);

    for (let i = 0; i < numParts; i += 1) {
      const ring = [];
      for (let j = starts[i]; j < starts[i + 1]; j += 1) {
        ring.push([
          round(dv.getFloat64(ptsOff + j * 16, true)),       // longitude
          round(dv.getFloat64(ptsOff + j * 16 + 8, true)),   // latitude
        ]);
      }
      if (ring.length >= 4) rings.push(ring);
    }
  }
  off += 8 + contentWords * 2;
}

const out = {
  source: 'Natural Earth 4.1.0, ne_110m_land',
  licence: 'Public domain. No permission is needed to use Natural Earth.',
  rings,
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out));

const points = rings.reduce((n, r) => n + r.length, 0);
console.log(`${rings.length} rings, ${points} points, ` +
  `${(JSON.stringify(out).length / 1024).toFixed(0)} KB -> ${outPath}`);
