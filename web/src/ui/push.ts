// Push notifications for the Home Screen app: pure helpers plus the small subscribe/unsubscribe flow.
export type Who = 'arel' | 'nora' | 'other';
export const WHO_KEY = 'push-who';

export function urlBase64ToUint8Array(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

interface Env { window?: Record<string, unknown> & { matchMedia?: (q: string) => { matches: boolean } }; navigator?: Record<string, unknown> }

/** True only inside the installed Home Screen app on a browser that can do web push (Safari tabs never can). */
export function pushSupported(env: Env = { window: window as never, navigator: navigator as never }): boolean {
  const w = env.window, n = env.navigator;
  if (!w || !n) return false;
  if (!('serviceWorker' in n) || !('PushManager' in w) || !('Notification' in w)) return false;
  return w.matchMedia?.('(display-mode: standalone)').matches === true || n.standalone === true;
}

const api = (path: string) => `${import.meta.env.BASE_URL}api/push/${path}`;
const post = (path: string, body: unknown) =>
  fetch(api(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function currentSub(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export const isOn = async (): Promise<boolean> => Notification.permission === 'granted' && !!(await currentSub());

/** Call from the click handler of the name button: requestPermission runs first and synchronously (iOS needs the gesture). */
export function enable(who: Who): Promise<'on' | 'denied' | 'error'> {
  const asked = Notification.requestPermission(); // nothing may be awaited before this line
  return (async () => {
    try {
      if ((await asked) !== 'granted') return 'denied';
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await (await fetch(api('key'))).json();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource });
      const res = await post('subscribe', { who, subscription: sub.toJSON() });
      if (!res.ok) return 'error';
      try { localStorage.setItem(WHO_KEY, who); } catch { /* ignore */ }
      return 'on';
    } catch { return 'error'; }
  })();
}

export async function disable(): Promise<void> {
  const sub = await currentSub();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  try { await post('unsubscribe', { endpoint }); } catch { /* offline: the server drops it on the next 410 */ }
}

/** At every launch: subscriptions can rotate, the server upserts, so just send the current one again. */
export async function resubscribe(): Promise<void> {
  try {
    if (Notification.permission !== 'granted') return;
    const sub = await currentSub();
    if (!sub) return;
    let who: string | null = null;
    try { who = localStorage.getItem(WHO_KEY); } catch { /* ignore */ }
    await post('subscribe', { who: who === 'arel' || who === 'nora' ? who : 'other', subscription: sub.toJSON() });
  } catch { /* offline or not supported: nothing to do */ }
}
