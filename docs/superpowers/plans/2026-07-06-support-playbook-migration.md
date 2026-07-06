# Support Playbook Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `support-resolution-v1` as the second controlled playbook and make approved support runs write durable workflow, draft, support asset, and knowledge asset records.

**Architecture:** Follow the existing sales controlled runtime path. Add one support playbook, register it in the catalog, extend writeback with support-specific builders, then widen Runtime Console landing summaries to include `support_asset` without creating a new console panel.

**Tech Stack:** TypeScript, Vitest, Next.js, existing JSON-backed stores, existing controlled runtime executor.

---

Spec: [Support Playbook Migration Design](../specs/2026-07-06-support-playbook-migration-design.md)

## File Structure

Create:

- `src/lib/executor/playbooks/support-resolution.ts`
  - Defines `supportResolutionPlaybook`.

- `src/__tests__/lib/executor/playbooks/support-resolution.test.ts`
  - Covers support playbook shape, catalog lookup, approval gates, schemas, and deterministic plan conversion.

Modify:

- `src/lib/executor/playbooks/catalog.ts`
  - Register support playbook.

- `src/lib/executor/runtime/writeback.ts`
  - Add support asset writeback.
  - Branch knowledge asset and draft labels for support.
  - Keep sales behavior unchanged.

- `src/lib/executor/runtime/console-summary.ts`
  - Add `support_asset` landing label and `support_copilot` app id.

- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
  - Route support asset landings to `requestOpenSupportCopilot`.

- `src/__tests__/lib/executor/runtime/writeback.test.ts`
  - Add support writeback unit coverage.

- `src/__tests__/lib/executor/controlled-runtime.test.ts`
  - Add support controlled runtime integration coverage.

- `src/__tests__/lib/executor/runtime/console-summary.test.ts`
  - Add support asset landing/search coverage.

- `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`
  - Add support asset open action coverage.

- `package.json`
  - Add support playbook test to `test:controlled-runtime`.

Docs after implementation:

- `CHANGELOG.md`
- `docs/NEXT_STEPS.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `memory/2026-07-06.md`

## Task 1: Support Playbook And Catalog

**Files:**

- Create: `src/__tests__/lib/executor/playbooks/support-resolution.test.ts`
- Create: `src/lib/executor/playbooks/support-resolution.ts`
- Modify: `src/lib/executor/playbooks/catalog.ts`

- [ ] **Step 1: Write failing support playbook test**

Create `src/__tests__/lib/executor/playbooks/support-resolution.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  getControlledPlaybook,
  getControlledPlaybookForScenario,
} from "@/lib/executor/playbooks/catalog";
import { resolveExecutionPlanFromPlaybook } from "@/lib/executor/playbooks/resolver";
import { supportResolutionPlaybook } from "@/lib/executor/playbooks/support-resolution";

describe("supportResolutionPlaybook", () => {
  it("defines the stable support controlled runtime workflow", () => {
    expect(supportResolutionPlaybook.id).toBe("support-resolution-v1");
    expect(supportResolutionPlaybook.scenarioId).toBe("support-ops");
    expect(supportResolutionPlaybook.resultAssets).toEqual([
      "support_asset",
      "knowledge_asset",
      "draft",
      "workflow_run",
    ]);
    expect(supportResolutionPlaybook.steps.map((step) => step.id)).toEqual([
      "intake",
      "classify",
      "draft_reply",
      "human_review",
      "writeback",
    ]);
  });

  it("registers in the controlled playbook catalog", () => {
    expect(getControlledPlaybook("support-resolution-v1")).toBe(supportResolutionPlaybook);
    expect(getControlledPlaybookForScenario("support-ops")).toBe(supportResolutionPlaybook);
  });

  it("keeps review and manual stages behind approval", () => {
    const approvalSteps = supportResolutionPlaybook.steps.filter((step) => step.requiresApproval);
    expect(approvalSteps.map((step) => step.id)).toEqual(["human_review", "writeback"]);
    expect(
      supportResolutionPlaybook.steps
        .filter((step) => step.mode === "review" || step.mode === "manual")
        .every((step) => step.requiresApproval),
    ).toBe(true);
  });

  it("declares schemas and allowed tools for every step", () => {
    for (const step of supportResolutionPlaybook.steps) {
      expect(step.inputSchema).toMatchObject({ type: "object" });
      expect(step.outputSchema).toMatchObject({ type: "object" });
      expect(step.allowedTools.length).toBeGreaterThan(0);
      expect(step.acceptanceCriteria.length).toBeGreaterThan(0);
    }
  });

  it("converts the playbook into a deterministic execution plan", () => {
    const plan = resolveExecutionPlanFromPlaybook(supportResolutionPlaybook);

    expect(plan.goal).toBe("Support Resolution Controlled Runtime");
    expect(plan.totalSteps).toBe(5);
    expect(plan.requiresApproval).toBe(true);
    expect(plan.steps.map((step) => step.id)).toEqual([
      "intake",
      "classify",
      "draft_reply",
      "human_review",
      "writeback",
    ]);
    expect(plan.steps[1].dependsOn).toEqual(["intake"]);
    expect(plan.steps[3].mode).toBe("review");
    expect(plan.steps[4].mode).toBe("manual");
  });
});
```

- [ ] **Step 2: Verify support playbook test fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/support-resolution.test.ts
```

