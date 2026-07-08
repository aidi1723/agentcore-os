# GitHub macOS CLI Install Path Design

## Purpose

Narrow the current public install path to one supported format:

**GitHub repository + macOS + command-line install from source.**

This phase exists because broader install messaging can blur the current delivery path. The project should not ask maintainers or users to reason about alternate mirrors, installer packages, desktop packaging, deployment, or production release channels for the current install step.

## Scope

Add a canonical install page:

```text
docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md
```

The canonical page must include:

- macOS requirement;
- Git requirement;
- Node.js 22 LTS recommendation;
- npm requirement;
- exact GitHub clone command;
- exact local startup command;
- `http://localhost:3000/` as the local URL.

Add a local read-only check:

```bash
npm run release:github-macos-cli:check
```

The check must validate:

- required install docs exist;
- canonical install commands are present;
- the canonical page does not include out-of-scope install alternatives;
- README, command-line install, public release, and early access docs link to the canonical page.

## Non-Goals

This phase must not:

- clone the repository;
- run `npm install`;
- start the app;
- build packages;
- create tags;
- upload artifacts;
- deploy;
- call connectors;
- perform external writes;
- use credentials;
- run production verification;
- claim production readiness.

## Output Semantics

The checker must output:

```json
{
  "installClaim": "github_macos_cli_install_path_defined",
  "platform": "macOS",
  "source": "GitHub",
  "installOnly": true,
  "productionReady": false,
  "publishingPerformed": false
}
```

## Handoff Integration

`release:handoff:check` should include this check after repository hygiene and before delivery readiness. That makes the current install path part of local handoff evidence without turning it into a production release action.

## Verification

Required verification:

```bash
npm test -- src/__tests__/scripts/github-macos-cli-install-check-script.test.ts src/__tests__/scripts/release-handoff-check-script.test.ts
npm run release:github-macos-cli:check
npm run release:handoff:check
git diff --check
```

Full controlled-runtime verification should include the new script test through `npm run test:controlled-runtime`.
