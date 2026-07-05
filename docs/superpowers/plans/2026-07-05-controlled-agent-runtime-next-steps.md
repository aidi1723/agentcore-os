# Controlled Agent Runtime Next Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first executable slice of the controlled Skill / Playbook Runtime by making `sales-pipeline` use a fixed, validated playbook plan instead of default LLM step planning.

**Architecture:** Add a small playbook layer under `src/lib/executor/playbooks/*` that defines controlled steps, resolves a playbook by id or scenario, validates the generated `ExecutionPlan`, and lets `/api/agent/stream` execute that plan directly. Keep the current LLM planner as fallback only when no controlled playbook is supplied.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, existing `AgentCoreTaskRequest`, existing `executeMultiStep`, existing workflow run state, existing tool registry.

---

## Scope

This plan implements Phase 1 from [可控 Agent Runtime 开发手册](../../CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md): fixed plan source and validation for one deep workflow.

In scope:

- Add controlled playbook types.
- Add `sales-pipeline` controlled playbook.
- Convert a controlled playbook to an `ExecutionPlan`.
- Validate step ids, tool allowlists, approval requirements, and basic schema presence.
- Let `/api/agent/stream` execute a validated fixed plan.
- Change `runWorkflowMultiStep` so it sends the fixed plan/playbook identity instead of only `maxSteps`.
- Add tests that prove the LLM planner is not used for controlled playbooks.

Out of scope:

- Persistent approval store.
- Persistent trace store.
- Full JSON Schema runtime validation of model outputs.
- UI redesign.
- New apps.
- New external dependencies.

## File Structure

Create:

- `src/lib/executor/playbooks/types.ts`
  - Controlled playbook and controlled step types.
- `src/lib/executor/playbooks/sales-pipeline.ts`
  - First fixed playbook.
- `src/lib/executor/playbooks/catalog.ts`
  - Playbook lookup by id and scenario id.
- `src/lib/executor/playbooks/resolver.ts`
  - Convert controlled playbook steps into `ExecutionPlan`.
- `src/lib/executor/playbooks/validator.ts`
  - Validate plans against playbook contracts and existing tool registry.
- `src/__tests__/lib/executor/playbooks/sales-pipeline.test.ts`
  - Unit tests for the sales playbook shape and conversion.
- `src/__tests__/lib/executor/playbooks/validator.test.ts`
  - Unit tests for validator failure cases.
- `src/__tests__/lib/executor/controlled-runtime.test.ts`
  - Integration-level test that explicit plans bypass LLM planning.

Modify:

- `src/lib/executor/contracts.ts`
  - Add controlled playbook metadata to task request.
- `src/lib/executor/core.ts`
  - Use explicit validated plan when supplied; fall back to `planSteps` otherwise.
- `src/app/api/agent/stream/route.ts`
  - Resolve and validate playbook plans from request body.
- `src/lib/executor/run-workflow-multi-step.ts`
  - Send `playbookId`, `scenarioId`, `workflowRunId`, and fixed step count to stream route.
- `package.json`
  - Add `test:controlled-runtime`.

Do not modify in this slice:

- `src/apps/registry.ts`
- `src/components/windows/*`
- app visual components unless a test requires a type import fix

---

### Task 1: Add Controlled Playbook Types And Sales Playbook

**Files:**

- Create: `src/lib/executor/playbooks/types.ts`
- Create: `src/lib/executor/playbooks/sales-pipeline.ts`
- Test: `src/__tests__/lib/executor/playbooks/sales-pipeline.test.ts`

- [ ] **Step 1: Write the failing playbook shape test**

Create `src/__tests__/lib/executor/playbooks/sales-pipeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";

describe("salesPipelinePlaybook", () => {
  it("defines the stable first controlled runtime workflow", () => {
    expect(salesPipelinePlaybook.id).toBe("sales-pipeline-v1");
    expect(salesPipelinePlaybook.scenarioId).toBe("sales-pipeline");
    expect(salesPipelinePlaybook.steps.map((step) => step.id)).toEqual([
      "intake",
      "qualify",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
  });

  it("keeps review and manual stages behind approval", () => {
    const approvalSteps = salesPipelinePlaybook.steps.filter((step) => step.requiresApproval);
    expect(approvalSteps.map((step) => step.id)).toEqual(["human_review", "writeback"]);
    expect(
      salesPipelinePlaybook.steps
        .filter((step) => step.mode === "review" || step.mode === "manual")
        .every((step) => step.requiresApproval),
    ).toBe(true);
  });

  it("declares schemas and allowed tools for every step", () => {
    for (const step of salesPipelinePlaybook.steps) {
      expect(step.inputSchema).toMatchObject({ type: "object" });
      expect(step.outputSchema).toMatchObject({ type: "object" });
      expect(step.allowedTools.length).toBeGreaterThan(0);
      expect(step.acceptanceCriteria.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/sales-pipeline.test.ts
```

