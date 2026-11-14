import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];
if (!args.includes('--site') || !args.includes('--commit')) throw new Error('Usage: --commit FULL_SHA --site ABSOLUTE_SITE_ROOT [--check]');
const site = path.resolve(option('--site'));
if (site === root || site.startsWith(root + path.sep)) throw new Error('Keep the site checkout outside the native source tree.');
const git = (...parts) => execFileSync('git', parts, { cwd: root });
const commit = git('rev-parse', '--verify', option('--commit') + '^{commit}').toString().trim();
const files = git('ls-tree', '-r', '--name-only', commit, 'shared').toString().trim().split('\n')
  .filter(p => /^shared\/(src|tokens|fixtures|assets\/fonts)\//.test(p)).sort();
if (!files.length || !fs.existsSync(path.join(site, 'package.json'))) throw new Error('Missing canonical files or site package.json.');
const manifest = { schemaVersion: 1, nativeRepository: 'silentshiro-g1thub/crewsignal-spaceapps', nativeCommit: commit, files: {} };
const target = path.join(site, 'src/shared');
for (const source of files) {
  const relative = source.slice('shared/'.length);
  const bytes = git('show', `${commit}:${source}`);
  manifest.files[relative] = { bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  const destination = path.join(target, relative);
  if (args.includes('--check')) {
    if (!fs.existsSync(destination) || !bytes.equals(fs.readFileSync(destination))) throw new Error('Snapshot drift: ' + relative);
  } else {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
  }
}
// Remove only obsolete managed files during export, never site-owned glue.
function scan(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Symlink in snapshot: ' + file);
    return entry.isDirectory() ? scan(file) : [file];
  });
}
for (const dir of ['src', 'tokens', 'fixtures', 'assets/fonts']) for (const file of scan(path.join(target, dir))) {
  const relative = path.relative(target, file).replaceAll('\\', '/');
  if (!manifest.files[relative]) {
    if (args.includes('--check')) throw new Error('Unexpected snapshot file: ' + relative);
    fs.unlinkSync(file);
  }
}
const manifestPath = path.join(site, 'shared-snapshot.json');
const json = JSON.stringify(manifest, null, 2) + '\n';
if (args.includes('--check')) {
  if (fs.readFileSync(manifestPath, 'utf8') !== json) throw new Error('Snapshot manifest differs from the pinned Git inputs.');
} else fs.writeFileSync(manifestPath, json);
console.log(`${args.includes('--check') ? 'Verified' : 'Exported'} ${files.length} shared files from ${commit}`);
