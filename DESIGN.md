# AgentCore OS Design Contract

## Product Identity

AgentCore OS is a local-first business operating system for real work. It is not an AI chat page, an app launcher, or a generic SaaS dashboard.

The interface should help users understand:

- which industry scenario they are in
- which role they are acting as
- which workflow should start or continue next
- what the AI is executing
- what needs human approval
- where results become reusable assets
- whether the local runtime is healthy

## Design Principles

1. Real work before decoration.
2. Clear next action before feature display.
3. Stable workflow progress before visual drama.
4. Implementation feasibility before concept art.
5. Trust and reliability before novelty.
6. AgentCore OS identity before borrowed product patterns.

## Information Architecture

Primary navigation:

- Home
- Solutions
- Roles
- Workflows
- Assets
- Approvals
- Settings

App windows may remain, but they are secondary execution modules. The product should read as a solution operating system organized around industry, role, workflow, approval, and asset.

## Visual Language

Use a restrained operational cockpit style:

- professional
- stable
- structured
- premium
- execution-oriented
- calm under load

Avoid:

- purple-dominant generic AI styling
- soft toy-like rounded interfaces
- hacker dashboards
- heavy glassmorphism
- purely decorative gradients or glow effects

## Color Roles

- Background: deep graphite or cool neutral.
- Surface: layered neutral panels with clear borders.
- Elevated surface: slightly lighter graphite with restrained shadow.
- Text: high-contrast off-white or near-black depending on theme.
- Muted text: cool gray with accessible contrast.
- Accent: controlled cyan green or cold metallic blue for primary action.
- Warning: signal amber.
- Danger: clear red.
- Success: calm green.
- Border: visible but quiet cool neutral.

Status colors must be semantic and consistent across workflow, approval, runtime, and asset surfaces.

## Typography

- Use controlled, modern product typography.
- Headings should be compact and confident.
- Body text should prioritize scanning and comprehension.
- Avoid oversized hero type inside dense tools, cards, sidebars, and dashboards.
- Use sentence case for interface labels unless a product name requires otherwise.
- Letter spacing should remain neutral.

## Density And Layout

The app is a work surface, not a marketing page.

- Keep information dense but organized.
- Use stable grid tracks for dashboards and workflow panels.
- Page sections should be full-width layouts with constrained inner content.
- Cards should represent repeated items, tools, or dialogs.
- Do not place cards inside other cards.
- Deep pages must maintain the same quality as top-level pages.

## Shapes And Surfaces

- Prefer 6px to 8px radius for cards and panels.
- Use visible boundaries for operational state.
- Use shadows sparingly.
- Avoid excessive blur.
- Keep command bars, runtime panels, approval cards, and workflow stages visually distinct.

## Components

Buttons:

- primary buttons start or continue work
- secondary buttons inspect, configure, or retry
- destructive buttons must be explicit
- icon buttons should use familiar symbols and tooltips

Inputs:

- clear labels
- visible focus states
- stable height
- helpful validation near the field

Workflow stages:

- show trigger, runtime state, blocker, next action, approval boundary, and asset landing
- do not collapse execution state into decorative timelines

Approval surfaces:

- show risk level, source workflow, AI recommendation, decision action, impact, write-back target, and history

Runtime surfaces:

- show active executor base
- show health, last heartbeat, version or binary path if available
- show actionable recovery states
- separate AI execution, human approval, restricted action, and failed states

Assets:

- show source, type, scenario, last used time, related workflow, related customer/project, reuse action, and derived versions

## Motion

Motion should clarify state change and continuity.

- Use short transitions.
- Avoid dramatic animations in dense operational screens.
- Loading states should be stable and readable.
- Error and retry states should be immediate and understandable.

## Accessibility

- Preserve keyboard focus.
- Maintain readable contrast.
- Do not hide critical information behind hover.
- Ensure text fits inside buttons, cards, and panels on desktop and mobile.
- Use semantic status labels in addition to color.

## Implementation Order

1. Shared tokens and global styles.
2. Desktop shell and navigation.
3. Runtime and executor surfaces.
4. Workflow, approval, and asset components.
5. Representative app windows.
6. Consistency sweep for typography, spacing, surfaces, states, responsiveness, and accessibility.
