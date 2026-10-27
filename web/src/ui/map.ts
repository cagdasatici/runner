// The journey map: 12 worlds stacked bottom (world 1) to top (world 12), 10 level buttons each on a winding path.
import { LEVELS_PER_WORLD, WORLDS } from '../core/level';
import type { ProgressStore } from '../core/progress';
import { WORLD_INFO } from './worlds';
import { worldScene } from './mapArt';
import { createMapRenderer, type MapRenderer } from './map3d';

export const SECTION_H = 1240;
export const STAR_SVG = '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"/></svg>';
const LOCK_SVG = '<svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/></svg>';

/** Where level i (0…9) of world w sits: x in % of the width, y in px from the top of its section. */
export function nodePos(w: number, i: number): [number, number] {
  return [50 + 30 * Math.sin(i * 1.05 + w * 1.7), SECTION_H - 190 - i * 88];
}

/** Builds the map once into `scroller`; tapping an open level calls onPick(n). */
export function buildMap(scroller: HTMLElement, onPick: (n: number) => void): void {
  let html = '';
  for (let w = WORLDS - 1; w >= 0; w--) {
    const info = WORLD_INFO[w];
    const pts = [...Array(LEVELS_PER_WORLD).keys()].map((i) => nodePos(w, i));
    html += `<section class="world" data-world="${w + 1}" style="height:${SECTION_H}px;--a:${info.a};--b:${info.b};--c:${info.c}">
      <svg class="decor" viewBox="0 0 820 ${SECTION_H}" preserveAspectRatio="none">${worldScene(w, SECTION_H, pts.map(([x, y]) => [x * 8.2, y] as [number, number]))}</svg>
      ${pts.map(([x, y], i) => `<button class="node${i === 9 ? ' boss' : ''}" data-level="${w * 10 + i + 1}" style="left:${x}%;top:${y}px"></button>`).join('')}
      <div class="banner"><small>WORLD ${w + 1}</small><b>${info.name}</b><span class="wstars"></span></div>
    </section>`;
  }
  scroller.innerHTML = html;
  lazyArt(scroller);
  scroller.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.node');
    if (b && !b.classList.contains('locked')) onPick(Number(b.dataset.level));
  });
}

/** Updates every button (done / next / locked, stars) and world banner from saved progress. */
export function refreshMap(scroller: HTMLElement, progress: ProgressStore): void {
  const next = progress.unlocked;
  scroller.querySelectorAll<HTMLButtonElement>('.node').forEach((b) => {
    const n = Number(b.dataset.level), stars = progress.stars(n);
    const state = n === next && stars === 0 ? 'now' : stars > 0 ? 'done' : 'locked';
    b.className = `node ${state}${n % 10 === 0 ? ' boss' : ''}`;
    b.innerHTML = state === 'locked' ? LOCK_SVG
      : `${n - Math.floor((n - 1) / 10) * 10}${state === 'done' ? `<span class="ns">${[0, 1, 2].map((k) => `<i class="${k < stars ? 'got' : ''}">${STAR_SVG}</i>`).join('')}</span>` : '<span class="go">GO!</span>'}`;
    b.setAttribute('aria-label', `Level ${n}${state === 'locked' ? ', locked' : `, ${stars} stars`}`);
  });
  scroller.querySelectorAll<HTMLElement>('.world').forEach((sec) => {
    const w = Number(sec.dataset.world);
    let got = 0;
    for (let i = 1; i <= 10; i++) got += progress.stars((w - 1) * 10 + i);
    sec.querySelector('.wstars')!.innerHTML = `${STAR_SVG}${got}/30`;
    sec.classList.toggle('lockedw', (w - 1) * 10 + 1 > next);
  });
}

/** Scrolls so the next level to play sits in the middle of the screen. */
export function scrollToLevel(scroller: HTMLElement, n: number): void {
  const b = scroller.querySelector<HTMLElement>(`.node[data-level="${n}"]`);
  if (!b) return;
  const sec = b.closest<HTMLElement>('.world')!;
  scroller.scrollTop = sec.offsetTop + b.offsetTop - scroller.clientHeight / 2;
}

/**
 * Swaps each world's flat vector scenery for its 3D render (map3d.ts) as it nears the screen: one world at a time, in idle frames.
 * The JPEG is kept; the <img> is emptied again when the world is far away, so only a few decoded pictures are ever in memory.
 * Without WebGL the vector art simply stays.
 */
function lazyArt(scroller: HTMLElement): void {
  if (typeof IntersectionObserver === 'undefined') return;
  const SCALE = Math.min(2, Math.max(1.25, window.devicePixelRatio || 1));
  let renderer: MapRenderer | null | undefined;
  const urls = new Map<number, string>();
  const queue: number[] = [];
  let busy = false, broken = false;
  const sections = new Map<number, HTMLElement>();
  scroller.querySelectorAll<HTMLElement>('.world').forEach((sec) => sections.set(Number(sec.dataset.world) - 1, sec));
  const show = (w: number) => {
    const sec = sections.get(w), url = urls.get(w);
    if (!sec || !url) return;
    let img = sec.querySelector<HTMLImageElement>('.art3d');
    if (!img) { img = document.createElement('img'); img.className = 'art3d'; img.alt = ''; img.decoding = 'async'; sec.querySelector('.decor')!.after(img); }
    if (!img.getAttribute('src')) img.src = url;
    img.classList.add('ready');
    sec.classList.add('has3d');
  };
  const hide = (w: number) => { const sec = sections.get(w); const img = sec?.querySelector<HTMLImageElement>('.art3d'); if (img) { img.classList.remove('ready'); img.removeAttribute('src'); } };
  const pump = async () => {
    if (busy || broken) return;
    const w = queue.shift();
    if (w === undefined) return;
    busy = true;
    try {
      if (!urls.has(w)) {
        renderer ??= createMapRenderer();
        const pts = [...Array(LEVELS_PER_WORLD).keys()].map((i) => { const [x, y] = nodePos(w, i); return [x * 8.2, y] as [number, number]; });
        urls.set(w, URL.createObjectURL(await renderer.render(w, SECTION_H, pts, SCALE)));
      }
      if (near.has(w)) show(w);
    } catch { broken = true; }
    busy = false;
    setTimeout(pump, 60);
  };
  const near = new Set<number>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const w = Number((e.target as HTMLElement).dataset.world) - 1;
      if (e.isIntersecting) { near.add(w); if (urls.has(w)) show(w); else if (!queue.includes(w)) queue.push(w); }
      else { near.delete(w); hide(w); const i = queue.indexOf(w); if (i >= 0) queue.splice(i, 1); }
    }
    pump();
  }, { root: scroller, rootMargin: '60% 0px' });
  sections.forEach((sec) => io.observe(sec));
}
