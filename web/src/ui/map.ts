// The journey map: 12 worlds stacked bottom (world 1) to top (world 12), 10 level buttons each on a winding path.
import { LEVELS_PER_WORLD, WORLDS } from '../core/level';
import type { ProgressStore } from '../core/progress';
import { worldDecor, WORLD_INFO } from './worlds';

export const SECTION_H = 1060;
export const STAR_SVG = '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"/></svg>';
const LOCK_SVG = '<svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/></svg>';

/** Where level i (0…9) of world w sits: x in % of the width, y in px from the top of its section. */
export function nodePos(w: number, i: number): [number, number] {
  return [50 + 30 * Math.sin(i * 1.05 + w * 1.7), SECTION_H - 200 - i * 87];
}

/** Builds the map once into `scroller`; tapping an open level calls onPick(n). */
export function buildMap(scroller: HTMLElement, onPick: (n: number) => void): void {
  let html = '';
  for (let w = WORLDS - 1; w >= 0; w--) {
    const info = WORLD_INFO[w];
    const pts = [...Array(LEVELS_PER_WORLD).keys()].map((i) => nodePos(w, i));
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x * 8.2} ${y}`).join(' ');
    html += `<section class="world" data-world="${w + 1}" style="height:${SECTION_H}px;--a:${info.a};--b:${info.b};--c:${info.c}">
      ${worldDecor(w, SECTION_H)}
      <svg class="path" viewBox="0 0 820 ${SECTION_H}" preserveAspectRatio="none"><path d="${d}"/></svg>
      ${pts.map(([x, y], i) => `<button class="node${i === 9 ? ' boss' : ''}" data-level="${w * 10 + i + 1}" style="left:${x}%;top:${y}px"></button>`).join('')}
      <div class="banner"><small>WORLD ${w + 1}</small><b>${info.name}</b><span class="wstars"></span></div>
    </section>`;
  }
  scroller.innerHTML = html;
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