Expected: FAIL because `@/lib/executor/playbooks/support-resolution` does not exist.

- [ ] **Step 3: Add support playbook**

Create `src/lib/executor/playbooks/support-resolution.ts`:

```ts
import type { ControlledPlaybook } from "@/lib/executor/playbooks/types";

const issueInputProperties = {
  customer: { type: "string" },
  channel: { type: "string" },
  subject: { type: "string" },
  issue: { type: "string" },
  orderId: { type: "string" },
  productLine: { type: "string" },
  language: { type: "string" },
};

export const supportResolutionPlaybook: ControlledPlaybook = {
  id: "support-resolution-v1",
  title: "Support Resolution Controlled Runtime",
  scenarioId: "support-ops",
  version: "1.0.0",
  triggerTypes: ["inbound_message", "manual"],
  resultAssets: ["support_asset", "knowledge_asset", "draft", "workflow_run"],
  steps: [
    {
      id: "intake",
      title: "收集客户问题",
      mode: "assist",
      purpose: "把客服消息整理成后续步骤可消费的结构化问题上下文。",
      inputSchema: {
        type: "object",
        properties: issueInputProperties,
        additionalProperties: true,
      },
      outputSchema: {
        type: "object",
        required: ["summary", "missingFields", "normalizedIssue"],
        properties: {
          summary: { type: "string" },
          missingFields: { type: "array", items: { type: "string" } },
          normalizedIssue: { type: "object", properties: issueInputProperties },
        },
        additionalProperties: false,
      },
      allowedTools: ["llm_generate", "human_ask"],
      requiresApproval: false,
      acceptanceCriteria: [
        "输出必须列出缺失字段。",
        "不得编造订单、承诺、退款或 SLA。",
        "必须保留客户、渠道和原始问题主题。",
      ],
      toolCalls: [{ toolName: "llm_generate" }],
      writesTo: [{ target: "workflow_run", when: "on_success" }],
      onFailure: { action: "await_human" },
    },
    {
      id: "classify",
      title: "分类问题和风险",
      mode: "assist",
      purpose: "判断问题类型、优先级、风险和缺失信息。",
      inputSchema: {
        type: "object",
        required: ["normalizedIssue"],
        properties: {
          normalizedIssue: { type: "object", properties: issueInputProperties },
          missingFields: { type: "array", items: { type: "string" } },
        },
        additionalProperties: true,
      },
      outputSchema: {
        type: "object",
        required: ["category", "priority", "risks", "nextAction"],
        properties: {
          category: { type: "string" },
          priority: { enum: ["urgent", "high", "normal", "low", "blocked"] },
          risks: { type: "array", items: { type: "string" } },
          missingInfo: { type: "array", items: { type: "string" } },
          nextAction: { type: "string" },
        },
        additionalProperties: false,
      },
      allowedTools: ["llm_generate", "knowledge_search"],
      requiresApproval: false,
      acceptanceCriteria: [
        "必须给出问题分类和优先级。",
        "必须列出风险和缺失信息。",
        "退款、赔付、法律、公开投诉类问题必须标记风险。",
      ],
      toolCalls: [{ toolName: "llm_generate" }],
      writesTo: [{ target: "support_asset", when: "on_success" }],
      onFailure: { action: "await_human" },
    },
    {
      id: "draft_reply",
      title: "生成客服回复草稿",
      mode: "assist",
      purpose: "生成可供人工审核的客服回复草稿。",
      inputSchema: {
        type: "object",
        required: ["normalizedIssue", "category", "priority", "nextAction"],
        properties: {
          normalizedIssue: { type: "object", properties: issueInputProperties },
          category: { type: "string" },
          priority: { type: "string" },
          nextAction: { type: "string" },
        },
        additionalProperties: true,
      },
      outputSchema: {
        type: "object",
        required: ["subject", "body", "tone", "needsHumanCheck"],
        properties: {
          subject: { type: "string" },
          body: { type: "string" },
          tone: { type: "string" },
          assumptions: { type: "array", items: { type: "string" } },
          needsHumanCheck: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
      allowedTools: ["llm_generate", "knowledge_search"],
      requiresApproval: false,
      acceptanceCriteria: [
        "回复不得承诺未确认退款、赔付、交期或政策例外。",
        "必须标出需要人工确认的内容。",
        "必须包含明确下一步动作。",
      ],
      toolCalls: [{ toolName: "llm_generate" }],
      writesTo: [{ target: "draft", when: "on_success" }],
      onFailure: { action: "await_human" },
    },
    {
      id: "human_review",
      title: "人工审核客服回复",
      mode: "review",
      purpose: "人工确认回复事实、语气、风险边界和下一步动作。",
      inputSchema: {
        type: "object",
        required: ["subject", "body"],
        properties: {
          subject: { type: "string" },
          body: { type: "string" },
          tone: { type: "string" },
          assumptions: { type: "array", items: { type: "string" } },
          needsHumanCheck: { type: "array", items: { type: "string" } },
        },
        additionalProperties: true,
      },
      outputSchema: {
        type: "object",
        required: ["approved", "approvedReply", "reviewNotes", "nextAction"],
        properties: {
          approved: { type: "boolean" },
          approvedReply: { type: "string" },
          reviewNotes: { type: "string" },
          nextAction: { type: "string" },
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
      title: "写回客服资产",
      mode: "manual",
      purpose: "把已批准客服处理结果写回 support asset 和 knowledge asset。",
      inputSchema: {
        type: "object",
        required: ["approved", "approvedReply"],
        properties: {
          approved: { type: "boolean" },
          approvedReply: { type: "string" },
          reviewNotes: { type: "string" },
          nextAction: { type: "string" },
        },
        additionalProperties: true,
      },
      outputSchema: {
        type: "object",
        required: ["supportAssetUpdated", "knowledgeAssetCandidate", "faqCandidate"],
        properties: {
          supportAssetUpdated: { type: "boolean" },
          knowledgeAssetCandidate: { type: "string" },
          faqCandidate: { type: "string" },
        },
        additionalProperties: false,
      },
      allowedTools: ["human_ask"],
      requiresApproval: true,
      acceptanceCriteria: [
        "只允许写回已批准内容。",
        "必须标记资产来源 workflowRunId。",
        "不得把未确认政策例外写入高信任知识资产。",
      ],
      toolCalls: [{ toolName: "human_ask" }],
      writesTo: [
        { target: "support_asset", when: "after_approval" },
        { target: "knowledge_asset", when: "after_approval" },
        { target: "workflow_run", when: "after_approval" },
      ],
      onFailure: { action: "fail_run" },
    },
  ],
};
```

