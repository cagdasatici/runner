// Dev-only: renders journey-map worlds with the 3D renderer and shows them as images. /maplab.html?ws=0,1,2&scale=1&view=0.3
import { createMapRenderer } from './ui/map3d';
import { nodePos, SECTION_H } from './ui/map';

const q = new URLSearchParams(location.search), scale = Number(q.get('scale') ?? 1), view = Number(q.get('view') ?? 1);
const ws = (q.get('ws') ?? q.get('w') ?? '0').split(',').map(Number);
const info = document.getElementById('info')!, box = document.getElementById('box')!;
const r = createMapRenderer();
(async () => {
  for (const w of ws) {
    const pts = [...Array(10).keys()].map((i) => { const [x, y] = nodePos(w, i); return [x * 8.2, y] as [number, number]; });
    const t0 = performance.now();
    try {
      const blob = await r.render(w, SECTION_H, pts, scale);
      const im = document.createElement('img'); im.style.cssText = `width:${820 * view}px;display:block`; im.src = URL.createObjectURL(blob); box.appendChild(im);
      info.textContent += ` w${w}:${Math.round(performance.now() - t0)}ms/${Math.round(blob.size / 1024)}KB`;
    } catch (e) { info.textContent += ` w${w} ERROR ${e}`; console.error(e); }
  }
  info.textContent += ' done';
})();
