# CrewSignal native applications

Windows and Android source, shared contracts, fixtures and tokens. The repository
URL and native Git history are retained: silentshiro-g1thub/crewsignal-spaceapps.
Android phone/tablet and Windows remain together. Repository and hosting visibility are managed independently.

The landing page and synthetic demo are prepared for a separate repository,
`silentshiro-g1thub/crewsignal-site`. Do not merge the website removal until the
site bootstrap, hosting/access decisions and legacy URL checks are accepted.
See [CUTOVER.md](CUTOVER.md). Existing evidence remains historical evidence at its
recorded commits; site verification is recorded separately in the split entry.

| Directory | Purpose |
| --- | --- |
| shared/ | Only editable source for shared contracts, fixtures, tokens and fonts |
| desktop/ | Windows Tauri application |
| mobile/ | Android Expo / React Native application |
| scripts/ | Native clean-source checks and pinned site export |

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
