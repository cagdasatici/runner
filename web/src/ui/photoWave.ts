// Finish photo wave for Arel and Nora: bubbles fly across the screen, then one big "Go <name>!" photo.
export const WAVE = { count: 12, stagger: 0.22, travel: 5.4, total: 9.0, finaleAt: 6.6, rows: [0.34, 0.62], amp: 0.07, lambda: 0.55 } as const;

/** File names in faces/ that belong to a kid (prefix match, image extensions only), sorted for a stable order. */
export function pickPhotos(names: string[], prefix: string): string[] {
  const p = prefix.toLowerCase();
  return names.filter((n) => n.toLowerCase().startsWith(p) && /\.(png|jpe?g|webp)$/i.test(n)).sort();
}

const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

/** Centre position (CSS px) of bubble i at time t (s since the wave began), or null when it is not on its path yet / any more. */
export function wavePos(i: number, t: number, vw: number, vh: number, size: number): { x: number; y: number; rot: number; scale: number } | null {
  const local = t - i * WAVE.stagger;
  if (local < 0 || local > WAVE.travel) return null;
  const u = easeInOut(local / WAVE.travel);
  const x = -size + u * (vw + 2 * size);
  const row = i % 2;
  const y = WAVE.rows[row] * vh + WAVE.amp * vh * Math.sin((2 * Math.PI * x) / (WAVE.lambda * vw) + (row ? Math.PI : 0));
  const k = Math.min(1, local / 0.3);
  const scale = k < 0.7 ? (k / 0.7) * 1.15 : 1.15 - ((k - 0.7) / 0.3) * 0.15;
  return { x, y, rot: 8 * Math.sin(1.8 * t + i), scale };
}

const cache = new Map<string, Promise<string[]>>();

const canLoad = (url: string) => new Promise<boolean>((res) => {
  const img = new Image();
  img.onload = () => res(true);
  img.onerror = () => res(false);
  img.src = url;
});

async function loadAll(urls: string[]): Promise<string[]> {
  const ok = await Promise.all(urls.map(canLoad));
  return urls.filter((_, i) => ok[i]);
}

/** Preloads a kid's photos (listed by faces/index.json, else the fallback url); resolves to the URLs that loaded. Memoized per prefix. */
export function loadPhotos(prefix: string, fallbackUrl?: string): Promise<string[]> {
  const hit = cache.get(prefix);
  if (hit) return hit;
  const p = (async () => {
    try {
      const base = import.meta.env.BASE_URL;
      const res = await fetch(`${base}faces/index.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error('no index');
      const names = (await res.json()) as unknown;
      if (!Array.isArray(names)) throw new Error('bad index');
      const urls = await loadAll(pickPhotos(names.filter((n): n is string => typeof n === 'string'), prefix).map((n) => `${base}faces/${encodeURIComponent(n)}`));
      if (urls.length) return urls;
      throw new Error('none loaded');
    } catch {
      return fallbackUrl ? loadAll([fallbackUrl]) : [];
    }
  })();
  cache.set(prefix, p);
  return p;
}

/** Plays the wave + finale over the page; returns cancel(). Removes itself after WAVE.total seconds. */
export function playPhotoWave(urls: string[], name: string, hooks: { onPop?: (i: number) => void; onFinale?: () => void }): () => void {
  const root = document.createElement('div');
  root.id = 'photo-wave';
  document.body.appendChild(root);
  let done = false;
  let raf = 0;
  const timers: number[] = [];
  const cancel = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    timers.forEach((t) => window.clearTimeout(t));
    root.remove();
  };
  const mk = (cls: string, url: string) => {
    const d = document.createElement('div');
    d.className = cls;
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    d.appendChild(img);
    return d;
  };
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  if (reduced) {
    const grid = document.createElement('div');
    grid.className = 'pw-grid';
    urls.slice(0, 6).forEach((u) => grid.appendChild(mk('pw-bubble static', u)));
    root.appendChild(grid);
    grid.animate([{ opacity: 0 }, { opacity: 1, offset: 0.4 / 2.6 }, { opacity: 1, offset: 2.2 / 2.6 }, { opacity: 0 }], { duration: 2600, fill: 'forwards' });
    timers.push(window.setTimeout(cancel, 2600));
    return cancel;
  }

  const vmin = () => Math.min(window.innerWidth, window.innerHeight);
  const size = () => Math.max(72, Math.min(150, 0.16 * vmin()));
  const bubbles = Array.from({ length: WAVE.count }, (_, i) => {
    const el = mk('pw-bubble', urls[i % urls.length]);
    el.style.width = el.style.height = `${size()}px`;
    el.style.visibility = 'hidden';
    root.appendChild(el);
    return el;
  });
  const popped = new Array<boolean>(WAVE.count).fill(false);
  let finale = false;
  const t0 = performance.now();
  const frame = () => {
    if (done) return;
    const t = (performance.now() - t0) / 1000;
    const vw = window.innerWidth, vh = window.innerHeight, s = size();
    bubbles.forEach((el, i) => {
      const p = wavePos(i, t, vw, vh, s);
      if (!p) { el.style.visibility = 'hidden'; return; }
      if (!popped[i]) { popped[i] = true; hooks.onPop?.(i); }
      el.style.visibility = 'visible';
      el.style.transform = `translate3d(${p.x - s / 2}px, ${p.y - s / 2}px, 0) rotate(${p.rot}deg) scale(${p.scale})`;
    });
    if (!finale && t >= WAVE.finaleAt) {
      finale = true;
      const f = document.createElement('div');
      f.className = 'pw-finale';
      f.appendChild(mk('pw-face', urls[0]));
      const label = document.createElement('div');
      label.className = 'pw-name';
      label.textContent = `Go ${name}!`;
      f.appendChild(label);
      root.appendChild(f);
      const rest = (WAVE.total - WAVE.finaleAt) * 1000;
      f.animate([{ transform: 'scale(0)', opacity: 1 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.25 }, { transform: 'scale(1)', opacity: 1, offset: 0.4 },
        { transform: 'scale(1)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 0 }], { duration: rest, fill: 'forwards' });
      hooks.onFinale?.();
    }
    if (t >= WAVE.total) { cancel(); return; }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return cancel;
}
