// In-app updates: the Home Screen app is cache-first, so ask the network for version.json and, when the
// build id differs, drop all caches and reload. Never touches localStorage (stars, best, character survive).
import { applyDelta, fetchRemoteManifest, UPDATES_URL, type Manifest } from './delta';

export interface Remote { version: string; label: string }

// Versions are base-36 build timestamps: only ever move forward (an old public build must not downgrade a newer install).
export const isNewer = (local: string, remote: string | null | undefined): boolean => {
  if (!remote || remote === local) return false;
  const a = parseInt(local, 36), b = parseInt(remote, 36);
  return Number.isNaN(a) || Number.isNaN(b) ? true : b > a;
};

let cdnManifest: Manifest | null = null; // set when the newest version was only reachable on the public update site

export async function fetchRemote(): Promise<Remote | null> {
  cdnManifest = null;
  const home = await fetchHome();
  if (home) return home;
  const m = await fetchRemoteManifest(); // away from home Wi-Fi
  if (!m) return null;
  cdnManifest = m;
  return { version: m.version, label: m.label };
}

async function fetchHome(): Promise<Remote | null> {
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
  location: Pick<Location, 'replace'> & { search?: string };
}

/** The reload address after an update: keeps the page's own flags (e.g. ?perf=1) and sets v to the new build. */
export const reloadUrl = (remote: string, search = ''): string => {
  const q = new URLSearchParams(search);
  q.set('v', remote);
  return './?' + q.toString();
};

let applying = false; // re-entry guard: the watcher, the button and show() can all ask at once

/** Test hook: a successful apply leaves the guard on (the page is reloading). */
export const resetApplyGuard = (): void => { applying = false; };

export async function applyUpdate(remote: string, deps: ApplyDeps = { caches, sw: navigator.serviceWorker, location }): Promise<void> {
  if (applying) return;
  applying = true;
  const overlay = globalThis.document?.getElementById('updating');
  overlay?.classList.remove('hidden');
  try {
    if (cdnManifest && cdnManifest.version === remote) {
      await applyDelta(cdnManifest, { caches, fetch: (u, i) => fetch(u, i), base: UPDATES_URL, scope: new URL('./', location.href).href });
      deps.location.replace(reloadUrl(remote, deps.location.search));
      return;
    }
    try { await (await deps.sw?.getRegistration())?.update(); } catch { /* offline or no worker: carry on */ }
    for (const k of await deps.caches.keys()) await deps.caches.delete(k);
    deps.location.replace(reloadUrl(remote, deps.location.search));
  } catch {
    overlay?.classList.add('hidden'); // failed: let the kids keep playing, a later check retries
    applying = false;
  }
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
