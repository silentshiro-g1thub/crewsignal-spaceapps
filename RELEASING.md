# Native release checklist

## Try CrewSignal

Use this section at the top of the release notes. Replace every placeholder with verified details from the exact files tested.

| Target | Download | Install and open |
| --- | --- | --- |
| Android phones and tablets | `[APK filename and version](approved versioned HTTPS URL)` · Android minimum version and supported ABIs | Open the APK from Downloads and follow the installation prompts. Open **CrewSignal** and try **Overview** in the SIM-01 synthetic profile. |
| Windows 10 or 11 x64 | `[setup.exe filename and version](approved versioned HTTPS URL)` · Publisher or unsigned status | Run setup under your Windows account and follow the prompts. Open **CrewSignal** from Start and try **Overview** in the SIM-01 synthetic profile. |

State whether first install was verified offline and whether CrewSignal was verified to reopen offline after installation for each target. Link the landing page’s **Browser demo** as a separate optional way to try CrewSignal.

## Build and identify the files

1. Record the full commit ID from `git rev-parse HEAD` and build both installers from a clean checkout of that revision. Use the [signed EAS preview APK procedure](mobile/README.md#build-a-signed-android-release) and the [Windows NSIS release build](desktop/README.md#build-the-windows-release-candidate).
2. Run the applicable [root README checks](README.md#quick-start-clean-source-checkout) and `node scripts/verify-clean-source.mjs`. The Windows PR workflow builds an unsigned candidate and runs the desktop type, JavaScript and Rust checks. Use the team build and signing process for the distributed files.
3. Record SHA-256 after any signing or renaming. Use `Get-FileHash -Algorithm SHA256 <file>` or `sha256sum <file>`. Record Windows signing with `Get-AuthenticodeSignature <setup.exe>`. For Android, run `apksigner verify --verbose --print-certs <file.apk>` and `aapt dump badging <file.apk>` from the Android SDK Build Tools to record the certificate fingerprint, version name and code, minimum API and native ABIs.

## Verify install and upgrade

Use the exact files proposed for download. Record each result in [EVIDENCE.md](EVIDENCE.md) with the OS build or device model, Android version and ABI where applicable, artifact version and SHA-256, commit ID, and signer or unsigned status.

- **Windows first install** · On clean Windows 10 and 11 x64 VM snapshots, run setup as an intended tester and record the trust and elevation prompts. For the bundled runtime test, use a disconnected snapshot that starts without WebView2, verify installation and launch, and record the runtime result. Open **Overview**, close CrewSignal, and reopen offline.
- **Android first install** · Install the distributed APK from Downloads on a supported phone and tablet and record trust prompts. Try **Overview**, close CrewSignal, switch to airplane mode, and reopen. Verify TalkBack can reach Overview and Help. If using a matching emulator for an ABI check, record it separately from physical-device testing and from any locally built x86_64 APK.
- **Upgrade** · Start from the previous team-distributed build of each app. Save a synthetic observation and retain one unfinished draft. Install the candidate over the previous build and confirm the observation and draft survive. On Android, confirm the same package and signing certificate and a higher version code. Record the previous version and hash too. For a first release with no previous distributed build, document that baseline and verify upgrade from a team-signed earlier test build before claiming it works.

## Publish and link

Upload the verified files to a team-approved host with stable versioned HTTPS links. Use public release assets only when the team approves public distribution. If using a private release, provide an approved signed-out download path for judging. Use synthetic data for verification and exclude local user data, signing credentials and private repository details from public downloads.

Check both direct links from a fresh signed-out browser session. Download each file and confirm its filename and hash. Put the same URLs in the release notes, the root and platform README download instructions, and [the site's native release configuration](website/src/config/native-releases.json). Enter each verified platform as an object with `url`, `version`, `fileName` and `requirements` strings. Keep the platform entry `null` while verification or publishing is pending. After deployment, repeat the signed-out test from the landing page and open the browser demo link.
