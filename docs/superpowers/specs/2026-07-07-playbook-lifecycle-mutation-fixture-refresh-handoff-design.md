# Playbook Lifecycle Mutation Fixture Refresh Handoff Design

Date: 2026-07-07

## Goal

Define a local read-only handoff gate between green post-apply audit evidence and any manual governed fixture refresh work.

The gate prevents a post-apply audit from being treated as permission to immediately refresh committed fixtures, publish, or claim readiness. It only confirms that a maintainer has declared the fixture refresh target, review checklist, and non-production boundary.

## Scope

- Add a fixture refresh handoff checker.
- Read one local handoff JSON file.
- Reuse the post-apply evidence checker for the referenced evidence.
- Require the handoff target playbook to match the referenced post-apply sequence target.
- Require at least one intended governed fixture id.
- Require a manual review checklist covering source identity, redaction, playbook contract, approval/terminal state, writeback identity, failure triage, sensitive string search, replacement diff, catalog gates, runtime regression, and rollback notes.
- Require boundary fields proving no fixture candidate generation, no committed fixture replacement, no store writes, no external writes, no publishing, and no production readiness.

## Non-Goals

- Build a candidate fixture.
- Replace committed fixture JSON.
- Run replay, fixture, test, lint, or build commands.
- Write stores or business assets.
- Call external connectors.
- Publish, tag, upload, or package artifacts.
- Claim production readiness.

## Next Gate

After this handoff gate is green, the next phase can define a candidate fixture review gate that validates generated candidate fixture metadata before a maintainer replaces committed fixture JSON.
