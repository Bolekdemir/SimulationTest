// Shared helpers. Everything lives on the global IS namespace so the game
// runs from plain <script> tags (no build step, works from file:// too).
const IS = {};
IS.TILE = 24;

IS.rand = (a, b) => a + Math.random() * (b - a);
IS.randi = (a, b) => Math.floor(IS.rand(a, b + 1));
IS.chance = p => Math.random() < p;
// Extra lines (js/lines.js) join any pool whose first line they're keyed by
IS.MoreLines = IS.MoreLines || {};
const moreCache = new Map();
IS.more = arr => {
  if (!arr || arr._more || !arr.length || typeof arr[0] !== 'string') return arr;
  const ex = IS.MoreLines[arr[0]];
  if (!ex) return arr;
  const key = arr[0] + '\u0000' + arr[arr.length - 1] + '\u0000' + arr.length;
  let m = moreCache.get(key);
  if (!m) { m = arr.concat(ex); m._more = true; moreCache.set(key, m); }
  return m;
};
IS.pick = arr => { arr = IS.more(arr); return arr[Math.floor(Math.random() * arr.length)]; };
IS.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
IS.lerp = (a, b, t) => a + (b - a) * t;
IS.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
IS.shuffle = arr => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
IS.weightedPick = items => {
  // items: [{w, ...}]
  let total = 0;
  for (const it of items) total += Math.max(0, it.w);
  if (total <= 0) return items[0];
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, it.w);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
};

// Seeded RNG + value noise for world generation.
IS.mulberry32 = seed => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
IS.hash2 = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
IS.makeNoise = seed => {
  const smooth = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = IS.hash2(xi, yi, seed), b = IS.hash2(xi + 1, yi, seed);
    const c = IS.hash2(xi, yi + 1, seed), d = IS.hash2(xi + 1, yi + 1, seed);
    return IS.lerp(IS.lerp(a, b, xf), IS.lerp(c, d, xf), yf);
  };
};

// Colors
IS.hexToRgb = hex => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
IS.rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map(v => IS.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
IS.mix = (a, b, t) => {
  const A = IS.hexToRgb(a), B = IS.hexToRgb(b);
  return IS.rgbToHex(IS.lerp(A[0], B[0], t), IS.lerp(A[1], B[1], t), IS.lerp(A[2], B[2], t));
};
// amt > 0 lightens, amt < 0 darkens (toward a cool shadow, which reads cozier than black)
IS.shade = (hex, amt) => (amt >= 0 ? IS.mix(hex, '#fff8e8', amt) : IS.mix(hex, '#1d1530', -amt));

IS.makeCanvas = (w, h, readback) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  // Small sprite canvases get read back for outlining; keep those on the CPU.
  const g = c.getContext('2d', { willReadFrequently: readback ?? (c.width * c.height < 160000) });
  g.imageSmoothingEnabled = false;
  return { c, g };
};

// Adds a 1px outline around every opaque pixel. This single pass is what makes
// procedurally drawn shapes read as hand-made pixel art.
IS.outline = (canvas, color = '#2a2135') => {
  const g = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const [r, gg, b] = IS.hexToRgb(color);
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 40 ? 1 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      const n =
        (x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) ||
        (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w]);
      if (n) {
        d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      }
    }
  }
  g.putImageData(img, 0, 0);
  return canvas;
};

IS.pad2 = n => String(n).padStart(2, '0');
IS.fmtTime = min => {
  const m = Math.floor(min) % 1440;
  return IS.pad2(Math.floor(m / 60)) + ':' + IS.pad2(m % 60);
};

// Tiny binary heap for A*
IS.Heap = class {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item, pri) {
    const a = this.a;
    a.push({ item, pri });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].pri <= a[i].pri) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].pri < a[m].pri) m = l;
        if (r < a.length && a[r].pri < a[m].pri) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top.item;
  }
};
