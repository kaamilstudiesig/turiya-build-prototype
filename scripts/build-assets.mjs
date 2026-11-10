// Turns the Pano2VR tour export (cube tiles + pano.xml data) into the few
// images and the JSON this prototype needs.
// Usage: node scripts/build-assets.mjs <extracted-tour-dir> <nodes.json>
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC = process.argv[2];
const NODES = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const OUT = path.resolve("public/tour");
fs.mkdirSync(OUT, { recursive: true });

const TILE = 472; // tiles are 474px: 472 + 1px overlap each side
const FACE = 2250;
const D2R = Math.PI / 180;

async function loadFace(node, f) {
  const buf = Buffer.alloc(FACE * FACE * 3);
  const dir = path.join(SRC, "tiles", node, `cf_${f}`, "l_3");
  for (const c of fs.readdirSync(dir)) {
    const cx = +c.split("_")[1];
    for (const t of fs.readdirSync(path.join(dir, c))) {
      const ty = +t.match(/\d+/)[0];
      const { data, info } = await sharp(path.join(dir, c, t)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const ox = cx * TILE - 1, oy = ty * TILE - 1;
      for (let y = 0; y < info.height; y++) {
        const Y = oy + y;
        if (Y < 0 || Y >= FACE) continue;
        for (let x = 0; x < info.width; x++) {
          const X = ox + x;
          if (X < 0 || X >= FACE) continue;
          const s = (y * info.width + x) * 3, d = (Y * FACE + X) * 3;
          buf[d] = data[s]; buf[d + 1] = data[s + 1]; buf[d + 2] = data[s + 2];
        }
      }
    }
  }
  return buf;
}

const loadCube = (node) => Promise.all([0, 1, 2, 3, 4, 5].map((f) => loadFace(node, f)));

// Direction convention used across the prototype:
// lon 0 = front (-z), lon grows to the right (+x), lat grows up (+y).
// Faces: 0 front, 1 right, 2 back, 3 left, 4 up, 5 down.
function sample(cube, x, y, z, out, o) {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  let f, u, v;
  if (az >= ax && az >= ay) {
    if (z < 0) { f = 0; u = x / az; v = -y / az; } else { f = 2; u = -x / az; v = -y / az; }
  } else if (ax >= ay) {
    if (x > 0) { f = 1; u = z / ax; v = -y / ax; } else { f = 3; u = -z / ax; v = -y / ax; }
  } else if (y > 0) { f = 4; u = x / ay; v = -z / ay; }
  else { f = 5; u = x / ay; v = z / ay; }
  const px = Math.min(FACE - 1, Math.max(0, ((u + 1) / 2) * FACE | 0));
  const py = Math.min(FACE - 1, Math.max(0, ((v + 1) / 2) * FACE | 0));
  const s = (py * FACE + px) * 3, b = cube[f];
  out[o] = b[s]; out[o + 1] = b[s + 1]; out[o + 2] = b[s + 2];
}

function equirect(cube, W) {
  const H = W / 2, out = Buffer.alloc(W * H * 3);
  for (let j = 0; j < H; j++) {
    const lat = (0.5 - (j + 0.5) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = ((i + 0.5) / W - 0.5) * 2 * Math.PI;
      sample(cube, cl * Math.sin(lon), sl, -cl * Math.cos(lon), out, (j * W + i) * 3);
    }
  }
  return sharp(out, { raw: { width: W, height: H, channels: 3 } });
}

// Straight-down view from the drone. `rot` = which lon points to image-up.
const TOP_FOV = 116, TOP_ROT = +(process.env.TOP_ROT ?? 0);
function topDown(cube, W, H) {
  const out = Buffer.alloc(W * H * 3), k = Math.tan((TOP_FOV / 2) * D2R) / (W / 2);
  const cr = Math.cos(TOP_ROT * D2R), sr = Math.sin(TOP_ROT * D2R);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const a = (i + 0.5 - W / 2) * k, b = (H / 2 - j - 0.5) * k; // right, up on screen
    // screen-up = direction of lon TOP_ROT on the ground
    const x = a * cr + b * sr, z = a * sr - b * cr;
    const n = Math.hypot(x, 1, z);
    sample(cube, x / n, -1 / n, z / n, out, (j * W + i) * 3);
  }
  return sharp(out, { raw: { width: W, height: H, channels: 3 } });
}
function topDownPoint(lon, lat, W, H) {
  const l = lon * D2R, t = lat * D2R;
  const x = Math.cos(t) * Math.sin(l), y = Math.sin(t), z = -Math.cos(t) * Math.cos(l);
  const gx = x / -y, gz = z / -y;
  const cr = Math.cos(TOP_ROT * D2R), sr = Math.sin(TOP_ROT * D2R);
  const a = gx * cr + gz * sr, b = gx * sr - gz * cr;
  const k = Math.tan((TOP_FOV / 2) * D2R) / (W / 2);
  return { x: (a / k + W / 2) / W, y: (H / 2 - b / k) / H };
}

