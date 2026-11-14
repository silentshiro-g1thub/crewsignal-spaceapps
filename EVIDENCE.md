# CrewSignal Verification & Release Evidence (`EVIDENCE.md`)

## Default report privacy

Working changes based on `348e65b`. The audited `373a265` commit was unavailable in this checkout.

| Verification | Result |
| --- | --- |
| Source checks | `node shared/scripts/sync-to-targets.mjs --write all`, `node scripts/verify-clean-source.mjs` and `git diff --check` passed. |
| Harness | Added a shared legacy-sentinel regression and Android coverage for JSON download, share, CSV and print after SQLite restore. `npm --prefix shared test -- interchange-and-vectors` could not start because Vitest was unavailable. Added Windows frontend JSON and print assertions against a seeded legacy observation. Android and Windows harness execution remain pending. |
| Installed apps | Offline checks on Android phone, Android tablet and Windows remain pending. |
## Issue #27 Indicator Guidance

All six indicators have source-linked educational actions on Android, Windows and the website. The shared insight builder requires a compatible reading and personal reference. Mood keeps its ordinal history and offers an educational action without a personalized comparison. Sleep keeps its existing insight ID format, rule version and source versions so stored acknowledgements remain usable.

Local checks against `a907ef9` passed TypeScript checks for all four packages, 85 shared tests, 54 Android harness tests, 34 Windows frontend tests and 15 website tests. Shared tests cover all six actions, the five reference-capable indicators, and missing, mismatched and flagged readings. The clean-source check confirmed all 42 shared files matched across the three targets. Installed Android and Windows checks remain open.

The website production build and four focused Playwright tests passed in headless Edge. They exercised Overview and Explorer links, keyboard focus on the action heading, reviewing a comparable pulse reading, source access without a comparison, and the existing sleep review journey.

## Issue #23 Continuous Integration

[GitHub Actions CI](../../actions/workflows/ci.yml) records shared, parity, mobile, desktop, and website job results for every pull request and push to `main`. The desktop job runs locked Rust tests on `windows-latest`.

Local verification on Windows with the workflow's Node `24.18.0` passed all four TypeScript checks, 73 shared tests, 54 mobile tests, 34 desktop frontend tests, 15 website tests, and both frontend builds. The shared test run used LF bytes for the CSV and font license fixtures to match the Linux checkout. `actionlint` accepted the workflow. The clean-source verifier passed with 42 matching shared files per target and exited with status 1 when a temporary unsynced edit was introduced.

The first hosted run passed the shared, parity, desktop (including Rust), and website jobs. The mobile typecheck failed to resolve Node built-in imports in the SQLite review test. The mobile TypeScript configuration now includes Node types.

## Scheduled check-in prompts

| Verification level | Result |
| --- | --- |
| Source checks | Shared sync and clean-source verification passed across all three targets. |
| Harness | Added SIM-SCHEDULE coverage for a past interval, first check-in, removal of a schedule, metric-only notification text, and opening the Windows blood pressure form. Harness execution is pending. Vitest could not load the test module from the sandbox temporary path, and the workspace dependency install failed with EPERM. |
| Emulator | Pending. No Android emulator or ADB tooling was available. |
| Installed devices | Pending on offline Android phone, Android tablet and installed Windows. Windows notifications require CrewSignal to be open. The Windows Rust lockfile and native build also remain pending because Cargo was unavailable. |

Device verification should enable notifications explicitly, confirm a due reminder offline with only the metric name, then disable the schedule and confirm no further reminder. Open the prompted check-in and skip it to verify the existing skipped event without creating a reading.

## Issue #11 Getting Started Verification

On November 14, 2026, the working changes based on `9f3e66c` passed shared and native-app type checks, 34 Windows UI tests, 54 Android harness tests, the Windows frontend build, and the Android JavaScript export (`expo export --platform android --no-bytecode`). Clean-source verification matched 42 shared files across all targets.

The Windows Playwright harness at 768 × 1024 blocked external requests on first launch. It verified keyboard entry, heading focus, tab order, return focus, the 44 CSS pixel entry target, and zero axe violations in the walkthrough. The Windows UI harness exercised the Demo walkthrough, report preview, the return to a draft in Review, and opening the walkthrough with a Personal profile active.

The Android React Native harness exercised the walkthrough at 390 × 844 and 768 × 1024, including 200% text scale on the tablet viewport. It verified the 48 dp entry target, report preview without saving or sharing, and hardware Back to a draft with the entered glucose value and selected unit intact. These were simulated viewport and accessibility checks. Installed Windows Narrator and Android TalkBack, physical-device layout, and first launch with the device network disabled remain pending.

## Issue #9 Unusual Entry Verification

On November 14, 2026, the working changes based on `996afdf` passed TypeScript checks across the shared, website, desktop, and Android projects. The 72 shared tests covered unusual entries, both temperature and glucose units, per-row CSV warnings, confirmation before commit, and preservation of the entered values and the Needs recheck flag. The website and desktop frontend builds, 15 website harness tests, and 33 desktop harness tests passed.

Two headless Edge tests verified that a reversed blood-pressure pair can be edited from Review or saved unchanged with a confirmation marker. All 52 Android harness tests passed, and the Android JavaScript bundle exported with `--no-bytecode`. Installed-device verification was outside this run.

## Issue #6 Reading Status Verification

### Issue #31 Overview accessibility follow-up

Windows and website Overview reading cards expose the metric name and recorded value as their accessible name and the badge text as their accessible description. Unlogged cards expose the metric name and the “Not logged” description. The shared reading-status tests passed, including both theme palettes, distinct icons and mood handling. Windows passed TypeScript and 37 frontend tests. The website production build and two focused headless Edge tests passed, covering accessible descriptions, contrast in both themes, forced colours, the Help legend and responsive Overview layout. Clean-source verification matched 42 shared files per target. Installed screen-reader verification remains open.

### Earlier cross-platform verification

On November 14, 2026, the working changes based on `bc13d33` passed TypeScript checks and 128 tests across shared, website, desktop, and Android harness suites on Windows with Node `24.22.1`. The website and desktop frontend builds passed. Clean-source verification confirmed all 39 shared files matched across each of the three targets.

The focused Playwright test ran in headless Microsoft Edge and passed at 390 CSS pixels. It checked all six Overview badges, accessible descriptions for mood and unlogged glucose, axe contrast in both themes, forced colors, and the five-entry Help legend. Badge text contrast ranged from 7.22:1 to 10.67:1. Each status uses a distinct symbol and label. Physical Android and installed desktop assistive technology were outside this verification run.

The Android JavaScript export completed with `--no-bytecode`. Windows Application Control blocked `hermesc.exe`, which prevented the standard Hermes bytecode export on this host.

## Issue #1 Mobile Verification

On November 14, 2026, the issue #1 changes based on `8b67a8c` passed mobile typechecking and all 45 tests across 5 suites on Windows with Node `26.12.1` and npm `11.20.0`. The offline `npm run export` produced one Android Hermes bundle and six bundled fonts. The export metadata listed only Android.

Clean-source verification passed after temporarily normalizing CRLF line endings in the website and desktop shared copies. The original checkout line endings were restored. Native APK installation and physical Android device checks remain open.

## 1. Host Environment & Toolchain Matrix

| Component | Observed Version / Status on Verification Host |
| --- | --- |
| Host OS & Architecture | Windows 11 x64 (`x86_64-pc-windows-msvc`) |
| Node.js / npm | `node v24.18.0` / `npm 11.16.0` |
| Rust / Cargo | `rustc 1.96.0` / `cargo 1.96.0` |
| C++ Build Tools & Windows SDK | Visual Studio 2022 Build Tools MSVC `14.44.35207`, Windows SDK `10.0.26100.0` |
| Microsoft Edge WebView2 Runtime | `157.0.4341.46` |
| Java Runtime (JDK) | `26.0.1` |
| Browser E2E & Accessibility | Playwright Chromium (`@playwright/test@1.65.0`, `@axe-core/playwright@4.14.0`) |
| Android Native SDK / EAS CLI | Not installed on host (`ANDROID_HOME` unset; `adb`, `sdkmanager`, `gradle`, `eas` absent) |
| Windows Authenticode Certificate | Not configured on host (Windows `.exe` and NSIS installer built as `NotSigned`) |

---

## 2. Per-Codebase Verification Results

> Counts in this section record the original `1b77771` verification. The current counts after the release-review fixes are in §6.2.

### 2.1 Canonical Shared Core (`shared/`) — **PASS**

- **Commands & Results:**
  - `cd shared && npm run typecheck` (`tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.tests.json`, with `"types": []` in `tsconfig.json`): exit `0`
  - `cd shared && npm test` (`vitest run`): `4 passed (4)` test files, `28 passed (28)` tests (`0` failed, `0` skipped)
    - `tests/conversions-and-timing.test.ts` (`9` tests)
    - `tests/references-and-guidance.test.ts` (`8` tests)
    - `tests/interchange-and-vectors.test.ts` (`7` tests)
    - `tests/contracts-and-boundaries.test.ts` (`4` tests)
  - `node ./scripts/verify-clean-source.mjs` (from `source/`): `Overall: PASS` (`0` `../docs` or `../plan` references, `0` forbidden secret/signing/DB files, `0` secret tokens, `37/37` SHA-256 shared file parity across `website/`, `desktop/`, and `mobile/`).

### 2.2 Public Landing Page & Synthetic Browser Demo (`website/`) — **PASS**

- **Isolated Clean-Checkout Build & Unit Suite (`shared/` + `website/`, without workspace siblings):**
  - `npm ci` (`464` packages installed)
  - `npm run typecheck` (`tsc --noEmit`): exit `0`
  - `npm test` (`vitest run` with `fake-indexeddb`): `1 passed (1)` suite, `8 passed (8)` tests (`0` failed)
  - `npm run build` (`tsc --noEmit && vite build`): exit `0` (`2595` modules transformed, `vite-plugin-pwa v2.0.0`, `21` precache entries / `3143.84 KiB`, `dist/sw.js`, `dist/workbox-2fbc6a65.js`, `dist/manifest.webmanifest`)
- **Playwright Chromium E2E, Accessibility, Viewport & Offline SW Verification:**
  - Author suite (`npx playwright test --reporter=list`): `6 passed` (`0` failed, `0` skipped)
  - Independent `@verifier` live audit against `dist/`:
    - `0` external network requests (`Inter Variable` and `Geist Mono` loaded locally)
    - `0` console or uncaught page errors
    - `0` `axe-core` WCAG 2.2 AA violations across `/` and `/demo` routes in both Dark and Light themes
    - `0` interactive hit targets below `44×44` CSS px
    - `0` horizontal overflows across `1440×900` (desktop), `768×1024` (tablet), `390×844` (phone Dark & Light), and `320×568` (`400%` zoom reflow)
    - Verified full `Overview -> Check-in -> Review -> Add to log -> Trends -> Explorer -> Actions -> Sources -> Reports` flow, real JSON/CSV download byte inspection (`mood` and `note` excluded by default), 5-row CSV reconciliation (`2 valid · 1 duplicate · 1 conflict · 1 rejected`), `personal`-mode bundle rejection in `/demo`, Light A4 `@media print`, and `context.setOffline(true)` service-worker reload.

### 2.3 Windows Desktop Application (`desktop/`) — **PASS (with host harness notes)**

- **Isolated Clean-Checkout Build, Rust SQLite & Unit Suites (`shared/` + `desktop/`, without workspace siblings):**
  - `npm ci` (`107` packages installed)
  - `npm run typecheck` (`tsc --noEmit`): exit `0`
  - `npm test` (`vitest run`): `1 passed (1)` suite, `7 passed (7)` tests (`0` failed)
  - `npm run build` (`tsc --noEmit && vite build`): exit `0` (`2211` modules transformed)
  - `cd src-tauri && cargo test`: `11 passed; 0 failed; 0 ignored` (tests real `rusqlite` `WAL` + `BEGIN IMMEDIATE` atomic commit + draft closure + `sourceDraftId` idempotence, lost-ack recovery, rollback preservation, whole-BP CSV batch import, separate vs. replace profile restore, and Demo/Personal isolation)
- **Packaged Windows x64 Release Binaries (`npx tauri build`):**
  - *Superseded:* the sizes and hashes below are from `1b77771`. §6.2 has the current release exe and installer.
  - **Application Executable:** `desktop/src-tauri/target/release/crewsignal-desktop.exe`
    - Size: `13,645,312` bytes
    - SHA-256: `2AE51C47EE7A837E3D268C2AE2EB863D635FE20DA939B07AEFF5860D30ADCE73`
    - Signing status: `NotSigned`
    - Launch smoke test: Launched cleanly and held `CrewSignal` window title after 3 seconds without crash.
  - **Per-User NSIS Installer (`installMode: "currentUser"`):** `desktop/src-tauri/target/release/bundle/nsis/CrewSignal_0.1.0_x64-setup.exe`
    - Size: `4,701,452` bytes (`4.48 MiB`)
    - SHA-256: `E2D924BF712455F095E4ABF25AA2F015302777C5D323F97D32729E4F893A2918`
    - Signing status: `NotSigned`
    - WebView2 mode: Evergreen bootstrapper default (`downloadBootstrapper`); airgapped `offlineInstaller` option documented in `desktop/README.md`.
- **Playwright Chromium E2E, `forced-colors` & Viewport Verification:**
  - Author suite (`npm run test:e2e`): `4 passed` (`0` failed)
  - Independent `@verifier` live audit: `0` external requests, `0` page/console errors, `0` `axe-core` violations (including `forcedColors: "active"` Windows High Contrast in Light & Dark), `0` horizontal overflows across `1440×900`, `768×1024`, `720×900`, `390×844` (Dark & Light), and `320×568` (`400%` zoom).

