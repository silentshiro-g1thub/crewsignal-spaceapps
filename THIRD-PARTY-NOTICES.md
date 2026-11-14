# Third-Party Notices

CrewSignal source code is licensed under the **Apache License, Version 2.0** (see [`LICENSE`](./LICENSE)).
Bundled fonts, third-party npm packages, and native runtime dependencies remain under their respective licenses as documented below.

---

## 1. Bundled Fonts (`shared/assets/fonts/`)

The canonical font manifest with exact SHA-256 checksums is stored in `shared/assets/fonts/FONT-MANIFEST.json`. Both font families are copied into each platform bundle during `sync-to-targets.mjs`.

### 1.1 Inter (v4.1)

- **Upstream:** https://github.com/rsms/inter/releases/tag/v4.1
- **Bundled Files:** `InterVariable.woff2`, `InterVariable.ttf`, `Inter-Regular.ttf`, `Inter-Medium.ttf`, `Inter-SemiBold.ttf`, `Inter-OFL-LICENSE.txt`
- **License:** SIL Open Font License 1.1 (OFL-1.1)

```text
Copyright (c) 2016 The Inter Project Authors (https://github.com/rsms/inter)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION AND CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be included
either as stand-alone text files, human-readable headers or in the
appropriate machine-readable metadata fields within text or binary files
as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

### 1.2 Geist Mono (v1.9.2)

- **Upstream:** https://www.npmjs.com/package/geist (via `geist@1.9.2`)
- **Bundled Files:** `GeistMono-Variable.woff2`, `GeistMono-Variable.ttf`, `GeistMono-Regular.ttf`, `GeistMono-Medium.ttf`, `GeistMono-SemiBold.ttf`, `GeistMono-OFL-LICENSE.txt`
- **License:** SIL Open Font License 1.1 (OFL-1.1)

```text
Copyright (c) 2023 Vercel, in collaboration with basement.studio

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION AND CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be included
either as stand-alone text files, human-readable headers or in the
appropriate machine-readable metadata fields within text or binary files
as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

---

## 1A. Bundled 3D Model (`shared/assets/models/`)

- `crewsignal-body.glb` and its base64 copy `shared/src/bodyModelAsset.ts` are CrewSignal's own work. POP N' SEB built them procedurally with `shared/scripts/build-body-model.mjs`, under the project's Apache License 2.0. They contain no third-party mesh, scan or texture. Provenance, reproduction steps and the region mapping are in `shared/assets/models/MODEL-SOURCE.md`.

---

## 2. Shared Core Dependencies (`source/shared/`)

Inspected from `shared/package.json` and `shared/package-lock.json`:

### Runtime Dependencies

| Package | Version | License | Scope |
| --- | --- | --- | --- |
| `zod` | `4.6.7` | MIT | Schema validation (`@crewsignal/shared`) |

### Direct Development & Test Dependencies

| Package | Version | License | Scope |
| --- | --- | --- | --- |
| `typescript` | `7.0.2` | Apache-2.0 | Strict TypeScript typechecking |
| `vitest` | `5.1.0` | MIT | Shared unit & acceptance-vector suite |
| `@types/node` | `26.6.6` | MIT | Test runner Node typings (`tsconfig.tests.json` only) |

Note: `shared/package-lock.json` additionally installs transitive dev/test tooling dependencies (`vite@8.3.8` MIT, `rolldown@1.2.19` MIT, `postcss@8.5.32` MIT, `chai@6.3.0` MIT, `lightningcss@1.33.0` MPL-2.0, `tslib@2.9.1` 0BSD, `picocolors@1.1.1` ISC, `source-map-js@1.2.2` BSD-3-Clause, and platform compiler/bundler bindings under Apache-2.0 / MIT / MPL-2.0). None of these dev tools are shipped inside `shared/src/`.

---

## 4. Desktop Dependencies (`source/desktop/`)

Inspected from `desktop/package-lock.json` (`176` locked npm packages) and `desktop/src-tauri/Cargo.lock` (`257` locked Windows MSVC Rust crates via `cargo metadata --offline --filter-platform x86_64-pc-windows-msvc`).

### 4.1 Frontend / npm Packages (`source/desktop/package-lock.json`)

