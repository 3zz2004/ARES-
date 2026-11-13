// The opening cinematic: ~30 seconds, drawn live from the game's own art (no video file needed).
// Space -> engine failure -> falling to Mars -> impact -> ARES wakes alone -> someone arrives -> title.
import * as A from "./audio.js";

export const CINE_MS = 31000;
const W = 1280, H = 720, K = "#2e1424";
const rnd = (i, s = 1) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const STARS = Array.from({ length: 220 }, (_, i) => ({ x: rnd(i, 1) * W, y: rnd(i, 2) * H, z: 0.2 + rnd(i, 3) * 0.8, tw: rnd(i, 4) * 6 }));
const ease = (x) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const seg = (t, a, b) => ease((t - a) / (b - a));     // 0..1 progress through [a, b] ms

const LINES = [                                         // [start ms, end ms, text]
  [600, 5200, "A traveller was going home. To a far star."],
  [5600, 9200, "Then the engine died."],
  [9600, 13200, "Mars pulled him down."],
  [15600, 21000, "He woke up alone. Broken ship. Three pieces lost."],
  [21600, 26200, "Then someone came."],
];
const CUES = [[300, () => A.music(true)], [1200, A.whoosh], [5400, A.danger], [6300, A.danger], [7200, A.danger], [8100, A.danger], [9400, A.whoosh], [11200, A.whoosh],
  [13400, A.die], [13500, A.blocked], [16800, () => A.ares(1)], [19000, () => A.ares(3)], [22600, A.jump], [23200, A.jump], [23800, A.jump], [24600, () => A.ares(2)], [24700, A.pickup], [26600, A.win]];

export function startCine(state) { state.cine = { t0: performance.now(), fired: new Set() }; }

function drawSprite(g, sheet, anim, frame, x, footY, scale, flip = false) {
  const a = sheet.anims[anim], [cw, ch] = sheet.cell, dw = cw * scale, dh = ch * scale;
  g.save(); g.translate(x, footY); if (flip) g.scale(-1, 1);
  g.drawImage(sheet.img, (frame % a.n) * cw, a.row * ch, cw, ch, -dw / 2, -dh, dw, dh); g.restore();
}
const img = (g, im, cx, cy, w, rot = 0) => { const h = (im.height / im.width) * w; g.save(); g.translate(cx, cy); g.rotate(rot); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore(); };
function glow(g, x, y, r, rgb, a) { const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, `rgba(${rgb},${a})`); q.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); }

function space(g, t, T) {                               // stars drifting, Mars rising
  g.fillStyle = "#07040c"; g.fillRect(0, 0, W, H);
  for (const s of STARS) { const x = (s.x - t * 0.02 * s.z + W * 4) % W, a = 0.35 + 0.65 * Math.abs(Math.sin(t / 700 + s.tw)); g.fillStyle = `rgba(255,${230 + 25 * s.z},${200 + 55 * s.z},${a * s.z})`; g.fillRect(x, s.y, s.z > 0.8 ? 3 : 2, s.z > 0.8 ? 3 : 2); }
  const rise = seg(t, 0, 9000), mx = 980, my = 900 - rise * 250, mr = 430;
  glow(g, mx, my, mr * 1.5, "255,110,60", 0.28);
  g.save(); g.beginPath(); g.arc(mx, my, mr, 0, 7); g.clip();
  g.fillStyle = g.createPattern(T.tex[2], "repeat"); g.save(); g.translate(-t * 0.004, 0); g.fillRect(mx - mr, my - mr, mr * 2 + 200, mr * 2); g.restore();
  const sh = g.createRadialGradient(mx - 180, my - 200, 80, mx, my, mr * 1.05); sh.addColorStop(0, "rgba(255,200,150,0.25)"); sh.addColorStop(0.6, "rgba(40,10,20,0.25)"); sh.addColorStop(1, "rgba(10,2,10,0.92)"); g.fillStyle = sh; g.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  g.restore();
}

