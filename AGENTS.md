# Project update policy

- This repository is the only development source. Run all tools relative to its root; do not copy from sibling outputs/integrations directories.
- The user requires every completed update to have descriptive Git commits and a GitHub push. Preserve history and never force-push.
- Update CHANGELOG.md with behavior, methodology and validation changes. Keep formatting-only changes separate when practical.
- scripts/Sync-and-push.ps1 validates origin, runs checks, audits credentials, commits and pushes this checkout. It no longer copies external source files. Use -SkipTests only after the same changes have already passed relevant checks.
- GitHub CI tests demo, pending, real and mode transitions without NASA credentials. Install dependencies and browser before local tests; see README.
- Sites publication is separate from GitHub. Use the Sites skill and native publishing workflow; supply the verified checkout content as a one-way publication input. Never develop in the publication checkout or copy its old files back here.
- Never commit credentials, .secrets, .env, .venv, raw raster downloads or runtime caches. Preserve source boundary bytes and hashes; normalize labels using the explicit registry.
- If authentication or publication fails, retain the local commit and report which destination is incomplete. Do not claim a push or deployment succeeded without evidence.
