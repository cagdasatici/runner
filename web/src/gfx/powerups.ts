// Visuals for power-ups: floating pickups, the board under the feet, the magnet ring, the jetpack and the chaser.
// Pure drawing; the rules live in core/runner.ts. Shared geometry and materials, so nothing here needs disposing per pickup.
import * as THREE from 'three';
import { laneX, type Pickup, type PickupKind } from '../core/track';
import type { RunnerState } from '../core/runner';

const lambert = (color: number, emissive = 0x000000) => new THREE.MeshLambertMaterial({ color, emissive });
const glyph = (text: string, bg: string): THREE.CanvasTexture => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#fff'; g.font = 'bold 84px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const COLORS: Record<PickupKind, number> = { board: 0x14b8a6, magnet: 0xef4444, sneakers: 0xf97316, double: 0xfacc15, jetpack: 0x64748b, mystery: 0xa855f7 };

function makePickup(kind: PickupKind): THREE.Group {
  const g = new THREE.Group();
  const col = COLORS[kind];
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false }));
  g.add(glow);
  switch (kind) {
    case 'board': {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 1.1), lambert(col, 0x0a6b60));
      b.rotation.x = 0.25;
      g.add(b);
      break;
    }
    case 'magnet': {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.11, 10, 20, Math.PI), lambert(col, 0x7f1d1d));
      m.rotation.z = Math.PI;
      g.add(m);
      for (const x of [-0.34, 0.34]) { const tip = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.18, 0.23), lambert(0xf8fafc)); tip.position.set(x, 0.0, 0); g.add(tip); }
      break;
    }
    case 'sneakers': {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.9), lambert(col, 0x7c2d12)));
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.1, 0.94), lambert(0xf8fafc)); sole.position.y = -0.2; g.add(sole);
      break;
    }
    case 'double':
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshLambertMaterial({ map: glyph('2×', '#ca8a04') })));
      break;
    case 'mystery':
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshLambertMaterial({ map: glyph('?', '#7e22ce') })));
      break;
    case 'jetpack':
      for (const x of [-0.2, 0.2]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 12), lambert(col)); c.position.x = x; g.add(c); const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 10), lambert(0xfb923c, 0xea580c)); f.position.set(x, -0.5, 0); f.rotation.x = Math.PI; g.add(f); }
      break;
  }
  return g;
}

export class PowerVisuals {
  readonly group = new THREE.Group();
  private nodes = new Map<number, THREE.Group>();
  private board = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 1.5), lambert(0x14b8a6, 0x0a6b60));
  private ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.7 }));
  private pack = new THREE.Group();
  private chaser = new THREE.Group();
  private flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0xfb923c }));

  constructor() {
    this.board.visible = this.ring.visible = this.pack.visible = this.chaser.visible = false;
    this.ring.rotation.x = Math.PI / 2;
    for (const x of [-0.18, 0.18]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 10), lambert(0x64748b)); c.position.set(x, 1.15, 0.38); this.pack.add(c); }
    this.flame.position.set(0, 0.75, 0.38);
    this.flame.rotation.x = Math.PI;
    this.pack.add(this.flame);
    // the chaser: a round, friendly blob with big eyes
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), lambert(0x65a30d, 0x1a2e05));
    body.position.y = 0.9;
    this.chaser.add(body);
    for (const x of [-0.3, 0.3]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); e.position.set(x, 1.15, -0.72); this.chaser.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0x111827 })); p.position.set(x, 1.15, -0.9); this.chaser.add(p);
    }
    this.group.add(this.board, this.ring, this.pack, this.chaser);
  }

  /** Keeps the pickups in the scene in step with the track, and poses the extras around the runner. */
  update(s: RunnerState, pickups: Pickup[], time: number, viewAhead: number): void {
    const live = new Set<number>();
    for (const p of pickups) {
      if (s.collected.has(p.id) || p.z > s.z + viewAhead || p.z < s.z - 5) continue;
      live.add(p.id);
      let n = this.nodes.get(p.id);
      if (!n) { n = makePickup(p.kind); this.nodes.set(p.id, n); this.group.add(n); }
      n.position.set(laneX(p.lane), 1.25 + Math.sin(time * 3 + p.id) * 0.12, -p.z);
      n.rotation.y = time * 2.2;
    }
    for (const [id, n] of this.nodes) if (!live.has(id)) { this.group.remove(n); this.nodes.delete(id); }

    this.board.visible = s.board > 0 && !s.crashed;
    this.board.position.set(s.x, s.y + 0.08, -s.z);
    this.board.rotation.z = -(laneX(s.lane) - s.x) * 0.15;
    this.board.material.opacity = 1;
    this.ring.visible = s.magnet > 0;
    this.ring.position.set(s.x, s.y + 1.0, -s.z);
    this.ring.scale.setScalar(1 + 0.08 * Math.sin(time * 8));
    this.pack.visible = s.fly > 0 || s.descend > 0;
    this.pack.position.set(s.x, s.y, -s.z);
    this.flame.scale.y = 0.8 + 0.4 * Math.sin(time * 40);
    const blink = s.iframes > 0 && Math.floor(time * 12) % 2 === 0;
    this.board.visible = this.board.visible && !(s.board < 360 && blink); // the board blinks in its last 3 s
    this.chaser.visible = s.chaser > 0 && !s.crashed;
    // the chaser runs 3 m behind and drops back as the timer runs out
    const behind = 3 + (1 - Math.min(1, s.chaser / 240)) * 9;
    this.chaser.position.set(s.x, Math.abs(Math.sin(time * 9)) * 0.25, -s.z + behind);
  }

  clear(): void {
    for (const n of this.nodes.values()) this.group.remove(n);
    this.nodes.clear();
  }
}
