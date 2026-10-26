// Sends a push notification to the iPads that tapped 🔔 (Mac only; web-push is a dev dependency, never in the game bundle).
// Usage: node scripts/push.mjs --body "Poop mode is here 💩" [--title Runner] [--to all|arel|nora|other] [--url ./]
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import webpush from 'web-push';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith('--') ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
if (!args.body) { console.error('Usage: node scripts/push.mjs --body "text" [--title Runner] [--to all|arel|nora|other] [--url ./]'); process.exit(2); }
const SITE = process.env.SUBWAY_RUNNER_SITE ?? join(homedir(), 'Library', 'Application Support', 'SubwayRunner'); // same default/override as deploy-local.sh
const dir = join(SITE, 'push');
const to = args.to ?? 'all';
if (!['all', 'arel', 'nora', 'other'].includes(to)) { console.error(`Unknown --to "${to}"`); process.exit(2); }

const { publicKey, privateKey } = JSON.parse(readFileSync(join(dir, 'vapid.json'), 'utf8'));
let subs = [];
try { subs = JSON.parse(readFileSync(join(dir, 'subscriptions.json'), 'utf8')); } catch { /* none yet */ }
webpush.setVapidDetails('mailto:cagdasatici@users.noreply.github.com', publicKey, privateKey);

const payload = JSON.stringify({ title: args.title ?? 'Runner', body: args.body, url: args.url ?? './' });
const targets = subs.filter((s) => to === 'all' || s.who === to);
let sent = 0, failed = 0;
const gone = new Set();
await Promise.all(targets.map(async (s) => {
  const host = new URL(s.subscription.endpoint).host;
  try {
    await webpush.sendNotification(s.subscription, payload, { TTL: 86400, urgency: 'normal' });
    sent++;
  } catch (e) {
    const code = e?.statusCode ?? 0;
    if (code === 404 || code === 410) gone.add(s.subscription.endpoint);
    else { failed++; console.error(`failed ${s.who} ${host}: ${code || e?.message}`); }
  }
}));
if (gone.size) {
  const tmp = join(dir, 'subscriptions.json.tmp');
  writeFileSync(tmp, JSON.stringify(subs.filter((s) => !gone.has(s.subscription.endpoint)), null, 2), { mode: 0o600 });
  renameSync(tmp, join(dir, 'subscriptions.json'));
}
console.log(`sent ${sent}, removed ${gone.size}, failed ${failed}`);
if (targets.length > 0 && sent === 0 && failed > 0) process.exit(1); // all sends failed