- [ ] **Step 4: Register support playbook**

Update `src/lib/executor/playbooks/catalog.ts`:

```ts
import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import { supportResolutionPlaybook } from "@/lib/executor/playbooks/support-resolution";
import type { ControlledPlaybook } from "@/lib/executor/playbooks/types";

const controlledPlaybooks: ControlledPlaybook[] = [
  salesPipelinePlaybook,
  supportResolutionPlaybook,
];
```

- [ ] **Step 5: Verify support playbook test passes**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/support-resolution.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Commit support playbook**

```bash
git add src/lib/executor/playbooks/support-resolution.ts src/lib/executor/playbooks/catalog.ts src/__tests__/lib/executor/playbooks/support-resolution.test.ts
git commit -m "feat: add support controlled playbook"
```

## Task 2: Support Asset Writeback

**Files:**

- Modify: `src/__tests__/lib/executor/runtime/writeback.test.ts`
- Modify: `src/lib/executor/runtime/writeback.ts`

- [ ] **Step 1: Write failing support writeback tests**

In `src/__tests__/lib/executor/runtime/writeback.test.ts`:

1. Add imports:

```ts
import { supportResolutionPlaybook } from "@/lib/executor/playbooks/support-resolution";
import { listSupportAssetStoreSnapshot } from "@/lib/server/support-asset-store";
```

