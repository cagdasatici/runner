// The 12 journey worlds: name and map colours (a = main, b = light, c = accent), plus simple generated
// scenery for the map, drawn as SVG shapes (no images).
export const WORLD_INFO = [
  { name: 'Sunny City', a: '#38bdf8', b: '#bae6fd', c: '#f59e0b' },
  { name: 'Leafy Park', a: '#22c55e', b: '#bbf7d0', c: '#15803d' },
  { name: 'Sandy Beach', a: '#f59e0b', b: '#fef3c7', c: '#0ea5e9' },
  { name: 'Candy Land', a: '#ec4899', b: '#fbcfe8', c: '#a855f7' },
  { name: 'Desert Canyon', a: '#ea580c', b: '#fed7aa', c: '#9a3412' },
  { name: 'Snowy Peaks', a: '#0ea5e9', b: '#e0f2fe', c: '#1e40af' },
  { name: 'Jungle Ruins', a: '#16a34a', b: '#86efac', c: '#854d0e' },
  { name: 'Neon Night', a: '#7c3aed', b: '#312e81', c: '#f0abfc' },
  { name: 'Toy Factory', a: '#ef4444', b: '#fecaca', c: '#2563eb' },
  { name: 'Volcano Valley', a: '#dc2626', b: '#fca5a5', c: '#1c1917' },
  { name: 'Cloud Kingdom', a: '#818cf8', b: '#e0e7ff', c: '#fbbf24' },
  { name: 'Space Station', a: '#1e293b', b: '#475569', c: '#22d3ee' },
] as const;

/** Scenery for world w (0…11) in an 820 × h box, seeded so it never changes. */
export function worldDecor(w: number, h: number): string {
  let s = 17 + w * 31;
  const n = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) >>> 8) / 16777216;
  const c = WORLD_INFO[w].c;
  const out: string[] = [];
  for (let i = 0; i < 14; i++) {
    const x = i % 2 ? n() * 160 : 640 + n() * 160, y = 60 + i * (h / 15) + n() * 30, k = 0.7 + n() * 0.6;
    switch (w) {
      case 0: out.push(`<rect x="${x}" y="${y}" width="${50 * k}" height="${90 * k}" rx="6" fill="${['#f87171', '#fbbf24', '#60a5fa', '#a78bfa'][i % 4]}" opacity=".75"/><rect x="${x + 10 * k}" y="${y + 14 * k}" width="${12 * k}" height="${12 * k}" fill="#fff8"/><rect x="${x + 28 * k}" y="${y + 14 * k}" width="${12 * k}" height="${12 * k}" fill="#fff8"/>`); break;
      case 1: case 6: out.push(`<rect x="${x + 22 * k}" y="${y + 40 * k}" width="${8 * k}" height="${36 * k}" fill="#92400e"/><circle cx="${x + 26 * k}" cy="${y + 30 * k}" r="${30 * k}" fill="${c}" opacity=".8"/>`); break;
      case 2: out.push(`<ellipse cx="${x + 30}" cy="${y + 50}" rx="${40 * k}" ry="${12 * k}" fill="#fde68a"/><path d="M${x + 30} ${y + 50}q-4 -40 6 -60" stroke="#92400e" stroke-width="6" fill="none"/><circle cx="${x + 36}" cy="${y - 10}" r="${18 * k}" fill="#22c55e"/>`); break;
      case 3: out.push(`<rect x="${x + 26}" y="${y + 20}" width="6" height="${60 * k}" fill="#fff"/><circle cx="${x + 29}" cy="${y + 16}" r="${26 * k}" fill="${['#f472b6', '#a855f7', '#22c55e'][i % 3]}"/><circle cx="${x + 29}" cy="${y + 16}" r="${14 * k}" fill="none" stroke="#fff" stroke-width="5"/>`); break;
      case 4: out.push(`<path d="M${x} ${y + 80}l${20 * k} -${70 * k}h${30 * k}l${20 * k} ${70 * k}z" fill="${c}" opacity=".6"/><rect x="${x + 70}" y="${y + 30}" width="10" height="${46 * k}" rx="5" fill="#16a34a"/>`); break;
      case 5: out.push(`<path d="M${x} ${y + 80}l${40 * k} -${80 * k}l${40 * k} ${80 * k}z" fill="#166534"/><path d="M${x + 24 * k} ${y + 32 * k}l${16 * k} -${32 * k}l${16 * k} ${32 * k}z" fill="#fff"/>`); break;
      case 7: out.push(`<rect x="${x}" y="${y}" width="${46 * k}" height="${100 * k}" fill="#1e1b4b"/><rect x="${x + 6}" y="${y + 10}" width="${34 * k}" height="6" fill="${['#f0abfc', '#67e8f9', '#fde047'][i % 3]}"/>`); break;
      case 8: out.push(`<rect x="${x}" y="${y}" width="${44 * k}" height="${44 * k}" rx="8" fill="${['#ef4444', '#2563eb', '#facc15', '#22c55e'][i % 4]}" transform="rotate(${n() * 30 - 15} ${x} ${y})"/>`); break;
      case 9: out.push(`<path d="M${x} ${y + 80}l${36 * k} -${70 * k}h${12 * k}l${36 * k} ${70 * k}z" fill="#44403c"/><circle cx="${x + 42 * k}" cy="${y + 4}" r="${12 * k}" fill="#f97316" opacity=".8"/>`); break;
      case 10: out.push(`<ellipse cx="${x + 40}" cy="${y + 40}" rx="${50 * k}" ry="${22 * k}" fill="#fff" opacity=".9"/><ellipse cx="${x + 20}" cy="${y + 30}" rx="${26 * k}" ry="${18 * k}" fill="#fff"/>`); break;
      default: out.push(`<circle cx="${x + 40}" cy="${y + 30}" r="${22 * k}" fill="${['#f472b6', '#22d3ee', '#fbbf24'][i % 3]}" opacity=".85"/><ellipse cx="${x + 40}" cy="${y + 30}" rx="${36 * k}" ry="${8 * k}" fill="none" stroke="#e2e8f0" stroke-width="3"/>`);
        for (let j = 0; j < 4; j++) out.push(`<circle cx="${n() * 820}" cy="${y + n() * 70}" r="1.6" fill="#fff"/>`);
    }
  }
  return `<svg class="decor" viewBox="0 0 820 ${h}" preserveAspectRatio="none">${out.join('')}</svg>`;
}
