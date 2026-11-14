# Contributing to CrewSignal

Release verification targets Android phones, Android tablets and Windows. The separate website vendors a reviewed shared snapshot through scripts/export-site-shared.mjs. Use synthetic profiles and fixtures for development and evidence.

## Issues

Use a short title that names the problem or requested outcome. Apply a type label (`bug`, `enhancement`, `documentation`, or `accessibility`) and one priority label. High priority covers data integrity, privacy and tester access. Medium covers planned challenge alignment and usability. Low covers enhancements scheduled after correctness and release access.

Include evidence and the inspected revision, reproduction steps for a bug, proposed architecture and affected components, legacy-data handling, acceptance criteria and verification. Identify related work with issue links. Record measured results separately from assumptions and pending device checks. The issue templates provide these fields.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) with plain-language descriptions. For example, `fix(mobile): keep drafts with their profiles` or `docs: record the challenge resource audit`. Use a scope when it helps identify the affected app. Explain the reason, relevant checks and issue references in the body when needed. Use the same convention for squash messages.

## Pull requests

Target `main` and link the issue. Use `Closes #N` when the PR satisfies its acceptance criteria. Use `Refs #N` for partial work and identify the remaining items. Include the concrete behavior change, architecture or compatibility decisions, tests run and outstanding device checks. Use the PR template.

After shared changes, run `node shared/scripts/sync-to-targets.mjs --write all` from the repository root. Run the affected platform checks in [README.md](README.md), then `node scripts/verify-clean-source.mjs`. Record the tested revision and results in [EVIDENCE.md](EVIDENCE.md). Distinguish harness, emulator and installed-device results. Keep the required failure and fallback behavior in the implementation PR.
