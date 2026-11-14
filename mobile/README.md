# CrewSignal Mobile (`source/mobile`)

## Try CrewSignal

The Android phone and tablet APK is pending release verification. Once published, use the versioned APK link in **Try CrewSignal** on the landing page or in the release notes. The source targets Android 7.0 (API 24) or later. Confirm the minimum version and supported ABI listed with the published APK. Open the APK from Downloads and approve installation from that source if prompted. Open **CrewSignal** and explore **Overview** in the synthetic SIM-01 profile. After installing, turn on airplane mode and reopen CrewSignal to try it offline.

Packaged offline-first **CrewSignal** client for Android phones and tablets (NASA Space Apps 2026 · Team POP N' SEB), built with **Expo SDK 58**, **React Native**, **TypeScript**, and **`expo-sqlite`**.

> **Safety & scope notice**: CrewSignal is a personal physiological wellness logbook and synthetic scenario prototype (`SIM-01`). It does not diagnose, treat, cure, or prevent any medical condition.

---

## Pinned Runtime & Native Stack

Versions pinned in [package.json](package.json) (Expo SDK `58.0.25` was pinned instead of earlier SDK 54 notes because `58.0.25` is the resolved stable Expo SDK in npm with React 19 / RN 0.88 compatibility and matching `expo-sqlite@~58.0.17` modules):

| Component | Package / Asset | Pinned Version | Purpose |
| --- | --- | --- | --- |
| App framework | `expo` | `58.0.25` | Metro bundling, Hermes `.hbc` export, native config plugins |
| UI runtime | `react` / `react-native` | `19.3.0` / `0.88.1` | Cross-platform native views, `Dimensions` / `Appearance` |
| Validation | `zod` | `4.6.7` | Runtime validation of observations, drafts, backups, and CSV rows |
| Local database | `expo-sqlite` | `~58.0.17` | Device SQLite storage with WAL mode and exclusive transactions |
| SQLite build hook peer | `expo-asset` | `~58.0.21` | Required by `expo-sqlite` Expo config plugin / build hooks |
| File storage & SAF | `expo-file-system` | `~58.0.13` | `Directory.pickDirectoryAsync()` and `Paths.document` file writes |
| File picker | `expo-document-picker` | `~58.0.5` | Import CSV logs, backup bundles, and draft recovery bundles |
| Share sheet | `expo-sharing` | `~58.0.23` | Native share-sheet handoff (distinct from confirmed file save) |
| Print / PDF | `expo-print` | `~58.0.9` | Light `#ffffff` A4 monochrome HTML report printing |
| Offline fonts | `expo-font` | `~58.0.12` | Loads bundled `Inter` and `GeistMono` TTF files offline |
| Links & clipboard | `expo-linking` / `expo-clipboard` | `~58.0.17` / `~58.0.4` | External source link verification (`canOpenURL`) and URL copy |
| Vector graphics | `react-native-svg` | `15.16.0` | Interactive 2D body diagram (`BodyDiagramSvg`) and trend charts |
| 3D model | `expo-gl` / `three` | `~58.0.4` / `0.187.0` | Opt-in Explorer 3D navigation model (`components/bodyModel/`); the diagram stays the default until device verification |
| Safe areas | `react-native-safe-area-context` | `~5.11.1` | Top/bottom notches, bottom tabs, and sticky keyboard dock |
| Test harness | `jest`, `jest-expo`, `@testing-library/react-native` | `^30.0.0`, `~58.0.14`, `14.1.0` | Unit, SQLite transaction (`node:sqlite`), vector, and RNTL UI tests |

### Bundled Offline Typography

Loaded locally via `src/platform/fonts.ts` (`loadBundledFonts`) with zero CDN/network requests:

- **Inter**: `Inter-Regular.ttf`, `Inter-Medium.ttf`, `Inter-SemiBold.ttf` (`src/shared/assets/fonts/Inter-OFL-LICENSE.txt`)
- **Geist Mono**: `GeistMono-Regular.ttf`, `GeistMono-Medium.ttf`, `GeistMono-SemiBold.ttf` (`src/shared/assets/fonts/GeistMono-OFL-LICENSE.txt`)
- Manifest: `src/shared/assets/fonts/FONT-MANIFEST.json`

---

## Architecture Highlights

### Transactional SQLite Persistence (`src/storage/`)
- **`schema.ts` (`CREWSIGNAL_DB_SCHEMA_VERSION = 1`)**: WAL journal mode, foreign keys enforced, `PRIMARY KEY (profile_id, ...)` scoping across `profiles`, `observations`, `check_in_drafts`, `check_in_events`, `personal_references`, `insight_reviews`, and `import_batches`, plus `idx_observations_profile_draft` idempotence unique index on `(profile_id, source_draft_id)`.
- **`driver.ts` / `expoDriver.ts` / `nodeDriver.ts`**: Shared `SqliteDriver` interface implemented by `ExpoSqliteDriver` (`withExclusiveTransactionAsync` on Android) and `NodeSqliteDriver` (`node:sqlite` `DatabaseSync` in Jest), ensuring tests run directly against the real SQL/transaction queries in `sqliteStore.ts`.
- **Atomic operations**: Observation commit + draft closure + workflow event in one transaction, lost-acknowledgement idempotence recovery, failed commit rollback preserving draft state, 5-row CSV staged reconciliation with whole-pair Blood Pressure correction history, full profile backup export/restore (`separate_profile` default + guarded `replace_existing`; one app-level operation owner in `CrewSignalProvider` refuses any second backup, Replace, demo reset or Personal deletion until the first finishes, even after the dialog closes or Reports is left; the safety backup goes to a native-picked folder and repeat saves get a `name (2).json` filename), uncommitted `DraftRecoveryBundle` export/resume, scoped `SIM-01` demo reset, and blank pseudonymous Personal profiles.

### Native UI, Themes & Accessibility (`src/`)
- **Themes**: Linear Dark, Full Vercel Light, and System (`userInterfaceStyle: "automatic"` via `Appearance` / `useColorScheme()`), preserving active route, draft fields, and selections across theme switches (`src/theme/tokens.ts`, `ThemeProvider.tsx`).
- **Responsive Phone & Tablet Shells (`AppShell.tsx`)**:
  - **Phone (`< 600` dp width)**: Top header with persistent labelled `Help` button (`>= 48 × 48` dp), 5-item bottom tab bar (`Overview`, `Check-in`, `Explorer`, `Trends`, `More`) that collapses automatically when the software keyboard opens during `Check-in` while keeping focused inputs, units, inline errors, and `Help` accessible; 2×3 reading cards collapsing cleanly to 1 column on `< 360` dp or elevated font scale.
  - **Tablet (`>= 600` dp width)**: Persistent labelled navigation rail (`>= 88` dp min width, intrinsic labels without clipping), 3×2 reading cards, and split-friendly views.
- **Core Workflows & Recovery**:
  - **Check-in (`CheckInScreen.tsx`)**: `Record -> Review -> Saved` across all 6 metrics (Heart Rate, Blood Pressure paired entry, Blood Glucose with unit-change Cancel/Convert/Clear modal, Body Temperature, Sleep duration / window + `"Reported no sleep"` `0h 0m`, and Mood ordinal 1–5 + custom prompt), measurement procedure Help modal, `Skip` / `Unavailable` workflow logging without fake observations, and `ER-01`–`ER-04` error recovery.
  - **Explorer & Trends**: Interactive `react-native-svg` 2D body diagram (`BodyDiagramSvg.tsx`), plus an opt-in "3D model (preview)" (`BodyExplorerVisual.tsx` → `bodyModel/BodyModelGL.tsx`, Expo GL + three.js, same shared GLB and mapping as Windows), synchronized with an accessible system list (`Musculoskeletal` unassessed, `Immune context` context-only), plus 7/30-day SVG trend plots (`SleepChartSvg.tsx`) and data-table toggle.
  - **Actions, Sources & Reports**: Offline cached summaries, safe external `Linking` verification + clipboard fallback, `ReportsScreen.tsx` live observation counts, distinct native file save (`File saved`), share sheet (`Share sheet opened`), and light `#ffffff` A4 print (`expo-print`).
  - **Accessibility**: `>= 48 × 48` dp touch targets, `accessibilityRole`, `accessibilityLabel`, `accessibilityState`, polite `accessibilityLiveRegion` status announcements, font scaling, and `AccessibilityInfo.isReduceMotionEnabled` support.

### Target Isolation (`src/shared/`)
All shared contracts, metric conversions, references, guidance rules, fixtures, and fonts are vendored inside `source/mobile/src/shared/` via `source/shared/scripts/sync-to-targets.mjs` with zero runtime imports outside `source/mobile/`.

---

## Commands

Run all commands from `source/mobile/`:

```bash
# Install dependencies (Node 24+ recommended for node:sqlite test driver)
npm ci

# TypeScript strict check
npm run typecheck

# Run SQLite transaction, canonical-vector, and RNTL mobile UI suites
npm test

# Export production Android Hermes JS bundle + font assets to ./dist
npm run export

# Local native Android builds (requires native SDK prerequisites below)
npm run prebuild:android
npm run android
```

Verify shared-bundle parity from the `source/` workspace root:

```bash
node shared/scripts/sync-to-targets.mjs --check mobile
```

[eas.json](eas.json) defines Android APK build profiles for `development`, `preview`, and `production`. [app.json](app.json) defines the `crewsignal` scheme, Android package `org.spaceapps.popnseb.crewsignal`, and `userInterfaceStyle: "automatic"`.

---

## Build a signed Android release

From a clean checkout of the release commit, run `npm ci` in `mobile/`. Use the team-owned EAS project and its existing Android signing credential for `org.spaceapps.popnseb.crewsignal`. If the checkout is unlinked, have the team link it to its project before building. Preserve the package ID and certificate across upgrades. Increase the local Android `versionCode` for an upgrade and record the verified EAS CLI version and build image from the build log. Keep credentials outside Git.

```sh
eas build --profile preview --platform android
```

The `preview` profile builds a standalone signed APK with bundled JavaScript and assets. It pins Node `22.23.2` and Expo's SDK 58 Android worker with Java 17 and NDK `27.1.12297006`. Verify the build log and the APK's certificate, minimum API and ABIs before sharing it. Test the supplied APK on both a phone and a tablet. See the [Expo build images](https://docs.expo.dev/build-reference/infrastructure/#android-server-images), [internal distribution guide](https://docs.expo.dev/build/internal-distribution/) and [native release checklist](../RELEASING.md).

For local native reproduction on Windows, clone directly into a short path such as `C:\cs` and keep the Android SDK in a short path such as `C:\sdk`. Set `ANDROID_HOME` and `JAVA_HOME` and install SDK Platform 37 and Build Tools `37.0.0` plus NDK `27.1.12297006`. Use the locked Expo `58.0.25` / React Native `0.88.1` dependencies, run `npm run prebuild:android` and use the generated Gradle `9.4.1` wrapper. JDK `26.0.1` reached native compilation in the prior audit. That build hit Windows path limits before producing an APK. Check the exact generated SDK, build-tools and NDK settings before building and record the successful combination when it is verified.

From the generated `mobile/android/` directory, run `./gradlew :app:assembleRelease` on Unix or `gradlew.bat :app:assembleRelease` on Windows for a local build check. Use the EAS APK for tester distribution. Local builds can use a debug certificate or an emulator-only ABI, so confirm both before using a local package in an upgrade test.
The following toolchain status was observed during verification on the Windows 11 host:
- **Available and verified**: `node v24.18.0`, `npm 11.16.0`, JDK `26.0.1`, TypeScript, Jest, and Android Hermes export.
- **Unavailable on the verification host**: Android SDK (`ANDROID_HOME` unset, `adb` / `sdkmanager` / `gradle` absent) and EAS CLI.
- Build and run locally with `npm run android` in an Android SDK environment. To generate a preview APK with EAS, run `eas build --profile preview --platform android`. Install the APK on Android phones and tablets to test TalkBack and native print preview.

## Where your data lives

CrewSignal stores readings and drafts in `files/SQLite/crewsignal_v1.db` within the app's private storage. The native build opts out of Android cloud backup with `android.allowBackup: false` in `app.json`. After prebuild, confirm the `<application>` in `android/app/src/main/AndroidManifest.xml` has `android:allowBackup="false"`.

A fresh reinstall starts without your previous Personal records unless you restore a profile backup in Reports. Some Android devices can still transfer app data directly between devices. Before uninstalling or moving devices, save a full profile backup from Reports and copy it outside the app. That backup includes the selected profile's readings, mood and notes. Report exports contain selected readings and exclude mood and notes by default. CrewSignal does not encrypt the database or exported files.

[Android Auto Backup documentation](https://developer.android.com/identity/data/autobackup#EnablingAutoBackup)
