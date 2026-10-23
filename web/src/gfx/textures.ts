// Port of App/Textures.swift: every image is drawn in code with Canvas 2D (no downloaded art).
import * as THREE from 'three';

export const hex = (v: number, a = 1): string =>
  `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;

/** Fixed-seed noise so textures look the same on every load. */
function noise(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s >>> 8) / 16777216;
  };
}

function canvas(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  draw(el.getContext('2d')!);
  return el;
}

function texture(el: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Sky: deep blue top → warm horizon → pink haze, with small clouds just above the horizon. Equirectangular. */
export function skyTexture(): THREE.Texture {
  const el = canvas(1024, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, hex(0x1d4ed8));
    g.addColorStop(0.3, hex(0x38bdf8));
    g.addColorStop(0.44, hex(0xbae6fd));
    g.addColorStop(0.5, hex(0xfde68a));
    g.addColorStop(1, hex(0xfbcfe8));
    c.fillStyle = g;
    c.fillRect(0, 0, 1024, 512);
    const n = noise(7);
    c.fillStyle = hex(0xffffff, 0.7);
    for (let i = 0; i < 18; i++) {
      const x = n() * 1024, y = 196 + n() * 44, r = 6 + n() * 10;
      for (let k = 0; k < 5; k++) {
        c.beginPath();
        c.ellipse(x + k * r * 1.1 + r * 1.2, y - (k % 2) * r * 0.4 + r * 0.45, r * 1.2, r * 0.45, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  });
  const t = texture(el);
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

export function gravelTexture(): THREE.Texture {
  return texture(
    canvas(256, 256, (c) => {
      c.fillStyle = hex(0x6b6f76);
      c.fillRect(0, 0, 256, 256);
      const n = noise(11);
      for (let i = 0; i < 1800; i++) {
        const v = Math.round((0.35 + n() * 0.45) * 255);
        c.fillStyle = `rgb(${v},${v},${v})`;
        const r = 2 + n() * 5;
        c.beginPath();
        c.ellipse(n() * 256, n() * 256, r / 2, r * 0.4, 0, 0, Math.PI * 2);
        c.fill();
      }
    }),
    true,
  );
}

export function woodTexture(): THREE.Texture {
  return texture(
    canvas(256, 64, (c) => {
      c.fillStyle = hex(0x7c4a21);
      c.fillRect(0, 0, 256, 64);
      const n = noise(3);
      for (let i = 0; i < 40; i++) {
        c.strokeStyle = hex(n() > 0.5 ? 0x5b3416 : 0x96612f, 0.7);
        c.lineWidth = 1 + n() * 2;
        const y = n() * 64;
        c.beginPath();
        c.moveTo(0, y);
        c.bezierCurveTo(80, y + 6, 170, y - 6, 256, y + (n() - 0.5) * 10);
        c.stroke();
      }
    }),
  );
}

export const BUILDING_COLORS = [0xf87171, 0xfbbf24, 0x34d399, 0x60a5fa, 0xa78bfa, 0xf472b6, 0xfb923c, 0x2dd4bf];

/** Building facade: 4 floors × 4 windows; some windows lit. */
export function facadeTexture(wall: number): THREE.Texture {
  return texture(
    canvas(256, 256, (c) => {
      c.fillStyle = hex(wall);
      c.fillRect(0, 0, 256, 256);
      const n = noise(wall);
      for (let row = 0; row < 4; row++) {
        c.fillStyle = hex(0x000000, 0.12);
        c.fillRect(0, row * 64 + 60, 256, 4);
        for (let col = 0; col < 4; col++) {
          const x = col * 64 + 14, y = row * 64 + 12;
          c.fillStyle = hex(0xffffff, 0.85);
          c.fillRect(x - 3, y - 3, 42, 46);
          c.fillStyle = hex(n() > 0.7 ? 0xfde68a : 0x1e3a5f);
          c.fillRect(x, y, 36, 40);
          c.fillStyle = hex(0xffffff, 0.25);
          c.fillRect(x + 4, y + 4, 8, 32);
        }
      }
    }),
    true,
  );
}

/** Diagonal warning stripes. */
export function stripesTexture(a: number, b: number): THREE.Texture {
  const t = texture(
    canvas(256, 64, (c) => {
      c.fillStyle = hex(a);
      c.fillRect(0, 0, 256, 64);
      c.fillStyle = hex(b);
      for (let x = -64; x < 320; x += 64) {
        c.beginPath();
        c.moveTo(x, 64);
        c.lineTo(x + 32, 64);
        c.lineTo(x + 96, 0);
        c.lineTo(x + 64, 0);
        c.closePath();
        c.fill();
      }
    }),
    true,
  );
  t.repeat.set(2, 1);
  return t;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}

/** Train side livery for the whole 10 m side. */
export function trainSideTexture(): THREE.Texture {
  return texture(
    canvas(1024, 256, (c) => {
      c.fillStyle = hex(0xf8fafc);
      c.fillRect(0, 0, 1024, 256);
      c.fillStyle = hex(0x1e40af);
      c.fillRect(0, 52, 1024, 70);
      for (let i = 0; i < 9; i++) {
        const x = 30 + i * 110;
        c.fillStyle = hex(0x93c5fd);
        roundRect(c, x, 60, 80, 54, 10);
        c.fillStyle = hex(0xffffff, 0.5);
        c.fillRect(x + 8, 66, 14, 42);
      }
      c.fillStyle = hex(0xef4444);
      c.fillRect(0, 140, 1024, 22);
      c.fillStyle = hex(0xfacc15);
      c.fillRect(0, 166, 1024, 6);
      c.strokeStyle = hex(0x94a3b8);
      c.lineWidth = 5;
      for (const d of [300, 700]) c.strokeRect(d, 40, 70, 170);
      c.fillStyle = hex(0x475569);
      c.fillRect(0, 214, 1024, 42);
    }),
  );
}

/** Train front: windscreen, sign, stripes, lamp housings. */
export function trainFrontTexture(): THREE.Texture {
  return texture(
    canvas(256, 384, (c) => {
      c.fillStyle = hex(0xf8fafc);
      c.fillRect(0, 0, 256, 384);
      c.fillStyle = hex(0x0f172a);
      roundRect(c, 26, 60, 204, 120, 22);
      c.fillStyle = hex(0x60a5fa, 0.5);
      c.fillRect(40, 72, 40, 96);
      c.fillStyle = hex(0x111827);
      c.fillRect(60, 20, 136, 30);
      c.fillStyle = hex(0xf59e0b);
      c.fillRect(72, 28, 112, 14);
      c.fillStyle = hex(0xef4444);
      c.fillRect(0, 210, 256, 30);
      c.fillStyle = hex(0x1e40af);
      c.fillRect(0, 244, 256, 10);
      c.fillStyle = hex(0x334155);
      for (const x of [58, 198]) { c.beginPath(); c.ellipse(x, 290, 28, 20, 0, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = hex(0x475569);
      c.fillRect(0, 330, 256, 54);
    }),
  );
}

/** Soft white dot for particles (with alpha). */
export function dotTexture(): THREE.Texture {
  return texture(
    canvas(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    }),
  );
}
