// @ts-nocheck -- node-only test (fs/os) and the repo has no @types/node; add it if more node tests appear
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPackage, checkFiles } from '../scripts/lib/updates-package.mjs';
import { applyDelta, changedFiles, sha16, type Manifest } from '../src/ui/delta';

describe('public update package', () => {
  it('refuses photos, faces and private-looking files', () => {
    for (const bad of ['faces/arel1.png', 'faces/index.json', 'photo-1.png', 'a.jpg', 'support/privacy.html', 'vapid.json', '../x.js', '/etc/x.js', 'a.txt'])
      expect(() => checkFiles({ [bad]: 'h' })).toThrow();
    expect(() => checkFiles({ 'index.html': 'h', 'assets/index-AB.js': 'h', 'models/cat.glb': 'h', 'icons/icon-192.png': 'h', 'sw.js': 'h' })).not.toThrow();
  });
  it('copies only files listed in files.json (a stray faces/ folder in dist never ships)', () => {
    const d = mkdtempSync(join(tmpdir(), 'dist-')), o = mkdtempSync(join(tmpdir(), 'out-'));
    mkdirSync(join(d, 'faces')); mkdirSync(join(d, 'assets'));
    writeFileSync(join(d, 'faces/arel1.png'), 'x'); writeFileSync(join(d, 'index.html'), '<p>'); writeFileSync(join(d, 'assets/a.js'), '1');
    writeFileSync(join(d, 'files.json'), JSON.stringify({ version: 'v1', label: 'l', files: { 'index.html': 'h', 'assets/a.js': 'h' } }));
    buildPackage(d, o);
    expect(existsSync(join(o, 'faces'))).toBe(false);
    expect(readdirSync(o).sort()).toEqual(['_headers', 'assets', 'index.html', 'manifest.json']);
  });
});

describe('delta apply', () => {
  const SCOPE = 'https://h.local/';
  const mem = () => {
    const stores = new Map<string, Map<string, Response>>();
    return {
      stores,
      keys: async () => [...stores.keys()],
      delete: async (k: string) => stores.delete(k),
      open: async (k: string) => { const s = stores.get(k) ?? new Map<string, Response>(); stores.set(k, s); return { put: async (u: string, r: Response) => { s.set(u, r); } } as unknown as Cache; },
      match: async (u: string) => { for (const s of stores.values()) { const r = s.get(u); if (r) return r.clone(); } return undefined; },
    };
  };
  const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
  it('changedFiles', () => expect(changedFiles({ a: '1', b: '2' }, { a: '1', b: '3', c: '4' })).toEqual(['b', 'c']));
  it('downloads only changed files, verifies hashes, swaps caches', async () => {
    const c = mem();
    const old = await c.open('runner-old');
    await old.put(SCOPE + 'keep.js', new Response('KEEP'));
    await old.put(SCOPE + 'files.json', new Response(JSON.stringify({ version: 'old', label: '', files: { 'keep.js': await sha16(enc('KEEP')), 'chg.js': 'stale' } })));
    const m: Manifest = { version: 'new', label: 'L', files: { 'keep.js': await sha16(enc('KEEP')), 'chg.js': await sha16(enc('NEW')) } };
    const got: string[] = [];
    const f = (async (u: string) => { got.push(u); return new Response('NEW'); }) as unknown as typeof fetch;
    await applyDelta(m, { caches: c as never, fetch: f, base: 'https://u/', scope: SCOPE });
    expect(got).toEqual(['https://u/chg.js']);
    expect([...c.stores.keys()]).toEqual(['runner-new']);
  });
  it('a bad hash or failed download leaves the old cache untouched', async () => {
    const c = mem();
    (await c.open('runner-old')); 
    const m: Manifest = { version: 'new', label: '', files: { 'x.js': await sha16(enc('GOOD')) } };
    const f = (async () => new Response('TAMPERED')) as unknown as typeof fetch;
    await expect(applyDelta(m, { caches: c as never, fetch: f, base: 'https://u/', scope: SCOPE })).rejects.toThrow(/hash/);
    expect([...c.stores.keys()]).toEqual(['runner-old']);
  });
});
