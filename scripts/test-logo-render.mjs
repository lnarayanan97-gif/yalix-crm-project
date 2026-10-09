import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';

// Let's create an exact vector SVG
// Color: #1852A4
// The logo has:
// "YALIX" wordmark
// Top bar: starts above A, goes right past X, bends down at slant angle of X
// Bottom bar: starts far left under Y, goes right under X, bends up at slant angle of X

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 240" width="1000" height="240">
  <defs>
    <style>
      .yalix-blue { fill: #1852A4; }
      .yalix-stroke { stroke: #1852A4; fill: none; }
      .logo-text {
        font-family: 'Liberation Sans', 'Arial', sans-serif;
        font-weight: 900;
        font-style: italic;
        fill: #1852A4;
      }
    </style>
  </defs>
  <!-- Transparent background -->
  <g id="yalix-logo">
    <!-- Top framing line -->
    <!-- Starts above A (~x=330, y=22), runs right to x=795, then turns diagonal down-right to (x=735, y=175) -->
    <path d="M 330 24 L 795 24 L 735 170" fill="none" stroke="#1852A4" stroke-width="12" stroke-linecap="square" stroke-linejoin="miter" stroke-miterlimit="10"/>

    <!-- Bottom framing line -->
    <!-- Starts far left (x=15, y=216), runs right to x=615, then turns diagonal up-right to (x=645, y=182) -->
    <path d="M 15 216 L 615 216 L 648 182" fill="none" stroke="#1852A4" stroke-width="12" stroke-linecap="square" stroke-linejoin="miter" stroke-miterlimit="10"/>

    <!-- YALIX text -->
    <text x="210" y="172" class="logo-text" font-size="148" letter-spacing="-1">YALIX</text>
  </g>
</svg>`;

const resvg = new Resvg(svg, {
  fitTo: {
    mode: 'width',
    value: 1920,
  },
});

const pngData = resvg.render();
const pngBuffer = pngData.asPng();

fs.mkdirSync('./public', { recursive: true });
fs.writeFileSync('./public/test-logo.png', pngBuffer);
fs.writeFileSync('./public/test-logo.svg', svg);
console.log('Rendered test-logo.png successfully, size:', pngBuffer.length);