| Package | Version | License | Scope |
| --- | --- | --- | --- |
| `@tauri-apps/api` | `2.12.4` | Apache-2.0 OR MIT | Tauri IPC client API (runtime) |
| `@tauri-apps/plugin-dialog` | `2.8.4` | MIT OR Apache-2.0 | Native file save/open dialogs (runtime) |
| `@tauri-apps/plugin-opener` | `2.7.3` | MIT OR Apache-2.0 | Allowlisted external URL opener (runtime) |
| `lucide-react` | `1.72.0` | ISC | UI icons (runtime) |
| `react` | `19.3.1` | MIT | UI runtime |
| `react-dom` | `19.3.1` | MIT | WebView DOM renderer (runtime) |
| `three` | `0.187.0` | MIT (Copyright © 2010-2026 three.js authors) | WebGL renderer for the Health Explorer 3D navigation model, loaded on demand (runtime) |
| `zod` | `4.6.7` | MIT | Shared schema validation (runtime) |
| `@axe-core/playwright` | `4.14.0` | MPL-2.0 | Accessibility tests (dev) |
| `@playwright/test` | `1.65.0` | Apache-2.0 | Desktop UI E2E suite (dev) |
| `@tauri-apps/cli` | `2.12.4` | Apache-2.0 OR MIT | Tauri build CLI (dev) |
| `@testing-library/jest-dom` | `7.0.1` | MIT | DOM matchers (dev) |
| `@testing-library/react` | `16.3.3` | MIT | Component tests (dev) |
| `@types/react` / `@types/react-dom` | `19.3.0` | MIT | TypeScript definitions (dev) |
| `@types/three` | `0.187.0` | MIT | three.js TypeScript definitions (dev) |
| `@vitejs/plugin-react` | `6.3.0` | MIT | Vite React plugin (dev) |
| `jsdom` | `31.0.0` | MIT | DOM test environment (dev) |
| `typescript` | `7.0.2` | Apache-2.0 | Typechecking (dev) |
| `vite` | `8.3.8` | MIT | Frontend bundler (dev) |
| `vitest` | `5.1.0` | MIT | Unit test runner (dev) |

Transitive lockfile license breakdown across all `176` locked entries in `desktop/package-lock.json`: `MIT` (`109`), `Apache-2.0` (`29`), `MPL-2.0` (`14`), `Apache-2.0 OR MIT` (`13`), `ISC` (`3`), `BSD-2-Clause` (`2`), `MIT OR Apache-2.0` (`2`), `BSD-3-Clause` (`2`), `BlueOak-1.0.0` (`1`), `0BSD` (`1`).

### 4.2 Rust / Cargo Crates (`source/desktop/src-tauri/Cargo.lock`)

Direct and core crates for `crewsignal-desktop` (`x86_64-pc-windows-msvc`):

| Crate | Version | License | Scope |
| --- | --- | --- | --- |
| `tauri` | `2.12.5` | Apache-2.0 OR MIT | Desktop application shell & IPC |
| `tauri-build` | `2.7.4` | Apache-2.0 OR MIT | Tauri resource/build script (build) |
| `tauri-plugin-dialog` | `2.8.4` | Apache-2.0 OR MIT | Native Windows file dialogs |
| `tauri-plugin-opener` | `2.7.3` | Apache-2.0 OR MIT | Allowlisted external browser opener |
| `rusqlite` | `0.32.1` | MIT | SQLite connection & `BEGIN IMMEDIATE` txns (`bundled`) |
| `libsqlite3-sys` | `0.30.1` | MIT (SQLite C source: Public Domain) | Bundled SQLite3 C amalgamation |
| `serde` | `1.0.229` | MIT OR Apache-2.0 | Serialization framework |
| `serde_json` | `1.0.154` | MIT OR Apache-2.0 | JSON IPC/export parser & serializer |
| `thiserror` | `2.0.21` | MIT OR Apache-2.0 | Typed error enums |
| `chrono` | `0.4.45` | MIT OR Apache-2.0 | UTC timestamps |
| `uuid` | `1.29.2` | Apache-2.0 OR MIT | Identifier generation |
| `webview2-com` | `0.39.1` | MIT | Windows WebView2 COM bindings |
| `windows` | `0.62.2` | MIT OR Apache-2.0 | Windows API bindings |
| `tempfile` | `3.27.0` | MIT OR Apache-2.0 | Isolated temporary DB test fixtures (dev) |

Transitive Cargo crate license breakdown across all `257` `x86_64-pc-windows-msvc` dependencies: `MIT OR Apache-2.0` (`122`), `MIT` (`48`), `Apache-2.0 OR MIT` (`29`), `Unicode-3.0` (`18`), `Unlicense OR MIT` (`8`), `MIT/Apache-2.0` (`7`), `MPL-2.0` (`5`), `Zlib` (`2`), `BSD-3-Clause` (`2`), `MIT OR Zlib OR Apache-2.0` (`2`), `MIT OR Apache-2.0 OR Zlib` (`2`), `Unlicense/MIT` (`2`), plus single-crate entries under `Apache-2.0`, `0BSD OR MIT OR Apache-2.0`, `BSD-2-Clause OR Apache-2.0 OR MIT`, `CC0-1.0 OR MIT-0 OR Apache-2.0`, `(MIT OR Apache-2.0) AND Unicode-3.0`, `BSD-3-Clause AND MIT`, `BSD-3-Clause/MIT`, `Apache-2.0 AND MIT`, `Apache-2.0 / MIT`, and `Zlib OR Apache-2.0 OR MIT`.

