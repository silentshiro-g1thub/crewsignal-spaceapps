# Silentshiro-only repository split — Refs #8

Native: silentshiro-g1thub/crewsignal-spaceapps. Site: silentshiro-g1thub/crewsignal-site. The site is seeded from native 07e592aa9039aef2a2e597e0bc8e1f0e8b44ac18, preserving all current website fixes including the 3D Explorer. This work makes no changes to any other GitHub repository.

The website removal is a draft cutover change. Keep it unmerged until the new repository/bootstrap and deployment are reviewed, native platform checks pass, hosting audience and release URLs are approved, and existing / and /demo/* links work signed out. Do not change existing hosting during source preparation. Preserve the previous deploy for rollback; if needed revert the ordinary cutover commit without rewriting history.

shared/ stays native's only editable domain source. Export exact Git revisions to an external site checkout with scripts/export-site-shared.mjs. The site checks its own content manifest and needs no native credentials. Review snapshot updates in ordinary site PRs. Preserve the existing paths, service-worker scope, storage identities and planned installer copy; supply release URLs only when approved through #6. Website source is not a proposed judging artifact.

The team owner still confirms portal requirements, intended judging/download links and their signed-out accessibility. Hosting/provider/domain details have not been supplied; no deployment or judge-access check is claimed.
