// Builds the public update package from dist/ using ONLY the files listed in dist/files.json, and refuses
// anything that looks like a photo or private data. The result is a plain static site (Cloudflare Pages).
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const OK_EXT = /\.(js|css|html|png|svg|glb|hdr|webmanifest)$/i; // hdr = CC0 sky lighting maps (public/hdri)
const PRIVATE = /(^|\/)(faces|support|photo|push|vapid|subscribers?)(\/|[-_.]|$)|\.(jpe?g|webp|heic|key|pem|env)$/i;

export function checkFiles(files) {
  for (const p of Object.keys(files)) {
    if (p.startsWith('/') || p.includes('..')) throw new Error(`unsafe path: ${p}`);
    if (PRIVATE.test(p)) throw new Error(`private-looking file refused: ${p}`);
    if (!OK_EXT.test(p)) throw new Error(`file type not allowed in the public package: ${p}`);
  }
}

export function buildPackage(dist, out) {
  const m = JSON.parse(readFileSync(join(dist, 'files.json'), 'utf8'));
  checkFiles(m.files);
  rmSync(out, { recursive: true, force: true });
  for (const p of Object.keys(m.files)) {
    mkdirSync(dirname(join(out, p)), { recursive: true });
    copyFileSync(join(dist, p), join(out, p));
  }
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(m));
  writeFileSync(join(out, '_headers'), '/*\n  Access-Control-Allow-Origin: *\n  X-Content-Type-Options: nosniff\n/manifest.json\n  Cache-Control: no-store\n');
  return m;
}
