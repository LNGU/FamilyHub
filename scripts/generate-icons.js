const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../public/icon.svg');
const svg = fs.readFileSync(svgPath);

async function generateIcons() {
  // Generate 192x192 icon
  await sharp(svg)
    .resize(192, 192)
    .png()
    .toFile(path.join(__dirname, '../public/icon-192.png'));
  console.log('Created icon-192.png');

  // Generate 512x512 icon
  await sharp(svg)
    .resize(512, 512)
    .png()
    .toFile(path.join(__dirname, '../public/icon-512.png'));
  console.log('Created icon-512.png');

  // Generate favicon
  await sharp(svg)
    .resize(32, 32)
    .png()
    .toFile(path.join(__dirname, '../public/favicon.png'));
  console.log('Created favicon.png');

  // Generate Apple touch icon
  await sharp(svg)
    .resize(180, 180)
    .png()
    .toFile(path.join(__dirname, '../public/apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  console.log('All icons generated!');
}

generateIcons().catch(console.error);