### 2.4 Android Mobile Application (`mobile/`) — **PASS (Headless JS / SQLite / Hermes Export) · HOST-LIMITED (Native `.apk` & Physical Devices)**

- **Isolated Clean-Checkout Build, SQLite & RNTL Suites (`shared/` + `mobile/`, without workspace siblings):**
  - `npm ci --prefer-offline` (`1,014` packages installed)
  - `npm run typecheck` (`tsc --noEmit`): exit `0`
  - Bare `npm test` (`jest`): `3 passed, 3 total` suites, `18 passed, 18 total` tests (`38.037 s`, exit `0`):
    - `tests/canonical-vectors.test.ts`
    - `tests/sqlite-transactions.test.ts` (executes real SQL schema and atomic transactions via `NodeSqliteDriver` on `node:sqlite`)
    - `tests/mobile-ui.test.tsx` (verifies phone `<600` dp 5-tab shell, keyboard tab-bar collapse, `>=48` dp targets, tablet `>=600` dp `>=88` dp rail, all 6 forms, unit-change modal, `0h 0m` sleep, `ER-01..ER-04`, SVG body diagram/list, SVG 7/30d trend chart/table, file save vs. share sheet vs. A4 print, and Demo/Personal isolation)
  - Historical Expo export (Android output): exit `0`
    - Android Hermes bundle (`937` modules): `dist/_expo/static/js/android/index-60c860b3340de09ec2f440893c0133d6.hbc` (`3 MB`)
    - Bundled offline fonts: `6` `.ttf` files (`Inter-Regular/Medium/SemiBold.ttf`, `GeistMono-Regular/Medium/SemiBold.ttf`) + `dist/metadata.json`

---

## 3. Cross-Platform Acceptance Vectors (`V01–V11`)

| Vector | Fixture / Operation | Result |
| --- | --- | --- |
| `V01` | `SIM-01` seed (`2026-10-03T00:00:00Z` epoch, Day 42 `2026-11-13T07:18:00Z`, 11 observations across 5 types, Glucose `Not recorded`) | **PASS** |
| `V02` | Optional blood pressure (`118/76 mmHg` at Day 42 `07:18`, atomic commit + single draft closure -> 12 observations, 5 of 6 coverage, `07:07` retained) | **PASS** |
| `V03` | Commit interruption (`ER-02` rollback retry, `ER-03` unknown outcome `Check the log` idempotence via `sourceDraftId`, `ER-04` retained draft banner) | **PASS** |
| `V04` | Skip or instrument unavailable (`CheckInEvent` logged without fake observation; session committed count preserved) | **PASS** |
| `V05` | Unit change (`5.4 mmol/L -> 97.308 mg/dL` / `~97.3 mg/dL`; `36.7 °C -> 98.06 °F` / `98.1 °F`; populated unit change Cancel/Confirm; display units non-mutating) | **PASS** |
| `V06` | Sleep and mood (period-only sleep ending Day 42, `5h 48m` over 6h midnight window, `0h 0m` `Reported no sleep`, blank stays invalid; Mood unselected start, `crewsignal-mood-v1`) | **PASS** |
| `V07` | Reference and trend (`5h 48m` vs `7h 24m` preflight ref = `1h 36m below reference`, Day 38 `426 min -> 7h 06m`, 7d plot 7 points, 30d plot 23 gaps + 7 points, 7-day fallback & lock lifecycle) | **PASS** |
| `V08` | Reports and scope (Day 36–42 default report has 10 observations across 4 types before optional BP and 11 after; `mood` & `note` excluded by default; separate backup & draft recovery kinds) | **PASS** |
| `V09` | CSV and restore (5-row fixture -> `2 valid · 1 duplicate · 1 conflict · 1 rejected`; whole-pair `118/76` conflict resolution; atomic 2-row commit; separate-profile default restore) | **PASS** |
| `V10` | Offline and file outcomes (`Download requested` on web vs `File saved` / `Share sheet opened` on native; refusal/cancellation preserves preview; offline SW/cached Help & evidence summaries) | **PASS** |
| `V11` | Personal data and appearance (blank native Personal mode on local clock; scoped `SIM-01` reset & profile deletion; System/Light/Dark themes preserving route/draft/selection; `44px`/`48dp` targets; `320px` reflow) | **PASS** |

---

## 4. Operating Scenarios (`S01–S14`)

| Scenario | Description | Status |
| --- | --- | --- |
| `S01` | Routine habitat check-in, rested user | **PASS** |
| `S02` | Fatigued/distracted tablet user | **PASS** |
| `S03` | Interrupted entry / device restart | **PASS** |
| `S04` | Optional reading / unavailable instrument | **PASS** |
| `S05` | Implausible / noisy / repeated observation | **PASS** |
| `S06` | Incompatible unit / method | **PASS** |
| `S07` | New profile / low coverage (`SIM-EMPTY` / Personal blank start) | **PASS** |
| `S08` | Sleep crossing midnight / timezone preservation | **PASS** |
| `S09` | Communication blackout (offline cached Help & 8 source summaries) | **PASS** |
| `S10` | Storage denied / full / evicted & guarded backup restore | **PASS** |
| `S11` | Symptomatic user seeking Help without forced 6-field entry or baseline | **PASS** |
| `S12` | Shared terminal / report handoff (`mood` & `note` excluded by default, isolated demo reset) | **PASS** |
| `S13` | Keyboard / screen-reader / chart-table & body-list access | **PASS** (Chromium keyboard, `axe-core` WCAG 2.2 AA, `forced-colors` verified; physical Android TalkBack noted under host limits) |
| `S14` | Phone keyboard / zoom (`320px` / `400%` reflow & `200%` text scaling) | **PASS** |

---

## 5. Completion Gates (`G01–G12`) & Honest Open / Host-Limited Items

| Gate | Status | Verification Summary & Open / Host-Limited Scope |
| --- | --- | --- |
| `G01` — Current official requirements | **PASS (repo artifacts) / OPEN (portal receipt)** | Apache-2.0 `LICENSE`, `CREDITS.md` (with AI disclosure), `THIRD-PARTY-NOTICES.md`, `README.md`, `EVIDENCE.md`, and clean-source verification are in `source/`. **Open for team owner:** verify live Space Apps portal fields and record final portal submission receipt. |
| `G02` — Applicable guidance | **PASS** | Educational sleep action pinned to observation, reference, rule, and source versions (`2026-11-13`); unreviewed clinical procedure slot remains disabled. |
| `G03` — Measurement protocol | **PASS** | Optional unscheduled logging, `SIM-SCHEDULE` (`26h 18m` vs `24h` interval), `Skip`, and `Unavailable` workflow events verified without fabricating readings. |
| `G04` — Data integrity | **PASS** | Exact glucose (`× 18.02`) and NIST temperature conversions, period-only sleep, whole-pair BP validation, and 5-row CSV reconciliation verified. |
| `G05` — Personal references | **PASS** | Preflight references preferred, 7-day distinct observed-day fallback median heuristic with deterministic tie-breaking, locked version lifecycle, and `Comparison unavailable` states verified. |
| `G06` — Help path | **PASS** | Persistent Help reachable from every route and empty/offline/error states; unconfigured default Help + clearly marked `Example procedure card · Test fixture`. |
| `G07` — Resilience | **PASS** | Atomic transactions, idempotence (`sourceDraftId`), rollback retry, lost-ack `Check the log` lookup, offline SW reload, and deferred SW update during active drafts verified. |
| `G08` — Privacy | **PASS** | Demo/Personal profile isolation, public web demo rejection of `personal` bundles, and default exclusion of `mood` and `note` in reports verified. |
| `G09` — Accessible devices | **PASS (Web/Desktop/RNTL) / HOST-LIMITED (Physical mobile AT)** | Phone (`390×844`), tablet (`768×1024`), desktop (`1440×900`), `320px` reflow, `200%` text scale, Dark & Light themes, `axe-core` WCAG 2.2 AA (`0` violations), and Windows `forced-colors` verified. Physical-device Android TalkBack runs require provisioned hardware. |
| `G10` — NASA traceability | **PASS** | All 8 NASA/CDC/NIST sources (`checkedDate: 2026-11-13`) bundled offline with explicit scope/limitation statements and non-endorsement disclosures. |
| `G11` — Self-contained release | **PASS (Source/Web/Windows/Hermes) / HOST-LIMITED (Native `.apk` & Signing)** | Isolated clean-checkout builds/tests pass for `shared/`, `website/`, `desktop/`, and `mobile/` without parent workspace folders. Windows `.exe` and NSIS installer are built (`NotSigned`). Native Android APK compilation requires an Android SDK environment. |
| `G12` — Complete journey & scope | **PASS** | Full `Record -> Review -> Saved -> Trends/Explorer -> Actions/Sources -> Scoped Report / Backup / CSV` journey verified across all codebases. |

---

## 6. Release Review Fixes (`plan/IMPLEMENTATION-REVIEW.md` of `1b77771`)

The review reproduced six blockers and several P2 issues. Each fix landed with regression tests that cover the reproduced failure and pass on this branch. The gates the review reopened (`G04`–`G08`, `G12`) were re-verified below.

### 6.1 Fixes, regression tests and affected gates

| Commit | Fix | Regression tests (file › name) | Gates / vectors |
| --- | --- | --- | --- |
| `757432f` | Windows SQLite bridge accepts the shared contract payloads (seed, save, restart) and never panics when storage cannot be opened: Help and a recovery panel stay reachable, with retry. | `desktop/src-tauri` › `shared_contract_seed_save_restart_and_retry_through_sqlite`, `restore_replace_rejects_cross_mode_and_leaves_records_intact`, `unreadable_database_leaves_file_untouched_and_reports_unavailable`, `denied_storage_recovers_on_retry_when_access_returns`, `missing_app_data_directory_is_reported_without_panicking`; `desktop/tests` › "matches the frontend's production payload shapes", "keeps Help and recovery reachable when local storage cannot be opened, then recovers on retry" | `G04`, `G06`, `G07`, `G12`; `S10`, `S11` |
| `e65d2bf` | Website: consecutive check-ins get distinct draft IDs; drafts survive navigation and metric changes. | `website/tests/e2e` › "7. Review P1 regressions: consecutive check-ins from Overview get distinct drafts…"; `website/tests` › "Review P1: consecutive check-ins get distinct draft IDs; retrying the second keeps 13", "Review P1: saving a draft for one measurement keeps the retained draft of another" | `V02`, `V03`; `S01`, `S03`, `S05`; `G04`, `G07`, `G12` |
| `4237269` | Seven-day fallback references are persisted (with representative observation IDs) and locked before they are shown, on all three apps. | `shared/tests` › "selects the first eligible method/context…", "a stored lock is reused after later observations and earlier imports", "an explicit update creates an active version 2…", "does nothing with fewer than seven days…"; `website` + `mobile` › "Review P1: the first eligible fallback is persisted with its representative IDs and stays locked"; `desktop/src-tauri` › `fallback_lock_writes_once_and_never_supersedes_an_existing_reference` | `V07`; `G05` |
| `ff0bcc4` | Windows backup restore keeps the profile mode and carries reviewed actions, clock history and corrections; replacing across modes is refused without changes. | `desktop/src-tauri` › `restore_keeps_demo_mode_and_round_trips_reviews_clock_history_and_corrections`; `desktop/tests` › "keeps Demo mode and history on a separate restore…", "refuses to replace a Personal profile with a Demo backup…"; `shared/tests` › "keeps reviewed actions, clock history and corrections through export and validation", "still accepts backups written before the history field existed" | `V09`; `S10`; `G07`, `G08`, `G12` |
| `dd57b74` | W3C tabs keyboard pattern (arrows / Home / End, roving `tabindex`) in Check-in, Explorer and Reports; offline WebView2 installer docs corrected. | `website/tests/e2e` › "8. Review P2: Check-in and Explorer tabs follow the W3C keyboard pattern"; `desktop/tests/e2e` › "Review P2: Reports and Explorer tabs follow the W3C keyboard pattern" | `S13`; `G09`, `G11` |
| `40e872e` | Calmer Overview: next step first, readings in 2×3 / 3×2 / 6-rail, sleep scale 0/5/10 h. | `website/tests/e2e` › "9. Review P2: calmer Overview…"; `desktop/tests/e2e` › "Review P2: calmer Overview shows the next step first and a 0/5/10-hour sleep scale" | `G09`, `G12` |
| `936daaa` | Landing page: labelled phone Menu, team entry, planned (not shipped) Windows and mobile platforms, evidence before limits, sources and credits. | `website/tests/e2e` › "10. Review P2: landing page has a phone menu, team entry, planned platforms and credits" (axe at 1440 px and 320 px) | `G01`, `G09`, `G10` |

The mobile app uses touch tabs, which have no arrow-key pattern, so the tab-keyboard fix applies only to the website and Windows. On Windows, reviewed actions travel in `history.actionReviews` and `insights` stays `[]`, as in the shared contract.

### 6.2 Full rerun on the fix branch (Windows 11 host, 2026-11-13)

All commands run from `source/`. Logs were kept outside the repository.

