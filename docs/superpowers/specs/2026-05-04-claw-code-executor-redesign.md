# Claw Code Executor Redesign

Date: 2026-05-04
Status: Approved

## Goal

Replace the LobsterAI-centered executor base with a claw-code-centered runtime while improving AgentCore OS around three first principles: stability, efficiency, and precision.

## Decision

AgentCore OS keeps ownership of the product shell, task contract, session history, audit trace, workflow context, UI, and business state. `claw-code` becomes the default task execution base.

This is a direct executor-base replacement, not a product rewrite.

## First Principles

1. Stability
   - one official executor entry path
   - consistent browser and desktop behavior
   - typed request/result contracts
   - structured errors
   - timeouts, health checks, and audit records

2. Efficiency
   - remove duplicate execution paths
   - reduce LobsterAI-specific naming and packaging
   - keep existing product assets instead of rebuilding the app
   - make runtime state visible and actionable in the UI

3. Precision
   - preserve system prompt, workspace context, role context, skill policy, and session id across the execution chain
   - map claw-code outputs into AgentCore result and trace records
   - make AI execution, human approval, retry, and asset landing explicit

## Architecture

### AgentCore OS Product Layer

Owns:

- desktop shell and browser shell
- settings
- workflow surfaces
- session and audit stores
- business assets
- UI state and runtime health

### AgentCore Executor Contract

The official internal task contract remains:

- `taskInput`
- `session`
- `metadata`
- `context`
- `skillPolicy`
- `modelConfig`
- `executionPolicy`
- `trace`

Legacy routes may keep compatibility names, but all execution should normalize into this contract before reaching a runtime backend.

### Claw Code Runtime Backend

`claw-code` is introduced as the default backend responsible for real task execution.

The initial integration uses a local CLI adapter because claw-code currently exposes a source-built CLI surface more clearly than a stable embedded HTTP daemon.

The adapter must:

- resolve the `claw` binary
- build deterministic CLI arguments
- pass prompt/context safely
- apply timeout controls
- parse stdout/stderr into structured output
- map failures into stable AgentCore errors
- emit trace attempts with `engine: "claw_code"`

### LobsterAI Legacy Removal

LobsterAI-specific code should be removed from the main execution path. During the first implementation phase, Lobster names may remain in packaging files that are not yet touched, but no new core execution logic should depend on LobsterAI.

## UI Direction

Create a root `DESIGN.md` based on the existing Chinese UI guidelines.

The UI should become a business operating system, not an app launcher. The first visible hierarchy is:

- Home
- Solutions
- Roles
- Workflows
- Assets
- Approvals
- Settings

Runtime surfaces should clearly expose:

- active execution base
- health state
- running tasks
- failed tasks and retry options
- AI/Human boundary
- asset landing location

## Rollout

### Phase 1: Runtime Backbone

- add claw-code types and adapter
- add tests for CLI argument building and output parsing
- extend executor trace engine types
- route `runAgentCoreTask` through claw-code by default when enabled
- keep direct model execution as controlled fallback only if configured

### Phase 2: Desktop Runtime

- rename sidecar concepts from Lobster-specific names to runtime executor names
- support packaged `claw` binary discovery
- expose runtime health for claw-code
- update runtime doctor and settings copy

### Phase 3: UI System

- add root `DESIGN.md`
- adjust global tokens and shell surfaces
- restyle executor console and settings runtime panels first
- then sweep workflow, assets, approvals, and home surfaces

### Phase 4: Cleanup

- remove dead Lobster bridge files and scripts after claw-code runtime has equivalent coverage
- update docs and release notes
- run full stability verification

## Acceptance Criteria

- `/api/agent/run` uses the official AgentCore contract and can execute through claw-code.
- Executor sessions record `engine: "claw_code"` attempts.
- Errors are structured and visible in API responses and audit records.
- UI has a root design contract in `DESIGN.md`.
- Runtime UI copy names the new base clearly.
- Existing workflow-facing callers do not need to know claw-code details.
- Build, lint, and core workflow regression commands complete successfully before final release.

