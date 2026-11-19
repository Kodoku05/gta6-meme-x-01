// gta6-meme-x-01 entry (Node 22, standard library only, no network, no wall clock).
//
// What it does, the way the grader runs it:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
// 1. Copies POST.json from the repository root to <output>/POST.json (the gate reads it).
// 2. Deterministically generates the meme picture as SVG into <output>/meme.svg.
//    Same input bytes in, same bytes out, every run: fixed seed, no Date, no Math.random,
//    no network. The make.fun ghost mark is embedded from the official press kit
//    (https://make.fun/press/ — mark.svg, the white ghost with sparkle eyes and the
//    magenta star coin), drawn inline so grading needs no network and no font download.
//
// The meme (rendered to meme.png for the X post with headless Chromium during the build):
// a Vice City / Leonida sunset poster. The joke: GTA 6 took 13 years; the poster's AI
// agent spent the wait earning real money on make.fun. The ghost rides the sunset,
// big and recognisable even shrunk to 480x480.

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// --- The make.fun ghost mark, inlined from the official press kit (mark.svg). ---
// viewBox 0 0 32 32: magenta disc, white ghost with sparkle eyes, magenta star coin.
const MARK_INNER = `<circle cx="16" cy="16" r="15.1" fill="#c41c83" stroke="#191419" stroke-width="1.8"/><g transform="translate(3.858 3.202) scale(0.79)"><path d="M6.2 13a8.2 8.2 0 0 1 16.4 0v4.6c1 .2 1.8.8 2 2-.2 1.2-1 1.9-2 2.2V25a2.6 2.6 0 0 1-2.6 2.6c-2 0-4.6 0-5.7-.7-1.1.7-3.7.7-5.5.7A2.6 2.6 0 0 1 6.2 25v-.7c-1.2.3-3.5.1-3.6-1.9-.1-2.1 1.3-4.8 3.6-6.2z" fill="#191419" stroke="#191419" stroke-width="3.4" stroke-linejoin="round"/><path d="M6.2 13a8.2 8.2 0 0 1 16.4 0v4.6c1 .2 1.8.8 2 2-.2 1.2-1 1.9-2 2.2V25a2.6 2.6 0 0 1-2.6 2.6c-2 0-4.6 0-5.7-.7-1.1.7-3.7.7-5.5.7A2.6 2.6 0 0 1 6.2 25v-.7c-1.2.3-3.5.1-3.6-1.9-.1-2.1 1.3-4.8 3.6-6.2z" fill="#ffffff"/><path d="M6.3 24.1v-2.5m8 5.8v-1.5" fill="none" stroke="#191419" stroke-width="1.25" stroke-linecap="round"/><path d="M13.2 10.6Q13.632 11.968 15 12.4Q13.632 12.832 13.2 14.2Q12.768 12.832 11.4 12.4Q12.768 11.968 13.2 10.6z" fill="#191419"/><path d="M19.3 9.8Q19.732 11.168 21.1 11.6Q19.732 12.032 19.3 13.4Q18.868 12.032 17.5 11.6Q18.868 11.168 19.3 9.8z" fill="#191419"/><circle cx="26.5" cy="13.4" r="5.5" fill="#191419"/><circle cx="26.5" cy="13.4" r="3.8" fill="#c41c83"/><path d="M26.926 11.395L27.154 12.811L28.539 13.186L27.262 13.84L27.334 15.273L26.317 14.261L24.977 14.772L25.625 13.492L24.725 12.375L26.142 12.596z" fill="#ffffff" stroke="#ffffff" stroke-width="0.5" stroke-linejoin="round"/><circle cx="24.9" cy="19.6" r="4" fill="#191419"/><circle cx="24.9" cy="19.6" r="2.3" fill="#ffffff"/></g>`;

// Deterministic pseudo-random: mulberry32 with a fixed seed. Same seed, same picture.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One gold "$" coin, tilted for a casual tossed look. textDy is the vertical
// offset of the "$" glyph from the coin centre (tuned per coin size).
function coin(cx: number, cy: number, r: number, rot: number, fontSize: number, textDy: number): string {
  return `<g transform="rotate(${rot} ${cx} ${cy})"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffd319" stroke="#8a5a00" stroke-width="4"/><text x="${cx}" y="${cy + textDy}" text-anchor="middle" font-family="'Noto Sans',sans-serif" font-weight="900" font-size="${fontSize}" fill="#7a4d00">$</text></g>`;
}