Expected: FAIL because `src/lib/executor/playbooks/sales-pipeline.ts` does not exist.

- [ ] **Step 3: Add controlled playbook types**

Create `src/lib/executor/playbooks/types.ts`:

```ts
import type { ToolCallSpec } from "@/lib/executor/contracts";

export type ControlledPlaybookTriggerType =
  | "manual"
  | "schedule"
  | "inbound_message"
  | "web_form";

export type ControlledPlaybookStepMode = "auto" | "assist" | "review" | "manual";

export type ControlledPlaybookWriteTarget =
  | "workflow_run"
  | "draft"
  | "sales_asset"
  | "support_asset"
  | "knowledge_asset";

export type ControlledPlaybookSchema = {
  type: "object";
  required?: string[];
  properties: Record<string, unknown>;
  additionalProperties?: boolean;
};

export type ControlledPlaybookStep = {
  id: string;
  title: string;
  mode: ControlledPlaybookStepMode;
  purpose: string;
  inputSchema: ControlledPlaybookSchema;
  outputSchema: ControlledPlaybookSchema;
  allowedTools: string[];
  forbiddenTools?: string[];
  requiresApproval: boolean;
  acceptanceCriteria: string[];
  toolCalls?: ToolCallSpec[];
  writesTo?: Array<{
    target: ControlledPlaybookWriteTarget;
    when: "on_success" | "after_approval";
  }>;
  onFailure: {
    action: "retry" | "await_human" | "fail_run";
    maxRetries?: number;
  };
};

export type ControlledPlaybook = {
  id: string;
  title: string;
  scenarioId: string;
  version: string;
  triggerTypes: ControlledPlaybookTriggerType[];
  steps: ControlledPlaybookStep[];
  resultAssets: string[];
};
```

- [ ] **Step 4: Add the sales playbook**

Create `src/lib/executor/playbooks/sales-pipeline.ts`:

```ts
import type { ControlledPlaybook } from "@/lib/executor/playbooks/types";

const leadInputProperties = {
  company: { type: "string" },
  contact: { type: "string" },
  inquiryChannel: { type: "string" },
  preferredLanguage: { type: "string" },
  productLine: { type: "string" },
  need: { type: "string" },
  budget: { type: "string" },
  timing: { type: "string" },
};

export const salesPipelinePlaybook: ControlledPlaybook = {
  id: "sales-pipeline-v1",
  title: "Sales Pipeline Controlled Runtime",
  scenarioId: "sales-pipeline",
  version: "1.0.0",
  triggerTypes: ["inbound_message", "schedule", "web_form", "manual"],
  resultAssets: ["sales_asset", "knowledge_asset"],
  steps: [
    {
      id: "intake",
      title: "收集询盘字段",
      mode: "assist",
      purpose: "把客户询盘整理成后续步骤可消费的结构化输入。",
      inputSchema: {
        type: "object",
        properties: leadInputProperties,
        additionalProperties: true,
      },
      outputSchema: {
        type: "object",
        required: ["summary", "missingFields", "normalizedLead"],
        properties: {
          summary: { type: "string" },
          missingFields: { type: "array", items: { type: "string" } },
          normalizedLead: { type: "object", properties: leadInputProperties },
        },
        additionalProperties: false,
      },
      allowedTools: ["llm_generate", "human_ask"],
      requiresApproval: false,
      acceptanceCriteria: [
        "输出必须列出缺失字段。",
        "不得编造价格、交期或客户背景。",
        "必须保留来源渠道和产品线。",
      ],
      toolCalls: [{ toolName: "llm_generate" }],
      writesTo: [{ target: "workflow_run", when: "on_success" }],
      onFailure: { action: "await_human" },
    },
    {
      id: "qualify",
      title: "判断线索优先级",
      mode: "assist",
      purpose: "判断线索是否值得进入跟进草稿阶段。",
      inputSchema: {
        type: "object",
        required: ["normalizedLead"],
        properties: {
          normalizedLead: { type: "object", properties: leadInputProperties },
          missingFields: { type: "array", items: { type: "string" } },
        },
        additionalProperties: true,
      },
      outputSchema: {
        type: "object",
        required: ["priority", "reasons", "risks", "nextAction"],
        properties: {
          priority: { enum: ["high", "medium", "low", "blocked"] },
          reasons: { type: "array", items: { type: "string" } },
          risks: { type: "array", items: { type: "string" } },
          nextAction: { type: "string" },
        },
        additionalProperties: false,
      },
      allowedTools: ["llm_generate", "knowledge_search"],
      requiresApproval: false,
      acceptanceCriteria: [
        "必须给出优先级。",
        "必须列出判断理由和风险。",
        "缺失关键信息时 priority 应为 blocked 或 medium 以下。",
      ],
      toolCalls: [{ toolName: "llm_generate" }],
      writesTo: [{ target: "sales_asset", when: "on_success" }],
      onFailure: { action: "await_human" },
    },
    {
      id: "draft_outreach",
      title: "生成跟进草稿",
      mode: "assist",
      purpose: "生成可供人工审核的客户跟进邮件或话术。",
      inputSchema: {
        type: "object",
        required: ["normalizedLead", "priority", "nextAction"],
        properties: {
          normalizedLead: { type: "object", properties: leadInputProperties },
          priority: { type: "string" },
          nextAction: { type: "string" },
        },
        additionalProperties: true,
      },
      outputSchema: {
        type: "object",
        required: ["subject", "body", "assumptions", "needsHumanCheck"],
        properties: {
          subject: { type: "string" },
          body: { type: "string" },
          assumptions: { type: "array", items: { type: "string" } },
          needsHumanCheck: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
      allowedTools: ["llm_generate", "knowledge_search"],
      requiresApproval: false,
      acceptanceCriteria: [
        "草稿不得承诺未确认价格或交期。",
        "必须标出需要人工确认的假设。",
        "必须包含一个明确下一步动作。",
      ],
      toolCalls: [{ toolName: "llm_generate" }],
      writesTo: [{ target: "draft", when: "on_success" }],
      onFailure: { action: "await_human" },
    },
    {
      id: "human_review",
      title: "人工审核跟进内容",
      mode: "review",
      purpose: "人工确认草稿中的事实、语气、风险和下一步动作。",
      inputSchema: {
        type: "object",
        required: ["subject", "body"],
        properties: {
          subject: { type: "string" },
          body: { type: "string" },
          assumptions: { type: "array", items: { type: "string" } },
          needsHumanCheck: { type: "array", items: { type: "string" } },
        },
        additionalProperties: true,
      },
      outputSchema: {
        type: "object",
        required: ["approved", "approvedBody", "reviewNotes"],
        properties: {
          approved: { type: "boolean" },
          approvedBody: { type: "string" },
          reviewNotes: { type: "string" },
        },
        additionalProperties: false,
      },
      allowedTools: ["human_ask"],
      requiresApproval: true,
      acceptanceCriteria: [
        "必须由人工批准后才能继续写回。",
        "拒绝时不得进入 writeback。",
        "审批记录必须进入 trace。",
      ],
      toolCalls: [{ toolName: "human_ask" }],
      writesTo: [{ target: "workflow_run", when: "after_approval" }],
      onFailure: { action: "await_human" },
    },
    {
      id: "writeback",
      title: "写回销售资产",
      mode: "manual",
      purpose: "把已批准结果写回销售资产和知识资产。",
      inputSchema: {
        type: "object",
        required: ["approved", "approvedBody"],
        properties: {
          approved: { type: "boolean" },
          approvedBody: { type: "string" },
          reviewNotes: { type: "string" },
        },
        additionalProperties: true,
      },
      outputSchema: {
        type: "object",
        required: ["salesAssetUpdated", "knowledgeAssetCandidate"],
        properties: {
          salesAssetUpdated: { type: "boolean" },
          knowledgeAssetCandidate: { type: "string" },
        },
        additionalProperties: false,
      },
      allowedTools: ["human_ask"],
      requiresApproval: true,
      acceptanceCriteria: [
        "只允许写回已批准内容。",
        "必须标记资产来源 workflowRunId。",
        "不得把未确认假设写入高信任知识资产。",
      ],
      toolCalls: [{ toolName: "human_ask" }],
      writesTo: [
        { target: "sales_asset", when: "after_approval" },
        { target: "knowledge_asset", when: "after_approval" },
      ],
      onFailure: { action: "fail_run" },
    },
  ],
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/sales-pipeline.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/executor/playbooks/types.ts src/lib/executor/playbooks/sales-pipeline.ts src/__tests__/lib/executor/playbooks/sales-pipeline.test.ts
git commit -m "feat: define controlled sales playbook"
```