2. Add `makeSupportRun()`:

```ts
function makeSupportRun(): ControlledExecutionRunRecord {
  return {
    ...makeRun(),
    id: "support-run-1",
    requestId: "support-run-1",
    workflowRunId: "support-workflow-1",
    scenarioId: "support-ops",
    playbookId: "support-resolution-v1",
    planId: "support-plan-1",
    plan: {
      id: "support-plan-1",
      goal: "support resolution",
      totalSteps: 5,
      requiresApproval: true,
      steps: [],
    },
  };
}
```

3. Add support previous results:

```ts
const supportPreviousResults: StepResult[] = [
  {
    stepId: "intake",
    status: "completed",
    output: {
      summary: "Customer reports delayed delivery",
      missingFields: [],
      normalizedIssue: {
        customer: "Ada Customer",
        channel: "email",
        subject: "Delivery delay",
        issue: "Order has not arrived",
        orderId: "ORD-9",
        productLine: "uPVC windows",
        language: "en",
      },
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
  {
    stepId: "classify",
    status: "completed",
    output: {
      category: "delivery_delay",
      priority: "high",
      risks: ["SLA risk"],
      missingInfo: [],
      nextAction: "confirm logistics ETA",
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
  {
    stepId: "draft_reply",
    status: "completed",
    output: {
      subject: "Delivery update",
      body: "We are checking the latest delivery status and will update you shortly.",
      tone: "calm",
      assumptions: [],
      needsHumanCheck: ["Confirm ETA"],
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
  {
    stepId: "human_review",
    status: "completed",
    output: {
      approved: true,
      approvedReply: "Approved support reply",
      reviewNotes: "Do not promise refund",
      nextAction: "send update after logistics confirms ETA",
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
];

function makeSupportWritebackResult(): StepResult {
  return {
    stepId: "writeback",
    status: "completed",
    output: {
      supportAssetUpdated: true,
      knowledgeAssetCandidate: "Delay response guidance",
      faqCandidate: "If delivery is delayed, confirm ETA before promising compensation.",
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  };
}
```

4. Add test:

```ts
it("writes support asset target to the support asset store", async () => {
  const step = supportResolutionPlaybook.steps.find((item) => item.id === "classify")!;

  const receipts = await writeControlledStepAssets({
    run: makeSupportRun(),
    step,
    result: supportPreviousResults[1],
    previousResults: supportPreviousResults.slice(0, 1),
    approved: true,
  });

  expect(receipts).toEqual([
    expect.objectContaining({
      target: "support_asset",
      ok: true,
      assetId: "controlled-support-asset:support-workflow-1",
      sourceKey: "controlled-run:support-run-1:support_asset",
      workflowRunId: "support-workflow-1",
    }),
  ]);

  const snapshot = await listSupportAssetStoreSnapshot();
  expect(snapshot.supportAssets).toHaveLength(1);
  expect(snapshot.supportAssets[0]).toMatchObject({
    id: "controlled-support-asset:support-workflow-1",
    workflowRunId: "support-workflow-1",
    scenarioId: "support-ops",
    customer: "Ada Customer",
    channel: "email",
    issueSummary: "Customer reports delayed delivery",
    nextAction: "confirm logistics ETA",
    status: "replying",
  });
  expect(snapshot.supportAssets[0].latestDigest).toContain("delivery_delay");
  expect(snapshot.supportAssets[0].latestDigest).toContain("SLA risk");
});
```

5. Add final writeback/idempotency test:

