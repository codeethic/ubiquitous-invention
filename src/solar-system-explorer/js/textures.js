// ─── Procedural Texture Generation ────────────────────────────────────────────
// Generates planet surface textures using 2D noise and canvas rendering.
// No external assets required.

// ── Noise utilities ──────────────────────────────

function hash(x, y) {
    let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
}

function noise2D(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = hash(ix, iy), b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x, y, octaves = 6, lacunarity = 2.0, gain = 0.5) {
    let val = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
        val += amp * noise2D(x * freq, y * freq);
        amp *= gain;
        freq *= lacunarity;
    }
    return val;
}

function ridge(x, y, octaves = 5) {
    let val = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
        let n = noise2D(x * freq, y * freq);
        n = 1.0 - Math.abs(n * 2 - 1);
        n = n * n;
        val += amp * n;
        amp *= 0.5;
        freq *= 2.0;
    }
    return val;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }
function smoothstep(lo, hi, t) { const x = clamp((t - lo) / (hi - lo)); return x * x * (3 - 2 * x); }

function colorLerp(c1, c2, t) {
    return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// ── Generic equirectangular texture renderer ─────

function renderTexture(w, h, fn) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
        const lat = (y / h) * Math.PI; // 0..π
        for (let x = 0; x < w; x++) {
            const lon = (x / w) * Math.PI * 2; // 0..2π
            const [r, g, b] = fn(lon, lat, x / w, y / h);
            const i = (y * w + x) * 4;
            img.data[i] = clamp(r) * 255;
            img.data[i + 1] = clamp(g) * 255;
            img.data[i + 2] = clamp(b) * 255;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
}

// ── Planet texture generators ────────────────────

function generateMercuryTexture(w, h) {
    return renderTexture(w, h, (lon, lat) => {
        const n = fbm(lon * 3, lat * 3, 7, 2.2, 0.5);
        const craters = 1 - ridge(lon * 6 + 10, lat * 6 + 5, 5) * 0.35;
        const v = n * 0.6 + craters * 0.4;
        const base = [0.42, 0.38, 0.34];
        const dark = [0.25, 0.22, 0.20];
        return colorLerp(dark, base, v);
    });
}

function generateVenusTexture(w, h) {
    return renderTexture(w, h, (lon, lat, u, v) => {
        const bands = Math.sin(v * 12 + fbm(lon * 2, lat * 2, 4) * 3) * 0.5 + 0.5;
        const turb = fbm(lon * 4 + 20, lat * 3 + 10, 5, 2.0, 0.55);
        const n = bands * 0.5 + turb * 0.5;
        const c1 = [0.85, 0.72, 0.38];
        const c2 = [0.78, 0.62, 0.30];
        const c3 = [0.65, 0.50, 0.25];
        let c = colorLerp(c3, c2, n);
        c = colorLerp(c, c1, smoothstep(0.5, 0.8, n));
        return c;
    });
}

function generateEarthTexture(w, h) {
    return renderTexture(w, h, (lon, lat, u, v) => {
        // Continent generation using multi-octave noise
        const continental = fbm(lon * 2.2 + 1.5, lat * 2.2 + 0.8, 6, 2.0, 0.5);
        const detail = fbm(lon * 8, lat * 8, 4, 2.0, 0.45) * 0.15;
        const elevation = continental + detail;

        // Latitude for biome variation
        const absLat = Math.abs(v - 0.5) * 2; // 0 at equator, 1 at poles

        // Ocean threshold
        const seaLevel = 0.48;
        const isLand = elevation > seaLevel;

        if (!isLand) {
            // Ocean
            const depth = smoothstep(0.3, seaLevel, elevation);
            const deep = [0.02, 0.06, 0.22];
            const shallow = [0.06, 0.18, 0.42];
            return colorLerp(deep, shallow, depth);
        }

        // Land biome
        const h2 = (elevation - seaLevel) / (1 - seaLevel);

        // Snow at poles or very high elevation
        if (absLat > 0.82 || (absLat > 0.7 && h2 > 0.3)) {
            const snow = [0.92, 0.94, 0.96];
            const tundra = [0.55, 0.58, 0.45];
            return colorLerp(tundra, snow, smoothstep(0.7, 0.9, absLat + h2 * 0.3));
        }

        // Desert near tropics
        if (absLat < 0.35 && h2 < 0.25) {
            const n2 = fbm(lon * 10, lat * 10, 3) * 0.3;
            if (continental + n2 > 0.62) {
                const desert = [0.76, 0.68, 0.42];
                const dry = [0.65, 0.55, 0.35];
                return colorLerp(dry, desert, n2 + 0.5);
            }
        }

        // Forests / grasslands
        const green = [0.12, 0.32, 0.08];
        const darkGreen = [0.08, 0.22, 0.06];
        const brown = [0.35, 0.28, 0.15];
        const mountain = [0.4, 0.38, 0.32];

        let c = colorLerp(green, darkGreen, fbm(lon * 12, lat * 12, 3));
        c = colorLerp(c, brown, smoothstep(0.15, 0.4, h2));
        c = colorLerp(c, mountain, smoothstep(0.4, 0.7, h2));
        return c;
    });
}

function generateEarthClouds(w, h) {
    return renderTexture(w, h, (lon, lat) => {
        const n1 = fbm(lon * 3 + 50, lat * 3 + 50, 5, 2.2, 0.5);
        const n2 = fbm(lon * 6 + 100, lat * 5 + 80, 4, 2.0, 0.45);
        const coverage = smoothstep(0.35, 0.65, n1) * 0.7 + smoothstep(0.4, 0.7, n2) * 0.3;
        const v = clamp(coverage);
        return [v, v, v];
    });
}

function generateMarsTexture(w, h) {
    return renderTexture(w, h, (lon, lat, u, v) => {
        const absLat = Math.abs(v - 0.5) * 2;
        const n = fbm(lon * 3.5 + 5, lat * 3.5, 6, 2.0, 0.5);
        const detail = fbm(lon * 10, lat * 10, 4) * 0.12;
        const val = n + detail;

        // Polar ice caps
        if (absLat > 0.88) {
            const ice = [0.95, 0.93, 0.90];
            const edge = [0.75, 0.45, 0.25];
            return colorLerp(edge, ice, smoothstep(0.88, 0.96, absLat));
        }

        const rust = [0.72, 0.30, 0.10];
        const light = [0.82, 0.52, 0.28];
        const dark = [0.35, 0.15, 0.06];
        let c = colorLerp(dark, rust, smoothstep(0.3, 0.55, val));
        c = colorLerp(c, light, smoothstep(0.55, 0.75, val));
        return c;
    });
}

function generateJupiterTexture(w, h) {
    return renderTexture(w, h, (lon, lat, u, v) => {
        // Strong horizontal bands
        const bandFreq = 18;
        const bandBase = Math.sin(v * bandFreq * Math.PI) * 0.5 + 0.5;
        const turb = fbm(lon * 2 + 30, lat * 1.5 + v * 5, 5, 2.0, 0.5) * 0.35;
        const band = clamp(bandBase + turb);

        // Great Red Spot (approximate location)
        const spotLon = 3.5, spotLat = 1.7;
        const dx = lon - spotLon, dy = lat - spotLat;
        const spotDist = Math.sqrt(dx * dx * 0.6 + dy * dy * 2.5);
        const spot = smoothstep(0.35, 0.0, spotDist);

        const tan = [0.82, 0.68, 0.42];
        const brown = [0.55, 0.38, 0.22];
        const cream = [0.90, 0.82, 0.65];
        const red = [0.75, 0.25, 0.15];

        let c = colorLerp(brown, tan, band);
        c = colorLerp(c, cream, smoothstep(0.6, 0.85, band));
        c = colorLerp(c, red, spot * 0.8);
        return c;
    });
}

function generateSaturnTexture(w, h) {
    return renderTexture(w, h, (lon, lat, u, v) => {
        const band = Math.sin(v * 14 * Math.PI + fbm(lon, lat * 2, 3) * 1.5) * 0.5 + 0.5;
        const turb = fbm(lon * 2 + 40, lat * 2 + 40, 4, 2.0, 0.5) * 0.2;
        const n = clamp(band + turb);

        const gold = [0.88, 0.78, 0.52];
        const dark = [0.68, 0.58, 0.38];
        const light = [0.94, 0.88, 0.68];

        let c = colorLerp(dark, gold, n);
        c = colorLerp(c, light, smoothstep(0.65, 0.9, n));
        return c;
    });
}

function generateUranusTexture(w, h) {
    return renderTexture(w, h, (lon, lat, u, v) => {
        const band = Math.sin(v * 6 * Math.PI) * 0.15;
        const n = fbm(lon * 2 + 60, lat * 2 + 60, 4, 2.0, 0.45) * 0.12;
        const val = 0.5 + band + n;

        const pale = [0.58, 0.82, 0.85];
        const deep = [0.38, 0.68, 0.75];
        return colorLerp(deep, pale, val);
    });
}

function generateNeptuneTexture(w, h) {
    return renderTexture(w, h, (lon, lat, u, v) => {
        const band = Math.sin(v * 8 * Math.PI + fbm(lon, lat, 3) * 2) * 0.2;
        const n = fbm(lon * 3 + 70, lat * 3 + 70, 5, 2.0, 0.5) * 0.2;
        const val = 0.5 + band + n;

        // Subtle bright cloud patches
        const clouds = smoothstep(0.62, 0.72, fbm(lon * 6 + 80, lat * 5, 4)) * 0.3;

        const deep = [0.12, 0.18, 0.52];
        const mid = [0.18, 0.28, 0.62];
        const bright = [0.45, 0.55, 0.85];

        let c = colorLerp(deep, mid, val);
        c = colorLerp(c, bright, clouds);
        return c;
    });
}

function generateMoonTexture(w, h) {
    return renderTexture(w, h, (lon, lat) => {
        const n = fbm(lon * 4 + 90, lat * 4 + 90, 6, 2.1, 0.48);
        const craters = ridge(lon * 8, lat * 8, 4) * 0.3;
        const val = n * 0.7 + (1 - craters) * 0.3;
        const light = [0.62, 0.60, 0.58];
        const dark = [0.32, 0.30, 0.28];
        return colorLerp(dark, light, val);
    });
}

// ── Ring texture ─────────────────────────────────

export function generateRingTexture(w = 1024, isSaturn = true) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, 64);

    for (let x = 0; x < w; x++) {
        const u = x / w; // 0 = inner edge, 1 = outer edge

        let alpha, r, g, b;
        if (isSaturn) {
            // Saturn: multiple distinct ring bands
            const n = noise2D(u * 80, 3.7) * 0.3 + noise2D(u * 200, 7.1) * 0.15;
            // Ring gaps (Cassini Division at ~0.55, Encke Gap at ~0.88)
            const cassini = 1 - smoothstep(0.52, 0.54, u) * (1 - smoothstep(0.56, 0.58, u)) * 0.85;
            const encke = 1 - smoothstep(0.86, 0.87, u) * (1 - smoothstep(0.88, 0.89, u)) * 0.6;

            const brightness = 0.5 + n + 0.2 * Math.sin(u * 40);
            alpha = clamp(0.6 * cassini * encke * (0.3 + 0.7 * (1 - Math.abs(u - 0.4) * 1.2)));
            r = clamp(lerp(0.72, 0.90, brightness));
            g = clamp(lerp(0.62, 0.82, brightness));
            b = clamp(lerp(0.45, 0.65, brightness));
        } else {
            // Uranus: faint, narrow rings
            const ring1 = smoothstep(0.3, 0.32, u) * (1 - smoothstep(0.34, 0.36, u));
            const ring2 = smoothstep(0.5, 0.52, u) * (1 - smoothstep(0.54, 0.56, u));
            const ring3 = smoothstep(0.7, 0.73, u) * (1 - smoothstep(0.76, 0.79, u));
            const ring4 = smoothstep(0.85, 0.88, u) * (1 - smoothstep(0.92, 0.95, u));
            alpha = clamp((ring1 + ring2 + ring3 + ring4) * 0.35);
            r = 0.6; g = 0.65; b = 0.7;
        }

        for (let y = 0; y < 64; y++) {
            const i = (y * w + x) * 4;
            img.data[i] = r * 255;
            img.data[i + 1] = g * 255;
            img.data[i + 2] = b * 255;
            img.data[i + 3] = alpha * 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
}

// ── Bump/normal map generation ───────────────────

export function generateBumpMap(surfaceCanvas) {
    const w = surfaceCanvas.width, h = surfaceCanvas.height;
    const src = surfaceCanvas.getContext('2d').getImageData(0, 0, w, h);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const dst = ctx.createImageData(w, h);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            // Luminance
            const lum = (src.data[idx] * 0.299 + src.data[idx + 1] * 0.587 + src.data[idx + 2] * 0.114) / 255;
            const v = Math.floor(lum * 255);
            dst.data[idx] = v;
            dst.data[idx + 1] = v;
            dst.data[idx + 2] = v;
            dst.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(dst, 0, 0);
    return canvas;
}

// ── Public API ───────────────────────────────────

const generators = {
    'Mercury': generateMercuryTexture,
    'Venus': generateVenusTexture,
    'Earth': generateEarthTexture,
    'Mars': generateMarsTexture,
    'Jupiter': generateJupiterTexture,
    'Saturn': generateSaturnTexture,
    'Uranus': generateUranusTexture,
    'Neptune': generateNeptuneTexture,
    'Moon': generateMoonTexture,
};

export function generatePlanetTexture(name, size = 1024) {
    const gen = generators[name];
    if (!gen) return null;
    return gen(size, size / 2);
}

export function generateCloudTexture(size = 1024) {
    return generateEarthClouds(size, size / 2);
}