---

### Task 2: Add Playbook Catalog, Resolver, And Validator

**Files:**

- Create: `src/lib/executor/playbooks/catalog.ts`
- Create: `src/lib/executor/playbooks/resolver.ts`
- Create: `src/lib/executor/playbooks/validator.ts`
- Test: `src/__tests__/lib/executor/playbooks/validator.test.ts`
- Modify: `src/__tests__/lib/executor/playbooks/sales-pipeline.test.ts`

- [ ] **Step 1: Extend the sales playbook test with resolver behavior**

Append these imports and tests to `src/__tests__/lib/executor/playbooks/sales-pipeline.test.ts`:

```ts
import { resolveExecutionPlanFromPlaybook } from "@/lib/executor/playbooks/resolver";
```

```ts
  it("converts the playbook into a deterministic execution plan", () => {
    const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);

    expect(plan.goal).toBe("Sales Pipeline Controlled Runtime");
    expect(plan.totalSteps).toBe(5);
    expect(plan.requiresApproval).toBe(true);
    expect(plan.steps.map((step) => step.id)).toEqual([
      "intake",
      "qualify",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
    expect(plan.steps[1].dependsOn).toEqual(["intake"]);
    expect(plan.steps[3].mode).toBe("review");
    expect(plan.steps[4].mode).toBe("manual");
  });
```

- [ ] **Step 2: Write validator tests**

Create `src/__tests__/lib/executor/playbooks/validator.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import { resolveExecutionPlanFromPlaybook } from "@/lib/executor/playbooks/resolver";
import {
  validateControlledPlaybook,
  validateExecutionPlanAgainstPlaybook,
} from "@/lib/executor/playbooks/validator";

describe("validateExecutionPlanAgainstPlaybook", () => {
  it("accepts the plan generated from its playbook", () => {
    const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);
    const result = validateExecutionPlanAgainstPlaybook(plan, salesPipelinePlaybook);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects unknown steps", () => {
    const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);
    const result = validateExecutionPlanAgainstPlaybook(
      {
        ...plan,
        steps: [
          ...plan.steps,
          {
            id: "surprise_step",
            title: "Unplanned action",
            description: "Should not run",
            toolCalls: [{ toolName: "llm_generate" }],
            dependsOn: [],
            mode: "auto",
          },
        ],
        totalSteps: plan.totalSteps + 1,
      },
      salesPipelinePlaybook,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Unknown step: surprise_step");
  });

  it("rejects tools outside the step allowlist", () => {
    const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);
    const result = validateExecutionPlanAgainstPlaybook(
      {
        ...plan,
        steps: plan.steps.map((step) =>
          step.id === "qualify"
            ? { ...step, toolCalls: [{ toolName: "code_execute" }] }
            : step,
        ),
      },
      salesPipelinePlaybook,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Step qualify uses disallowed tool: code_execute");
  });

  it("rejects review and manual playbook steps without approval", () => {
    const invalidPlaybook = {
      ...salesPipelinePlaybook,
      steps: salesPipelinePlaybook.steps.map((step) =>
        step.id === "human_review" ? { ...step, requiresApproval: false } : step,
      ),
    };
    const result = validateControlledPlaybook(invalidPlaybook);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Step human_review must require approval");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/sales-pipeline.test.ts src/__tests__/lib/executor/playbooks/validator.test.ts
```

Expected: FAIL because resolver and validator files do not exist.

- [ ] **Step 4: Add catalog**

Create `src/lib/executor/playbooks/catalog.ts`:

```ts
import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import type { ControlledPlaybook } from "@/lib/executor/playbooks/types";

const controlledPlaybooks: ControlledPlaybook[] = [salesPipelinePlaybook];

export function listControlledPlaybooks() {
  return controlledPlaybooks;
}

export function getControlledPlaybook(playbookId: string) {
  return controlledPlaybooks.find((playbook) => playbook.id === playbookId) ?? null;
}

export function getControlledPlaybookForScenario(scenarioId: string) {
  return controlledPlaybooks.find((playbook) => playbook.scenarioId === scenarioId) ?? null;
}
```

- [ ] **Step 5: Add resolver**

Create `src/lib/executor/playbooks/resolver.ts`:

```ts
import type { ExecutionPlan, ExecutionStep } from "@/lib/executor/contracts";
import type { ControlledPlaybook } from "@/lib/executor/playbooks/types";

function buildPlanId(playbook: ControlledPlaybook) {
  return `playbook:${playbook.id}:${playbook.version}`;
}

export function resolveExecutionPlanFromPlaybook(playbook: ControlledPlaybook): ExecutionPlan {
  const steps: ExecutionStep[] = playbook.steps.map((step, index) => ({
    id: step.id,
    title: step.title,
    description: [
      step.purpose,
      "",
      "Acceptance criteria:",
      ...step.acceptanceCriteria.map((item) => `- ${item}`),
    ].join("\n"),
    toolCalls:
      step.toolCalls && step.toolCalls.length > 0
        ? step.toolCalls
        : step.allowedTools.slice(0, 1).map((toolName) => ({ toolName })),
    dependsOn: index > 0 ? [playbook.steps[index - 1].id] : [],
    mode: step.mode,
  }));

  return {
    id: buildPlanId(playbook),
    goal: playbook.title,
    steps,
    totalSteps: steps.length,
    requiresApproval: playbook.steps.some((step) => step.requiresApproval),
  };
}
```

- [ ] **Step 6: Add validator**

Create `src/lib/executor/playbooks/validator.ts`:

```ts
import type { ExecutionPlan } from "@/lib/executor/contracts";
import { getTool } from "@/lib/executor/tools";
import type { ControlledPlaybook } from "@/lib/executor/playbooks/types";

export type ControlledPlanValidationResult = {
  valid: boolean;
  errors: string[];
};

function hasObjectSchema(schema: unknown) {
  return Boolean(
    schema &&
      typeof schema === "object" &&
      (schema as { type?: unknown }).type === "object",
  );
}

export function validateExecutionPlanAgainstPlaybook(
  plan: ExecutionPlan,
  playbook: ControlledPlaybook,
): ControlledPlanValidationResult {
  const errors: string[] = [];
  const stepById = new Map(playbook.steps.map((step) => [step.id, step]));

  if (plan.totalSteps !== plan.steps.length) {
    errors.push(`Plan totalSteps ${plan.totalSteps} does not match step count ${plan.steps.length}`);
  }

  for (const step of plan.steps) {
    const contract = stepById.get(step.id);
    if (!contract) {
      errors.push(`Unknown step: ${step.id}`);
      continue;
    }

    if (!hasObjectSchema(contract.inputSchema)) {
      errors.push(`Step ${step.id} is missing object input schema`);
    }
    if (!hasObjectSchema(contract.outputSchema)) {
      errors.push(`Step ${step.id} is missing object output schema`);
    }

    if ((contract.mode === "review" || contract.mode === "manual") && !contract.requiresApproval) {
      errors.push(`Step ${step.id} must require approval`);
    }

    const allowedTools = new Set(contract.allowedTools);
    const forbiddenTools = new Set(contract.forbiddenTools ?? []);
    for (const toolCall of step.toolCalls) {
      if (!allowedTools.has(toolCall.toolName)) {
        errors.push(`Step ${step.id} uses disallowed tool: ${toolCall.toolName}`);
      }
      if (forbiddenTools.has(toolCall.toolName)) {
        errors.push(`Step ${step.id} uses forbidden tool: ${toolCall.toolName}`);
      }
      if (!getTool(toolCall.toolName)) {
        errors.push(`Step ${step.id} references unknown tool: ${toolCall.toolName}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateControlledPlaybook(
  playbook: ControlledPlaybook,
): ControlledPlanValidationResult {
  const errors: string[] = [];
  const seenStepIds = new Set<string>();

  for (const step of playbook.steps) {
    if (seenStepIds.has(step.id)) {
      errors.push(`Duplicate step id: ${step.id}`);
    }
    seenStepIds.add(step.id);

    if ((step.mode === "review" || step.mode === "manual") && !step.requiresApproval) {
      errors.push(`Step ${step.id} must require approval`);
    }
    if (!hasObjectSchema(step.inputSchema)) {
      errors.push(`Step ${step.id} is missing object input schema`);
    }
    if (!hasObjectSchema(step.outputSchema)) {
      errors.push(`Step ${step.id} is missing object output schema`);
    }
    if (step.allowedTools.length === 0) {
      errors.push(`Step ${step.id} must allow at least one tool`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/sales-pipeline.test.ts src/__tests__/lib/executor/playbooks/validator.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/executor/playbooks src/__tests__/lib/executor/playbooks
git commit -m "feat: resolve and validate controlled playbooks"
```

---

### Task 3: Let The Executor Run Explicit Controlled Plans

**Files:**

- Modify: `src/lib/executor/contracts.ts`
- Modify: `src/lib/executor/core.ts`
- Test: `src/__tests__/lib/executor/controlled-runtime.test.ts`

- [ ] **Step 1: Write failing controlled executor test**

Create `src/__tests__/lib/executor/controlled-runtime.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { runMultiStepTask } from "@/lib/executor/core";
import { resolveExecutionPlanFromPlaybook } from "@/lib/executor/playbooks/resolver";
import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import type { AgentCoreTaskRequest, ExecutionCallbacks } from "@/lib/executor/contracts";

function buildRequest(): AgentCoreTaskRequest {
  return {
    taskInput: { userMessage: "Execute controlled sales pipeline" },
    session: { id: "test-sales-session" },
    metadata: { requestId: "controlled-runtime-test", source: "test" },
    context: {
      systemPrompt: "",
      workspace: { activeScenarioId: "sales-pipeline" },
    },
    skillPolicy: { enabled: false, mode: "off" },
    executionPolicy: {
      timeoutSeconds: 30,
      maxAttempts: 1,
      retryBackoffMs: 0,
      allowFallbackToOpenClaw: false,
    },
    multiStep: {
      enabled: true,
      maxSteps: 5,
      approvalMode: "none",
    },
    controlledPlaybookId: "sales-pipeline-v1",
    controlledPlan: {
      ...resolveExecutionPlanFromPlaybook(salesPipelinePlaybook),
      steps: resolveExecutionPlanFromPlaybook(salesPipelinePlaybook).steps.map((step) => ({
        ...step,
        toolCalls: [],
      })),
    },
  };
}

function buildCallbacks() {
  const events: string[] = [];
  const callbacks: ExecutionCallbacks = {
    onPlanReady(plan) {
      events.push(`plan:${plan.id}`);
    },
    onStepStart(step) {
      events.push(`start:${step.id}`);
    },
    onStepProgress() {},
    onStepComplete(result) {
      events.push(`complete:${result.stepId}:${result.status}`);
    },
    onAwaitingApproval(step) {
      events.push(`approval:${step.id}`);
    },
    waitForApproval: vi.fn(async () => ({ approved: true })),
    onError(error) {
      events.push(`error:${error}`);
    },
  };
  return { callbacks, events };
}

describe("controlled runtime execution", () => {
  it("uses the supplied controlled plan instead of invoking planner fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ text: "{}" }),
      })),
    );
    const request = buildRequest();
    const { callbacks, events } = buildCallbacks();

    const result = await runMultiStepTask(request, callbacks);

    expect(result.trace.plan.id).toBe("playbook:sales-pipeline-v1:1.0.0");
    expect(result.trace.plan.steps.map((step) => step.id)).toEqual([
      "intake",
      "qualify",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
    expect(events[0]).toBe("plan:playbook:sales-pipeline-v1:1.0.0");
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/controlled-runtime.test.ts
```

Expected: FAIL because `controlledPlan` and `controlledPlaybookId` are not yet part of `AgentCoreTaskRequest`.

- [ ] **Step 3: Add controlled plan fields to contracts**

Modify `src/lib/executor/contracts.ts`.

Add these optional fields to `AgentCoreTaskRequest`:

```ts
  controlledPlaybookId?: string;
  controlledPlan?: ExecutionPlan;
```

The resulting type should include:

```ts
export type AgentCoreTaskRequest = {
  taskInput: AgentCoreTaskInput;
  session: AgentCoreSessionRef;
  metadata: AgentCoreExecutionMetadata;
  context: AgentCoreExecutionContext;
  skillPolicy: AgentCoreSkillPolicy;
  modelConfig?: AgentCoreExecutorLlmConfig | null;
  fallbackModelConfigs?: AgentCoreExecutorLlmConfig[];
  executionPolicy: AgentCoreExecutionPolicy;
  multiStep?: AgentCoreMultiStepPolicy;
  controlledPlaybookId?: string;
  controlledPlan?: ExecutionPlan;
};
```

Add these optional fields to `AgentCoreLegacyTaskRequest`:

```ts
  controlledPlaybookId?: string;
  controlledPlan?: ExecutionPlan;
```

Inside `normalizeAgentCoreTaskRequest`, copy them into the returned object:

```ts
    controlledPlaybookId:
      typeof input.controlledPlaybookId === "string" && input.controlledPlaybookId.trim()
        ? input.controlledPlaybookId.trim()
        : undefined,
    controlledPlan: input.controlledPlan,
```

- [ ] **Step 4: Use explicit plan before LLM planner**

Modify `runMultiStepTask` in `src/lib/executor/core.ts`.

Replace:

```ts
  const plan = await planSteps(normalizedRequest, callLlm);
```

with:

```ts
  const plan = normalizedRequest.controlledPlan ?? await planSteps(normalizedRequest, callLlm);
```

Keep the existing empty-plan failure block unchanged.

- [ ] **Step 5: Run the controlled runtime test**

Run:

```bash
npm test -- src/__tests__/lib/executor/controlled-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run related executor tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/step-executor.test.ts src/__tests__/lib/executor/planner.test.ts src/__tests__/lib/executor/controlled-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/executor/contracts.ts src/lib/executor/core.ts src/__tests__/lib/executor/controlled-runtime.test.ts
git commit -m "feat: execute supplied controlled plans"
```

---

### Task 4: Wire Stream Route And Workflow Runner To Controlled Playbooks

**Files:**

- Modify: `src/app/api/agent/stream/route.ts`
- Modify: `src/lib/executor/run-workflow-multi-step.ts`
- Test: `src/__tests__/lib/executor/run-workflow-multi-step.test.ts`

- [ ] **Step 1: Add a failing workflow runner payload test**

Modify `src/__tests__/lib/executor/run-workflow-multi-step.test.ts`.

Add this helper below `makeScenario`:

```ts
function makeSalesScenario(): WorkspaceScenario {
  return {
    ...makeScenario(5),
    id: "sales-pipeline",
    title: "Sales Pipeline Desk",
  } as WorkspaceScenario;
}
```

Add this test inside the existing `describe("runWorkflowMultiStep", ...)` block:

```ts
it("sends controlled playbook identity for eligible workflow scenarios", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    body: {
      getReader: () => ({
        read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
      }),
    },
  });
  global.fetch = fetchMock;

  await runWorkflowMultiStep({
    runId: "run-sales-1",
    scenario: makeSalesScenario(),
  });

  const [, init] = fetchMock.mock.calls[0];
  expect(JSON.parse(String(init.body))).toMatchObject({
    workflowRunId: "run-sales-1",
    scenarioId: "sales-pipeline",
    playbookId: "sales-pipeline-v1",
    approvalMode: "each-review-step",
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/run-workflow-multi-step.test.ts
```

Expected: FAIL because `runWorkflowMultiStep` does not send `scenarioId` or `playbookId`.

- [ ] **Step 3: Resolve controlled playbook in client workflow runner**

Modify `src/lib/executor/run-workflow-multi-step.ts`.

Add import:

```ts
import { getControlledPlaybookForScenario } from "@/lib/executor/playbooks/catalog";
```

Inside `runWorkflowMultiStep`, after `const steps = workflowStagesToExecutionSteps(...)`, add:

```ts
  const controlledPlaybook = getControlledPlaybookForScenario(scenario.id);
```

Change the request body to:

```ts
      body: JSON.stringify({
        message: `Execute workflow: ${scenario.title}`,
        workflowRunId: runId,
        scenarioId: scenario.id,
        playbookId: controlledPlaybook?.id,
        maxSteps: controlledPlaybook?.steps.length ?? steps.length,
        approvalMode: "each-review-step",
      }),
```

- [ ] **Step 4: Resolve and validate controlled playbook in stream route**

Modify `src/app/api/agent/stream/route.ts`.

Add imports:

```ts
import { getControlledPlaybook, getControlledPlaybookForScenario } from "@/lib/executor/playbooks/catalog";
import { resolveExecutionPlanFromPlaybook } from "@/lib/executor/playbooks/resolver";
import {
  validateControlledPlaybook,
  validateExecutionPlanAgainstPlaybook,
} from "@/lib/executor/playbooks/validator";
```

After `normalized.multiStep = ...`, add:

```ts
  const playbookId = typeof body.playbookId === "string" ? body.playbookId.trim() : "";
  const scenarioId = typeof body.scenarioId === "string" ? body.scenarioId.trim() : "";
  const controlledPlaybook =
    (playbookId ? getControlledPlaybook(playbookId) : null) ??
    (scenarioId ? getControlledPlaybookForScenario(scenarioId) : null);

  if (controlledPlaybook) {
    const controlledPlan = resolveExecutionPlanFromPlaybook(controlledPlaybook);
    const playbookValidation = validateControlledPlaybook(controlledPlaybook);
    const planValidation = validateExecutionPlanAgainstPlaybook(controlledPlan, controlledPlaybook);
    const validation = {
      valid: playbookValidation.valid && planValidation.valid,
      errors: [...playbookValidation.errors, ...planValidation.errors],
    };
    if (!validation.valid) {
      return NextResponse.json(
        { ok: false, error: "Invalid controlled playbook plan", details: validation.errors },
        { status: 400 },
      );
    }
    normalized.controlledPlaybookId = controlledPlaybook.id;
    normalized.controlledPlan = controlledPlan;
    normalized.multiStep.maxSteps = controlledPlan.totalSteps;
  }
```

- [ ] **Step 5: Run workflow runner test**

Run:

```bash
npm test -- src/__tests__/lib/executor/run-workflow-multi-step.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run controlled runtime tests together**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/sales-pipeline.test.ts src/__tests__/lib/executor/playbooks/validator.test.ts src/__tests__/lib/executor/controlled-runtime.test.ts src/__tests__/lib/executor/run-workflow-multi-step.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/agent/stream/route.ts src/lib/executor/run-workflow-multi-step.ts src/__tests__/lib/executor/run-workflow-multi-step.test.ts
git commit -m "feat: route workflows through controlled playbooks"
```

---

### Task 5: Add Controlled Runtime Regression Command And Documentation Link

**Files:**

- Modify: `package.json`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`

- [ ] **Step 1: Add the package script**

Modify `package.json` scripts:

```json
"test:controlled-runtime": "vitest run src/__tests__/lib/executor/playbooks/sales-pipeline.test.ts src/__tests__/lib/executor/playbooks/validator.test.ts src/__tests__/lib/executor/controlled-runtime.test.ts src/__tests__/lib/executor/run-workflow-multi-step.test.ts"
```

Place it near the existing `test:*` commands.

- [ ] **Step 2: Run the new command**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS.

- [ ] **Step 3: Update the manual test command section**

Modify [docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md](../../CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md).

Replace:

```bash
npm run test:controlled-runtime
```

with:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
```

Add this note below the command block:

```md
`test:controlled-runtime` 是第一阶段的最小门禁，覆盖 sales playbook、plan validator、显式 controlled plan 执行和 workflow runner 请求收口。
```

- [ ] **Step 4: Run stability subset**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md
git commit -m "test: add controlled runtime regression gate"
```

---

## Final Verification

After all tasks are complete, run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
```

Expected:

- `test:controlled-runtime`: PASS
- `test:core-workflows`: PASS
- `lint`: PASS

If time allows before merge, also run:

```bash
npm run build
```

Expected: PASS.

## Review Checklist

- `sales-pipeline` has deterministic step ids.
- `review` and `manual` steps cannot be represented as non-approval playbook steps.
- Controlled plans bypass LLM planner by using `normalizedRequest.controlledPlan`.
- `/api/agent/stream` validates controlled plans before execution.
- `runWorkflowMultiStep` sends `playbookId` and `scenarioId`.
- No new external dependency is added.
- No new UI surface is added.
- Existing LLM planner remains available only as fallback for non-controlled requests.

## Known Follow-Up Work

These are intentionally deferred:

- Durable approval store.
- Durable trace store.
- JSON Schema validation of actual tool/model outputs.
- Asset writeback enforcement for `sales_asset` and `knowledge_asset`.
- Runtime console UI for controlled playbook traces.