```ts
it("writes approved final support output to support and knowledge assets idempotently", async () => {
  const step = supportResolutionPlaybook.steps.find((item) => item.id === "writeback")!;

  await writeControlledStepAssets({
    run: makeSupportRun(),
    step,
    result: makeSupportWritebackResult(),
    previousResults: supportPreviousResults,
    approved: true,
  });
  const receipts = await writeControlledStepAssets({
    run: makeSupportRun(),
    step,
    result: makeSupportWritebackResult(),
    previousResults: supportPreviousResults,
    approved: true,
  });

  expect(receipts.map((receipt) => receipt.target)).toEqual([
    "support_asset",
    "knowledge_asset",
    "workflow_run",
  ]);
  expect(receipts.every((receipt) => receipt.ok)).toBe(true);

  const supportSnapshot = await listSupportAssetStoreSnapshot();
  expect(supportSnapshot.supportAssets).toHaveLength(1);
  expect(supportSnapshot.supportAssets[0]).toMatchObject({
    id: "controlled-support-asset:support-workflow-1",
    workflowRunId: "support-workflow-1",
    latestReply: "Approved support reply",
    faqDraft: "If delivery is delayed, confirm ETA before promising compensation.",
    status: "completed",
  });

  const knowledgeSnapshot = await listKnowledgeAssetStoreSnapshot();
  expect(knowledgeSnapshot.knowledgeAssets).toHaveLength(1);
  expect(knowledgeSnapshot.knowledgeAssets[0]).toMatchObject({
    sourceKey: "controlled-run:support-run-1:knowledge_asset",
    workflowRunId: "support-workflow-1",
    assetType: "support_faq",
    status: "active",
  });
  expect(knowledgeSnapshot.knowledgeAssets[0].body).toContain("Delay response guidance");
});
```

- [ ] **Step 2: Verify support writeback tests fail**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts
```

Expected: FAIL because `support_asset` is skipped as unsupported.

- [ ] **Step 3: Implement support writeback**

In `src/lib/executor/runtime/writeback.ts`:

1. Import support store:

```ts
import { upsertSupportAssetInStore } from "@/lib/server/support-asset-store";
```

2. Add helpers:

```ts
function isSupportPlaybook(input: WriteControlledStepAssetsInput) {
  return input.run.playbookId === "support-resolution-v1" || scenarioIdFor(input.run) === "support-ops";
}

