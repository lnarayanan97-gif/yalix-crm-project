import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';

// Official YALIX Brand Colors
// Royal Blue: #1652A5 (RGB: 22, 82, 165)
const YALIX_BLUE = '#1652A5';

// SVG Definition of the official YALIX logo with framing speed lines
// Ratio ~ 4.2 : 1 (1260 x 300)
// Clean transparent background, exact royal blue color and proportions
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1260 300" width="1260" height="300">
  <defs>
    <style>
      .yalix-blue { fill: ${YALIX_BLUE}; }
      .yalix-text {
        font-family: 'Liberation Sans', 'Arial Black', 'Helvetica Neue', Arial, sans-serif;
        font-weight: 900;
        font-style: italic;
        fill: ${YALIX_BLUE};
        font-size: 182px;
        letter-spacing: -1px;
      }
    </style>
  </defs>
  <g id="yalix-official-logo">
    <!-- Top horizontal speed bar starting above the 'A' -->
    <!-- Runs horizontally to the right, then angles downward parallel to the right stroke of 'X' -->
    <path d="M 405 32 L 980 32 L 910 215 L 868 256 L 22 256 L 22 242 L 860 242 L 898 206 L 966 46 L 405 46 Z" fill="${YALIX_BLUE}"/>

    <!-- YALIX Wordmark -->
    <text x="250" y="214" class="yalix-text">YALIX</text>
  </g>
</svg>`;

// High-resolution 4K render (3840px width)
const resvg4K = new Resvg(svg, {
  fitTo: {
    mode: 'width',
    value: 3840,
  },
});

const png4KData = resvg4K.render();
const png4KBuffer = png4KData.asPng();

// Standard resolution render (1260px width)
const resvgStd = new Resvg(svg, {
  fitTo: {
    mode: 'width',
    value: 1260,
  },
});
const pngStdBuffer = resvgStd.render().asPng();

// Square Favicon SVG & PNG (focusing on the Y mark or full emblem)
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="28" fill="#FFFFFF"/>
  <rect width="128" height="128" rx="28" fill="none" stroke="#E2E8F0" stroke-width="2"/>
  <!-- YALIX stylized Y monogram in royal blue -->
  <g transform="translate(14, 18) scale(0.78)">
    <path d="M 8 10 L 115 10 L 98 55 L 82 85 L 8 85 L 8 75 L 75 75 L 88 50 L 100 20 L 8 20 Z" fill="${YALIX_BLUE}"/>
    <text x="22" y="86" font-family="'Liberation Sans', Arial, sans-serif" font-weight="900" font-style="italic" font-size="82" fill="${YALIX_BLUE}">Y</text>
  </g>
</svg>`;

const resvgFavicon = new Resvg(faviconSvg, {
  fitTo: {
    mode: 'width',
    value: 128,
  },
});
const faviconPngBuffer = resvgFavicon.render().asPng();

const publicDir = path.resolve('public');
fs.mkdirSync(publicDir, { recursive: true });

// 1. Primary official logo files in public/
fs.writeFileSync(path.join(publicDir, 'YALIX_Logo_4K_Transparent.png'), png4KBuffer);
fs.writeFileSync(path.join(publicDir, 'YALIX_Logo_4K_Transparent.svg'), svg);
fs.writeFileSync(path.join(publicDir, 'yalix-logo.png'), pngStdBuffer);
fs.writeFileSync(path.join(publicDir, 'yalix-logo.svg'), svg);

// 2. Favicons in public/
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg);
fs.writeFileSync(path.join(publicDir, 'favicon.png'), faviconPngBuffer);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), faviconPngBuffer);

console.log('Successfully generated:');
console.log(' - /public/YALIX_Logo_4K_Transparent.png (4K Transparent, size:', png4KBuffer.length, 'bytes)');
console.log(' - /public/YALIX_Logo_4K_Transparent.svg');
console.log(' - /public/favicon.svg & /public/favicon.png');
