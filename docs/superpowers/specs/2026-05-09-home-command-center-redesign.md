# Home Command Center Redesign

## Summary

Redesign the AgentCore OS home screen into a single-page command center. The home screen should let the user see and operate the product's core capabilities from one place: business scenarios, active workflow, approvals, reusable assets, runtime health, and access to deeper app windows.

The chosen direction is A1: a command center layout with business scenarios on the left, execution and workflow controls in the center, and attention/runtime/asset status on the right.

## Goals

- Make the first screen simpler, more direct, and more business-oriented.
- Let users see the main functional areas without hunting through desktop icons.
- Preserve existing app windows for deeper, complex operations.
- Keep behavior, routing, app state, runtime calls, and business logic intact unless a specific UI action already exists.
- Use an open-design-inspired enterprise style: clean panels, clear borders, compact typography, and restrained color.

## Non-Goals

- Do not rewrite individual app window internals.
- Do not replace the existing window system.
- Do not add a new large UI framework.
- Do not create a marketing-style landing page.
- Do not introduce decorative motion, heavy gradients, or glassmorphism as the dominant style.

## Visual Direction

Use the repository `DESIGN.md` as the primary contract, with open-design's professional, enterprise, and Vercel-inspired systems as references.

Design rules:

- Prefer a light or neutral operational canvas over the current saturated wallpaper feel.
- Use 6px to 8px radius for panels and action cards.
- Use visible but quiet borders instead of heavy blur and glow.
- Keep text compact and readable.
- Use one controlled accent for primary action and selected state.
- Keep status colors semantic: success, warning, danger, neutral.
- Avoid purple-dominant AI styling and oversized dashboard hero typography.

## Information Architecture

The home screen has three primary regions.

### Left Region: Business Scenarios

Purpose: choose the current business context.

Content:

- Sales or inbound quote workflow.
- Support or escalation workflow.
- Content or creator publishing workflow.
- Research or market scan workflow.
- Knowledge assets or reusable output workflow.

Each scenario item shows:

- scenario name
- short business outcome
- current run status when available
- selected state

Clicking a scenario changes the selected starter or workspace context, using existing scenario and starter data.

### Center Region: Execution Surface

Purpose: start or continue work.

Content:

- primary command input
- primary action button to execute the command
- secondary actions for role desk, solution library, or industry hub
- four core capability shortcuts: Workflows, Approvals, Assets, Runtime
- active workflow stage strip showing trigger, execution, approval, and asset landing
- recent command or execution messages when available

The center area is the user's main operating surface. It should be visually dominant but not oversized.

### Right Region: Attention And State

Purpose: show what needs attention and what the system has produced.

Content:

- pending approvals or human confirmations
- running or failed tasks
- recent reusable assets
- runtime health and active provider

These panels should be actionable where possible: open the relevant app, retry, inspect, or continue.

## Interaction Model

- Existing app windows remain the deep-work surface.
- Home shortcuts call the existing `openApp` behavior.
- Scenario selection continues to use existing starter/scenario helpers.
- The command input continues to use the existing execution request path.
- Runtime and settings actions open their current app windows or settings tabs.
- The hidden desktop icon grid should no longer be the primary mental model.

## Component Changes

Expected changes are concentrated in `src/app/page.tsx` and global styling if needed.

Update or replace:

- status bar styling
- wallpaper/background treatment
- `SolutionCenterPanel`
- `HomeOperationsDeck`
- related small cards and buttons used only by the home screen

Preserve:

- `Spotlight`
- `SystemTrayWindows`
- app window state management
- runtime event listeners
- app registry
- settings persistence

## Responsive Behavior

Desktop:

- Three-column command center: left scenario rail, center execution surface, right status rail.
- Maximum width remains constrained for readability.
- First screen should show the main command surface and major shortcuts without feeling crowded.

Tablet:

- Left scenario rail and right status rail can compress.
- Center execution remains first priority.

Mobile:

- Stack regions in order: command surface, scenario selector, shortcuts, attention/status.
- Avoid text overflow in buttons, cards, and status pills.

## Accessibility

- Use semantic buttons for all actions.
- Preserve visible focus states.
- Do not rely on color alone for status.
- Maintain readable contrast.
- Keep touch targets stable and large enough.
- Ensure scroll behavior remains usable when app windows are closed or open.

## Testing And Verification

Run:

- `npm run lint`
- `npm run build`

Visual checks:

- desktop viewport around 1440px wide
- tablet or narrow desktop around 900px wide
- mobile around 390px wide

Manual flows:

- open app from shortcut
- select scenario
- run or submit command
- open settings
- open Spotlight
- open and close at least one app window

## Open Decisions

- Exact final color tokens can be tuned during implementation, but must stay within the existing `DESIGN.md` contract and the open-design enterprise/professional reference direction.
- The first implementation should not attempt to populate every status panel with new backend data. It should use existing available data and safe fallbacks.