function buildSupportAssetInput(input: WriteControlledStepAssetsInput) {
  const allResults = [...input.previousResults, input.result];
  const intake = outputFor(allResults, "intake");
  const normalizedIssue = isRecord(intake.normalizedIssue) ? intake.normalizedIssue : {};
  const classify = outputFor(allResults, "classify");
  const draft = outputFor(allResults, "draft_reply");
  const review = outputFor(allResults, "human_review");
  const finalOutput = isRecord(input.result.output) ? input.result.output : {};
  const workflowRunId = workflowRunIdFor(input.run);
  const risks = stringList(classify.risks);
  const missingInfo = stringList(classify.missingInfo);
  const latestDigest = [
    stringValue(classify.category) ? `Category: ${stringValue(classify.category)}` : "",
    stringValue(classify.priority) ? `Priority: ${stringValue(classify.priority)}` : "",
    risks.length ? `Risks: ${risks.join("; ")}` : "",
    missingInfo.length ? `Missing info: ${missingInfo.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const approvedReply = stringValue(review.approvedReply);
  const now = Date.now();

  return {
    id: stableId("controlled-support-asset", workflowRunId),
    workflowRunId,
    scenarioId: scenarioIdFor(input.run),
    customer: stringValue(normalizedIssue.customer),
    channel: stringValue(normalizedIssue.channel),
    issueSummary:
      stringValue(intake.summary) || stringValue(normalizedIssue.issue) || stringValue(draft.body),
    latestDigest,
    latestReply: approvedReply || stringValue(draft.body),
    escalationTask: risks.join("\n"),
    faqDraft: stringValue(finalOutput.faqCandidate),
    nextAction: stringValue(review.nextAction) || stringValue(classify.nextAction),
    status: input.step?.id === "writeback" ? "completed" : "replying",
    createdAt: now,
    updatedAt: now,
  };
}
```

3. Add support knowledge branch inside `buildKnowledgeAssetInput(input)` before returning:

```ts
  if (isSupportPlaybook(input)) {
    const supportIssue = outputFor(allResults, "intake");
    const normalizedIssue = isRecord(supportIssue.normalizedIssue) ? supportIssue.normalizedIssue : {};
    const classify = outputFor(allResults, "classify");
    const review = outputFor(allResults, "human_review");
    const finalOutput = isRecord(input.result.output) ? input.result.output : {};
    const customer = stringValue(normalizedIssue.customer);
    const approvedReply = stringValue(review.approvedReply);
    const faqCandidate = stringValue(finalOutput.faqCandidate);
    const knowledgeCandidate = stringValue(finalOutput.knowledgeAssetCandidate);
    const now = Date.now();

    return {
      id: stableId("controlled-knowledge-asset", input.run.id),
      sourceKey,
      title: `Support playbook asset - ${customer || input.run.id}`,
      body: [
        knowledgeCandidate,
        faqCandidate,
        approvedReply ? `Approved reply: ${approvedReply}` : "",
        stringValue(classify.category) ? `Category: ${stringValue(classify.category)}` : "",
        stringValue(review.reviewNotes) ? `Review notes: ${stringValue(review.reviewNotes)}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      sourceApp: "support_copilot",
      scenarioId: scenarioIdFor(input.run),
      workflowRunId,
      assetType: "support_faq",
      status: "active",
      tags: ["controlled-run", "support-ops", input.run.playbookId],
      applicableScene: "support reply / FAQ reuse / escalation boundary",
      reuseCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }
```

4. Add writer:

```ts
async function writeSupportAsset(input: WriteControlledStepAssetsInput, writtenAt: number) {
  const payload = buildSupportAssetInput(input);
  const result = await upsertSupportAssetInStore(payload);
  const stored = result.supportAsset;
  if (!stored) {
    return {
      target: "support_asset",
      ok: false,
      summary: "Failed to write support asset",
      writtenAt,
    } satisfies ControlledWritebackReceipt;
  }
  return {
    target: "support_asset",
    ok: true,
    summary: `Wrote support asset ${stored.id} for workflow ${stored.workflowRunId}`,
    writtenAt,
    assetId: stored.id,
    sourceKey: `controlled-run:${input.run.id}:support_asset`,
    workflowRunId: stored.workflowRunId,
  } satisfies ControlledWritebackReceipt;
}
```

5. Add dispatch before knowledge:

```ts
      if (target.target === "support_asset") {
        receipts.push(await writeSupportAsset(input, writtenAt));
      } else if (target.target === "sales_asset") {
```

- [ ] **Step 4: Verify support writeback tests pass**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit support writeback**

```bash
git add src/lib/executor/runtime/writeback.ts src/__tests__/lib/executor/runtime/writeback.test.ts
git commit -m "feat: write support controlled assets"
```

## Task 3: Support Controlled Runtime Integration

**Files:**

- Modify: `src/__tests__/lib/executor/controlled-runtime.test.ts`

- [ ] **Step 1: Write failing support controlled runtime integration test**

In `src/__tests__/lib/executor/controlled-runtime.test.ts`:

1. Import support playbook:

```ts
import { supportResolutionPlaybook } from "@/lib/executor/playbooks/support-resolution";
```

2. Extend registered tools with support output branches:

```ts
    if (prompt.includes("把客服消息整理")) {
      output = {
        summary: "Support request from Ada",
        missingFields: [],
        normalizedIssue: {
          customer: "Ada Customer",
          channel: "email",
          subject: "Delivery delay",
          issue: "Order has not arrived",
          orderId: "ORD-9",
          productLine: "uPVC windows",
          language: "en",
        },
      };
    } else if (prompt.includes("判断问题类型")) {
      output = {
        category: "delivery_delay",
        priority: "high",
        risks: ["SLA risk"],
        missingInfo: [],
        nextAction: "Confirm logistics ETA",
      };
    } else if (prompt.includes("生成可供人工审核的客服回复")) {
      output = {
        subject: "Delivery update",
        body: "We are checking logistics and will update you shortly.",
        tone: "calm",
        assumptions: [],
        needsHumanCheck: ["Confirm ETA"],
      };
    }
```

3. Extend `human_ask` output:

```ts
      output: prompt.includes("把已批准客服处理结果写回")
        ? {
            supportAssetUpdated: true,
            knowledgeAssetCandidate: "Support FAQ candidate",
            faqCandidate: "Confirm ETA before promising compensation.",
          }
        : prompt.includes("人工确认回复事实")
          ? {
              approved: true,
              approvedReply: "Approved support reply",
              reviewNotes: "No refund promise",
              nextAction: "Send ETA update",
            }
          : prompt.includes("把已批准结果写回")
            ? {
                salesAssetUpdated: true,
                knowledgeAssetCandidate: "Approved outreach content",
              }
            : {
                approved: true,
                approvedBody: "Approved outreach body",
                reviewNotes: "Looks good",
              },
```

4. Add request builder:

```ts
function buildSupportRequest(): AgentCoreTaskRequest {
  const plan = resolveExecutionPlanFromPlaybook(supportResolutionPlaybook);
  return {
    ...buildRequest(),
    taskInput: { userMessage: "Execute controlled support resolution" },
    session: { id: "test-support-session" },
    metadata: { requestId: "controlled-support-runtime-test", source: "test" },
    context: {
      systemPrompt: "",
      workspace: { activeScenarioId: "support-ops" },
    },
    multiStep: {
      enabled: true,
      maxSteps: 5,
      approvalMode: "none",
    },
    controlledPlaybookId: "support-resolution-v1",
    controlledPlan: plan,
  };
}
```

5. Add test:

```ts
it("executes support controlled playbook and writes support records", async () => {
  vi.stubGlobal("fetch", vi.fn());
  const { getControlledExecutionRun } = await import(
    "@/lib/server/controlled-execution-store"
  );
  const { listSupportAssetStoreSnapshot } = await import(
    "@/lib/server/support-asset-store"
  );
  const { listKnowledgeAssetStoreSnapshot } = await import(
    "@/lib/server/knowledge-asset-store"
  );
  const { listWorkflowRunStoreSnapshot } = await import(
    "@/lib/server/workflow-run-store"
  );
  const { listDraftStoreSnapshot } = await import("@/lib/server/draft-store");
  const request = buildSupportRequest();
  const { callbacks } = buildCallbacks();

  const result = await runMultiStepTask(request, callbacks);
  const run = await getControlledExecutionRun(request.metadata.requestId);

  expect(result.ok).toBe(true);
  expect(run?.playbookId).toBe("support-resolution-v1");
  expect(run?.steps.map((step) => step.stepId)).toEqual([
    "intake",
    "classify",
    "draft_reply",
    "human_review",
    "writeback",
  ]);
  expect(run?.steps.find((step) => step.stepId === "classify")?.writebackReceipts).toEqual([
    expect.objectContaining({ target: "support_asset", ok: true }),
  ]);
  expect(run?.steps.find((step) => step.stepId === "writeback")?.writebackReceipts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ target: "support_asset", ok: true }),
      expect.objectContaining({ target: "knowledge_asset", ok: true }),
      expect.objectContaining({ target: "workflow_run", ok: true }),
    ]),
  );

  expect((await listSupportAssetStoreSnapshot()).supportAssets[0]).toMatchObject({
    id: "controlled-support-asset:controlled-support-runtime-test",
    workflowRunId: "controlled-support-runtime-test",
    scenarioId: "support-ops",
    latestReply: "Approved support reply",
    status: "completed",
  });
  expect((await listKnowledgeAssetStoreSnapshot()).knowledgeAssets[0]).toMatchObject({
    workflowRunId: "controlled-support-runtime-test",
    assetType: "support_faq",
  });
  expect((await listWorkflowRunStoreSnapshot()).workflowRuns[0]).toMatchObject({
    id: "controlled-support-runtime-test",
    scenarioId: "support-ops",
    state: "completed",
  });
  expect((await listDraftStoreSnapshot()).drafts[0]).toMatchObject({
    id: "controlled-draft:controlled-support-runtime-test",
    workflowRunId: "controlled-support-runtime-test",
    workflowStageId: "draft_reply",
  });
});
```

- [ ] **Step 2: Verify integration test passes**

Run:

```bash
npm test -- src/__tests__/lib/executor/controlled-runtime.test.ts
```

Expected: PASS after Task 2 implementation.

- [ ] **Step 3: Commit support runtime integration**

```bash
git add src/__tests__/lib/executor/controlled-runtime.test.ts
git commit -m "test: cover support controlled runtime"
```

## Task 4: Runtime Console Support Landing

**Files:**

- Modify: `src/__tests__/lib/executor/runtime/console-summary.test.ts`
- Modify: `src/lib/executor/runtime/console-summary.ts`
- Modify: `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`
- Modify: `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`

- [ ] **Step 1: Write failing console summary support landing test**

In `src/__tests__/lib/executor/runtime/console-summary.test.ts`, add a support receipt to the completed fixture or create a dedicated support run, then assert:

```ts
expect(summary.assetLandings).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      target: "support_asset",
      label: "Support asset",
      ok: true,
      assetId: "controlled-support-asset:workflow-1",
      sourceKey: "controlled-run:run-console-1:support_asset",
      workflowRunId: "workflow-1",
      appId: "support_copilot",
    }),
  ]),
);