// One bold headline line with the poster's outlined look. letterSpacing is only
// emitted when given (the middle lines have none).
function headline(x: number, y: number, fontSize: number, fill: string, strokeWidth: number, text: string, letterSpacing?: number): string {
  const ls = letterSpacing === undefined ? '' : ` letter-spacing="${letterSpacing}"`;
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="'Noto Sans',sans-serif" font-weight="900" font-size="${fontSize}"${ls} fill="${fill}" stroke="#191419" stroke-width="${strokeWidth}" paint-order="stroke" stroke-linejoin="round">${text}</text>`;
}

function buildMemeSvg(): string {
  const rand = mulberry32(20261119);

  // Stars in the upper sky.
  let stars = '';
  for (let i = 0; i < 42; i++) {
    const x = (20 + rand() * 1160).toFixed(1);
    const y = (15 + rand() * 380).toFixed(1);
    const r = (0.9 + rand() * 2.1).toFixed(2);
    const o = (0.35 + rand() * 0.6).toFixed(2);
    stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="${o}"/>`;
  }

  // Lit windows on the skyline (rows that sit inside every building: y 726 and 744).
  let windows = '';
  for (let x = 14; x < 1190; x += 26) {
    for (const y of [726, 744]) {
      if (rand() < 0.55) {
        windows += `<rect x="${x}" y="${y}" width="7" height="9" fill="#ffd319" opacity="0.85"/>`;
      }
    }
  }

  // Neon grid: perspective lines from the vanishing point, plus receding horizontals.
  let grid = '';
  for (const bx of [-260, -60, 140, 330, 470, 600, 730, 870, 1060, 1260, 1460]) {
    grid += `<line x1="600" y1="760" x2="${bx}" y2="1200" stroke="#ff2e88" stroke-width="2" opacity="0.5"/>`;
  }
  const hLines: Array<[number, number]> = [
    [784, 0.35], [812, 0.4], [846, 0.45], [890, 0.5], [944, 0.55], [1010, 0.6], [1090, 0.65], [1188, 0.7],
  ];
  for (const [y, o] of hLines) {
    grid += `<line x1="0" y1="${y}" x2="1200" y2="${y}" stroke="#ff2e88" stroke-width="2" opacity="${o}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#150826"/><stop offset="0.35" stop-color="#3b0f4f"/><stop offset="0.6" stop-color="#a4136b"/><stop offset="0.82" stop-color="#ff5e3a"/><stop offset="1" stop-color="#ffb347"/>
</linearGradient>
<linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#ffe259"/><stop offset="0.55" stop-color="#ff7e5f"/><stop offset="1" stop-color="#ff2e88"/>
</linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
</radialGradient>
<mask id="sunCut">
<rect x="300" y="340" width="600" height="420" fill="#ffffff"/>
<rect x="300" y="560" width="600" height="7" fill="#000000"/>
<rect x="300" y="600" width="600" height="10" fill="#000000"/>
<rect x="300" y="642" width="600" height="14" fill="#000000"/>
<rect x="300" y="686" width="600" height="19" fill="#000000"/>
<rect x="300" y="732" width="600" height="26" fill="#000000"/>
</mask>
<g id="palm" stroke="#0a0312" stroke-linecap="round" fill="none">
<path d="M0,0 C-6,-60 -4,-140 12,-210" stroke-width="15"/>
<path d="M12,-210 C-30,-242 -90,-238 -132,-200" stroke-width="10"/>
<path d="M12,-210 C-20,-262 -72,-276 -122,-264" stroke-width="10"/>
<path d="M12,-210 C8,-272 0,-302 -22,-322" stroke-width="10"/>
<path d="M12,-210 C42,-262 82,-276 122,-260" stroke-width="10"/>
<path d="M12,-210 C52,-238 102,-232 136,-196" stroke-width="10"/>
<path d="M12,-210 C-42,-216 -82,-192 -106,-160" stroke-width="10"/>
<path d="M12,-210 C62,-212 96,-186 116,-150" stroke-width="10"/>
<circle cx="6" cy="-204" r="7" fill="#0a0312" stroke="none"/>
<circle cx="18" cy="-200" r="6" fill="#0a0312" stroke="none"/>
</g>
</defs>
<rect x="0" y="0" width="1200" height="760" fill="url(#sky)"/>
${stars}
<circle cx="600" cy="640" r="280" fill="url(#sun)" mask="url(#sunCut)"/>
<path d="M0,760 L0,690 L60,690 L60,650 L110,650 L110,700 L170,700 L170,640 L230,640 L230,710 L290,710 L290,670 L350,670 L350,720 L420,720 L420,660 L480,660 L480,700 L540,700 L540,675 L600,675 L600,715 L660,715 L660,655 L720,655 L720,705 L790,705 L790,665 L850,665 L850,720 L910,720 L910,650 L970,650 L970,700 L1030,700 L1030,670 L1090,670 L1090,715 L1150,715 L1150,680 L1200,680 L1200,760 Z" fill="#1c0a2e"/>
${windows}
<rect x="0" y="760" width="1200" height="440" fill="#0f0518"/>
<line x1="0" y1="760" x2="1200" y2="760" stroke="#ff2e88" stroke-width="3" opacity="0.9"/>
${grid}
<use href="#palm" transform="translate(105,805) scale(1.15)"/>
<use href="#palm" transform="translate(1095,805) scale(-1.15,1.15)"/>
<circle cx="600" cy="630" r="280" fill="url(#glow)"/>
<g transform="rotate(-4 600 630)">
<svg x="400" y="430" width="400" height="400" viewBox="0 0 32 32">${MARK_INNER}</svg>
</g>
${coin(295, 470, 32, -12, 38, 12)}
${coin(912, 445, 27, 10, 32, 10)}
${coin(940, 715, 23, -8, 27, 9)}
${headline(600, 122, 92, '#ffffff', 14, 'WAITED 13 YEARS', 2)}
${headline(600, 220, 92, '#ffffff', 14, 'FOR GTA 6&#8230;', 2)}
${headline(600, 992, 54, '#ffffff', 9, 'MY AGENT SPENT THE WAIT')}
${headline(600, 1062, 54, '#ffffff', 9, 'EARNING REAL MONEY ON')}
${headline(600, 1148, 78, '#ff88c4', 11, 'MAKE.FUN', 3)}
</svg>
`;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
try {
  copyFileSync(join(BOT_DIR, 'POST.json'), join(OUTPUT_DIR, 'POST.json'));
} catch (err) {
  console.error(`POST.json could not be copied from ${BOT_DIR}: ${(err as Error).message}`);
  process.exit(1);
}
writeFileSync(join(OUTPUT_DIR, 'meme.svg'), buildMemeSvg(), 'utf8');
