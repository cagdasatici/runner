// In-app updates: the Home Screen app is cache-first, so ask the network for version.json and, when the
// build id differs, drop all caches and reload. Never touches localStorage (stars, best, character survive).
export interface Remote { version: string; label: string }

export const isNewer = (local: string, remote: string | null | undefined): boolean => !!remote && remote !== local;

export async function fetchRemote(): Promise<Remote | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store', signal: ctl.signal });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j?.version === 'string' ? { version: j.version, label: String(j.label ?? '') } : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

export interface ApplyDeps {
  caches: Pick<CacheStorage, 'keys' | 'delete'>;
  sw?: Pick<ServiceWorkerContainer, 'getRegistration'>;
  location: Pick<Location, 'replace'>;
}

export async function applyUpdate(remote: string, deps: ApplyDeps = { caches, sw: navigator.serviceWorker, location }): Promise<void> {
  globalThis.document?.getElementById('updating')?.classList.remove('hidden');
  try { await (await deps.sw?.getRegistration())?.update(); } catch { /* offline or no worker: carry on */ }
  for (const k of await deps.caches.keys()) await deps.caches.delete(k);
  deps.location.replace('./?v=' + remote);
}

export function startUpdateWatcher(opts: { canApply: () => boolean; onAvailable: (label: string, remote: string) => void }): { check: () => Promise<void> } {
  const check = async (): Promise<void> => {
    if (!import.meta.env.PROD) return; // dev server: nothing to update
    const r = await fetchRemote();
    if (!r || !isNewer(__APP_VERSION__, r.version)) return;
    if (opts.canApply()) { await applyUpdate(r.version); return; }
    opts.onAvailable(r.label, r.version);
    void navigator.setAppBadge?.(1);
  };
  void check();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
  setInterval(() => { if (opts.canApply()) void check(); }, 10 * 60 * 1000);
  return { check };
}
