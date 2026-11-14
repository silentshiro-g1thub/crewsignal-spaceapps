#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SHARED_ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE_ROOT = path.resolve(SHARED_ROOT, '..');

const SYNC_DIRECTORIES = ['src', 'tokens', 'fixtures', path.join('assets', 'fonts')];
const VALID_TARGETS = ['desktop', 'mobile'];

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function listFilesRecursive(rootDir, baseDir = rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full, baseDir));
    } else if (entry.isFile()) {
      results.push(path.relative(baseDir, full).replace(/\\/g, '/'));
    }
  }
  return results.sort();
}

export function collectSharedFiles() {
  const files = new Map();
  for (const relSubdir of SYNC_DIRECTORIES) {
    const absSubdir = path.join(SHARED_ROOT, relSubdir);
    for (const relFile of listFilesRecursive(absSubdir, SHARED_ROOT)) {
      files.set(relFile, path.join(SHARED_ROOT, relFile));
    }
  }
  return files;
}

export function syncToTargetDir(targetSharedDir) {
  const sharedFiles = collectSharedFiles();
  let copied = 0;

  for (const [relPath, srcPath] of sharedFiles.entries()) {
    const destPath = path.join(targetSharedDir, relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    copied += 1;
  }

  // Remove stale synced files in managed subdirectories that no longer exist in source/shared/
  for (const relSubdir of SYNC_DIRECTORIES) {
    const targetSubdir = path.join(targetSharedDir, relSubdir);
    for (const existingRel of listFilesRecursive(targetSubdir, targetSharedDir)) {
      if (!sharedFiles.has(existingRel)) {
        fs.unlinkSync(path.join(targetSharedDir, existingRel));
      }
    }
  }

  return { copied, totalFiles: sharedFiles.size };
}

export function checkTargetParity(targetSharedDir) {
  const sharedFiles = collectSharedFiles();
  const mismatches = [];
  const missing = [];
  const extra = [];

  for (const [relPath, srcPath] of sharedFiles.entries()) {
    const destPath = path.join(targetSharedDir, relPath);
    if (!fs.existsSync(destPath)) {
      missing.push(relPath);
      continue;
    }
    if (sha256File(srcPath) !== sha256File(destPath)) {
      mismatches.push(relPath);
    }
  }

  for (const relSubdir of SYNC_DIRECTORIES) {
    const targetSubdir = path.join(targetSharedDir, relSubdir);
    for (const existingRel of listFilesRecursive(targetSubdir, targetSharedDir)) {
      if (!sharedFiles.has(existingRel)) {
        extra.push(existingRel);
      }
    }
  }

  const ok = missing.length === 0 && mismatches.length === 0 && extra.length === 0;
  return { ok, totalExpected: sharedFiles.size, missing, mismatches, extra };
}

async function generateStaticArtifacts() {
  // Use Vite's bundled esbuild/SSR loader available via vitest devDependency
  const { createServer } = await import('vite');
  const server = await createServer({
    root: SHARED_ROOT,
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });

  try {
    const mod = await server.ssrLoadModule('/src/index.ts');
    const fixturesDir = path.join(SHARED_ROOT, 'fixtures');
    const tokensDir = path.join(SHARED_ROOT, 'tokens');
    fs.mkdirSync(fixturesDir, { recursive: true });
    fs.mkdirSync(tokensDir, { recursive: true });

    const writeJson = (dir, name, data) => {
      fs.writeFileSync(
        path.join(dir, name),
        `${JSON.stringify(data, null, 2)}\n`,
        'utf8',
      );
    };

    writeJson(fixturesDir, 'sim-01.json', {
      schemaVersion: mod.CREWSIGNAL_SCHEMA_VERSION,
      profile: mod.SIM_01_PROFILE,
      preferences: mod.SIM_01_PREFERENCES,
      observations: mod.SIM_01_OBSERVATIONS,
      references: mod.SIM_01_REFERENCES,
      insights: mod.SIM_01_INSIGHTS,
      optionalBpDraft: mod.SIM_01_OPTIONAL_BP_DRAFT,
      sleepSeriesHours: mod.SIM_01_SLEEP_SERIES_HOURS,
    });

    writeJson(fixturesDir, 'mf-fixtures.json', {
      schemaVersion: mod.CREWSIGNAL_SCHEMA_VERSION,
      fixtures: mod.MF_FIXTURES,
    });

    writeJson(fixturesDir, 'sim-schedule.json', {
      schemaVersion: mod.CREWSIGNAL_SCHEMA_VERSION,
      profile: mod.SIM_SCHEDULE_PROFILE,
      observations: mod.SIM_SCHEDULE_OBSERVATIONS,
    });

    writeJson(fixturesDir, 'sim-empty.json', {
      schemaVersion: mod.CREWSIGNAL_SCHEMA_VERSION,
      profile: mod.SIM_EMPTY_PROFILE,
      observations: [],
      references: [],
      insights: [],
    });

    writeJson(fixturesDir, 'example-report.json', mod.EXAMPLE_REPORT_BUNDLE);
    writeJson(fixturesDir, 'example-backup.json', mod.EXAMPLE_BACKUP_BUNDLE);
    writeJson(
      fixturesDir,
      'example-draft-recovery.json',
      mod.EXAMPLE_DRAFT_RECOVERY_BUNDLE,
    );
    writeJson(
      fixturesDir,
      'canonical-vectors.json',
      mod.CANONICAL_ACCEPTANCE_VECTORS,
    );
    writeJson(fixturesDir, 'evidence-and-help.json', {
      schemaVersion: mod.CREWSIGNAL_SCHEMA_VERSION,
      checkedDate: mod.EVIDENCE_CHECKED_DATE,
      evidence: mod.EVIDENCE_LIST,
      actions: mod.ACTION_CONTENT_LIST,
      helpUnconfigured: mod.DEFAULT_UNCONFIGURED_HELP,
      helpConfiguredFixture: mod.CONFIGURED_HELP_TEST_FIXTURE,
      metricDefinitions: mod.METRIC_DEFINITIONS,
      bodySystems: mod.BODY_SYSTEM_DEFINITIONS,
      moodScale: mod.MOOD_SCALE_SPEC,
    });

    fs.writeFileSync(
      path.join(fixturesDir, 'csv-review-fixture.csv'),
      mod.CSV_REVIEW_FIXTURE_CSV,
      'utf8',
    );
    fs.writeFileSync(
      path.join(fixturesDir, 'csv-template.csv'),
      mod.generateCsvTemplate(),
      'utf8',
    );

    writeJson(tokensDir, 'tokens.json', mod.THEME_TOKENS);

    console.log('Generated canonical JSON/CSV fixtures and tokens.json in source/shared/.');
  } finally {
    await server.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--generate-artifacts')) {
    await generateStaticArtifacts();
    return;
  }

  const isWrite = args.includes('--write');
  const isCheck = args.includes('--check');
  const targetDirIdx = args.indexOf('--target-dir');

  if (targetDirIdx !== -1 && args[targetDirIdx + 1]) {
    const customDir = path.resolve(args[targetDirIdx + 1]);
    if (isWrite) {
      const res = syncToTargetDir(customDir);
      console.log(`Synced ${res.copied} files to ${customDir}`);
      return;
    }
    const parity = checkTargetParity(customDir);
    console.log(JSON.stringify({ target: customDir, ...parity }, null, 2));
    if (!parity.ok) process.exit(1);
    return;
  }

  const requestedTargets = args.filter((a) => !a.startsWith('--'));
  const invalidTargets = requestedTargets.filter((t) => t !== 'all' && !VALID_TARGETS.includes(t));
  if (invalidTargets.length) {
    throw new Error(`Unknown native target: ${invalidTargets.join(', ')}. Use --target-dir for external snapshots.`);
  }
  const targets =
    requestedTargets.length === 0 || requestedTargets.includes('all')
      ? VALID_TARGETS
      : requestedTargets.filter((t) => VALID_TARGETS.includes(t));

  if (!isWrite && !isCheck) {
    console.log(
      'Usage:\n' +
        '  node scripts/sync-to-targets.mjs --generate-artifacts\n' +
        '  node scripts/sync-to-targets.mjs --write [desktop|mobile|all]\n' +
        '  node scripts/sync-to-targets.mjs --check [desktop|mobile|all]\n' +
        '  node scripts/sync-to-targets.mjs --write|--check --target-dir <path>',
    );
    return;
  }

  let hasFailures = false;
  for (const t of targets) {
    const targetSharedDir = path.join(SOURCE_ROOT, t, 'src', 'shared');
    if (isWrite) {
      const res = syncToTargetDir(targetSharedDir);
      console.log(`[${t}] synced ${res.copied} files to ${targetSharedDir}`);
    } else if (isCheck) {
      if (!fs.existsSync(targetSharedDir)) {
        console.log(`[${t}] target shared directory does not exist yet: ${targetSharedDir}`);
        hasFailures = true;
        continue;
      }
      const parity = checkTargetParity(targetSharedDir);
      if (parity.ok) {
        console.log(`[${t}] OK (${parity.totalExpected} files match SHA-256)`);
      } else {
        hasFailures = true;
        console.log(`[${t}] MISMATCH:`, JSON.stringify(parity, null, 2));
      }
    }
  }

  if (hasFailures) {
    process.exit(1);
  }
}

const isEntrypoint =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
