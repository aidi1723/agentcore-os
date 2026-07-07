# Playbook Guardrail Policy Alignment Design

## Goal

Extend the existing playbook control audit so it verifies that each registered playbook resolves into an execution plan accepted by the runtime guardrails, and that guarded tools are explicitly reflected in playbook approval policy.

## Context

`npm run playbook:control:audit` now checks playbook contract completeness and fixture coverage. The next control-chain gap is policy alignment: the audit should also prove that a playbook is compatible with the runtime guardrail defaults used by execution.

This keeps the maintainer workflow efficient: one local read-only command continues to answer whether a registered playbook is safe enough for controlled execution.

## Design

Enhance `src/lib/executor/playbooks/control-audit.ts`:

- Resolve each playbook through `resolveExecutionPlanFromPlaybook()`.
- Validate the resolved plan against `DEFAULT_GUARDRAILS`.
- Add per-playbook `guardrails` summary to the audit item.
- Fail closed when default guardrails reject the resolved plan.
- Fail closed when a step calls a tool listed in `DEFAULT_GUARDRAILS.requireApprovalFor` but the playbook step does not declare `requiresApproval: true`.

Also remove the duplicate default guardrail constant from `step-executor.ts` and import `DEFAULT_GUARDRAILS` from `guardrails.ts`, so the audit and executor refer to the same exported default policy.

## Boundaries

This phase does not change runtime behavior, tool execution, approval store behavior, writeback behavior, UI, fixtures, release handoff evidence, or publication state. It only tightens local audit coverage and default guardrail source alignment.
