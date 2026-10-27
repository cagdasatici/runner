// Packages the latest build for the public update site, and uploads it when asked.
//   npm run build && node scripts/publish-updates.mjs            # just writes updates-out/ for inspection
//   node scripts/publish-updates.mjs --deploy                    # also: wrangler pages deploy (needs `wrangler login` once)
import { execFileSync } from 'node:child_process';
import { buildPackage } from './lib/updates-package.mjs';

const PROJECT = process.env.UPDATES_PROJECT ?? 'runner-updates';
const m = buildPackage('dist', 'updates-out');
console.log(`Package for ${m.version} (${m.label}): ${Object.keys(m.files).length} files in updates-out/`);
if (process.argv.includes('--deploy')) {
  execFileSync('npx', ['--yes', 'wrangler@4', 'pages', 'deploy', 'updates-out', '--project-name', PROJECT, '--branch', 'main'], { stdio: 'inherit' });
}
