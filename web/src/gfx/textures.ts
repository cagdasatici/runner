// Port of App/Textures.swift: every image is drawn in code with Canvas 2D (no downloaded art).
import * as THREE from 'three';

export const hex = (v: number, a = 1): string =>
  `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;

/** Fixed-seed noise so textures look the same on every load. */
export function noise(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s >>> 8) / 16777216;
  };
}

export function canvas(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  draw(el.getContext('2d')!);
  return el;
}

let maxAniso = 4;
export function getMaxAnisotropy(): number { return maxAniso; }
/** Set before textures are created (Game constructor). */
export function setMaxAnisotropy(n: number): void { maxAniso = n; }

export function texture(el: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
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

export function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
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

/** Finish banner: red band with "FINISH" between two checkered strips. */
export function finishBannerTexture(): THREE.Texture {
  return texture(
    canvas(512, 96, (c) => {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 32; x++) {
        c.fillStyle = (x + y) % 2 ? hex(0x111827) : hex(0xffffff);
        c.fillRect(x * 16, y * 16, 16, 16);
        c.fillRect(x * 16, 64 + y * 16, 16, 16);
      }
      c.fillStyle = hex(0xef4444);
      c.fillRect(0, 32, 512, 32);
      c.fillStyle = hex(0xffffff);
      c.font = '900 30px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('F I N I S H', 256, 49);
    }),
  );
}

/** Checkered finish line on the ground (2 rows of squares). */
export function checkerTexture(): THREE.Texture {
  return texture(
    canvas(256, 16, (c) => {
      for (let x = 0; x < 32; x++) for (let y = 0; y < 2; y++) {
        c.fillStyle = (x + y) % 2 ? hex(0x111827) : hex(0xffffff);
        c.fillRect(x * 8, y * 8, 8, 8);
      }
    }),
  );
}
