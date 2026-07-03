import sharp from 'sharp';
import fs from 'fs';

const svgPath = 'public/icon.svg';

async function buildIcons() {
    const svgBuffer = fs.readFileSync(svgPath);

    await sharp(svgBuffer)
        .resize(180, 180)
        .png()
        .toFile('public/apple-touch-icon-pink.png');

    await sharp(svgBuffer)
        .resize(192, 192)
        .png()
        .toFile('public/icon-192-pink.png');

    await sharp(svgBuffer)
        .resize(512, 512)
        .png()
        .toFile('public/icon-512-pink.png');

    console.log('Pink Icons generated successfully!');
}

buildIcons().catch(console.error);