| Step | Command | Result |
| --- | --- | --- |
| Shared sync | `node shared/scripts/sync-to-targets.mjs --check all` | exit `0`: website, desktop, mobile each `OK (37 files match SHA-256)` |
| Clean-source parity | `node scripts/verify-clean-source.mjs` | `Overall: PASS` (343 files; 0 sibling refs, 0 secret/signing/DB files, strict parity) |
| Shared | `cd shared && npm run -s typecheck && npx vitest run` | exit `0`; `4` files, **`34 passed`** (was 28) |
| Mobile | `cd mobile && npx tsc --noEmit && npx jest --ci` | exit `0`; `3` suites, **`19 passed`** (was 18) |
| Website unit | `cd website && npx vitest run` | **`11 passed`** (was 8) |
| Website build | `cd website && npm run -s build` | exit `0`; `2597` modules, `21` precache entries (`3152.95 KiB`) |
| Website E2E + axe | `cd website && npx playwright test --project=chromium` | **`10 passed`** (was 6) |
| Desktop unit | `cd desktop && npx vitest run` | `3` files, **`11 passed`** (was 7) |
| Desktop build | `cd desktop && npm run -s build` | exit `0`; `2213` modules |
| Desktop E2E + axe | `cd desktop && npx playwright test` | **`6 passed`** (was 4) |
| Rust / SQLite | `cd desktop/src-tauri && cargo test --quiet` | **`18 passed; 0 failed`** (was 11) |
| Mobile Hermes export | Historical Expo export (Android output) | exit `0`; Android `937` modules (`_expo/static/js/android/index-7e8a11668b857f1202a03dfa5adc95ba.hbc`, 3 MB), 6 bundled `.ttf` fonts |
| Windows release + NSIS | `cd desktop && npx tauri build` (default config) | exit `0`; `desktop/src-tauri/target/release/crewsignal-desktop.exe` `13,720,576` bytes, SHA-256 `75DB77E98D4636ADDEC68EA5A584C09889936CADBBDFE05304BD1F79F48309F3`; `desktop/src-tauri/target/release/bundle/nsis/CrewSignal_0.1.0_x64-setup.exe` `4,724,357` bytes, SHA-256 `766F18D66248AF11ACB9C9B49520BCD1683718DF29ADF1BC683F835CAACBADFB`; both `NotSigned` |

### 6.3 Windows real runtime (release build, real Tauri `invoke` → `rusqlite`)

