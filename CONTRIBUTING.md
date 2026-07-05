# Contributing

Thanks for contributing to **AgentCore OS**.

The current engineering mainline is the **Controlled Skill / Playbook Runtime**. Contributions should strengthen deterministic playbook execution, tool boundaries, approvals, traceability, recovery, or asset writeback.

## Before you start

Please read:
- `README.md`
- `docs/PROJECT_FRAMEWORK.zh-CN.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `docs/GETTING_STARTED.md`
- `docs/ARCHITECTURE.md`
- `docs/OPEN_SOURCE_CHECKLIST.md`

## Development setup

```bash
npm install
npm run dev
```

For a production-style check:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

## Contribution guidelines

### Keep changes focused
- Prefer small, reviewable pull requests
- Avoid mixing refactors, features, and docs in one PR when possible

### Respect project boundaries
- Do not expand the desktop shell or add standalone apps unless they directly support controlled runtime goals
- Keep fixed playbook steps, tool boundaries, approval gates, trace, recovery, and asset writeback explicit
- Do not add real social-platform automation unless it uses official APIs or clearly compliant connector patterns
- Do not add private identifiers, secrets, customer data, or internal URLs

### Documentation matters
If behavior changes, update the relevant docs:
- README
- project framework / controlled runtime manual
- architecture / connector docs
- privacy / deployment notes where relevant

## Pull request checklist

Before opening a PR:
- Run `npm run test:controlled-runtime` for runtime changes
- Run `npm run test:core-workflows` for workflow or asset changes
- Run `npm run lint`
- Run `npm run build`
- Confirm no secrets or private identifiers were added
- Confirm no build artifacts were committed
- Update docs if the user-facing behavior changed

## Code style

- Prefer clarity over cleverness
- Keep naming literal and predictable
- Preserve the controlled runtime direction unless intentionally proposing a documented change
- If introducing a tradeoff, document it in the PR description

## Issues and feature requests

- Use bug reports for reproducible problems
- Use feature requests for enhancements or new capabilities
- For security-sensitive topics, follow `SECURITY.md`
