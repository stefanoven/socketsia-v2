// One-time script: generates PWA icons from favicon.svg
// Run: node scripts/generate-icons.cjs

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const faviconPath = path.join(__dirname, '../public/favicon.svg');
const iconsDir = path.join(__dirname, '../public/icons');

// #2563eb = rgb(37, 99, 235) — blue-600, matches theme_color
const BRAND_BG = { r: 37, g: 99, b: 235, alpha: 1 };

async function generate() {
  if (!fs.existsSync(faviconPath)) {
    console.error('favicon.svg not found at', faviconPath);
    process.exit(1);
  }
  fs.mkdirSync(iconsDir, { recursive: true });

  // Regular (any) icons — white background, logo fills the frame
  await sharp(faviconPath).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192x192.png'));
  await sharp(faviconPath).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512x512.png'));
  console.log('✓ any icons (192, 512)');

  // Maskable icons — logo scaled to 80% safe zone, blue brand bg fills the rest
  //   192 × 0.80 = 153.6 → 154px content, 19px padding each side
  //   512 × 0.80 = 409.6 → 410px content, 51px padding each side
  await sharp(faviconPath)
    .resize(154, 154)
    .extend({ top: 19, bottom: 19, left: 19, right: 19, background: BRAND_BG })
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-192x192.png'));

  await sharp(faviconPath)
    .resize(410, 410)
    .extend({ top: 51, bottom: 51, left: 51, right: 51, background: BRAND_BG })
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-512x512.png'));
  console.log('✓ maskable icons (192, 512)');

  console.log('All icons generated in', iconsDir);
}

generate().catch((err) => { console.error(err); process.exit(1); });