expect(
  filterControlledRunConsoleSummaries([completed, awaiting], {
    state: "all",
    query: "Support asset",
  }).map((summary) => summary.id),
).toEqual(["run-console-1"]);
```

- [ ] **Step 2: Verify console summary test fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts
```

Expected: FAIL because `support_asset` is not in landing labels/app ids.

- [ ] **Step 3: Add support asset landing summary**

In `src/lib/executor/runtime/console-summary.ts`:

```ts
  appId?: "deal_desk" | "knowledge_vault" | "industry_hub" | "publisher" | "support_copilot";
```

Add maps:

```ts
  support_asset: "Support asset",
```

```ts
  support_asset: "support_copilot",
```

- [ ] **Step 4: Verify console summary test passes**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing Runtime Console open action test**

In `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`:

1. Add mock import and mock function for `requestOpenSupportCopilot`.
2. Add a `support_asset` receipt to the completed run fixture.
3. Assert clicking its `打开` button calls:

```ts
expect(requestOpenSupportCopilot).toHaveBeenCalledWith({
  workflowRunId: "workflow-assets-1",
  workflowScenarioId: "sales-pipeline",
  workflowSource: "Runtime Console asset controlled-support-asset:workflow-assets-1",
  workflowNextStep: "Review the controlled run support asset and continue support resolution.",
});
```

