// Off-Wi-Fi updates: the build lists a hash per file (files.json). When the home server is unreachable the app
// asks the public update site for its files.json, downloads only the files whose hash differs, verifies each one,
// and swaps caches only if everything arrived. Any failure leaves the installed version untouched.
export interface Manifest { version: string; label: string; files: Record<string, string> }

/** Public update site (static, no photos or personal data). Override at build time with VITE_UPDATES_URL. */
export const UPDATES_URL: string = import.meta.env.VITE_UPDATES_URL ?? 'https://runner-updates.cagdasatici.com/';

export const changedFiles = (local: Record<string, string>, remote: Record<string, string>): string[] =>
  Object.keys(remote).filter((p) => local[p] !== remote[p]);

const isManifest = (j: unknown): j is Manifest => {
  const m = j as Manifest | null;
  return !!m && typeof m.version === 'string' && !!m.files && typeof m.files === 'object'
    && Object.entries(m.files).every(([p, h]) => typeof h === 'string' && !p.startsWith('/') && !p.includes('..'));
};

export async function fetchRemoteManifest(base = UPDATES_URL, f: typeof fetch = fetch): Promise<Manifest | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await f(`${base}manifest.json?t=${Date.now()}`, { cache: 'no-store', signal: ctl.signal });
    if (!res.ok) return null;
    const j: unknown = await res.json();
    return isManifest(j) ? { ...j, label: String(j.label ?? '') } : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

export const sha16 = async (buf: ArrayBuffer): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

export interface DeltaDeps {
  caches: Pick<CacheStorage, 'keys' | 'delete' | 'open' | 'match'>;
  fetch: typeof fetch;
  base: string;
  scope: string; // absolute URL of the app folder, e.g. https://Mac-Studio.local:8843/
}

/** Builds the new cache from the old one plus the changed files; deletes the old caches only after it is complete. */
export async function applyDelta(m: Manifest, deps: DeltaDeps): Promise<void> {
  const url = (p: string): string => new URL('./' + p, deps.scope).href;
  const localRes = await deps.caches.match(url('files.json'), { ignoreSearch: true });
  const local = localRes ? ((await localRes.json()) as Manifest).files : {};
  const stale = new Set(changedFiles(local, m.files));
  const oldNames = await deps.caches.keys();
  const name = 'runner-' + m.version;
  await deps.caches.delete(name); // a half-built attempt from earlier
  const next = await deps.caches.open(name);
  try {
    for (const p of Object.keys(m.files)) {
      let res: Response | undefined;
      if (!stale.has(p)) res = await deps.caches.match(url(p), { ignoreSearch: true });
      if (!res) {
        const r = await deps.fetch(deps.base + p, { cache: 'no-store' });
        if (!r.ok) throw new Error(`${p}: ${r.status}`);
        const body = await r.arrayBuffer();
        if ((await sha16(body)) !== m.files[p]) throw new Error(`${p}: hash mismatch`);
        res = new Response(body, { headers: { 'content-type': r.headers.get('content-type') ?? 'application/octet-stream' } });
      }
      await next.put(url(p), res.clone());
      if (p === 'index.html') await next.put(deps.scope, res.clone()); // the app opens './'
    }
    await next.put(url('files.json'), new Response(JSON.stringify(m), { headers: { 'content-type': 'application/json' } }));
  } catch (e) {
    await deps.caches.delete(name); // keep the installed version
    throw e;
  }
  for (const k of oldNames) if (k !== name) await deps.caches.delete(k);
}
