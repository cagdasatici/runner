import { describe, expect, it } from 'vitest';
import { pushSupported, urlBase64ToUint8Array } from '../src/ui/push';

const full = (standalone: boolean, extra: Record<string, unknown> = {}) => ({
  window: { PushManager: class {}, Notification: class {}, matchMedia: () => ({ matches: standalone }), ...extra },
  navigator: { serviceWorker: {}, standalone },
});

describe('push helpers', () => {
  it('urlBase64ToUint8Array round-trips a 65-byte key starting with 4', () => {
    const bytes = new Uint8Array(65).map((_, i) => (i === 0 ? 4 : (i * 37) % 256));
    const b64url = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(b64url.length).toBe(87);
    const out = urlBase64ToUint8Array(b64url);
    expect(out.length).toBe(65);
    expect(out[0]).toBe(4);
    expect(Array.from(out)).toEqual(Array.from(bytes));
  });
  it('pushSupported is false outside the Home Screen app and true when standalone with all features', () => {
    expect(pushSupported(full(false) as never)).toBe(false);
    expect(pushSupported(full(true) as never)).toBe(true);
  });
  it('pushSupported is false when PushManager is missing', () => {
    const env = full(true);
    delete (env.window as Record<string, unknown>).PushManager;
    expect(pushSupported(env as never)).toBe(false);
  });
});