If the fixture scenario is updated to `support-ops`, expect `workflowScenarioId: "support-ops"`.

- [ ] **Step 6: Implement support open action**

In `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`:

1. Import `requestOpenSupportCopilot`.
2. Add branch after knowledge/publisher branches:

```ts
    if (asset.appId === "support_copilot") {
      requestOpenSupportCopilot({
        workflowRunId: asset.workflowRunId ?? selectedControlledRunSummary?.workflowRunId,
        workflowScenarioId: selectedControlledRunSummary?.scenarioId,
        workflowSource: `Runtime Console asset ${asset.assetId ?? asset.target}`,
        workflowNextStep:
          "Review the controlled run support asset and continue support resolution.",
      });
      showToast("已打开 Support Copilot", "ok");
      return;
    }
```

- [ ] **Step 7: Verify Runtime Console support landing tests pass**

Run:

```bash
npm test -- src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx src/__tests__/lib/executor/runtime/console-summary.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Runtime Console support landing**

```bash
git add src/lib/executor/runtime/console-summary.ts src/components/apps/ClawRuntimeConsoleAppWindow.tsx src/__tests__/lib/executor/runtime/console-summary.test.ts src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
git commit -m "feat: surface support asset landings"
```

## Task 5: Test Script, Docs, And Final Verification

**Files:**

- Modify: `package.json`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-support-playbook-migration.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Add support tests to controlled runtime script**

In `package.json`, add this file to `test:controlled-runtime` immediately after the sales playbook test:

```text
src/__tests__/lib/executor/playbooks/support-resolution.test.ts
```

- [ ] **Step 2: Run targeted tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/support-resolution.test.ts src/__tests__/lib/executor/runtime/writeback.test.ts src/__tests__/lib/executor/controlled-runtime.test.ts src/__tests__/lib/executor/runtime/console-summary.test.ts src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run final gates**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected:

- `test:controlled-runtime` passes with the new support test included.
- `test:core-workflows` passes.
- `lint` exits 0 with only the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `build` exits 0 with the same existing warning.
- `git diff --check` exits 0.

- [ ] **Step 4: Update docs**

Update:

- `CHANGELOG.md`
  - Add Support Playbook Migration under Unreleased.
  - Update controlled runtime test counts.
- `docs/NEXT_STEPS.md`
  - Move Support Playbook Migration from P0 to completed.
  - Set next recommended P0 to Trace Governance or Support Runtime Console Record Focus.
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - Mark Phase 8 complete.
  - Update current progress snapshot and controlled runtime count.
- `memory/2026-07-06.md`
  - Record commits, verification, and next phase.

- [ ] **Step 5: Mark plan complete and commit docs**

Add final verification evidence to this plan, mark task checkboxes completed, then run:

```bash
git add package.json CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-support-playbook-migration.md
git commit -m "docs: complete support playbook migration"
```

## Self-Review

- Spec coverage: playbook, catalog, writeback, runtime integration, Runtime Console support landing, tests, docs, and verification are covered.
- Placeholder scan: no implementation task depends on an unspecified helper or a deferred behavior.
- Type consistency: `supportResolutionPlaybook`, `support-resolution-v1`, `support-ops`, `support_asset`, `controlled-support-asset:{workflowRunId}`, and `support_copilot` are used consistently.