- **Build:** `cd desktop && npx tauri build --no-bundle --config <tauri.verify.json>`, where the config sets `{"identifier":"org.crewsignal.desktop.verify","productName":"CrewSignalVerify"}`. This keeps the verification database in its own `%APPDATA%\org.crewsignal.desktop.verify` folder and away from any user profile. Artifact: `desktop/src-tauri/target/release/crewsignal-desktop.exe` (unsigned, git-ignored).
- **Driver:** WebView2 `157.0.4341.46`, launched with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` and driven by Playwright `connectOverCDP`. The probe scripts were temporary and are not committed.

| Journey | Observed result | Gates |
| --- | --- | --- |
| Fresh launch | `get_storage_status` available, journal `wal`; Overview shows "11 observations across 5 of 6 types" | `G04`, `G12` |
| UI check-in BP `119/77` (Day 42 07:20) | Receipt "Added to your log / Stored on this device"; Overview shows 12 with latest BP 119/77 | `G04`, `G07`, `G12` |
| Kill and relaunch | 12 observations and latest BP kept | `G07` |
| Garbage `crewsignal.db` (4096 random bytes) | Process stays up (no panic); `DB_PRAGMA_FAILED "file is not a database"`; recovery panel shows the path, "Try opening storage again" and "Open Help"; Help renders; file SHA-256 unchanged | `G06`, `G07`; `S10`, `S11` |
| Good DB restored → Retry | Overview shows 12 again | `G07` |
| Overview → "Review sleep →" → Mark reviewed | Toast "Action marked reviewed · Tied to Reference v1 · crewsignal-sleep-guidance-v1. Observations unchanged."; `actionReviews` 0 → 1 | `G02`, `G12` |
| Reference locks | `heart_rate` and `sleep` v1 `active`, locked in SQLite | `G05` |
| Separate restore (through the real `invoke('restore_backup')` bridge with the payload `buildRestoreRequest` builds; not through the Reports file picker) | New `restored-demo-<suffix>` profile, mode `demo`, 12 observations, 1 action review, both v1 references locked, clock history 1 | `G07`, `G08`; `V09` |
| Repeat import of the same backup | Second distinct `restored-demo-<suffix>` profile, 12 observations | `V09` |
| Separate restore reusing an existing ID | Refused: `RESTORE_PROFILE_ID_COLLISION` "…No changes made." | `G07` |
| Replace the Demo profile with a Personal-mode backup | Refused: `RESTORE_MODE_MISMATCH` (`backup=personal target=demo`) "…No changes made."; source profile still has 12 observations and 1 review | `G08` |
| Kill and relaunch after restores | All three profiles keep mode `demo`, 12 observations, 1 action review and locked v1 references; Overview shows "Reviewed · Reference v1 · Rule crewsignal-sleep-guidance-v1" | `G07`, `G08`, `G12` |

With these results, `G04`–`G08` and `G12` are **PASS** again on the fix branch for the website (Chromium), Windows (real WebView2 + SQLite) and mobile (Jest + `node:sqlite` driver).

### 6.4 PR #1 re-review fixes (`plan/IMPLEMENTATION-REVIEW.md`, "PR #1 re-review · 1fbb9e5")

The re-review reproduced three more P1 blockers. Each fix has a regression test that fails on `1fbb9e5` and passes here. The release build was driven through the native Windows file dialogs. This supersedes the "Separate restore" row in §6.3, which used `invoke('restore_backup')` directly and not the Reports file picker.

| Commit | Fix | Regression tests (file › name) | Gates / vectors |
| --- | --- | --- | --- |
| `ac63f7a` | Windows: a Reports restore that switches profiles saves the leaving profile's draft under that profile and hydrates the destination profile's own draft; commit refuses a draft from another profile (`COMMIT_SCOPE_MISMATCH`). | `desktop/tests` › "PR #1 re-review P1: restore keeps drafts with their own profile › Personal draft stays resumable, the restored Demo profile starts blank, and only Personal gains its entry" (`restore-draft-scope.test.tsx`) | `G07`, `G08`, `G12` |
| `ac63f7a` | Windows: native preferences use the shared `AppPreferences` shape on first launch, load and update (legacy `glucose` / `temperature` / `configuredHelpFixture` mapped). Full backup export normalizes again; if the bundle still fails, "Couldn't create backup" is shown, no dialog opens and the preview stays. | `desktop/tests` › `backup-export-preferences.test.tsx` (3 tests: normalization; legacy prefs → export, cancel, re-open, restore; bundle failure keeps the preview); `desktop/src-tauri` › `first_launch_preferences_use_the_shared_shape`, `legacy_saved_preferences_are_normalized_on_load` | `V09`, `V10`; `G07`, `G12` |
| `fc3aae8` | Website: "Check stored log" confirmation clears the draft; an unconfirmed outcome stays recoverable; the next check-in starts blank and adds one entry (13 → 14). | `website/tests` › `checkin-confirmation.test.tsx`; `website/tests/e2e` › "11. Review P1 (re-review): a saved draft behind an unconfirmed outcome is never reopened…" | `V02`, `V03`; `G04`, `G07`, `G12` |

**Rerun on the fix branch (Windows 11 host, 2026-11-13).** Sync check and clean-source parity PASS (37 files per target). Shared **34**, mobile **19**, website unit **12** (was 11), website E2E + axe **11** (was 10), website build OK, desktop unit **15** (was 11), desktop build OK, desktop E2E + axe **6**, Rust / SQLite **21** (was 18).

**Windows release build through the native file dialogs.** The verify build from §6.3 (separate `%APPDATA%\org.crewsignal.desktop.verify` database) was driven over CDP. The Windows "Save As" / "Open" dialogs were operated through UI Automation and Win32 messages (file name set, then Save, Open or Cancel pressed). The probe scripts were temporary and are not committed.

| Journey | Observed result | Gates / vectors |
| --- | --- | --- |
| Fresh launch (no database) | Native preferences are `{"activeProfileId":"sim-01-crew-01","appearance":"system","displayUnits":{"blood_glucose":"mg/dL","body_temperature":"C"},"helpMode":"unconfigured"}` | `G12` |
| Reports → Export full backup → Save As | "File saved" names the chosen path; the file passes `validateBackupImport` with those preferences and 11 observations | `V09`, `V10`; `G07` |
| Export again → Cancel | "Export cancelled"; nothing written | `V10` |
| New Personal profile, BP 127/81 at Review → Reports → Open the saved backup → Restore | "Valid Demo backup", then "Restored into separate profile" (11 observations). On the restored profile Check-in, heart rate and systolic are empty and 127/81 is not shown | `G07`, `G08` |
| Switch back to Personal | The 127/81 draft resumes at Review; Add to log → Personal shows 1 observation | `G07`, `G12` |
| Per-profile SQLite state | Demo 11 observations / 0 drafts; restored Demo 11 / only its own draft; Personal 1 / 0 drafts | `G07`, `G08` |
| Export from the existing Personal profile | Valid backup, `activeProfileId` = the Personal profile, 1 observation | `V09`; `G07` |
| Legacy preferences written into SQLite (`glucose: mmol/L`, `temperature: F`, `configuredHelpFixture: false`), relaunch | Loaded as `blood_glucose: mmol/L`, `body_temperature: F`, `helpMode: unconfigured`; export validates; cancel, re-open and restore succeed | `V09`, `V10`; `G07`, `G12` |

Default-config release rebuilt afterwards (`npx tauri build`): `crewsignal-desktop.exe` `13,735,936` bytes, SHA-256 `3A94332EC26ECAEA8EA088E332F803B2E90C402B2C4CECCF77EA3522D276D29F`; `CrewSignal_0.1.0_x64-setup.exe` `4,724,271` bytes, SHA-256 `D3D3CD1518AF58CB9C6A7C33B144C34C2934EAD30304791863F1DD36A938B7D4`; both `NotSigned`. These replace the hashes in §6.2.

**Mobile parity check.** Mobile does not share either path. `SqliteCrewSignalStore.checkDraftCommitStatus` already deletes the draft when the check returns `already_in_log` (`mobile/src/storage/sqliteStore.ts`), and mobile preferences are written in the shared `AppPreferences` shape with no legacy keys. Covered by `mobile/tests/sqlite-transactions.test.ts`.

With these results, `V02`, `V03`, `V09`, `V10`, `G04`, `G07`, `G08` and `G12` are **PASS** again on the fix branch.

### 6.5 PR #1 follow-up fix (`plan/IMPLEMENTATION-REVIEW.md`, "PR #1 follow-up · af389d0")

The follow-up review reproduced one Windows P1. When local storage can't keep a Personal draft (`ER-04`, memory only), a Reports restore into a separate profile switched profiles, the native save returned `retained: false`, and the only copy of the draft was dropped. The fix keeps the draft recoverable under its own profile while the app is open and warns before the restore.

| Fix | Regression tests (file › name) | Gates / vectors |
| --- | --- | --- |
| Windows: every profile change (Reports restore, Settings switch, new Personal profile, Demo reset, profile delete) first tries to save the leaving draft under its own profile. If the save returns `retained: false` or throws, the draft is kept in memory with that profile (`memory_only`) and resumes when the user switches back. The close guard counts these drafts and offers "Export {profile} draft" for each. Before a restore, Reports names the memory-only draft and offers "Export draft recovery" (native Save As) and "Back to check-in"; the restore toast says the draft is kept with its profile until CrewSignal closes. | `desktop/tests` › `restore-memory-draft.test.tsx`: "retained: false — Reports warns and offers export, cancel keeps it, restore parks it, Personal resumes it"; "thrown save error — the draft is parked in memory and resumes on Personal"; "a Settings profile switch also keeps the memory-only draft, and the close guard counts it". The successful-retention path stays covered by `restore-draft-scope.test.tsx`. All three new tests fail on `af389d0` and pass here. | `ER-04`; `V03`; `S10`; `G07`, `G12` |

**Rerun on the fix branch (Windows 11 host, 2026-11-13).** Sync check and clean-source parity PASS (37 files per target). Shared **34**, mobile **19**, website unit **12**, website E2E + axe **11**, website build OK, desktop type check OK, desktop unit **18** (was 15), desktop build OK, desktop E2E + axe **6**, Rust / SQLite **21**.

**Windows release build through the native file dialogs.** This is the review's reproduction on the §6.3 verify build (separate `%APPDATA%\org.crewsignal.desktop.verify` database, reset first), driven over CDP. The "Save As" and "Open" dialogs were operated through UI Automation and Win32 messages. The probe script was temporary and is not committed.

| Journey | Observed result | Gates / vectors |
| --- | --- | --- |
| Reports → Export full backup → Save As | "File saved"; backup on disk | `V09`; `G07` |
| New Personal profile, Settings › "Simulate ER-01 draft retention failure" on, BP 129/83 → Review | Review shows 129/83 mmHg with "We couldn't retain this draft on this device." | `ER-04` |
| Reports → Choose backup → Cancel in the native Open dialog | No backup loaded; still on Personal | `V10` |
| Choose backup → Open | "Valid Demo backup"; the notice reads "Your Commander Vega draft is only on this screen… Restoring keeps it in memory with Commander Vega until you close CrewSignal…" | `ER-04`; `S10` |
| Notice → Export draft recovery → Save As | Save As stays open for 3 s with no file written; after Save, "File saved" and the file is a `crewsignal-draft-recovery` bundle holding 129/83 | `ER-04`; `V10` |
| Restore profile atomically | "Restored into separate profile" with "…draft is kept in memory with that profile"; restored Overview shows 11 observations; its Check-in doesn't show 129/83 | `S10`; `G07`, `G08` |
| Settings → switch to Personal, hook off → Check-in | The 129/83 draft resumes at Review; Add to log → Personal Overview "1 observation across 1 of 6 types" | `G07`, `G12` |
| Same journey with the hook off (successful retention) | No retention warning and no memory-only notice; after the restore, SQLite holds exactly one Personal draft (`blood_pressure`, `retained`) and the restored profile holds none; switching back resumes 129/83 and Add to log gives "1 observation across 1 of 6 types" with no draft left | `ER-04`; `S10`; `G07`, `G12` |

Natively verified: `retained: false`, successful retention and Open cancellation, each on a reset database. The thrown-save path is covered by the unit test only: in the release build, a save error that throws would also make `restore_backup` fail before any profile change, so reproducing it natively would need a new Rust test hook. The verify build used a separate Cargo target folder, so the release binaries below were not rebuilt by it.

Default-config release rebuilt afterwards (`npx tauri build`): `crewsignal-desktop.exe` `13,736,448` bytes, SHA-256 `40A2A8604530E4840DD6D036337C6868C7D4756BCC495F36C5AE9A8F1BDCAC43`; `CrewSignal_0.1.0_x64-setup.exe` `4,728,500` bytes, SHA-256 `DEEF5ECB2299E702D023C6004A9D0F84655428ED0F1CBC105648546A6501E87E`; both `NotSigned`. These replace the hashes in §6.4.

**Parity check.** The website already keeps working drafts in app-level state keyed by profile and measurement (`website/src/state/AppStateContext.tsx`, `workingDrafts`), so a profile change there doesn't drop a memory-only draft, and `beforeunload` warns while one exists. *Correction (see §6.6):* this paragraph first said mobile drafts live only in SQLite. That was wrong: a draft the device refused to save stays in React state, and a restore that changed profiles could drop it. §6.6 fixes and tests that.

With these results, `ER-04`, `S10`, `G07` and `G12` are **PASS** again on the fix branch.

### 6.6 PR #1 recovery verification (`plan/IMPLEMENTATION-REVIEW.md`, "PR #1 recovery verification · 215c55b")

The review held the PR for three draft-recovery P1s: loading `SIM-SCHEDULE` on Windows dropped the open draft; replacing the active profile deleted its saved draft with no warning and left the old draft on screen; and on mobile a draft the device refused to save was lost when a restore changed profiles.

| Fix | Regression tests (file › name) | Gates / vectors |
| --- | --- | --- |
| Windows: loading `SIM-SCHEDULE` uses the same profile handoff as every other profile change. The leaving draft is saved under its own profile, or kept in memory with it if the save fails. The toast says which happened ("saved with {profile}" / "kept in memory with {profile}"). | `desktop/tests` › `draft-handoff-fixture-replace.test.tsx`: "SIM-SCHEDULE: a stored Record draft is saved with Personal and resumes there"; "SIM-SCHEDULE: a memory-only Review draft is kept in memory with Personal and resumes there" | `ER-04`; `S03`; `G07`, `G12` |
| Windows: when "Replace current personal profile" is selected and that profile has an open draft, Reports explains first: "Replacing {profile} removes its open draft." It says whether the draft is only on screen or saved on the device and deleted with the old data. It offers "Export draft recovery" and "Back to check-in", and the confirm checkbox adds "including its open draft". Choosing a separate restore hides the notice and leaves the draft as it was. After a confirmed replace, the app reloads the draft from SQLite (none), clears the memory-only state and says the draft was removed. A failed restore changes nothing. | same file: "replace: warns and exports before, cancel keeps the draft, confirmed replace shows storage"; "replace with a memory-only draft: says it's only on screen, and clears the unsaved state afterwards"; "replace rollback: a failed restore leaves the draft and its storage unchanged" | `S10`; `G07`, `G12` |
| Website parity: Settings shows the same warning before a replace (drafts saved in the browser are deleted in the same IndexedDB transaction), offers "Download recovery JSON", and Check-in afterwards shows what storage holds. | `website/tests` › `restore-replace-draft.test.tsx`: "warns before the replace and shows storage afterwards"; "a failed restore leaves the saved draft in place" | `S10`; `G07`, `G12` |
| Mobile: every draft write goes through one path. A rejected write no longer throws into the screen. The draft stays on screen as `memory_only`, a banner says so and the failure is announced. Before any profile change (restore, switch, new profile, reset, delete), the leaving draft is saved with its own profile or parked in memory under it. It comes back when that profile is active again. Before a restore, Reports explains what will happen to such a draft ("only on this screen… kept in memory with {profile}") and offers "Export draft backup". A replace of the draft's profile gets the same warning as on Windows. | `mobile/tests` › `mobile-ui.test.tsx`: "ER-04/S10: a draft the device refused to save survives a restore that changes profiles" (saving fails, then the restore succeeds; switching back resumes 129/83) | `ER-04`; `S10`; `G07`, `G12` |
| Flaky test: the restore-message checks in `restore-memory-draft.test.tsx` now read the visible `.toast-banner` only. The sr-only live region repeats the text, so a page-wide query could match twice. The long journeys get a 20 s budget instead of the 5 s default. | three concurrent rounds of desktop, website and mobile unit tests: all pass (desktop 23/23, website 14/14, mobile 20/20 each round; the longest draft test took 0.6 s) | — |

All eight new tests (desktop 5, website 2, mobile 1) were run against the `215c55b` source in a separate worktree. All eight fail there and pass here.

**Rerun on the fix branch (Windows 11 host, 2026-11-13).** Sync check and clean-source parity PASS. Shared **34**, mobile **20** (was 19), mobile type check OK, mobile Android Hermes export OK, website unit **14** (was 12), website E2E + axe **11**, website build OK, desktop type check OK, desktop unit **23** (was 18), desktop build OK, desktop E2E + axe **6**, Rust / SQLite **21**.

**Windows release build, native journey.** This ran on the §6.3 verify build with a reset database, driven over CDP, with native Save As/Open handled as in §6.5 (temporary probe, not committed; 37 checks, PASS).

| Journey | Observed result | Gates / vectors |
| --- | --- | --- |
| New Personal profile (Vega), BP 131/84 on Record → load `SIM-SCHEDULE` | Toast "Your open draft was saved with Commander Vega"; SQLite holds Vega's draft (`retained`); switching back shows 131/84 on Record | `S03`; `G07`, `G12` |
| Second Personal profile (Lyra), retention hook on, BP 129/83 → Review → load `SIM-SCHEDULE` | Toast "…kept in memory with Commander Lyra…"; no Lyra draft in SQLite; native close is intercepted with "only in memory" and "Export Commander Lyra draft"; Stay in app | `ER-04`; `S03` |
| Hook off, switch back to Lyra | Review shows 129/83; Add to log → one observation | `G07`, `G12` |
| Lyra full backup → BP 127/81 → Review → Reports, open the backup, select replace | Notice "Replacing Commander Lyra removes its open draft…"; confirm checkbox says "including its open draft" | `S10` |
| Notice → Export draft recovery → Save As | `crewsignal-draft-recovery` file holding 127/81 | `ER-04`; `V10` |
| Switch to separate restore (cancel) | Notice hidden; Lyra still has one stored draft | `S10` |
| Replace, confirm, Restore profile atomically | Toast "…open draft was removed with the replaced profile data"; SQLite: Lyra 1 observation, 0 drafts; Check-in doesn't show 127/81 | `S10`; `G07` |
| Close straight after the replace, then relaunch | No close prompt; the app exits (no draft left in memory). Relaunch: Lyra active; SQLite Lyra 1/0, Vega 0/1 (131/84 kept), Demo 11/0; Lyra Check-in blank, no 127/81 | `G07`, `G12` |

Replace rollback was not part of this native journey. The release retest of `7494f04` (`plan/IMPLEMENTATION-REVIEW.md`, "PR #1 release retest · 7494f04") then verified it natively on Windows through the existing "Simulate ER-02 commit rollback" switch in Settings: after the failed replace, the original draft and observation were still intact. The desktop and website unit tests cover the same case. Opening Check-in afterwards creates a blank draft, and the close guard counts it, as it already did at `1b77771`.

The mobile fix ran in the headless Jest/SQLite harness only. A physical-device check is listed in §7.

Default-config release rebuilt afterwards (`npx tauri build`): `crewsignal-desktop.exe` `13,736,960` bytes, SHA-256 `9CC7F84B45D0F79AD66652A0E0F4AAEDB8C5142B105275996D6BB391C4D18A94`; `CrewSignal_0.1.0_x64-setup.exe` `4,729,867` bytes, SHA-256 `91585E26D6B8D47BB93894A63F933C3428A8DF18A1933D6F548D7D9EAB0D00D3`; both `NotSigned`. These replace the hashes in §6.5.

With these results, `ER-04`, `S03`, `S10`, `G07` and `G12` are **PASS** on the fix branch.

### 6.7 PR #1 release retest fixes (`plan/IMPLEMENTATION-REVIEW.md`, "PR #1 release retest · 7494f04")

The retest found two mobile P1s and one mobile P2. On mobile, a draft that was already in the log could be saved again when the profile changed. Replacing an inactive profile ignored that profile's drafts. The draft recovery export included private notes.

| Fix | Regression tests (`mobile/tests` › `mobile-ui.test.tsx`) | Gates / vectors |
| --- | --- | --- |
| A confirmed add, or a verified "Already in your log", now closes the draft. The active draft is marked `committed` and keeps its observation ID, so the receipt stays on screen. The parked copy of that draft is dropped. Before a handoff, the store checks whether an observation already exists for that draft ID (`isDraftCommitted`). If so, nothing is written back. Reload, resume and metric switching skip committed drafts. | "V02/G04: a confirmed add closes the draft, so a profile switch cannot write it back"; "V02/G04: a verified Already in your log closes the draft, …" (both: 0 drafts straight after switching to Demo and back, no 129/83 Review, and a second reading of 132/84 gives 2 observations) | `V02`, `V03`; `G04`, `G07`, `G12` |
| Reports looks up drafts for the replacement destination, not for the active profile. It checks the stored drafts (`loadProfileDrafts`), the parked memory-only draft and the open draft. The notice and the confirm dialog name the target profile and the number of drafts. "Export draft backup" saves one file per draft. After a confirmed replace, the target's parked copy is dropped and the committed SQLite snapshot is loaded. The source profile's draft is handed off separately. A store error during the restore is caught: "Nothing was changed", and every draft stays where it was. | "S10/G07: replacing an inactive profile names its retained draft, survives cancel and rollback, then clears it"; the same test with a memory-only draft (the draft write is refused throughout). Both also check that the other profile's draft is kept. | `S10`; `G07`, `G12` |
| Both mobile recovery entry points (the Check-in "Export uncommitted draft backup" or banner action, and the Reports notice) use `includeNotes: false`, as `docs/design/ERROR-RECOVERY.md` requires. The website and Windows exports already did. | The two S10/G07 tests and "ERROR-RECOVERY: Check-in draft recovery export leaves the private note out" read the saved file bytes: `"includeNotes": false`, `note: ""`, and no note text. | `ER-04`; `V10` |

All five new tests were run against the `7494f04` source in a separate worktree. All five fail there for the reasons the review gave: one draft left after the switch, no `restore-replace-draft` notice for the inactive target, and the note text in the file. All five pass here.

**Parity.** The Windows app already closes the draft on all three confirmation paths: `setActiveDraft(null)`, plus `deleteDraft` on the "Already in your log" paths. Its handoff also skips `committed` drafts. The website deletes the stored draft in the same IndexedDB transaction as the commit (`commitDraftAtomically`). All three of its confirmation paths (add, lost acknowledgement, and the Check log button) call `forgetWorkingDraft`, so no copy is left to save again. Windows and the website only replace the current profile ("Replace current personal profile" / `activeProfile`), so they cannot have the inactive-target case. No shared-core file changed (37/37 identical).

**Rerun on the fix branch (Windows 11 host, 2026-11-13).** Sync check and clean-source parity PASS. Shared **34**, mobile **25** (was 20), mobile type check OK, mobile Android Hermes export OK, website unit **14**, website E2E + axe **11**, website build OK, desktop type check OK, desktop unit **23**, desktop build OK, desktop E2E + axe **6**, Rust / SQLite **21**. This run was sequential. The two website timing flakes the retest saw only in its concurrent run (the confirmation receipt wait and the 320px overflow straight after a resize) did not reproduce here and were not changed.

The Windows build is unchanged from `7494f04`, so the hashes in §6.6 still apply.

With these results, `V02`, `V03`, `G04`, `S10`, `G07` and `G12` are **PASS** on the fix branch. The mobile results come from the headless Jest/SQLite harness; the physical-device check is listed in §7.

---

### 6.8 PR #1 replacement preview and safety backup fixes (review of `f92ef39`)

The review found two mobile Reports problems in "Replace existing profile":

1. **No preview gate.** Replace was enabled before the target's draft lookup finished. A failed lookup looked the same as "no drafts", and a late answer for an earlier selection could replace the current one.
2. **Wrong safety backup.** "Save safety backup first" saved the *active* profile, gave consent on the user's behalf, and showed any earlier backup time as "Safety backup saved", including a backup of another profile.

| Fix | Regression tests (`mobile/tests` › `mobile-ui.test.tsx`) | Gates / vectors |
| --- | --- | --- |
| **Preview state.** Reports keeps a draft preview (`pending`, `ready` or `failed`) keyed by the target profile and a per-backup token. It counts only when both match the current selection, so changing either one invalidates it in the same render. Each lookup takes a request number, and only the latest may settle the preview; a late answer for an earlier selection is dropped. | "S10/G07: Replace stays off while the target preview is delayed or failed, ignores late results, and retries". It holds the target's read on a promise the test releases, switches targets while that read is pending, and makes the read reject (`SQLITE_IOERR`). | `S10`; `G07`, `G12` |
| **Preview gate.** The lookup is strict (`loadDraftsForProfile(id, { strict: true })`), so a storage error is reported as `failed` instead of a short list. While the preview is pending or failed, Replace is disabled and refuses to run, and "Export draft backup" is not shown. A failed preview shows "Couldn't check … for open drafts" with **Try again**. | Same test. While delayed or failed: the Replace button is disabled, no confirmation opens, no file is written, and every table of both profiles still equals its baseline (`toEqual`). "Try again" then succeeds and names Alpha's draft. | `S10`; `G07`, `G12` |
| **Same target throughout.** Pressing Replace captures the previewed target (ID, label, drafts and backup token). The confirmation text and the `restoreBackup` write both use that captured target. | The late Alpha answer is ignored after switching to Bravo, and the confirmation names Bravo, not Alpha. The safety-backup test confirms the replace and checks that only Alpha's drafts are gone and Bravo's observation is kept. | `S10`; `G07` |
| **Target-scoped safety backup.** "Save safety backup first" reads the confirmation target's full data from SQLite, whether or not that profile is active (`loadProfileBackupData` → `loadProfileSnapshot(id, { lockReferences: false })`, a read that does not take the fallback-reference lock). It saves `crewsignal-backup-<targetId>.json`, with the file's `activeProfileId` set to that target. It needs explicit consent in the dialog ("Include all of …'s data (mood & private notes)"), and that consent is asked again each time the dialog opens. | "S10/G07: the safety backup holds the inactive target profile and counts only a written file". It parses the saved file: the profile is Alpha, and `observations`, `checkInEvents`, `references` and `insights` each equal Alpha's stored rows. The file contains Alpha's logged note, and neither Bravo's note nor Bravo's profile ID. | `S10`; `G07`, `ER-04` |
| **Success only on a written file.** "Safety backup saved for …" appears only after `saveTextFile` returns `saved` for that same target and backup. A cancelled save, `write_failed`, a save that throws, a failed read, and a full backup of another profile all leave "No safety backup of … yet". | Same test: missing consent (no file written), `cancelled`, `write_failed`, a rejected save, and a saved backup of the active Bravo profile. After each, the dialog still says "No safety backup of Commander Alpha yet". | `S10`; `G07` |
| **Draft recovery kept separate.** The draft recovery export is unchanged: one file per draft, with `includeNotes: false`. | Same test: the draft file is `crewsignal-draft-recovery` for Alpha's ID. It has `note: ""`, the 129 reading, and no private note or Bravo value. | `ER-04`; `V10` |

Both new tests were run against the `f92ef39` source in a separate worktree: 2 failed, and the 2 earlier S10/G07 tests passed. All four pass here. All profiles in these tests are synthetic ("Commander Alpha", "Commander Bravo").

**Scope.** This round changes mobile only: `ReportsScreen.tsx`, `CrewSignalContext.tsx`, `Modals.tsx` (an optional consent slot and a test ID for the secondary action), and `sqliteStore.ts` (an opt-out of the reference lock for read-only snapshots). No shared-core file changed. Windows and the website replace only the active profile (§6.7), so they have no inactive-target preview. Their pre-replace backup wording was not re-examined in this round.

**Rerun on the fix branch (Windows 11 host, 2026-11-13).** Shared-core sync: website, desktop and mobile each match all 37 files by SHA-256. Clean-source check: **PASS**. Shared core (Vitest): 4 files, 34 tests passed. Mobile Jest: 3 suites, **27** tests passed (25 before this round, plus the 2 new tests). Mobile `tsc --noEmit`: clean. Mobile Hermes export (`npm run export`): completed. Website: Vitest 14/14, production build OK, Playwright e2e 11/11. Desktop: `tsc` clean, Vitest 23/23, Vite build OK, Playwright e2e 6/6, `cargo test` 21 passed, 0 failed.

With these results, `S10`, `G07` and `G12` remain **PASS** on the fix branch, using the headless Jest/SQLite harness. Device checks are listed in §7.

---

### 6.9 PR #1 safety backup ordering and folder picker fixes (review of `35501de`)

The review held the merge at `35501de` with two mobile Reports findings in "Replace existing profile":

1. **P1, Replace could overtake the safety backup.** "Save safety backup first" and the confirmed Replace could run at the same time. With a slow SQLite read, a Replace confirmed during the backup was written first, so the backup file held the replacement records and the original reading was lost.
2. **P2, no folder picker.** The safety backup was written to app storage without asking for a destination, so the native folder picker (and its cancel path) was never used.

| Fix | Regression tests (`mobile/tests` › `mobile-ui.test.tsx`) | Gates / vectors |
| --- | --- | --- |
| **Backup and Replace exclude each other.** `ReportsScreen` holds a synchronous ref for each operation (`safetyBusyRef`, `replaceBusyRef`), so a second press in the same tick is refused, plus matching state for the UI. While the backup's read or file write is pending, the confirm button is disabled and the handler returns before `restoreBackup`; the dialog shows "Saving a safety backup of … Replace is paused until it finishes." (`safety-backup-progress`, polite live region). While a confirmed Replace is running, both the confirm button and "Save safety backup first" are disabled. `ConfirmDestructiveModal` gained an optional `confirmDisabled` prop. | "S10/G07: Replace waits for the safety backup read and write, and the file keeps the original records". (1) It holds `loadProfileSnapshot` on a promise the test releases; the real read runs only on release, as in the review's reproduction. While it is held, the progress text shows, confirm and save are disabled, pressing both does nothing, and both profiles' SQLite records equal their baseline. The write then returns `write_failed`: the status says "not saved … Write failed", the progress text is gone, Replace is enabled again, and "No safety backup … yet" stays. The file content built from that delayed read is parsed: `observations` and `checkInEvents` equal Alpha's stored rows, with Alpha's note and the original 121 mmHg reading. (1b) Same tick: with the read held again, the test takes the press handlers of the enabled Save and Replace buttons from the current render and runs both in one `act()`, so neither button has re-rendered as disabled and only the refs can refuse. `restoreBackupBundle` is never called and SQLite is unchanged. The save then throws: the status says "The file could not be written." and Replace is enabled again. (2) It holds `saveTextFile` the same way: Replace stays held until the write settles, and the written `crewsignal-backup-<AlphaId>.json` has `observations` and `checkInEvents` equal to Alpha's stored rows, Alpha's note and the original 121 mmHg reading. (3) It runs confirm and save in one `act()` with `restoreBackupBundle` held: the save is refused in that same tick, and while the Replace runs, more presses of confirm or save call neither again; after release, Alpha's draft is gone and Bravo's observation is kept. | `S10`; `G07`, `ER-04` |
| **Replace stays optional.** A cancelled, failed or thrown backup ends the progress state and re-enables Replace, with the outcome in `safety-backup-status`. Nothing requires a backup before Replace. | Same test, steps (1) (`write_failed`) and (1b) (a save that throws), and the picker test below (cancelled pick, then Replace still enabled). | `S10`; `G07` |
| **Native folder picker.** The safety backup now calls `saveTextFile` with `chooseDestination: true`. The default adapter then asks for a folder with `Directory.pickDirectoryAsync()` and writes `crewsignal-backup-<targetId>.json` (`application/json`) there. A cancelled pick (expo-file-system rejects with "…cancelled by the user" on Android) is reported as `cancelled`. Other saves are unchanged. | "S10/G07: the safety backup asks for a folder through the native picker, and a cancelled pick writes nothing". It renders the app with the production `defaultPlatformIo` and stubs only `Directory.pickDirectoryAsync`. Cancelled pick: status "not saved … Cancelled. Folder selection was cancelled", no file written, no "saved" message, "No safety backup … yet", the overwrite text still names the draft, the draft preview is still there, Replace is enabled, and SQLite is unchanged. Picked folder: exactly one file, `crewsignal-backup-<AlphaId>.json`, `application/json`, with profile and `activeProfileId` Alpha, observations equal to Alpha's stored rows and Alpha's note; the status says "to the selected folder". | `S10`; `G07`, `ER-04` |

Both new tests were run against the `35501de` source (source files stashed, new tests kept): 2 failed, and the 4 earlier S10/G07 tests passed. All six pass here. Two mutation checks show the refs, not the disabled props, carry the same-tick guarantee: removing both ref checks (disabled props kept) makes step (1b) fail, because `restoreBackupBundle` is called during the backup; removing only the save handler's `replaceBusyRef` check makes step (3) fail, because a fourth save starts during the Replace. All profiles in these tests are synthetic ("Commander Alpha", "Commander Bravo").

**Scope.** This round changes mobile only: `ReportsScreen.tsx` and `Modals.tsx`. No shared-core file changed, and the platform file adapter is unchanged (it already supported `chooseDestination`). Windows and the website are unchanged.

**Rerun on the fix branch (Windows 11 host, 2026-11-13).** Shared-core sync: website, desktop and mobile each match all 37 files by SHA-256. Clean-source check: **PASS**. Shared core (Vitest): 4 files, 34 tests passed. Mobile Jest: 3 suites, **29** tests passed (27 before this round, plus the 2 new tests). Mobile `tsc --noEmit`: clean. Mobile Hermes export (`npm run export`): completed. Website: Vitest 14/14, production build OK, Playwright e2e 11/11. Desktop: `tsc` clean, Vitest 23/23, Vite build OK, Playwright e2e 6/6, `cargo test` 21 passed, 0 failed.

The follow-up that tightened these tests changed only `mobile/tests/mobile-ui.test.tsx`; after it, mobile Jest was rerun (3 suites, 29/29) and mobile `tsc --noEmit` is clean.

With these results, `S10`, `G07` and `G12` remain **PASS** on the fix branch, using the headless Jest/SQLite harness with the native picker stubbed. The real picker on devices is listed in §7.

---

### 6.10 PR #1 backup and restore lifecycle: one app-level operation owner (review of `a66df87`)

**Tested implementation.** `47324b8499a7090539e09bc4584bd7f5d9f65ba8` contains the lifecycle fix, tests and build logs. The follow-up evidence update changes documentation only.

The review held the merge at `a66df87`, where all 29 mobile tests passed, with one lifecycle failure. Start "Save safety backup first" for an inactive profile with a slow SQLite read, close the confirmation, leave Reports and come back. The new Reports screen allowed Replace while the old backup was still reading, and the saved file could hold the replacement rows with the originals gone. The earlier guard (§6.9) lived in `ReportsScreen` refs, so it vanished when the screen unmounted.

**Reproduced first.** `evidence/red-a66df87-lifecycle.txt` is the run of the new lifecycle test against the `a66df87` sources: it fails because a confirmed `restoreBackupBundle` call (destination `replace_existing`, target `personal-…`) is made while the first backup read is still held.

**Root cause and fix.** The guard sat at the wrong ownership boundary. It now lives in `CrewSignalProvider` (`mobile/src/state/CrewSignalContext.tsx`), which outlives every route and modal.

| Requirement | What the code does | Tests |
| --- | --- | --- |
| **One operation owner** | The provider takes a synchronous guard before the first `await` and releases it in `finally`. `activeOperation` drives the UI. Conflicting actions return immediately. The guard covers the backup read, picker and write, the confirmed replacement and its reconciliation, Demo reset and Personal deletion. SQLite transactions end before the picker opens. Navigation stays usable. | `operation-owner.test.tsx` and UI lifecycle tests 1–3 below |
| **Preview and consent for one target** | Confirmation binds the backup identity, destination profile ID and draft signature. A pending or failed preview blocks Replace and target draft export. A changed file or draft signature requires a fresh preview. A missing destination is refused. A full safety backup requires explicit consent and reads the chosen profile in a single SQLite transaction, including when that profile is inactive. | Tests 5–6 below and identity and signature tests in `backup-binding-units.test.ts` |
| **Native picker and file outcomes** | The backup uses `Directory.pickDirectoryAsync()` and reports success after the file is written. Cancellation, permission refusal, a read failure or a write failure preserve the preview. Repeat saves try an available filename such as `name (2).ext`. A remaining collision reports a write failure. Draft recovery uses a separate file with notes excluded by default. | UI test 4 below and `uniqueFilename` tests in `backup-binding-units.test.ts` |
| **Draft retention and restore outcomes** | A successful replacement clears the selected profile's stored and in-memory drafts. Other profiles keep their drafts and records. An atomic rollback preserves the destination. A committed restore whose view fails to reload reports `refresh_failed`. | UI test 3 below and the rollback and refresh test in `operation-owner.test.tsx` |

New and changed tests (all synthetic profiles "Commander Alpha" and "Commander Bravo"):

1. `mobile-ui.test.tsx`, "S10/G07 lifecycle: a safety backup still reading when Reports is left and reopened keeps Replace refused, and the file holds the original records" (held read). Green here, red on `a66df87`.
2. `mobile-ui.test.tsx`, "S10/G07 lifecycle: a safety backup waiting on the file write survives closing the dialog and leaving Reports, and the file keeps the original records" (held write). Close the dialog, press `tab-overview`, reopen Reports and Replace: banner shown, Replace disabled (also a same-tick press that skips re-rendering), no confirmed replace, records unchanged. After release, the saved file has Alpha's ID, observations and note (systolic 121); the banner clears; the outcome is announced.
3. `mobile-ui.test.tsx`, "S10/G07 lifecycle: a replace still writing when Reports is left and reopened refuses a second Replace, a backup, a reset and a delete" (reverse order). Confirm twice and Save in one tick: one confirmed call, no save. In Settings the Personal delete is disabled and a same-tick press does nothing. Back on Reports the banner says the replace is in progress. After release, Alpha holds the sample backup's 11 observations without the old note, Bravo's records equal baseline and Bravo's drafts stay at 0.
4. `mobile-ui.test.tsx`, "S10/G07 production file adapter: cancel, refusal, write failure and collisions keep the preview and overwrite nothing; the saved file reimports as a separate profile". It uses the production `defaultPlatformIo` with only the native picker stubbed: permission refusal, ENOSPC write failure, an "already exists" collision, an existing name saved as `… (2).json`, and a reimport as "Commander Alpha (Restored)" with a new profile ID and equal observation values. The originals are unchanged.
5. [`mobile-ui.test.tsx`](mobile/tests/mobile-ui.test.tsx#L645), “S10/G07: Replace stays off while the target preview is delayed or failed, ignores late results, and retries”. The pending and failed states disable Replace and hide draft export. Changing the target ignores the late result, and a successful retry restores the preview. Both profiles' SQLite records remain intact.
6. [`operation-owner.test.tsx`](mobile/tests/operation-owner.test.tsx#L315), “a stale or missing target at confirmation writes nothing and asks for a fresh preview”. It covers confirmation without a preview, a different backup identity, changed drafts, an unknown or deleted target, and a successful replacement after a fresh preview. [`interchange-and-vectors.test.ts`](shared/tests/interchange-and-vectors.test.ts#L154) verifies that the shared planner rejects a missing target without falling back to the backup's profile ID.
7. The earlier regression cases still pass. The §6.9 delayed-read test now holds `readProfileBackupData`, the transactional snapshot used by the provider. `operation-owner.test.tsx` adds five provider-level tests for operation ordering, conflicts, preview validation, rollback versus refresh failure, and backup outcomes. `backup-binding-units.test.ts` covers backup identity, draft signatures and filename selection.

**Verification of `47324b8` on Windows 11, November 14, 2026.** Build and test logs are in [`evidence/final-run/`](evidence/final-run/). The documentation follow-up independently reran shared and mobile type checks and tests, the shared sync check, and clean-source verification on this source revision.

| Command | Result |
| --- | --- |
| Shared-core sync check | website, desktop and mobile each match 37 files by SHA-256 |
| `node scripts/verify-clean-source.mjs` | **PASS** |
| Shared core (Vitest) | 35 passed |
| Mobile `tsc --noEmit` | clean |
| Mobile Jest | 5 suites, **45** tests passed (29 before this round) |
| Mobile Hermes export | completed, Android `.hbc` |
| Website | Vitest 14/14, production build OK, Playwright e2e 11/11 |
| Desktop | `tsc` clean, Vitest 23/23, Vite build OK, Playwright e2e 6/6, `cargo test` 21 passed, 0 failed |
| `tauri build` | Built the Windows executable and per-user NSIS installer. The SHA-256 hashes and signatures were independently verified. |

The two website timing flakes seen earlier did not recur in this run.

| Windows artifact | Bytes | SHA-256 | Signature |
| --- | ---: | --- | --- |
| `crewsignal-desktop.exe` | 13,736,960 | `35FF903324320C4D0CC19E2F9CD7D25F1C1AEE6006484BDCECA20644C69F404B` | `NotSigned` |
| `CrewSignal_0.1.0_x64-setup.exe` | 4,729,901 | `0F9653389A8535CAC9C103EF45399F28B8F679F599A73883FFFE0EFD508D70FD` | `NotSigned` |

**Coverage limits.** The lifecycle tests used React Native Testing Library, an in-memory `node:sqlite` driver and a stubbed native picker. The provider guard covers one running app instance. OS backgrounding, interruption by process termination, real file providers and manual assistive-technology walkthroughs remain open in §7.

**Automated security review.** The commit and push review attempts returned HTTP 429 for this implementation and produced no verdict. The functional checks above have their own results. An explicit retry for this code revision remains open.

**Scope.** Mobile source (`CrewSignalContext.tsx`, `ReportsScreen.tsx`, `SettingsScreen.tsx`, `files.ts`, `sqliteStore.ts`, `backupIdentity.ts`) and the shared transaction core, with its synced copies in website and desktop and the website repository adapter. No unrelated cleanup is bundled.

The automated lifecycle checks for `S10`, `G07` and `G12` passed on the fix branch. Installed-device acceptance is tracked below.

---

## 7. Open Checks and Their Prerequisites

| Check | Gate | Status | Specific prerequisite |
| --- | --- | --- | --- |
| Android TalkBack walkthroughs | `G09`, `S13` | OPEN | Physical Android phone and tablet with a dev or preview build installed (needs the native builds below) |
| Windows Narrator / NVDA in the installed app | `G09`, `S13` | OPEN | NVDA (or Narrator) on a Windows machine with the NSIS-installed build; a person to run the scripted journey by ear |
| Full manual keyboard-only pass on real devices | `G09` | OPEN (automated tab and focus tests pass) | Human tester with a hardware keyboard on Windows and an Android tablet with a keyboard |
| Mobile draft retention and restore on devices (§6.6–§6.10) | `ER-04`, `S03`, `S10`, `G07`, `G12` | OPEN | Install a dev build on Android phones and tablets. Use synthetic profiles and a controllable slow or failed SQLite read/write. Check pending, failure and retry, committed drafts after switching profiles, memory-only drafts after a separate restore, and replacement of an inactive profile. |
| Mobile folder picker, repeat saves and restore | `ER-04`, `S10`, `G07`, `G12` | OPEN | On Android phones and tablets, cancel a pick and verify that no file is written and the preview stays. Exercise permission refusal and a failed write. Save twice to the same folder and verify that the earlier file survives and the new name or failure is reported. Reopen the saved file as a separate profile and verify its source identity and records. |
| Mobile navigation, backgrounding and interrupted operations | `S03`, `S10`, `G07`, `G12` | OPEN | On both installed apps, hold a backup read, picker or write and a confirmed restore in separate runs. Dismiss the dialog, leave and return to Reports, then background and foreground the app. Verify that conflicting actions remain blocked while the original operation runs. Terminate and restart during a pending backup and during a restore. Verify durable SQLite state and draft status on relaunch and check that an interrupted save never claims success. |
| Android installable build and offline restart | `G11` | OPEN | Build with the Android SDK and JDK (`ANDROID_HOME`, `adb`) or the team's EAS account and signing setup. Install the APK on a supported phone and tablet. Verify cold start and offline restart. |
| Authenticode-signed Windows `.exe` / installer | `G11` | OPEN (built `NotSigned`) | Code-signing certificate (OV/EV or Azure Trusted Signing) and `signCommand`/`certificateThumbprint` in a local, untracked Tauri config |
| Clean-VM install of the Windows installer | `G11` | OPEN | Fresh Windows 10/11 VM with no dev tools: one online (Evergreen bootstrapper) and one offline run with the `offlineInstaller` variant |
| Hosted website and signed-out device matrix | `G01`, `G09`, `G11` | OPEN | The team deploys the synthetic demo with SPA routing while keeping the repository private. Check the landing page and `/demo/*` deep links signed out in Firefox, Safari and Android Chrome, plus PWA installation and offline reload on supported browsers. |
| NASA Space Apps portal submission | `G01` | OPEN — **team owner** | Verify the live requirements, judging links, media limits and tool disclosures in the team portal. Check any public judging material signed out and record the submission receipt. |
| Explorer 3D model on installed Windows app (§10.4) | `S13`, `G09`, `G11` | OPEN | NSIS-installed build on Windows 10/11 with WebView2. Open Explorer offline, rotate, reset and select each region, then repeat from the list. Check Narrator, keyboard focus, High Contrast (forced colours) and minimise/restore. Record cold load and responsiveness on that hardware. |
| Explorer 3D model on installed Android phone and tablet (§10.4) | `S13`, `G09`, `G11` | OPEN, needs an installed APK | The APK must be prebuilt with `expo-gl`. Choose "3D model (preview)" in portrait and landscape and check that rotation coexists with page scrolling. Check TalkBack, large text, reduced motion and background/return. Record GL errors, model size and cold load. Set `ANDROID_MODEL_DEFAULT = true` only after this passes. |
| Automated security review of `47324b8` | Review coverage | NO VERDICT (HTTP 429) | Run the review explicitly against the implementation revision once the service is available. |
| Android cloud backup and storage wording ([#17](https://github.com/silentshiro-g1thub/crewsignal-spaceapps/issues/17)) | Privacy | PREBUILD VERIFIED / APK OPEN | Expo 58.0.25 prebuild generated `mobile/android/app/src/main/AndroidManifest.xml` with `android:allowBackup="false"` on `<application>`. Verify the packaged manifest when an Android SDK build is available. The copy audit covered Android, Windows and website screens. Help and the install notes describe local storage, backup and export contents. App-level encryption at rest for databases and exported files is outside the submission scope. Some Android devices may still transfer app data directly between devices. |

**Issue #17 checks.** On Windows with Node 24.22.1, the patch based on `4bb2035` passed type checks for Android, Windows and the website. The Android harness passed 54 tests, Windows passed 34 on rerun with a 20-second timeout after a restore test timed out at five seconds, and the website passed 15. The Windows restore test also passed on its own with the default timeout. The clean-source check found existing shared-file differences in the Android and Windows copies of `guidance.ts`. Both copies differ from the canonical source only in import order at `4bb2035`.

---

## 8. Challenge resource and app access audit — November 14, 2026

The audit inspected local and GitHub `main` at `076dfb3a03c8e52f39776a1b8c18739ca1447c20`. GitHub had one merged PR and zero open issues or PRs at the start. The user set the platform scope to Android phones and tablets and Windows. Findings and proposed implementation decisions are recorded in issues [#2](https://github.com/miraflowwer/spaceapps-2026-crewsignal/issues/2) through [#10](https://github.com/miraflowwer/spaceapps-2026-crewsignal/issues/10).

### 8.1 Research sources

Both official challenge URLs returned unavailable responses through the browsing tool. The audit used the user's supplied resource list, read the full brief on the [Athlone event site](https://hackathlone.com/challenges/health-monitoring-software), and directly verified the five linked NASA and CSA pages. Four exact resource records are missing from the current evidence registry. Issue #5 specifies offline summaries, context mappings, attribution and the Windows CSA link-opening change. The existing Five Hazards and Human Research Roadmap references have separate identities. An independent GPT reviewer inspected the same source and domain paths and corroborated the evidence, reference and acknowledgement findings.

### 8.2 Verification performed

| Scope | Command or action | Result |
| --- | --- | --- |
| Shared contracts | `npm run typecheck` in `shared/` | PASS |
| Shared domain tests | `npm test -- --pool=threads` in `shared/` | 4 files, 35 tests passed. The default forks pool was refused by the host sandbox with `spawn EPERM`. |
| Mobile types and harness | `npm run typecheck`, then `npm test -- --runInBand` in `mobile/` | 5 suites, 45 tests passed. Phone/tablet dimensions, Help and navigation were exercised by React Native Testing Library with the existing SQLite harness. |
| Windows types and unit harness | `npm run typecheck`, then `npm test -- --pool=threads` in `desktop/` | 7 files, 23 tests passed. |
| Windows browser harness | `npm run test:e2e -- --reporter=list` in `desktop/` | 6 tests passed after allowing the browser/server processes outside the sandbox. Includes themes, reflow, forced colours, tab keyboard controls and Help modal focus. |
| Windows release executable | Launched the existing `desktop/src-tauri/target/release/crewsignal-desktop.exe` and inspected Overview → Help → Health Explorer → Mission context → Overview using Windows automation | Visible Help opens directly. Explorer has an SVG regional map, system list and accessible selection controls. Help starts with procedure availability and cached sources. A Getting started walkthrough is specified in #7. The executable SHA-256 matches §6.10, `35FF903324320C4D0CC19E2F9CD7D25F1C1AEE6006484BDCECA20644C69F404B`. |
| Shared serialization probe | Synthetic BP row with distinct text in `note`, `qualityNote` and correction reason, through default `buildReportBundle` | `includeNotes` was false. The regular note was removed. Quality note and correction reason remained in JSON. An empty range carried 2 references and 6 citations. Issue #3 defines the report projection and preview changes. |
| Shared guidance probe | Same synthetic sleep observation after reference version change and after a cited source version change | The complete matcher refused the stale review. The observation-only path produced `reviewed`, and the insight ID stayed equal after the source-only change. Android and Windows selection/storage paths are documented in #4. |
| Android native generation | `npm run prebuild:android` | PASS. Generated native project is ignored by Git. |
| Android native compilation | Generated Gradle 9.4.1 project, JDK 26.0.1, API 37/build-tools 37, NDK 27.1.12297006, x86_64 release task | No APK produced. After installing the required SDK components, Ninja failed on an object path longer than 260 characters. A local CMake path workaround stalled and was stopped. A temporary short-path drive mapping then failed while evaluating generated Expo autolinking settings. The build log directory is the ignored `mobile/android/`. Issue #6 requires a pinned, reproducible build and usable distribution. |
| Android emulators | Isolated Android 15/API 35 Pixel 7 and Pixel Tablet AVDs | Both booted. CrewSignal installation and runtime checks remain open because compilation produced no APK. |
| Source hygiene | `node scripts/verify-clean-source.mjs` from `source/` after the build attempts | PASS, 361 tracked files scanned, 37 shared files match each of website, desktop and mobile. |

All probes and app views used synthetic fixtures. Installed Android phone/tablet, TalkBack, clean Windows installation, Narrator and new-release offline restart checks remain open. The Windows executable walkthrough and the headless/browser harnesses have the scopes listed above.

### 8.3 Issue handoff

| Issue | Finding or requested outcome | Priority |
| --- | --- | --- |
| [#2](https://github.com/miraflowwer/spaceapps-2026-crewsignal/issues/2) | Explicit complete personal reference values and measurement context | P1 |
| [#3](https://github.com/miraflowwer/spaceapps-2026-crewsignal/issues/3) | Default report redaction and accurate payload preview | P1 |
| [#4](https://github.com/miraflowwer/spaceapps-2026-crewsignal/issues/4) | Guidance acknowledgement bound to all current inputs and source versions | P1 |
| [#5](https://github.com/miraflowwer/spaceapps-2026-crewsignal/issues/5) | Released NASA/CSA resources linked to Check-in and Explorer | P2 |
| [#6](https://github.com/miraflowwer/spaceapps-2026-crewsignal/issues/6) | Android and Windows downloads, build and installation instructions | P1 for tester access |
| [#7](https://github.com/miraflowwer/spaceapps-2026-crewsignal/issues/7) | Replayable offline Getting started walkthrough | P2 |
| [#8](https://github.com/miraflowwer/spaceapps-2026-crewsignal/issues/8) | Native app repository and separate website repository with pinned shared content | P2 |
| [#9](https://github.com/miraflowwer/spaceapps-2026-crewsignal/issues/9) | Interactive 3D Explorer with accessible system selection and fallback | P3 |
| [#10](https://github.com/miraflowwer/spaceapps-2026-crewsignal/issues/10) | User-selected reading quality and recheck path | P2 |

Each issue contains implementation decisions, affected code links, acceptance checks, relevant coordination and PR verification requirements. The manual quality finding in #10 leaves S05/G04 open for that entry path despite the earlier harness result in §4. The user-facing Android/Windows release matrix and repository cutover belong to #6 and #8. The implementation and device checks in those issues remain future work.

## 9. Recording conventions and workspace organization — November 14, 2026

The user explicitly requested rewriting the two published commit messages. The rewritten history uses Conventional Commit subjects and plain-language bodies. Original author identities and author dates are retained. Rewriting replaced the original GitHub-signed commit with a new commit recorded by the local committer.

| Original commit | Rewritten commit | Verified tree ID |
| --- | --- | --- |
| `1b7777103b67e0a8c3a2a2e664ef2dd0e78fac34` | `426112fa8b733fab2cdb1be5ab9af78cf2811b77` | `2a9352453653499820d2fa3fee24b3dbf3ce4d77` |
| `076dfb3a03c8e52f39776a1b8c18739ca1447c20` | `373a265750d2e9288b07ab51c33031330c501937` | `3902a35b1d4c9b7a25bfd592f877ca3093a2f3c3` |

Each tree was compared before changing the local `main` ref. The original head is retained in the local recovery ref `refs/backup/before-recording-rewrite-20261114`. Audit findings in §8 apply to the second tree. Historical implementation revisions in the earlier evidence sections identify the revisions originally tested.

The recording update adds [CONTRIBUTING.md](CONTRIBUTING.md), bug and feature issue forms, and a PR template. Issues #2–#10 receive a type label and one priority label, consistent acceptance sections, related-work links and source permalinks to the rewritten audit baseline. Future PRs use `Closes #N` for completed issues and `Refs #N` for partial work.

Workspace documentation was organized outside the application repository. Current requirements are in `docs/planning/`, design contracts and current mockups in `docs/design/`, original style/research sources in `docs/references/`, and completed plans, old images, prompts and manifests in `docs/archive/`. The root guide and product/design documents point to those locations and the Android/Windows scope. The initial link pass was corrected before final verification.

The workspace audit verified 488 local Markdown links and all moved manifest artifact/authority paths. It verified 247 image and exact-prompt hashes and both original style-reference hashes. The organized inventory contains 194 PNGs, including 137 approved/handoff references, 54 historical studies and 3 review screenshots, plus 13 round manifests. Both GitHub issue forms parsed as valid YAML with unique field IDs. The source-only verifier passed after adding the recording templates, with all 37 shared files matching each target.

## 10. Health Explorer interactive 3D model — November 14, 2026

This section covers the 3D navigation model added to the Health Explorer on Windows (Tauri) and Android (Expo). The automated harness ran in a Linux container: Node `22.23.4`, npm `10.9.9`, Google Chrome headless with software WebGL2 (ANGLE SwiftShader), on top of `42265af`. No installed app or physical device was used, so those checks are in §10.4 and §7 and remain open.

### 10.1 What changed

- **Asset.** `shared/assets/models/crewsignal-body.glb` is a glTF 2.0 binary built by `shared/scripts/build-body-model.mjs`. It is original POP N' SEB work under Apache-2.0, with no third-party mesh, so it is safe to distribute. Its source, attribution and reproduction steps are in `shared/assets/models/MODEL-SOURCE.md`. `shared/src/bodyModelAsset.ts` embeds the same bytes, so the model always loads locally from the app bundle.
- **Mapping.** `BODY_MODEL_REGION_MAP` in `shared/src/bodyModel.ts` maps named nodes to existing `BodySystemId` values: head → `sleep_cognition`, torso → `cardiovascular`, limbs → `musculoskeletal`. The neck is shape only. `immune_context` and `nutrition_metabolism` stay whole-body context in the list, with no region, and the caption names them as whole-body context. Each GLB node repeats its mapping in `extras.bodySystemId`, and `loadMappedBodyModel` rejects any disagreement.
- **Renderer.** three.js `0.187.0` sits behind view components. On Windows it is `BodyModelView`, a lazy chunk inside `BodyExplorerVisual`. On Android it is `BodyModelGL` on `expo-gl` `~58.0.4`, the version in Expo SDK 58's `bundledNativeModules.json`, inside `BodyExplorerVisual`. Both platforms share one GLB parser, mapping, camera model and fallback policy (`resolveBodyVisualMode`). Rendering is on demand, with no auto-rotation and no network. Leaving the view, or `visibilitychange` hidden / `AppState` background, disposes the geometry, materials, renderer and context. Windows creates a new canvas for each renderer because a released context cannot be reused.
- **Selection.** The existing `selectedId` / `onSelect` semantics are unchanged. Canvas taps, labelled region buttons, the whole-body chips and the Systems list all set the same state. The selection colour always comes with a text caption that carries the shared coverage label, for example "Limbs: Musculoskeletal, Not assessed". Rotate left, Rotate right and Reset view are labelled buttons.
- **Fallback.** The SVG diagram is used automatically when WebGL2 is missing, the model fails to load, the context is lost (a retry button is offered) or reduced motion is on (the model stays one click away). A failure always takes priority over a manual choice. Windows defaults to the model. **Android keeps the diagram as the default (`ANDROID_MODEL_DEFAULT = false`) and offers "3D model (preview)" until an installed build is verified.** The Android choice also waits until the reduced-motion setting has been read, so the model never flashes up first.

### 10.2 Harness results (automated, container)

| Check | Result |
| --- | --- |
| Khronos glTF Validator `2.0.0-dev.3.10` on the GLB | 0 errors, 0 warnings, 0 infos, 0 hints. 7 meshes, 2,363 vertices, 3,996 triangles, 7 draw calls |
| Model size | 86,240 B GLB; 122,324 B embedded TS module |
| Reproducibility | `node shared/scripts/build-body-model.mjs --check`: both outputs byte-identical |
| `shared` typecheck and Vitest | PASS, 50/50 across 5 files, including 12 new tests in `body-model.test.ts` for asset hash, reproducibility, mapping guard, tamper rejection, labels, camera, gesture claim and fallback policy |
| `scripts/verify-clean-source.mjs` | PASS. 39 shared files match in website, desktop and mobile; secret scan 0 hits |
| Desktop typecheck, Vitest, `vite build` | PASS. 31/31 across 8 files, including 8 new tests (shared selection, drag vs tap, reset, hide/restore with a fresh canvas, load failure plus retry, context loss, no WebGL, reduced motion, route without WebGL). Main chunk 571.57 → 586.52 kB (gzip 155.85 → 161.42 kB). The new lazy `bodyModelScene` chunk is 649.09 kB (gzip 168.00 kB) and loads only when the model opens |
| Desktop Playwright (real three.js, Chrome with SwiftShader) | PASS, 15/15: 6 existing and 9 new in `tests/e2e/body-model.spec.ts`. The new tests canvas-select every region at 1440×900 and 900×1200 portrait, with the list, panel and next actions in agreement; check that a drag never selects; rotate a half turn and hit-test from behind; reset; select by keyboard with visible focus; run axe WCAG 2.2 AA in dark, light and forced colours (0 serious or critical); start on the diagram under reduced motion; fall back when WebGL2 is removed; fall back on `WEBGL_lose_context` and retry; free the canvas on hidden and restore it on visible |
| Desktop harness timing (software GL, not device data) | Cold load from route click to first model frame 790 ms. 30-step drag 766 ms. List select 85 ms. 2 long tasks, longest 57 ms |
| Mobile typecheck and Jest | PASS, 51/51 across 6 suites, including 6 new tests (diagram default with preview offered, shared selection, rotate/reset, background release and active restore, real three.js path failing on a fake GL context with fallback and retry, reduced-motion gating either way) |
| Android Hermes export (`expo export --platform android`) | PASS. One Android bundle; `.hbc` 3,018,909 → 4,301,296 B (+1.28 MB for three.js plus the model). Metro does not tree-shake three.js. The scene module is evaluated only when the model first opens |
| Website typecheck and Vitest | PASS, 14/14. The model asset is not in the website bundle |

### 10.3 Not run in the harness

- Windows Tauri production build (`tauri build`, NSIS). No Rust or Tauri config changed, and the CSP needs no change because three.js loads from a same-origin chunk with no `eval`.
- Android native prebuild and APK. Adding `expo-gl` means the native binary must be rebuilt; it cannot ride over the air.
- Touch scrolling coexisting with rotation, Narrator, TalkBack, Android large text, real minimise/background and real GPU drivers.

### 10.4 Device results

No installed-app or device results are recorded yet. Both rows in §7 stay OPEN until someone runs them on the target hardware and records the results here, separately from §10.2.
## 10. Needs recheck on Review (S05 / G04)

Implementation checkout `8b67a8cc959c16aa261addcd53ba8e8232147875`. The audited commit `373a265750d2e9288b07ab51c33031330c501937` and its tree were unavailable in this clone.

| Verification | Result |
| --- | --- |
| `node shared/scripts/sync-to-targets.mjs --write all` and `--check all` | **PASS**. All 37 files on each of Android/mobile, Windows/desktop and the synthetic website match the canonical shared source by SHA-256. |
| `node scripts/verify-clean-source.mjs` and `git diff --check` | **PASS**. Clean-source scan and strict target parity passed. |
| Shared regression suite | **BLOCKED**. Added draft recovery, legacy defaults, malformed input, retry, report privacy, CSV round-trip and sleep eligibility checks. `npm ci` could not provision dependencies. Registry DNS returned `ENOTFOUND`, and Vitest was unavailable. |
| Normal Android and Windows UI suites | **BLOCKED**. Added normal check-in scenarios with synthetic `350` bpm and malformed `350oops`. The Android harness covers switching profiles. Both harnesses cover a lost acknowledgement and one committed copy. Jest and Vitest were unavailable. |
| Offline reopen on Android phone, Android tablet and installed Windows app | **OPEN**. No Android tooling or connected Android device was available, and no installed CrewSignal app or Windows build toolchain was available for this check. |

To close S05/G04 for this entry path, run the harnesses and repeat the normal check-in on each installed target. Flag `350` bpm, switch profiles, close the app and reopen offline. Confirm Review retains the flag in its original profile. Save and confirm one flagged row in History, JSON, CSV and the printable report. Use `350oops` as the malformed control. Verify a flagged sleep period is absent from fallback reference samples and personalized actions, then log an independent compatible reading and confirm comparison is available.

## 11. Scheduled check-in prompts (issue #16)

| Verification | Result |
| --- | --- |
| Shared harness | 10 tests passed in the timing and conversions suite. SIM-SCHEDULE shows blood pressure overdue, an enabled schedule with no entries shows a first check-in due, and disabled or fresh schedules are excluded. |
| Windows UI harness | 6 tests passed in the draft handoff suite. SIM-SCHEDULE shows a navigation count of 1 and the Overview action opens the systolic and diastolic entry form. |
| Android UI harness | Both focused cases passed. Phone and tablet layouts show a navigation count of 1 and the Overview action opens blood pressure entry using local SQLite fixture data. |
| Android emulator | Pending installed-app verification. |
| Installed devices | Pending on Android phone, Android tablet, and Windows. |

Shared, desktop, and mobile type checks passed. The full shared suite had three unrelated failures involving CSV fixture line endings, a font license file byte count, and the expected guidance registry size.

This change covers the in-app prompt milestone. Native notifications and their install permissions remain pending.

## 12. NASA and CSA research context (issue #13)

Tested the working tree based on `4bb2035940f3c2b4a16dc112abd91208cdec7758` with the research-context changes applied.

| Verification | Result |
| --- | --- |
| `node shared/scripts/sync-to-targets.mjs --generate-artifacts`, `node shared/scripts/sync-to-targets.mjs --write all`, `node scripts/verify-clean-source.mjs`, `git diff --check` | Passed. All 43 shared files match on each target. |
| Shared Vitest suite | 75 passed. The existing font manifest check failed because the Windows checkout uses CRLF for the Geist Mono license, whose manifest expects LF bytes. The focused guidance suite passed all 20 tests, including five exact agency URLs, source IDs, all six indicators, the SIM-01 sleep and BP comparison walkthrough, report defaults and report evidence scope. |
| Desktop and mobile harnesses | Desktop Vitest passed 35 tests. The updated Explorer suite passed 9 tests, including cached card navigation and simulated browser failure. The full mobile Jest run passed 25 UI tests. The focused rerun with expanded browser-failure assertions passed and verified feedback and copying the exact CSA URL. |
| Website | Type check passed. Vitest passed 12 tests and failed 3 in the check-in, restore and raise-reading workflows. |
| Rust tests | Pending. Cargo was unavailable on this checkout. |
| Installed Windows app, Android phone and Android tablet | Pending. Verify cached summaries in airplane mode from Explorer and measurement Help, the five deliberate browser opens, and browser failure feedback with URL copy on each target. |
## 9. Native tester downloads (upstream issue #15)

Verification on November 14, 2026 used the working changes based on `4bb2035940f3c2b4a16dc112abd91208cdec7758`. The fork and upstream returned no published release assets through the public GitHub API.

| Check | Result |
| --- | --- |
| Source hygiene and shared parity | `node scripts/verify-clean-source.mjs` passed with 42 matching shared files per target after syncing the desktop and mobile guidance copies. |
| Website | TypeScript, all 15 unit tests, and the production PWA build passed. A targeted Edge smoke check passed against the built site, covering the download section, both pending states and navigation into the browser demo. The updated landing-page Playwright test passed. Four other cases failed in the full Edge run, involving Explorer interaction, offline service worker behavior and duplicate Overview text. |
| Shared core | TypeScript passed. The unit suite had 70 passes and three failures. Two assertions compare byte-exact fixtures or font licenses against this Windows checkout's CRLF files. The evidence registry assertion expects eight sources and the current registry has 17. |
| Android release | Preview profile pins the SDK 58 EAS image. Mobile TypeScript, all 54 Jest tests on a serial rerun, and the 955-module Android Hermes export passed. No team-signed APK was built or published here. Phone and tablet install, TalkBack, offline restart and upgrade checks are open. |
| Windows release | Added an x64 per-user NSIS candidate with the WebView2 offline installer override. Desktop TypeScript, 34 unit tests and the frontend build passed. The native build stopped at Cargo metadata because Cargo is unavailable on this host. No installer was published. Clean VM, runtime installation, trust prompts, offline restart and upgrade checks are open. |
| Download links | The site shows pending verification for both native platforms. Signed-out downloads and SHA-256 checks require the final published files. |

Use [the native release checklist](RELEASING.md) to record the artifact versions, hashes, signers, source commit, devices and OS builds once tested.
## Sleep guidance acknowledgement identity — 2026-11-14

Implementation/tested code commit: `1e296509b052e550d574a0b595ef2ca7d4e58a97` on local branch `fix/guidance-review-identity`. Source checkout base: `3d9d2c3297b05eceaafbf258ab90f1830df4e400`. Tests ran from the full native Windows source clone at `H:\crewsignal-desktop\guidance-review-fix`; the original checkout at `H:\spaceapps-crewsignal\crewsignal-spaceapps` is outside this session's writable roots and has not been changed by this work.

### Implemented behavior

Guidance is derived before acknowledgement lookup. Overview and Actions share the complete identity matcher: profile, observation ID, reference ID/version (or explicit null/null), rule ID/version, and the exact set of cited source IDs/summary versions. Citation order does not affect identity. Missing/empty required metadata never qualifies, and missing source versions are no longer invented as `Version 1`.

Persisted acknowledgements have a deterministic profile/revision identity. Android stores the currently presented tuple rather than the stale saved snapshot; SQLite conflict handling preserves the first reviewed time even with concurrent duplicate requests. Windows carries all tuple fields through the bridge and backup adapter, preserves historical legacy payloads, re-scopes restored acknowledgements, and uses an idempotent Rust insert. The synthetic browser uses the same matcher and keeps historical revisions under independent IndexedDB identities. Both screens use current comparisons/citations; saved review times are shown only for matching tuples. Review writes remain separate from observation writes.

### Harness results (not installed-app evidence)

Dependencies available for the website were reused locally through ignored `node_modules` junctions; these are not part of the change. The Android SQLite harness runs the actual storage adapter and Node SQLite database, with Jest test globals aliased to Vitest. Its wrapper temporarily replaces the missing Expo TypeScript preset only for transpilation and restores the exact original bytes afterward. The Windows bridge harness aliases unavailable native API imports to stubs which reject native invocation; these checks exercise the browser bridge/backend, not Tauri IPC or Rust execution.

| Command | Outcome |
| --- | --- |
| `npm run typecheck --prefix shared` | PASS (source and test TypeScript configurations). |
| `node website/node_modules/vitest/vitest.mjs run --root shared tests/guidance-review.test.ts` | PASS: 10 complete-identity vectors. Includes source order, each identity dimension, source-only revision, missing source/version, and incomplete legacy records. See `evidence/guidance-review/version-vectors.txt`. |
| `npm test --prefix shared` | 82 passed, 1 failed. The existing evidence-registry test expects 8 sources, but the unchanged registry now contains 17. The acknowledgement vectors pass. This broader suite is **not green**. See `evidence/guidance-review/shared.txt`. Initial checkout CRLF conversion also broke CSV/font-license integrity checks; restoring unchanged Git blob bytes removed those local checkout failures without a source change. |
| `node evidence/guidance-review/run-sqlite.cjs` | PASS: 15 Android SQLite/canonical-vector checks. The new regression exercises concurrent duplicate confirmation, source-only revision, closing/reopening the on-disk SQLite database, retention of old acknowledgements, separate-profile backup restore, profile isolation and unchanged observations. See `evidence/guidance-review/android-sqlite.txt`. |
| `node website/node_modules/vitest/vitest.mjs run --config evidence/guidance-review/windows.config.ts` | PASS: 4 browser bridge/backup checks, including incomplete legacy source tuple rejection, source-only invalidation, duplicate time preservation and backup profile re-scoping. See `evidence/guidance-review/windows-bridge.txt`. |
| `npm run typecheck --prefix website` | PASS. |
| `npm test --prefix website` | PASS: 16 tests. New IndexedDB regression verifies source-only confirmation, duplicate-tap identity/time, repository reload, retained historical revisions, profile isolation and no observation writes. See `evidence/guidance-review/browser.txt`. |
| `node shared/scripts/sync-to-targets.mjs --write all` | PASS after shared edits; all three target copies synchronized. |
| `node scripts/verify-clean-source.mjs` | PASS from the full native checkout. All 41 managed shared files on each target match canonical SHA-256. See `evidence/guidance-review/clean-source.txt`. |
| `git diff --check` | PASS. |

### Native harness blockers and installed-app results

| Required check | Actual result |
| --- | --- |
| `npm test --prefix mobile -- --runInBand` | BLOCKED before tests: Jest is not installed. Expo/React Native dependencies are also unavailable. Added the Android UI regression for a stale provider snapshot, source-only bump, a duplicate tap and Overview/Actions agreement; it has **not** been executed in the normal React Native harness. |
| `npm test --prefix desktop` | BLOCKED during module resolution: `@tauri-apps/api/core` / `event` are unavailable. The normal Windows UI suite has **not** passed. |
| `npm run typecheck --prefix desktop` | BLOCKED by missing Tauri API and Three.js types. Browser bridge tests used explicit harness aliases; this does not establish native typecheck success. |
| `C:\Users\Kennz Balite\.cargo\bin\cargo.exe test --offline --manifest-path desktop/src-tauri/Cargo.toml` | BLOCKED: cached crates.io index has no `chrono`. Added Rust storage regression for duplicate preservation, source revision history, profile rejection and reopen, but it has **not** executed. |
| `rustfmt --edition 2021 --check desktop/src-tauri/src/db.rs` | Parses the source but fails formatting checks (including pre-existing formatting differences); not a Rust compilation/test result. |
| Installed Windows application / Tauri IPC / installed Android phone or tablet | NOT RUN. No updated native binaries were built or installed. App close/reopen and restore are verified only in the SQLite harness, not on installed targets. |

Release acceptance remains open until native dependencies can be provisioned, the normal Android UI and Windows UI/Rust suites run, the stale evidence-count assertion is reconciled, and installed Windows/Android restart/profile/restore checks are recorded separately. No installed-app or clinical validation is claimed.


## Explicit manual personal references — 2026-11-14

Tested implementation commit: `7cc61f483ca877edefc32ffc50a48c3896c8fee5`, local branch `fix/explicit-personal-references`, based on `4e94c15a46b3653ee96ac92e360bb61f895bb0f2`. Full native source checkout: `H:\crewsignal-desktop\personal-reference-fix`. The original checkout at `H:\spaceapps-crewsignal\crewsignal-spaceapps` is outside this session's writable roots and remains unchanged.

### Behavior and compatibility

- A shared validator uses the existing strict finite-number parser, metric method/context options, canonical units and reference-value contract. Android has separately labelled systolic/diastolic mmHg fields; neither component is generated from the other. Decimal BP/scalar precision is preserved, including the original input strings in capture provenance; sleep references require the integer minutes allowed by the contract rather than rounding silently.
- Both reference editors start empty, with no selected method/context, and clear their input/review state on profile or metric changes. Display-unit changes do not reinterpret canonical reference inputs. Field-level errors precede the reference save call. Storage failures have a separate error path which retains entered values; successful saves return to an empty editor.
- Valid saves use the existing profile-scoped versioning/transaction path. The optional `manualCapture` contract field travels through Android's provider/SQLite and Windows' reference JSON/bridge. Older backups remain parseable because this field is optional; there is no bulk rewrite of historical versions.
- Legacy `user_updated` BP references without capture evidence proving both components require review before comparison. This intentionally includes unverifiable legacy records on either platform: the numeric pair, an arithmetic relationship, or a label alone is not evidence of how Android captured it. Entered-preflight and seven-day-derived references keep their existing eligibility rules.
- Legacy pairs stay visible in history with a confirmation-required label. Selecting Review previous BP values opens a labelled review flow; a separate confirmation is required before creating a replacement version. Editing any reviewed value/method/context clears that confirmation. The original remains in history, and validation/storage rejection does not supersede it. Ordinary observations, component-wise BP deltas and seven-day derivation rules are unchanged.

### Harness checks

Available website dependencies were reused through ignored local node_modules junctions. The Android storage harness uses the real store and Node SQLite driver, aliases Jest test globals to Vitest, and temporarily bypasses the missing Expo compiler preset for pure storage tests; its wrapper restores the original configuration bytes. The desktop editor harness renders the real Settings editor but mocks app context and bridge writes; unavailable native API imports are explicit rejecting stubs. These are not installed-app tests.

| Command | Outcome |
| --- | --- |
| `node website/node_modules/vitest/vitest.mjs run --root shared tests/manual-references.test.ts` | PASS: 17 focused checks. Strict/malformed numbers, missing BP component/context/method, canonical units, full precision, fractional sleep rejection, readable legacy values, explicit version replacement, component deltas and incompatible method/context. See `evidence/personal-reference/shared.txt`. |
| `npm run typecheck --prefix shared` | PASS, including the focused test types. |
| `npm test --prefix shared` | 99 passed, 1 failed. The unchanged source-registry assertion still expects 8 sources while the registry has 17. All new reference checks passed. See `evidence/personal-reference/shared-full.txt`. Local CRLF-only CSV/font-license checkout differences were restored to original Git blob bytes before the full run; no fixture/font source changes are included. |
| `node evidence/personal-reference/run-sqlite.cjs` | PASS: 7 checks (new reference persistence regression plus existing SQLite transactions). Verifies empty Personal reference history; invalid capture with no reference writes; exact 118/76 and selected method/context; actual on-disk database close/reopen; display-unit preference change; injected persistence failure and rollback; preserved input/reference values, observation independence, backup restore and profile scoping. See `evidence/personal-reference/android-sqlite.txt`. |
| `node website/node_modules/vitest/vitest.mjs run --config evidence/personal-reference/windows.config.ts` | PASS: 2 real editor/bridge-contract UI checks. Empty Personal defaults, single-component and malformed rejection with zero bridge calls, field validation, failed persistence preserving inputs, display-unit/profile changes, and explicit legacy confirmation. See `evidence/personal-reference/windows-editor.txt`. |
| `npm run typecheck --prefix website` and `npm test --prefix website` | PASS; browser suite has 16 passing tests with the additive reference contract and updated comparison guard. See `evidence/personal-reference/browser.txt`. |
| `node shared/scripts/sync-to-targets.mjs --write all` | PASS after shared edits; all three consumers carry the shared validator/schema/comparison guard. |
| `node scripts/verify-clean-source.mjs` | PASS from this native source checkout: 42/42 managed shared files match each target. See `evidence/personal-reference/clean-source.txt`. |
| `git diff --check` | PASS for the implementation changes. |

### Native harness and installed-app status

- `npm test --prefix mobile -- --runInBand`: BLOCKED before tests because Jest is not installed. Added 390px phone and 834px tablet editor UI cases (empty Personal defaults, explicit pair, malformed input/context, failed save and metric switching), but these normal React Native UI cases have not executed. The Expo/React Native dependency set is unavailable. See `evidence/personal-reference/android-ui.txt`.
- `npm test --prefix desktop`: BLOCKED during module resolution by missing Tauri API packages. The isolated Settings editor checks above passed; the full Windows suite did not run. See `evidence/personal-reference/windows-full.txt`.
- Desktop typecheck is blocked by absent Tauri/Three.js types. Android typecheck is blocked by the absent Expo base tsconfig/native packages. Neither is claimed as passing.
- Installed Windows, Android phone and Android tablet: NOT RUN. No updated native binary was built/installed; relaunch, input accessibility, and backup behavior on installed apps remain open. SQLite reopen is harness evidence only.

Acceptance is not fully verified until the native dependencies are provisioned, the normal UI suites and installed target scenarios run, and the unrelated source-count assertion is reconciled. No installed-app or clinical validation is claimed.
