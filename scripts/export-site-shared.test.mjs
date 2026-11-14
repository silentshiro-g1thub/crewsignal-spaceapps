import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const pin = '07e592aa9039aef2a2e597e0bc8e1f0e8b44ac18';
test('native pinned export rejects drift, nested destinations and obsolete target names', () => {
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'crewsignal-export-'));
  const run = (...args) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  try {
    fs.writeFileSync(path.join(site, 'package.json'), '{}');
    const args = ['scripts/export-site-shared.mjs', '--commit', pin, '--site', site];
    assert.equal(run(...args).status, 0);
    assert.equal(run(...args, '--check').status, 0);
    const manifest = JSON.parse(fs.readFileSync(path.join(site, 'shared-snapshot.json'), 'utf8'));
    assert.equal(manifest.nativeCommit, pin);
    assert.equal(Object.keys(manifest.files).length, 42);
    fs.appendFileSync(path.join(site, 'src/shared/src/contracts.ts'), '\n// tampered');
    assert.notEqual(run(...args, '--check').status, 0);
    assert.notEqual(run('scripts/export-site-shared.mjs', '--commit', pin, '--site', root).status, 0);
    assert.notEqual(run('shared/scripts/sync-to-targets.mjs', '--check', 'website').status, 0);
  } finally {
    assert.ok(path.resolve(site).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(site, { recursive: true, force: true });
  }
});
