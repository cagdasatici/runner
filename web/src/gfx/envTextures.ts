// Procedural textures for the themed environment: sky, skyline backdrop, facades, the vehicle trim sheet, particles.
// Everything is drawn once with Canvas 2D (no downloaded art), kept small (<= 1024 px) and shared.
import * as THREE from 'three';
import type { Theme } from './themes';
import { canvas, hex, getMaxAnisotropy, noise, roundRect, texture } from './textures';

const mix = (a: number, b: number, t: number): number => {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
};
export { mix };

/** Equirectangular sky: gradient, stars, sun/moon disc and soft clouds. The runner looks at u = 0.25 (menu: 0.75). */
export function skyTexture(t: Theme): THREE.Texture {
  const W = 1024, H = 512;
  const el = canvas(W, H, (c) => {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, hex(t.sky.top));
    g.addColorStop(0.28, hex(t.sky.mid));
    g.addColorStop(0.5, hex(t.sky.horizon));
    g.addColorStop(0.52, hex(t.sky.below));
    g.addColorStop(1, hex(t.sky.below));
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const n = noise(t.id.length * 977 + 5);
    if (t.stars > 0) {
      for (let i = 0; i < 260 * t.stars; i++) {
        const y = n() * H * 0.42;
        c.fillStyle = hex(0xffffff, 0.35 + n() * 0.65);
        const r = 0.6 + n() * 1.5;
        c.beginPath(); c.arc(n() * W, y, r, 0, Math.PI * 2); c.fill();
      }
    }
    if (t.orb) {
      for (const u of [0.25, 0.75]) {
        const x = u * W, y = H * (0.5 - t.orb.height * 0.85);
        const halo = c.createRadialGradient(x, y, 0, x, y, t.orb.size * 3.4);
        halo.addColorStop(0, hex(t.orb.color, 0.55));
        halo.addColorStop(1, hex(t.orb.color, 0));
        c.fillStyle = halo;
        c.fillRect(x - 200, y - 200, 400, 400);
        c.fillStyle = hex(t.orb.color);
        c.beginPath(); c.arc(x, y, t.orb.size, 0, Math.PI * 2); c.fill();
      }
    }
    // clouds: flat-bottomed puffs (overlapping circles) in a band above the horizon, bigger when closer to it
    for (let i = 0; i < t.cloud.count; i++) {
      const x = n() * W, y = H * (0.3 + n() * 0.17), s = 14 + n() * 26;
      c.fillStyle = hex(t.cloud.color, t.cloud.alpha * (0.6 + n() * 0.4));
      for (let k = -2; k <= 2; k++) {
        const r = s * (0.5 + 0.35 * Math.cos(k * 0.7));
        c.beginPath(); c.arc(x + k * s * 0.7, y - r * 0.35 + (k % 2) * 3, r, 0, Math.PI * 2); c.fill();
      }
      c.fillRect(x - s * 1.4, y, s * 2.8, s * 0.12);
    }
    // soft haze at the horizon so the fog blends in
    const h = c.createLinearGradient(0, H * 0.4, 0, H * 0.53);
    h.addColorStop(0, hex(t.fog.color, 0));
    h.addColorStop(1, hex(t.fog.color, 0.85));
    c.fillStyle = h;
    c.fillRect(0, H * 0.4, W, H * 0.13);
  });
  const tex = texture(el);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

