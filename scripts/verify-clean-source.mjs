#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { checkTargetParity } from '../shared/scripts/sync-to-targets.mjs';

const SOURCE_ROOT = path.resolve(import.meta.dirname, '..');
const TARGETS = ['desktop', 'mobile'];

const REQUIRED_ROOT_FILES = [
  '.gitignore',
  'LICENSE',
  'CREDITS.md',
  'THIRD-PARTY-NOTICES.md',
  'README.md',
  path.join('shared', 'package.json'),
  path.join('shared', 'src', 'index.ts'),
  path.join('shared', 'assets', 'fonts', 'FONT-MANIFEST.json'),
];

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.vite',
  '.turbo',
  '.expo',
  '.expo-shared',
  'android',
  'ios',
  'target',
  'test-results',
  'playwright-report',
  'coverage',
  'release-artifacts',
]);

const TEXT_SCAN_EXTS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.html',
  '.rs',
  '.toml',
  '.yaml',
  '.yml',
  '.md',
  '.txt',
  '.env',
]);

const FORBIDDEN_SECRET_EXTS = [
  '.jks',
  '.keystore',
  '.p12',
  '.mobileprovision',
  '.cer',
  '.key',
  '.pem',
];

const FORBIDDEN_LOCAL_DATA_EXTS = [
  '.sqlite',
  '.sqlite3',
  '.db',
  '.db-wal',
  '.db-shm',
  '.db-journal',
];

const ALLOWED_FIXTURE_JSON = new Set([
  'shared/fixtures/example-backup.json',
  'shared/fixtures/example-draft-recovery.json',
  'shared/fixtures/example-report.json',
]);