- **System / Installer Runtime:** Uses Windows **Microsoft Edge WebView2 Runtime** (Evergreen bootstrapper default in `tauri.conf.json`; optional Microsoft `MicrosoftEdgeWebView2RuntimeInstallerX64.exe` offline redistributable documented in `desktop/README.md`, subject to Microsoft Edge WebView2 redistributable terms if bundled).

---

## 5. Mobile Dependencies (`source/mobile/`)

Inspected from `mobile/package.json` and `mobile/package-lock.json` (`1,075` locked npm entries total; Expo SDK `58.0.25`):

### 5.1 JavaScript / Expo / React Native Packages (`source/mobile/package-lock.json`)

| Package | Version | License | Scope |
| --- | --- | --- | --- |
| `expo` | `58.0.25` | MIT | App framework, Metro bundling & Hermes `.hbc` export (runtime) |
| `expo-asset` | `58.0.21` | MIT | SQLite Expo plugin / asset resolution peer (runtime) |
| `expo-clipboard` | `58.0.4` | MIT | Clipboard copy fallback for external URLs (runtime) |
| `expo-constants` | `58.0.16` | MIT | App manifest/constants access (runtime) |
| `expo-document-picker` | `58.0.5` | MIT | Import CSV, backup, and draft-recovery files (runtime) |
| `expo-file-system` | `58.0.13` | MIT | Document/SAF local file export writes (runtime) |
| `expo-gl` | `58.0.4` | MIT | Native OpenGL ES context for the Health Explorer 3D navigation model (runtime) |
| `expo-font` | `58.0.12` | MIT | Offline Inter & Geist Mono TTF loading (runtime) |
| `expo-linking` | `58.0.17` | MIT | External source URL verification & opening (runtime) |
| `expo-print` | `58.0.9` | MIT | Light `#ffffff` A4 monochrome HTML report printing (runtime) |
| `expo-sharing` | `58.0.23` | MIT | Native share sheet handoff (runtime) |
| `expo-sqlite` | `58.0.17` | MIT | WAL SQLite storage with exclusive transactions (runtime) |
| `expo-status-bar` | `58.0.5` | MIT | Native status bar integration (runtime) |
| `react` | `19.3.0` | MIT | UI runtime |
| `react-native` | `0.88.1` | MIT | Native mobile runtime |
| `react-native-safe-area-context` | `5.11.1` | MIT | Safe-area & notch inset handling (runtime) |
| `react-native-svg` | `15.16.0` | MIT | Interactive 2D body diagram & trend charts (runtime) |
| `three` | `0.187.0` | MIT (Copyright © 2010-2026 three.js authors) | 3D navigation model renderer on Expo GL (runtime) |
| `zod` | `4.6.7` | MIT | Shared schema validation (runtime) |
| `@testing-library/react-native` | `14.1.0` | MIT | RNTL UI & accessibility tests (dev) |
| `@types/jest` | `30.0.0` | MIT | Jest TypeScript typings (dev) |
| `@types/react` | `19.3.0` | MIT | React TypeScript typings (dev) |
| `@types/three` | `0.187.0` | MIT | three.js TypeScript typings (dev) |
| `babel-preset-expo` | `58.0.25` | MIT | Expo Babel transform preset (dev) |
| `jest` | `30.5.2` | MIT | Unit & SQLite transaction test runner (dev) |
| `jest-expo` | `58.0.14` | MIT | Expo Jest preset (dev) |
| `test-renderer` | `1.3.1` | MIT | React test renderer (dev) |
| `typescript` | `6.0.3` | Apache-2.0 | Typechecking (dev) |

Transitive lockfile license breakdown across all `1,075` locked entries in `mobile/package-lock.json`: `MIT` (`885`), `ISC` (`97`), `BSD-3-Clause` (`33`), `BlueOak-1.0.0` (`16`), `BSD-2-Clause` (`12`), `MPL-2.0` (`12`), `Apache-2.0` (`9`), `Unlicense` (`2`), `(MIT OR CC0-1.0)` (`2`), `MIT-0` (`1`), `Python-2.0` (`1`), `CC-BY-4.0` (`1`), `(MIT OR Apache-2.0)` (`1`), `0BSD` (`1`), `CC0-1.0` (`1`), `(BSD-3-Clause OR GPL-2.0)` (`1`).

### 5.2 Native Android Modules

- Native Android prebuild and APK compilation were pending on the Windows verification host, which lacked the Android SDK, Gradle, and EAS CLI.
- Generate Android Gradle/AAR third-party license notices before distributing APKs. Include the notices alongside the APKs and keep signing keys and `.keystore` / `.jks` files outside the repository.
