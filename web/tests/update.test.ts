import { describe, expect, it } from 'vitest';
import { applyUpdate, isNewer } from '../src/ui/update';

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
  it('isNewer', () => {
    expect(isNewer('a', 'b')).toBe(true);
    expect(isNewer('a', 'a')).toBe(false);
    expect(isNewer('a', null)).toBe(false);
  });
  it('applyUpdate clears caches, reloads once, keeps localStorage', async () => {
    const f = fakes();
    await applyUpdate('b', f.deps);
    expect(f.store.size).toBe(0);
    expect(f.replaced).toEqual(['./?v=b']);
    expect(JSON.stringify(f.ls)).toBe(f.before);
  });
  it('applyUpdate survives a rejecting getRegistration', async () => {
    const f = fakes(true);
    await applyUpdate('b', f.deps);
    expect(f.store.size).toBe(0);
    expect(f.replaced).toEqual(['./?v=b']);
  });
});