// Runtime / source references to external planning/workspace directories must not exist inside source/
const WORKSPACE_REF_PATTERNS = [
  { label: 'parent docs path reference', rx: /(\.\.[/\\])+docs\b/ },
  { label: 'parent plan path reference', rx: /(\.\.[/\\])+plan\b/ },
  { label: 'workspace docs/design import', rx: /['"][^'"]*\/docs\/design\// },
  { label: 'workspace nannystore path reference', rx: /['"][^'"]*plan\/nannystore\.md['"]/ },
];

// Credential / private key markers that must never appear in source/
const SECRET_CONTENT_PATTERNS = [
  { label: 'PEM private key block', rx: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/ },
  { label: 'AWS access key ID', rx: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: 'GitHub token', rx: /\b(?:ghp_[0-9A-Za-z]{36}|github_pat_[0-9A-Za-z_]{22,})\b/ },
  { label: 'Slack token', rx: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { label: 'Google API key', rx: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
];

function walkFiles(dirPath, results = []) {
  if (!fs.existsSync(dirPath)) return results;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walkFiles(path.join(dirPath, entry.name), results);
    } else if (entry.isFile()) {
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(SOURCE_ROOT, fullPath).replace(/\\/g, '/');
      results.push({ fullPath, relPath, name: entry.name });
    }
  }
  return results;
}

function isTargetCodeOrConfig(relPath) {
  return (
    relPath.startsWith('shared/') ||
    relPath.startsWith('website/') ||
    relPath.startsWith('desktop/') ||
    relPath.startsWith('mobile/')
  );
}

function runChecks({ allowPendingTargets }) {
  const missingRootFiles = [];
  for (const rel of REQUIRED_ROOT_FILES) {
    if (!fs.existsSync(path.join(SOURCE_ROOT, rel))) {
      missingRootFiles.push(rel.replace(/\\/g, '/'));
    }
  }

  const allFiles = walkFiles(SOURCE_ROOT);
  const workspaceRefViolations = [];
  const forbiddenFiles = [];
  const secretHits = [];
  const licenseCheck = { ok: false, note: '' };

  for (const file of allFiles) {
    const lowerName = file.name.toLowerCase();

    // Check forbidden secret/signing files or env files (allow .env.example)
    if (
      FORBIDDEN_SECRET_EXTS.some((ext) => lowerName.endsWith(ext)) ||
      (lowerName === '.env' || (lowerName.startsWith('.env.') && lowerName !== '.env.example'))
    ) {
      forbiddenFiles.push({ file: file.relPath, reason: 'secret/signing/env artifact' });
    }

    // Check unignored SQLite DB dumps
    if (FORBIDDEN_LOCAL_DATA_EXTS.some((ext) => lowerName.endsWith(ext))) {
      forbiddenFiles.push({ file: file.relPath, reason: 'local SQLite database dump' });
    }

    // Check non-fixture personal backups/exports committed accidentally
    if (
      (lowerName.includes('personal-backup') ||
        lowerName.includes('crewsignal-backup') ||
        lowerName.includes('crewsignal-report') ||
        lowerName.includes('crewsignal-draft-recovery')) &&
      !ALLOWED_FIXTURE_JSON.has(file.relPath)
    ) {
      forbiddenFiles.push({ file: file.relPath, reason: 'personal backup or report export file' });
    }

    const ext = path.extname(lowerName);
    if (!TEXT_SCAN_EXTS.has(ext) && lowerName !== '.gitignore') continue;

    // Never scan this verification script's own regex definitions
    if (file.relPath === 'scripts/verify-clean-source.mjs') continue;

    const text = fs.readFileSync(file.fullPath, 'utf8');

    // Scan codebases (excluding THIRD-PARTY-NOTICES / CREDITS prose) for ../docs or ../plan coupling
    if (isTargetCodeOrConfig(file.relPath) && !file.relPath.endsWith('package-lock.json')) {
      for (const { label, rx } of WORKSPACE_REF_PATTERNS) {
        if (rx.test(text)) {
          workspaceRefViolations.push({ file: file.relPath, rule: label });
        }
      }
    }

    if (!file.relPath.endsWith('package-lock.json')) {
      for (const { label, rx } of SECRET_CONTENT_PATTERNS) {
        if (rx.test(text)) {
          secretHits.push({ file: file.relPath, rule: label });
        }
      }
    }
  }

  const licensePath = path.join(SOURCE_ROOT, 'LICENSE');
  if (fs.existsSync(licensePath)) {
    const licText = fs.readFileSync(licensePath, 'utf8');
    licenseCheck.ok =
      licText.includes('Apache License') && licText.includes('Version 2.0, January 2004');
    licenseCheck.note = licenseCheck.ok ? 'Apache-2.0 header verified' : 'Missing Apache-2.0 header';
  } else {
    licenseCheck.note = 'LICENSE missing';
  }

  const parityResults = [];
  let parityOk = true;
  for (const target of TARGETS) {
    const targetSharedDir = path.join(SOURCE_ROOT, target, 'src', 'shared');
    if (!fs.existsSync(targetSharedDir)) {
      parityResults.push({
        target,
        status: 'pending',
        targetSharedDir: path.relative(SOURCE_ROOT, targetSharedDir).replace(/\\/g, '/'),
      });
      if (!allowPendingTargets) {
        parityOk = false;
      }
      continue;
    }
    const report = checkTargetParity(targetSharedDir);
    parityResults.push({
      target,
      status: report.ok ? 'ok' : 'mismatch',
      ...report,
    });
    if (!report.ok) {
      parityOk = false;
    }
  }

  const overallOk =
    missingRootFiles.length === 0 &&
    licenseCheck.ok &&
    workspaceRefViolations.length === 0 &&
    forbiddenFiles.length === 0 &&
    secretHits.length === 0 &&
    parityOk;

  return {
    overallOk,
    allowPendingTargets,
    scannedFileCount: allFiles.length,
    missingRootFiles,
    licenseCheck,
    workspaceRefViolations,
    forbiddenFiles,
    secretHits,
    parityResults,
  };
}

function main() {
  const args = process.argv.slice(2);
  const allowPendingTargets = args.includes('--allow-pending-targets');
  const jsonOutput = args.includes('--json');

  const result = runChecks({ allowPendingTargets });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Clean-source verification (${result.scannedFileCount} files scanned in source/):`);
    console.log(
      `- Root release files: ${result.missingRootFiles.length === 0 ? 'OK' : `MISSING [${result.missingRootFiles.join(', ')}]`}`,
    );
    console.log(`- License check: ${result.licenseCheck.ok ? 'OK' : 'FAIL'} (${result.licenseCheck.note})`);
    console.log(
      `- Workspace sibling references (../docs, ../plan): ${result.workspaceRefViolations.length === 0 ? 'OK (0 hits)' : `FAIL (${result.workspaceRefViolations.length} hits)`}`,
    );
    for (const v of result.workspaceRefViolations) {
      console.log(`    * ${v.file}: ${v.rule}`);
    }
    console.log(
      `- Forbidden secret/signing/DB files: ${result.forbiddenFiles.length === 0 ? 'OK (0 hits)' : `FAIL (${result.forbiddenFiles.length} hits)`}`,
    );
    for (const f of result.forbiddenFiles) {
      console.log(`    * ${f.file}: ${f.reason}`);
    }
    console.log(
      `- Secret token content scan: ${result.secretHits.length === 0 ? 'OK (0 hits)' : `FAIL (${result.secretHits.length} hits)`}`,
    );
    for (const s of result.secretHits) {
      console.log(`    * ${s.file}: ${s.rule}`);
    }
    console.log(`- Shared-to-target parity (${allowPendingTargets ? 'allowing pending targets' : 'strict all targets'}):`);
    for (const p of result.parityResults) {
      if (p.status === 'ok') {
        console.log(`    * ${p.target}: OK (${p.totalExpected} files match SHA-256)`);
      } else if (p.status === 'pending') {
        console.log(`    * ${p.target}: PENDING (${p.targetSharedDir} not initialized yet)`);
      } else {
        console.log(
          `    * ${p.target}: MISMATCH (missing=${p.missing.length}, mismatches=${p.mismatches.length}, extra=${p.extra.length})`,
        );
      }
    }
    console.log(`Overall: ${result.overallOk ? 'PASS' : 'FAIL'}`);
  }

  if (!result.overallOk) {
    process.exit(1);
  }
}

main();