const PAN_SIGN = +(process.env.PAN_SIGN ?? -1); // Pano2VR pan → our lon
const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
const target = (h) => byId[(h.url || "").replace(/[{}]/g, "")];

const HERO = "node31";
const STRIP = ["node46", "node11", "node15", "node30", "node31", "node52", "node62", "node78", "node24", "node20", "node14", "node57"];

const debug = process.env.DEBUG === "1";

// 0. Panorama strips for the hero pills: the band around the horizon, which loops seamlessly.
// Run on their own with ONLY=pills.
for (const id of ["node31", "node78", "node15"]) {
  const cube = await loadCube(id);
  const img = await equirect(cube, 2000).png().toBuffer();
  await sharp(img).extract({ left: 0, top: 290, width: 2000, height: 440 }).webp({ quality: 76 }).toFile(path.join(OUT, `pill-${id}.webp`));
}
if (process.env.ONLY === "pills") {
  console.log("pills done");
  process.exit(0);
}

// 1. Aerial map
{
  const cube = await loadCube("node47");
  const W = 1800, H = 1200;
  const aerial = byId.node47;
  const pins = aerial.hs.filter((h) => h.skin === "ht_node").map((h) => {
    const p = topDownPoint(PAN_SIGN * h.pan, h.tilt, W, H);
    return { id: target(h).id, title: h.title, x: +p.x.toFixed(4), y: +p.y.toFixed(4) };
  });
  let img = topDown(cube, W, H);
  if (debug) {
    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${pins.map((p) => `<circle cx="${p.x * W}" cy="${p.y * H}" r="14" fill="red"/><text x="${p.x * W + 18}" y="${p.y * H}" font-size="30" fill="yellow">${p.title}</text>`).join("")}</svg>`;
    img = sharp(await img.png().toBuffer()).composite([{ input: Buffer.from(svg) }]);
    await sharp(await img.png().toBuffer()).resize(1100).jpeg({ quality: 70 }).toFile(path.join(OUT, "_debug-aerial.jpg"));
  } else {
    await img.webp({ quality: 80 }).toFile(path.join(OUT, "aerial.webp"));
  }
  fs.writeFileSync(path.join(OUT, "_pins.json"), JSON.stringify(pins));
}

// 2. Hero panorama
{
  const cube = await loadCube(HERO);
  if (debug) {
    const W = 1200, H = 600, n = byId[HERO];
    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${n.hs.map((h) => {
      let lon = (((PAN_SIGN * h.pan + 180) % 360) + 360) % 360 - 180;
      const x = (lon / 360 + 0.5) * W, y = (0.5 - h.tilt / 180) * H;
      return `<circle cx="${x}" cy="${y}" r="9" fill="red"/><text x="${x + 12}" y="${y}" font-size="22" fill="yellow">${h.title}</text>`;
    }).join("")}</svg>`;
    await sharp(await equirect(cube, W).png().toBuffer()).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 70 }).toFile(path.join(OUT, "_debug-hero.jpg"));
  } else {
    await equirect(cube, 6000).webp({ quality: 78 }).toFile(path.join(OUT, "hero-6k.webp"));
    await equirect(cube, 6000).resize(3072).webp({ quality: 76 }).toFile(path.join(OUT, "hero-3k.webp"));
  }
}

// 3. Flat thumbnails for the import strip
if (!debug) for (const id of STRIP) {
  const cube = await loadCube(id);
  await equirect(cube, 1280).resize(560).webp({ quality: 72 }).toFile(path.join(OUT, `flat-${id}.webp`));
}

console.log("done");
