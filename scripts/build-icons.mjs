// Rasterize the SVG sources in public/ into the PNGs that ship:
//   icon.svg -> the manifest + iOS icons
//   og.svg   -> og.png, the link-preview card (scrapers can't read SVG)
// The PNGs are committed, so this only runs when a source changes. sharp isn't
// a project dependency (it'd slow every install for a one-off tool):
//   npm i -D sharp && node scripts/build-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "public", "icon.svg"));

const sizes = [
  { size: 512, file: "icon-512.png" },
  { size: 192, file: "icon-192.png" },
  { size: 180, file: "apple-touch-icon.png" },
];

for (const { size, file } of sizes) {
  const png = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
  writeFileSync(join(root, "public", file), png);
  console.log(`wrote public/${file} (${size}x${size}, ${png.length} bytes)`);
}

// The share card. 1200x630 is the size every scraper expects.
const og = readFileSync(join(root, "public", "og.svg"));
const ogPng = await sharp(og, { density: 144 }).resize(1200, 630).png().toBuffer();
writeFileSync(join(root, "public", "og.png"), ogPng);
console.log(`wrote public/og.png (1200x630, ${ogPng.length} bytes)`);
