# CrewSignal native applications

Windows and Android source, shared contracts, fixtures and tokens. The repository
URL and native Git history are retained: silentshiro-g1thub/crewsignal-spaceapps.
Android phone/tablet and Windows remain together. Repository and hosting visibility are managed independently.

The landing page and synthetic demo are prepared for a separate repository,
`silentshiro-g1thub/crewsignal-site`. Do not merge the website removal until the
site bootstrap, hosting/access decisions and legacy URL checks are accepted.
See [CUTOVER.md](CUTOVER.md). Existing evidence remains historical evidence at its
recorded commits; site verification is recorded separately in the split entry.

## Try CrewSignal

The browser demo is available from the landing page. Open **Browser demo** to try the synthetic SIM-01 profile. Native downloads are pending release verification.

| Target | Install and try the demo |
| --- | --- |
| Android phones and tablets | When published, download the versioned APK from **Try CrewSignal** on the landing page or the release notes. Open it from Downloads, approve installation from that source if Android asks, and open **CrewSignal**. Explore **Overview** with the synthetic SIM-01 profile. |
| Windows 10 or 11, x64 | When published, download the versioned `CrewSignal_<version>_x64-setup.exe`. Run it under your Windows account, follow the setup prompts, then open **CrewSignal** from Start and explore **Overview** with the synthetic SIM-01 profile. |

The [native release checklist](RELEASING.md) covers download availability, signing and offline installation. The [Android](mobile/README.md#try-crewsignal) and [Windows](desktop/README.md#try-crewsignal) READMEs have platform-specific steps.

Use [CONTRIBUTING.md](CONTRIBUTING.md) for issue records, Conventional Commits and pull request verification.


| Directory | Purpose |
| --- | --- |
| shared/ | Only editable source for shared contracts, fixtures, tokens and fonts |
| desktop/ | Windows Tauri application |
| mobile/ | Android Expo / React Native application |
| scripts/ | Native clean-source checks and pinned site export |

Native CI checks shared code, parity, Android and Windows; its website job moves to the standalone site. The incoming CI uses Node 24.18.0 and Rust 1.96.0.

Run from this checkout with Node 22+:

```sh
cd shared
npm ci
npm run typecheck
npm test
cd ../desktop
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run tauri:build -- --target x86_64-pc-windows-msvc --config src-tauri/tauri.offline.conf.json -- --locked
cd ../mobile
npm ci
npm run typecheck
npm test -- --runInBand
npm run export
cd ..
node shared/scripts/sync-to-targets.mjs --write all
node shared/scripts/sync-to-targets.mjs --check all
node scripts/verify-clean-source.mjs
```

`all` now means desktop and mobile. The custom `--target-dir` option remains
available. Native Windows builds also require Rust/MSVC, Windows SDK and WebView2;
run `cargo test` from desktop/src-tauri. Installed Android builds need Android
SDK/JDK or approved EAS infrastructure. See platform READMEs for prerequisites.

## Where your data lives

- **Android.** Readings and drafts are stored in SQLite in the app's private storage. CrewSignal opts out of Android cloud backup. A fresh reinstall starts without your previous Personal records unless you restore a saved profile backup. Some Android devices can still transfer app data directly between devices. Save a backup from Reports and copy it outside the app before uninstalling or moving devices.
- **Windows.** Readings and drafts are stored in `%APPDATA%\org.popnseb.crewsignal\crewsignal.db`. CrewSignal has no cloud sync. Use Reports to save and restore profile backups.
- **Files and encryption.** A full profile backup contains the selected profile's records, including mood and notes. Report exports contain selected readings and exclude mood and notes by default. CrewSignal does not encrypt stored records or exported files.


Export a reviewed shared revision into a separate site checkout:

```sh
node scripts/export-site-shared.mjs --commit FULL_SHA --site ABSOLUTE_SITE_ROOT
node scripts/export-site-shared.mjs --commit FULL_SHA --site ABSOLUTE_SITE_ROOT --check
```

Export reads committed Git objects rather than uncommitted workspace files. The
site receives a manifest and vendored files, requires no native credentials, and
updates through its own reviewed PR. The site path must be outside this checkout.

License, credits, notices and [contribution guidance](CONTRIBUTING.md) still apply.
Challenge portal requirements, app materials and unauthenticated judge access
must be checked by the team owner. Native release download URLs are separate
from both repository and hosting visibility. Refs #8; coordinate releases with #6.
