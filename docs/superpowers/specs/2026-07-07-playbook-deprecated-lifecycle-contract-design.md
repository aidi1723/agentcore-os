# Playbook Deprecated Lifecycle Contract Design

## Goal

Make `deprecated` controlled playbooks auditable by requiring explicit deprecation metadata and a registered replacement playbook.

## Context

The project now has lifecycle metadata and a lifecycle review diagnostic. The next gap is that `status: "deprecated"` is still only a label. A maintainable playbook system needs deprecation to be a controlled transition: maintainers must know when the playbook was deprecated, why it was deprecated, and which registered playbook replaces it.

## Design

Extend `ControlledPlaybookLifecycle` with optional deprecation fields:

- `deprecatedAt`: `YYYY-MM-DD`, required only when `status === "deprecated"`;
- `deprecationReason`: non-empty string, required only when `status === "deprecated"`;
- `replacementPlaybookId`: non-empty string, required only when `status === "deprecated"`.

Enhance `npm run playbook:control:audit`:

- fail closed when a deprecated playbook omits `deprecatedAt`;
- fail closed when a deprecated playbook omits `deprecationReason`;
- fail closed when a deprecated playbook omits `replacementPlaybookId`;
- fail closed when `replacementPlaybookId` points to itself;
- fail closed when `replacementPlaybookId` is not present in the registered playbook catalog.

The audit should continue to include lifecycle metadata in each audit item. Existing active playbooks should not need deprecation fields.

## Boundaries

No new business playbook, no UI, no authoring screen, no migration runner, no fixture mutation, no runtime execution change, no external connector writes, no release, no browser smoke, and no production-readiness claim.
