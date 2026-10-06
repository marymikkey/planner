// Regenerates the precache list and cache version inside service-worker.js.
// Usage: node tools/build-sw.mjs
// The version is a hash of every shipped file, so any change invalidates old caches.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const INCLUDE_DIRS = ['styles', 'js', 'icons'];
const INCLUDE_FILES = ['index.html', 'manifest.json'];

const files = [...INCLUDE_FILES];
const walk = (dir) => {
  for (const name of readdirSync(join(root, dir)).sort()) {
    const rel = join(dir, name);
    if (statSync(join(root, rel)).isDirectory()) walk(rel);
    else if (!name.startsWith('.')) files.push(rel);
  }
};
INCLUDE_DIRS.forEach(walk);

const hash = createHash('sha1');
for (const f of files) hash.update(f).update(readFileSync(join(root, f)));
const version = hash.digest('hex').slice(0, 10);

const list = ['./', ...files.map((f) => `./${f.split('\\').join('/')}`)];
const block = `/*BEGIN GENERATED*/\nconst CACHE_VERSION = '${version}';\nconst PRECACHE = ${JSON.stringify(list, null, 2)};\n/*END GENERATED*/`;

const swPath = join(root, 'service-worker.js');
const src = readFileSync(swPath, 'utf8');
writeFileSync(swPath, src.replace(/\/\*BEGIN GENERATED\*\/[\s\S]*?\/\*END GENERATED\*\//, block));
console.log(`service-worker.js updated: ${list.length} files, version ${version}`);
