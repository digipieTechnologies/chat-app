import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgPath = path.resolve('public', 'favicon.svg');
const svgBuffer = fs.readFileSync(svgPath);

async function generateIcons() {
  try {
    // 192x192
    await sharp(svgBuffer)
      .resize(192, 192)
      .png()
      .toFile(path.resolve('public', 'pwa-192x192.png'));
    
    console.log('Generated pwa-192x192.png');

    // 512x512
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(path.resolve('public', 'pwa-512x512.png'));
    
    console.log('Generated pwa-512x512.png');

    // maskable 512x512 (we'll just use the same for now, or add padding)
    // To make it truly maskable, we could add padding, but just standard size is fine for passing validation
    await sharp(svgBuffer)
      .resize(400, 400, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .extend({
        top: 56,
        bottom: 56,
        left: 56,
        right: 56,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(path.resolve('public', 'maskable-icon.png'));
    
    console.log('Generated maskable-icon.png');

    // apple-touch-icon 180x180
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile(path.resolve('public', 'apple-touch-icon.png'));
    
    console.log('Generated apple-touch-icon.png');
    
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();
