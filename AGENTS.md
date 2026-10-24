# Project update policy

User explicitly requests that EVERY project update be recorded and pushed to their GitHub repository.

- Preserve existing history. Use descriptive commits and push after each completed, verified update. Never force-push.
- The Sites editing checkout is `../outputs/forest-cover-demo`; the active data pipeline is `../integrations/appeears` relative to this repository. This repository archives both.
- After changes in those locations, run `scripts/Sync-and-push.ps1 -Message "具体说明此次更新"` from this repository. It copies an allowlist, audits credentials, commits and pushes.
- Keep this README and CHANGELOG accurate. Record material behavior/data/method changes and validation.
- Never upload credentials, encrypted tokens, browser profiles, virtual environments, raw downloads or local runtime directories. Published statistics are allowed, with their definitions and provenance.
- Sites publication and GitHub pushes are separate operations. Verify each required destination and report failures accurately. Do not claim synchronization if push failed.
- If GitHub authentication expires, prepare the change locally and request the required user login; do not ask the user to paste a token in chat.
