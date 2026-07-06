# GPLv3 License Migration Design

## Context

AgentCore OS currently presents itself as Apache-2.0:

- `LICENSE` contains Apache License 2.0.
- `package.json` declares `"license": "Apache-2.0"`.
- `README.md` badge and license section point to Apache-2.0.
- `NOTICE` says source code is licensed under Apache License 2.0.

The project owner approved changing the project license to GPLv3 after the current major direction change toward the Controlled Skill / Playbook Runtime.

## Decision

Move the project source license for new versions to:

```text
GPL-3.0-or-later
```

Use the canonical GNU GPL version 3 text in `LICENSE`.

Source record:

- URL: `https://www.gnu.org/licenses/gpl-3.0.txt`
- Publisher: Free Software Foundation
- License text version: GNU General Public License, Version 3, 29 June 2007
- Downloaded file SHA-256: `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`

## Boundaries

This migration applies from the commit that changes the repository license metadata onward.

Important boundaries:

- Previously published Apache-2.0 versions remain available under Apache-2.0.
- This repository should not claim that old Apache-2.0 grants were revoked.
- Brand assets, names, marks, logos, and trademarks remain outside the software license unless explicitly stated.
- Third-party dependencies keep their own licenses.
- This change does not publish, tag, or push anything by itself.

## Compatibility Notes

Apache-2.0 code can be combined into GPLv3-licensed work, but GPLv3 code cannot be relicensed back into Apache-2.0 without permission from the relevant rights holders. This is a project governance decision, not a code behavior change.

This spec is not legal advice. If there are third-party contributors whose rights were not assigned to the project owner, the owner should confirm they are allowed to relicense those contributions or keep a clear historical boundary around the old Apache-2.0 code.

## Scope

Update:

- `LICENSE`
- `package.json`
- `package-lock.json`
- `README.md`
- `NOTICE`
- `docs/OPEN_SOURCE_CHECKLIST.md`
- `CHANGELOG.md`
- new `docs/LICENSE_CHANGE_NOTICE.md`
- local memory record

Do not update:

- runtime source code,
- dependency versions,
- release tags,
- remote repository settings,
- publication channels.

## Documentation Requirements

`docs/LICENSE_CHANGE_NOTICE.md` must explain:

- the new license identifier,
- effective boundary,
- historical Apache-2.0 boundary,
- brand/trademark carve-out,
- third-party dependency carve-out,
- owner/contributor review warning,
- source of the GPLv3 license text.

`README.md` must show the new GPLv3 license badge and state the new software license without hiding the historical boundary.

`NOTICE` must state that current source code is licensed under GNU GPLv3 or later.

`docs/OPEN_SOURCE_CHECKLIST.md` must include a license migration check so future releases verify:

- `LICENSE`,
- `package.json`,
- README badge,
- NOTICE,
- license change notice,
- release notes.

## Verification

Run:

```bash
rg -n "Apache-2.0|Apache License 2.0|Apache_2.0" README.md NOTICE package.json docs LICENSE
rg -n "GPL-3.0-or-later|GNU General Public License|GPLv3" README.md NOTICE package.json docs LICENSE
git diff --check
npm run trace:fixtures --silent
npm run test:controlled-runtime
```

Expected:

- old Apache references remain only in historical boundary text, compatibility notes, or migration notes,
- current license metadata points to `GPL-3.0-or-later`,
- docs have no whitespace errors,
- controlled runtime and fixture gates remain unaffected.

## Success Criteria

- Current repository metadata consistently presents `GPL-3.0-or-later`.
- Historical Apache-2.0 releases are explicitly preserved rather than revoked.
- Brand assets and third-party dependency boundaries remain explicit.
- License migration is recorded in changelog and a dedicated migration notice.
- Verification commands pass, except for already-known unrelated warnings if broader lint/build commands are later run.