function scene(g, t, T) {
  let shake = 0;
  if (t < 9400) {                                       // 1-2: cruising, then the engine fails
    space(g, t, T);
    const fail = t > 5400, x = -200 + seg(t, 0, 9400) * 900, y = 300 + Math.sin(t / 600) * 14 + (fail ? Math.sin(t / 37) * 7 : 0), rot = fail ? Math.sin(t / 90) * 0.06 + seg(t, 5400, 9400) * 0.22 : Math.sin(t / 900) * 0.02;
    const flick = fail ? (Math.sin(t / 45) > 0.2 ? 0.25 : 1) * (1 - seg(t, 7600, 9000)) : 1;
    for (let k = 0; k < 14; k++) glow(g, x - 150 - k * 22, y + 26 + Math.sin(t / 80 + k) * 3, 34 - k * 1.6, "79,240,208", 0.34 * flick * (1 - k / 14));
    if (fail) for (let k = 0; k < 10; k++) { const a = (t / 900 + k / 10) % 1; g.fillStyle = `rgba(90,70,90,${0.55 * (1 - a)})`; g.beginPath(); g.arc(x - 120 - a * 260, y + 10 - a * 60 + Math.sin(k) * 14, 10 + a * 34, 0, 7); g.fill(); }
    img(g, T.items.ship, x, y, 380, rot);
    if (fail) { for (let k = 0; k < 6; k++) if (rnd(Math.floor(t / 70), k) > 0.55) { g.fillStyle = k % 2 ? "#ffd23c" : "#fff"; g.fillRect(x - 60 + rnd(Math.floor(t / 70), k + 9) * 160, y - 30 + rnd(Math.floor(t / 70), k + 5) * 90, 5, 5); }
      if (Math.sin(t / 220) > 0.35) { g.fillStyle = "rgba(255,30,50,0.2)"; g.fillRect(0, 0, W, H); } shake = 3; }
  } else if (t < 13400) {                               // 3: falling through the sky
    const p = seg(t, 9400, 13400), sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, `rgb(${7 + p * 70},${4 + p * 22},${12 + p * 26})`); sky.addColorStop(1, `rgb(${60 + p * 180},${20 + p * 90},${30 + p * 40})`); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    for (const s of STARS) { g.fillStyle = `rgba(255,240,220,${(1 - p) * s.z})`; g.fillRect(s.x, s.y, 2, 2); }
    for (let k = 0; k < 26; k++) { const a = (t / (260 + rnd(k) * 300) + rnd(k, 2)) % 1; g.fillStyle = `rgba(255,${180 + rnd(k, 3) * 60},120,${0.5 * (1 - a)})`; g.fillRect(rnd(k, 4) * W * 1.3 - a * 520, rnd(k, 5) * H * 1.2 - 80 + a * 320 * -1 + 300 * a * 0 - a * 40, 90 + rnd(k) * 120, 3); }
    const x = 240 + p * 720, y = 120 + p * p * 420;
    for (let k = 0; k < 18; k++) glow(g, x - k * 36, y - k * 23, 110 - k * 4, k < 6 ? "255,240,190" : "255,120,40", 0.3 * (1 - k / 18));
    img(g, T.items.ship, x, y, 300, 0.62 + Math.sin(t / 60) * 0.04);
    glow(g, x + 90, y + 60, 150, "255,250,220", 0.55);
    shake = 6 + p * 10;
  } else {                                              // 4-6: the crater floor
    const sky = g.createLinearGradient(0, 0, 0, 420); sky.addColorStop(0, "#3a1830"); sky.addColorStop(0.55, "#a8483c"); sky.addColorStop(1, "#f0a060"); g.fillStyle = sky; g.fillRect(0, 0, W, 430);
    glow(g, 300, 330, 260, "255,220,170", 0.5); g.fillStyle = "#ffe9c8"; g.beginPath(); g.arc(300, 330, 26, 0, 7); g.fill();              // small, pale Mars sun
    g.fillStyle = "#6e2c34"; g.beginPath(); g.moveTo(0, 430); for (let x = 0; x <= W; x += 40) g.lineTo(x, 392 - Math.sin(x / 190) * 26 - Math.sin(x / 61) * 9 - (x > 800 ? (x - 800) * 0.09 : 0)); g.lineTo(W, 430); g.fill();   // far crater rim
    g.fillStyle = "#8c3a38"; g.beginPath(); g.moveTo(0, 440); for (let x = 0; x <= W; x += 40) g.lineTo(x, 416 - Math.sin(x / 130 + 2) * 14); g.lineTo(W, 440); g.fill();
    g.save(); g.translate(0, 425); g.transform(1, 0, 0, 0.5, 0, 0); g.fillStyle = g.createPattern(T.tex[2], "repeat"); g.fillRect(0, 0, W, 620); g.restore();
    const haze = g.createLinearGradient(0, 425, 0, H); haze.addColorStop(0, "rgba(240,160,96,0.6)"); haze.addColorStop(0.45, "rgba(120,50,50,0.1)"); haze.addColorStop(1, "rgba(30,10,24,0.45)"); g.fillStyle = haze; g.fillRect(0, 425, W, H - 425);
    const wx = 520, wy = 540;
    for (let k = 0; k < 9; k++) { const a = (t / 2600 + k / 9) % 1; g.fillStyle = `rgba(70,50,70,${0.5 * (1 - a)})`; g.beginPath(); g.arc(wx - 30 + Math.sin(a * 5 + k) * 40 + a * 90, wy - 60 - a * 330, 18 + a * 70, 0, 7); g.fill(); }
    img(g, T.items.wreck, wx, wy, 520); glow(g, wx + 20, wy + 10, 120, "79,240,208", 0.25 + 0.12 * Math.sin(t / 300));
    const dust = 1 - seg(t, 13400, 17500);              // dust from the impact settles
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(232,180,140,${0.35 * dust})`; g.beginPath(); g.arc(rnd(k, 7) * W, 380 + rnd(k, 8) * 300 - (1 - dust) * 60, 30 + rnd(k, 9) * 90, 0, 7); g.fill(); }
    if (t > 16200) {                                    // ARES climbs out and looks around
      const up = seg(t, 16200, 18400), ax = 770, ay = 640 - (1 - up) * 40, met = t > 24400;
      glow(g, ax, ay - 60, 130, met ? "255,207,74" : "79,240,208", 0.3 * up);
      g.globalAlpha = up; drawSprite(g, T.ares, met ? "happy" : t < 18800 ? "sad" : t < 21500 ? "idle" : "talk", t < 18800 ? 4 - Math.min(4, Math.floor((t - 16200) / 520)) : Math.floor(t / 170), ax, ay - (met ? Math.abs(Math.sin(t / 110)) * 22 : 0), 1.5, t > 21600); g.globalAlpha = 1;
    }
    if (t > 21600) {                                    // the astronaut walks in
      const p = seg(t, 21600, 24200), x = 1380 - p * 400;
      drawSprite(g, T.astro, p < 1 ? "side" : t > 24600 ? "win" : "idle", p < 1 ? Math.floor(t / 90) : t > 24600 ? Math.floor(t / 400) % 2 : Math.floor(t / 260), x, 650 - (p < 1 ? Math.abs(Math.sin(t / 130)) * 14 : 0), 1.25, p < 1);
    }
    shake = (1 - seg(t, 13400, 15200)) * 22;
  }
  return shake;
}

export function drawCine(g, state, T, onEnd) {
  const t = performance.now() - state.cine.t0;
  for (const [at, fn] of CUES) if (t >= at && !state.cine.fired.has(at)) { state.cine.fired.add(at); fn(); }
  if (t >= CINE_MS) return onEnd();
  g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = true;
  g.save();
  const sh = scene(g, t, T) || 0; g.restore();
  if (sh) { g.save(); g.globalCompositeOperation = "copy"; g.drawImage(g.canvas, Math.sin(t / 13) * sh, Math.cos(t / 17) * sh); g.restore(); }   // camera shake
  const flash = t > 13400 ? 1 - seg(t, 13400, 14600) : seg(t, 13100, 13400);   // the impact
  if (flash > 0) { g.fillStyle = `rgba(255,250,235,${flash})`; g.fillRect(0, 0, W, H); }
  if (t > 26200) {                                      // title
    const p = seg(t, 26200, 27400); g.fillStyle = `rgba(18,8,16,${0.78 * p})`; g.fillRect(0, 0, W, H);
    const s = 1 + (1 - ease(Math.min(1, (t - 26400) / 500))) * 2.2;
    g.save(); g.translate(W / 2, 330); g.scale(s, s); g.textAlign = "center"; g.font = "150px 'Press Start 2P', monospace";
    g.fillStyle = K; g.fillText("ARES", 10, 10); g.fillStyle = "#ffcf4a"; g.fillText("ARES", 0, 0); g.restore();
    if (t > 26900 && t < 27300) { g.fillStyle = `rgba(255,255,255,${1 - (t - 26900) / 400})`; g.fillRect(0, 0, W, H); }
    g.textAlign = "center"; g.globalAlpha = seg(t, 27400, 28400);
    g.font = "30px 'Press Start 2P', monospace"; g.fillStyle = "#4ff0d0"; g.fillText("A JEZERO MARSWALK", W / 2, 420);
    g.font = "17px 'Press Start 2P', monospace"; g.fillStyle = "#fff1dc"; g.fillText("Every slope is real NASA data of Jezero Crater, Mars", W / 2, 480); g.globalAlpha = 1;
  }
  const v = g.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 820); v.addColorStop(0, "rgba(10,4,10,0)"); v.addColorStop(1, "rgba(10,4,10,0.8)"); g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.fillStyle = "#000"; g.fillRect(0, 0, W, 64); g.fillRect(0, H - 64, W, 64);                                     // letterbox
  const L = LINES.find((l) => t >= l[0] && t < l[1]);
  if (L) { g.globalAlpha = Math.min(1, (L[1] - t) / 500); g.font = "20px 'Press Start 2P', monospace"; g.textAlign = "center";
    const txt = L[2].slice(0, Math.floor((t - L[0]) / 34)); g.fillStyle = K; g.fillText(txt, W / 2 + 3, H - 92 + 3); g.fillStyle = "#fff6e6"; g.fillText(txt, W / 2, H - 92); g.globalAlpha = 1; }
  const fade = Math.max(1 - t / 900, seg(t, CINE_MS - 900, CINE_MS)); if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, W, H); }
}