/** Wide skyline strip drawn in front of the sky beyond the fog (transparent above the silhouette). */
export function backdropTexture(t: Theme): THREE.Texture {
  const W = 1024, H = 192;
  const el = canvas(W, H, (c) => {
    const n = noise(t.id.length * 131 + 9);
    const col = t.backdrop.color;
    const dark = mix(col, 0x000000, 0.18);
    c.fillStyle = hex(col);
    const base = H;
    switch (t.backdrop.kind) {
      case 'city':
        for (let x = 0; x < W;) {
          const w = 24 + n() * 46, h = 40 + n() * 110 * (n() > 0.8 ? 1.3 : 0.8);
          c.fillStyle = hex(n() > 0.5 ? col : dark);
          c.fillRect(x, base - h, w, h);
          if (n() > 0.7) c.fillRect(x + w * 0.4, base - h - 16, 4, 16);
          if (t.windowGlow > 0.3) {
            c.fillStyle = hex(0xffe9a8, 0.55);
            for (let wy = base - h + 8; wy < base - 8; wy += 12) for (let wx = x + 5; wx < x + w - 6; wx += 10) if (n() > 0.55) c.fillRect(wx, wy, 4, 6);
          }
          x += w + n() * 4;
        }
        break;
      case 'hills': case 'candy': {
        for (let layer = 0; layer < 2; layer++) {
          c.fillStyle = hex(layer ? col : mix(col, 0xffffff, 0.25));
          c.beginPath(); c.moveTo(0, base);
          const ph = n() * 6;
          for (let x = 0; x <= W; x += 8) c.lineTo(x, base - 50 - layer * 22 - Math.sin(x / 90 + ph) * 26 - Math.sin(x / 37 + ph * 2) * 8);
          c.lineTo(W, base); c.fill();
        }
        if (t.backdrop.kind === 'candy') {
          for (let i = 0; i < 9; i++) {
            const x = n() * W, h = 40 + n() * 50;
            c.fillStyle = hex(0xffffff, 0.9); c.fillRect(x - 2, base - 60 - h, 4, h);
            c.fillStyle = hex([0xff5fa8, 0x5fd0ff, 0xffe04f][i % 3]); c.beginPath(); c.arc(x, base - 66 - h, 14, 0, Math.PI * 2); c.fill();
          }
        }
        break;
      }
      case 'peaks': case 'volcano': case 'mesas': {
        for (let layer = 0; layer < 2; layer++) {
          c.fillStyle = hex(layer ? col : mix(col, 0xffffff, 0.22));
          c.beginPath(); c.moveTo(0, base);
          for (let x = 0; x < W; x += 1) {
            let y: number;
            if (t.backdrop.kind === 'mesas') { const k = Math.sin(x / 70 + layer * 3) + Math.sin(x / 23); y = base - 55 - layer * 18 - Math.max(0, Math.min(1, k * 1.5)) * 45; }
            else y = base - 40 - layer * 24 - Math.abs(Math.sin(x / 80 + layer * 2.2)) * 80 - Math.abs(Math.sin(x / 31)) * 12;
            c.lineTo(x, y);
          }
          c.lineTo(W, base); c.fill();
        }
        if (t.backdrop.kind === 'peaks' && t.snow) {
          c.fillStyle = hex(0xffffff, 0.85);
          for (let x = 4; x < W; x += 80) { c.beginPath(); c.moveTo(x + 37, base - 124); c.lineTo(x + 25, base - 100); c.lineTo(x + 49, base - 100); c.fill(); }
        }
        if (t.backdrop.kind === 'volcano') {
          const x = W * 0.28;
          c.fillStyle = hex(col); c.beginPath(); c.moveTo(x - 200, base); c.lineTo(x - 36, base - 140); c.lineTo(x + 36, base - 140); c.lineTo(x + 200, base); c.fill();
          const g = c.createLinearGradient(0, base - 160, 0, base - 135);
          g.addColorStop(0, hex(0xffd23f, 0)); g.addColorStop(1, hex(0xff6a1a, 1));
          c.fillStyle = g; c.fillRect(x - 38, base - 160, 76, 25);
        }
        break;
      }
      case 'islands': {
        c.fillStyle = hex(col, 0.9);
        for (let i = 0; i < 6; i++) {
          const x = n() * W, w = 90 + n() * 130, h = 16 + n() * 30;
          c.beginPath(); c.ellipse(x, base - 30, w, h, 0, Math.PI, 0); c.fill();
        }
        c.fillStyle = hex(mix(col, 0x000000, 0.25));
        for (let i = 0; i < 12; i++) { // port cranes
          const x = n() * W, h = 50 + n() * 40;
          c.fillRect(x, base - 30 - h, 4, h); c.fillRect(x - 6, base - 30 - h, 34, 4);
        }
        break;
      }
      case 'planet': {
        const x = W * 0.3, y = base - 40;
        const g = c.createRadialGradient(x - 30, y - 30, 8, x, y, 120);
        g.addColorStop(0, hex(mix(col, 0xffffff, 0.4))); g.addColorStop(1, hex(mix(col, 0x000000, 0.4)));
        c.fillStyle = g; c.beginPath(); c.arc(x, y, 110, 0, Math.PI * 2); c.fill();
        c.strokeStyle = hex(0xbfc4ff, 0.7); c.lineWidth = 6;
        c.beginPath(); c.ellipse(x, y, 190, 34, -0.25, 0, Math.PI * 2); c.stroke();
        c.fillStyle = hex(dark);
        for (let i = 0; i < 14; i++) { const px = n() * W, h = 20 + n() * 40; c.fillRect(px, base - h, 14 + n() * 24, h); }
        break;
      }
    }
    // fade the bottom into the fog colour (atmospheric perspective), keeping it opaque at the very bottom
    const f = c.createLinearGradient(0, H * 0.35, 0, H);
    f.addColorStop(0, hex(t.fog.color, 0.0));
    f.addColorStop(1, hex(t.fog.color, 1));
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = f;
    c.fillRect(0, 0, W, H);
    // blend everything towards the fog by `far` (higher = more faded)
    c.fillStyle = hex(t.fog.color, t.backdrop.far * 0.45);
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
  });
  const tex = texture(el);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Building facade tile, 8 columns × 4 floors, white walls (tinted per building by vertex colours). Returns colour + glow maps. */
export function facadeTextures(): { map: THREE.Texture; glow: THREE.Texture } {
  const S = 512, cw = 64, ch = 128;
  const lit: boolean[] = [];
  const n = noise(4242);
  for (let i = 0; i < 32; i++) lit.push(n() > 0.62);
  const draw = (glow: boolean) => canvas(S, S, (c) => {
    c.fillStyle = glow ? '#000' : '#fff';
    c.fillRect(0, 0, S, S);
    for (let row = 0; row < 4; row++) {
      if (!glow) { // floor band shadow + highlight
        c.fillStyle = hex(0x000000, 0.1); c.fillRect(0, row * ch + ch - 7, S, 7);
        c.fillStyle = hex(0xffffff, 1); c.fillRect(0, row * ch + ch - 9, S, 2);
      }
      for (let col = 0; col < 8; col++) {
        const x = col * cw + 11, y = row * ch + 22, w = cw - 22, h = 66;
        const isLit = lit[row * 8 + col];
        if (glow) {
          if (!isLit) continue;
          const g = c.createLinearGradient(0, y, 0, y + h);
          g.addColorStop(0, hex(0xfff2b8)); g.addColorStop(1, hex(0xffb347));
          c.fillStyle = g; c.fillRect(x, y, w, h);
          continue;
        }
        c.fillStyle = hex(0x000000, 0.18); c.fillRect(x - 4, y - 4, w + 8, h + 10); // frame shadow
        c.fillStyle = hex(0xf6f3ee); c.fillRect(x - 3, y - 3, w + 6, h + 6);        // frame
        const g = c.createLinearGradient(0, y, 0, y + h);
        if (isLit) { g.addColorStop(0, hex(0xfff2b8)); g.addColorStop(1, hex(0xffc15e)); }
        else { g.addColorStop(0, hex(0x6fb4ea)); g.addColorStop(1, hex(0x1f4d86)); }
        c.fillStyle = g; c.fillRect(x, y, w, h);
        c.fillStyle = hex(0xffffff, isLit ? 0.25 : 0.35);                              // glass reflection
        c.beginPath(); c.moveTo(x, y + h * 0.55); c.lineTo(x + w * 0.6, y); c.lineTo(x + w, y); c.lineTo(x, y + h * 0.95); c.fill();
        c.fillStyle = hex(0x000000, 0.35); c.fillRect(x + w / 2 - 1, y, 2, h);         // mullion
        c.fillStyle = hex(0xd8d2c8); c.fillRect(x - 5, y + h + 3, w + 10, 5);          // sill
      }
    }
  });
  return { map: texture(draw(false), true), glow: texture(draw(true), true) };
}

// ---- vehicle trim sheet ---------------------------------------------------------------------------------------------
export const ATLAS_SIZE = 1024;
type Rect = [number, number, number, number]; // x, y, w, h in pixels (canvas, y down)
export const ATLAS: Record<'side' | 'front' | 'roof' | 'white' | 'dark' | 'hazardYB' | 'hazardRW' | 'deck', Rect> = {
  side: [0, 0, 1024, 320],
  front: [0, 330, 256, 340],
  roof: [270, 330, 128, 640],
  white: [410, 330, 32, 32],
  dark: [410, 370, 32, 32],
  hazardYB: [450, 330, 256, 64],
  hazardRW: [450, 400, 256, 64],
  deck: [450, 470, 256, 256],
};
/** UV rectangle (u0, v0, u1, v1) of an atlas region, ready for `Merger.add({ uv })`. Insets a texel so filtering doesn't bleed. */
export function atlasUV(name: keyof typeof ATLAS, inset = 1): [number, number, number, number] {
  const [x, y, w, h] = ATLAS[name];
  return [(x + inset) / ATLAS_SIZE, 1 - (y + h - inset) / ATLAS_SIZE, (x + w - inset) / ATLAS_SIZE, 1 - (y + inset) / ATLAS_SIZE];
}

function stripes(c: CanvasRenderingContext2D, r: Rect, a: number, b: number, count: number): void {
  const [x, y, w, h] = r;
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = hex(a); c.fillRect(x, y, w, h);
  c.fillStyle = hex(b);
  const step = w / count;
  for (let i = -2; i < count + 2; i++) {
    c.beginPath();
    c.moveTo(x + i * step, y + h); c.lineTo(x + i * step + step / 2, y + h);
    c.lineTo(x + i * step + step / 2 + h, y); c.lineTo(x + i * step + h, y);
    c.fill();
  }
  c.restore();
}

/** One 1024² sheet for trains, ramps and barriers: white body (tinted by vertex colours), windows, cab, roof, hazard stripes. */
export function vehicleAtlas(): THREE.Texture {
  const el = canvas(ATLAS_SIZE, ATLAS_SIZE, (c) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
    // --- side of one 10 m car (102 px per metre); top of the strip is the roof edge, the bottom is the skirt
    const [sx, sy, sw, sh] = ATLAS.side;
    c.save(); c.translate(sx, sy);
    const skirt = c.createLinearGradient(0, 240, 0, sh);
    skirt.addColorStop(0, hex(0xffffff, 0)); skirt.addColorStop(0.25, hex(0x4a5568, 0.85)); skirt.addColorStop(1, hex(0x2d3748));
    c.fillStyle = skirt; c.fillRect(0, 232, sw, sh - 232);
    const win = (x: number, w: number) => {
      c.fillStyle = hex(0x0b1220, 0.35); c.fillRect(x - 4, 60, w + 8, 138);
      c.fillStyle = '#fff'; roundRect(c, x - 3, 62, w + 6, 132, 14);
      const g = c.createLinearGradient(0, 68, 0, 186);
      g.addColorStop(0, hex(0x7cc4f4)); g.addColorStop(0.55, hex(0x2c5f9e)); g.addColorStop(1, hex(0x17305a));
      c.fillStyle = g; roundRect(c, x, 68, w, 120, 11);
      c.fillStyle = hex(0xffffff, 0.3);
      c.beginPath(); c.moveTo(x + 8, 180); c.lineTo(x + w * 0.5, 72); c.lineTo(x + w * 0.5 + 26, 72); c.lineTo(x + 34, 180); c.fill();
    };
    const zones: [number, number][] = [[28, 168], [352, 672], [856, 996]];
    for (const [a, b] of zones) {
      const n = Math.max(1, Math.floor((b - a + 14) / 130));
      const w = (b - a - 14 * (n - 1)) / n;
      for (let i = 0; i < n; i++) win(a + i * (w + 14), w);
    }
    for (const dx of [194, 700]) { // doors
      c.fillStyle = hex(0x000000, 0.22); c.fillRect(dx - 4, 34, 140, 214);
      c.fillStyle = hex(0xeceff3); c.fillRect(dx, 38, 132, 206);
      c.fillStyle = hex(0x9aa5b1); c.fillRect(dx + 64, 38, 4, 206);
      for (const gx of [dx + 12, dx + 76]) {
        const g = c.createLinearGradient(0, 56, 0, 190);
        g.addColorStop(0, hex(0x7cc4f4)); g.addColorStop(1, hex(0x1f4d86));
        c.fillStyle = g; roundRect(c, gx, 56, 44, 134, 8);
      }
      c.fillStyle = hex(0x22c55e); c.fillRect(dx + 54, 20, 24, 10); // door light
    }
    c.fillStyle = hex(0x000000, 0.14); // car end seams
    c.fillRect(0, 0, 6, sh); c.fillRect(sw - 6, 0, 6, sh);
    c.restore();
    // --- front (cab): windscreen, destination sign, bumper
    const [fx, fy, fw, fh] = ATLAS.front;
    c.save(); c.translate(fx, fy);
    c.fillStyle = hex(0x1b2433); roundRect(c, 22, 54, fw - 44, 124, 26);
    const wg = c.createLinearGradient(0, 62, 0, 170);
    wg.addColorStop(0, hex(0x8ed0ff)); wg.addColorStop(1, hex(0x234a80));
    c.fillStyle = wg; roundRect(c, 30, 62, fw - 60, 108, 20);
    c.fillStyle = hex(0xffffff, 0.3); c.beginPath(); c.moveTo(40, 160); c.lineTo(100, 66); c.lineTo(132, 66); c.lineTo(72, 160); c.fill();
    c.fillStyle = hex(0x101722); roundRect(c, 62, 14, fw - 124, 30, 6);
    c.fillStyle = hex(0xffb347); roundRect(c, 70, 20, fw - 140, 18, 4);
    stripes(c, [0, 214, fw, 30], 0xfacc15, 0x1f2937, 9);
    c.fillStyle = hex(0x2d3748); c.fillRect(0, 262, fw, fh - 262);
    c.fillStyle = hex(0x1a202c); c.fillRect(20, 286, fw - 40, 10);
    c.restore();
    // --- roof: light running surface with panel seams and yellow edge dashes
    const [rx, ry, rw, rh] = ATLAS.roof;
    c.save(); c.translate(rx, ry);
    c.fillStyle = hex(0xe3e8ee); c.fillRect(0, 0, rw, rh);
    c.fillStyle = hex(0xf6f8fb); c.fillRect(14, 0, rw - 28, rh);
    c.fillStyle = hex(0x8c97a6, 0.7);
    for (let y = 0; y < rh; y += 64) c.fillRect(8, y, rw - 16, 3);
    c.fillStyle = hex(0xfacc15);
    for (let y = 8; y < rh; y += 32) { c.fillRect(2, y, 8, 18); c.fillRect(rw - 10, y, 8, 18); }
    c.fillStyle = hex(0xc4ccd6, 0.9); // chevrons showing the way
    for (let y = 40; y < rh; y += 160) { c.beginPath(); c.moveTo(rw / 2, y); c.lineTo(rw / 2 + 22, y + 22); c.lineTo(rw / 2 + 22, y + 36); c.lineTo(rw / 2, y + 14); c.lineTo(rw / 2 - 22, y + 36); c.lineTo(rw / 2 - 22, y + 22); c.fill(); }
    c.restore();
    c.fillStyle = hex(0x232b38); c.fillRect(ATLAS.dark[0], ATLAS.dark[1], 32, 32);
    stripes(c, ATLAS.hazardYB, 0xfacc15, 0x1f2937, 8);
    stripes(c, ATLAS.hazardRW, 0xef4444, 0xffffff, 8);
    // --- ramp deck: dark steel, grip ribs, yellow arrows pointing up the slope (towards smaller canvas y)
    const [dx, dy, dw, dh] = ATLAS.deck;
    c.fillStyle = hex(0x3b4452); c.fillRect(dx, dy, dw, dh);
    c.fillStyle = hex(0x56606f);
    for (let y = 6; y < dh; y += 14) c.fillRect(dx + 14, dy + y, dw - 28, 5);
    c.fillStyle = hex(0xfacc15);
    c.fillRect(dx + 6, dy, 8, dh); c.fillRect(dx + dw - 14, dy, 8, dh);
    for (let y = 40; y < dh; y += 110) {
      c.beginPath(); c.moveTo(dx + dw / 2, dy + y); c.lineTo(dx + dw / 2 + 50, dy + y + 56); c.lineTo(dx + dw / 2 + 24, dy + y + 56);
      c.lineTo(dx + dw / 2 + 24, dy + y + 92); c.lineTo(dx + dw / 2 - 24, dy + y + 92); c.lineTo(dx + dw / 2 - 24, dy + y + 56); c.lineTo(dx + dw / 2 - 50, dy + y + 56); c.fill();
    }
  });
  const t = texture(el);
  t.anisotropy = getMaxAnisotropy();
  return t;
}

/** Four-point sparkle for coin and star glints (with alpha). */
export function sparkleTexture(): THREE.Texture {
  return texture(
    canvas(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 14);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
      c.fillStyle = 'rgba(255,255,255,0.95)';
      c.beginPath();
      c.moveTo(32, 1); c.quadraticCurveTo(34, 30, 63, 32); c.quadraticCurveTo(34, 34, 32, 63);
      c.quadraticCurveTo(30, 34, 1, 32); c.quadraticCurveTo(30, 30, 32, 1);
      c.fill();
    }),
  );
}

/** Small rounded rectangle for confetti (with alpha). */
export function confettiTexture(): THREE.Texture {
  return texture(canvas(32, 32, (c) => { c.fillStyle = '#fff'; roundRect(c, 6, 4, 20, 24, 4); }));
}
