import { beforeEach, describe, expect, it } from 'vitest';
import { applyUpdate, isNewer, reloadUrl, resetApplyGuard } from '../src/ui/update';

const fakes = (reject = false) => {
  const store = new Set(['runner-a', 'runner-b']);
  const replaced: string[] = [];
  const ls = { character: 'nora', progress: '{"stars":12}' };
  const before = JSON.stringify(ls);
  return {
    store, replaced, ls, before,
    deps: {
      caches: { keys: async () => [...store], delete: async (k: string) => store.delete(k) },
      sw: { getRegistration: async () => { if (reject) throw new Error('no sw'); return { update: async () => {} } as unknown as ServiceWorkerRegistration; } },
      location: { replace: (u: string) => { replaced.push(u); } },
    },
  };
};

describe('updates', () => {
  beforeEach(resetApplyGuard);
  it('isNewer', () => {
    expect(isNewer('a', 'b')).toBe(true);
    expect(isNewer('a', 'a')).toBe(false);
    expect(isNewer('a', null)).toBe(false);
    expect(isNewer('mp', 'mo')).toBe(false); // never downgrade
    expect(isNewer('mo', 'mp')).toBe(true);
  });
  it('applyUpdate clears caches, reloads once, keeps localStorage', async () => {
    const f = fakes();
    await applyUpdate('b', f.deps);
    expect(f.store.size).toBe(0);
    expect(f.replaced).toEqual(['./?v=b']);
    expect(JSON.stringify(f.ls)).toBe(f.before);
  });
  it('the update reload keeps the page flags and replaces an old v', async () => {
    expect(reloadUrl('b', '?perf=1&v=a&dpr=1')).toBe('./?perf=1&v=b&dpr=1');
    expect(reloadUrl('b')).toBe('./?v=b');
    const f = fakes();
    await applyUpdate('b', { ...f.deps, location: { ...f.deps.location, search: '?perf=1&autoplay=1' } });
    expect(f.replaced).toEqual(['./?perf=1&autoplay=1&v=b']);
  });
  it('applyUpdate survives a rejecting getRegistration', async () => {
    const f = fakes(true);
    await applyUpdate('b', f.deps);
    expect(f.store.size).toBe(0);
    expect(f.replaced).toEqual(['./?v=b']);
  });
  it('applyUpdate failure hides the overlay, resets the guard and does not reload; re-entry is a no-op', async () => {
    const classes = new Set<string>();
    const g = globalThis as unknown as { document?: unknown };
    const prev = g.document;
    g.document = { getElementById: () => ({ classList: { remove: (c: string) => classes.delete(c), add: (c: string) => classes.add(c) } }) };
    try {
      const f = fakes();
      const bad = { ...f.deps, caches: { keys: async () => { throw new Error('boom'); }, delete: async () => true } };
      await applyUpdate('b', bad);
      expect(f.replaced).toEqual([]);
      expect(classes.has('hidden')).toBe(true);
      // guard was reset: a second call works, and a concurrent third call is ignored
      await Promise.all([applyUpdate('b', f.deps), applyUpdate('b', f.deps)]);
      expect(f.replaced).toEqual(['./?v=b']);
    } finally { g.document = prev; }
  });
});
