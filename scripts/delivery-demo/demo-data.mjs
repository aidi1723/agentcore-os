export const DELIVERY_DEMO_COMPLETED_RUN_ID = "delivery-demo-run-completed";
export const DELIVERY_DEMO_AWAITING_APPROVAL_RUN_ID =
  "delivery-demo-run-awaiting-approval";
export const DELIVERY_DEMO_FAILED_RUN_ID = "delivery-demo-run-failed-retryable";

export const DELIVERY_DEMO_WORKFLOW_RUN_ID = "delivery-demo-workflow-sales";
export const DELIVERY_DEMO_SALES_ASSET_ID = "delivery-demo-sales-asset";
export const DELIVERY_DEMO_KNOWLEDGE_ASSET_ID = "delivery-demo-knowledge-asset";
export const DELIVERY_DEMO_DRAFT_ID = "delivery-demo-draft";
export const DELIVERY_DEMO_SUPPORT_ASSET_ID = "delivery-demo-support-asset";

const PLAYBOOK_ID = "sales-pipeline-v1";
const PLAYBOOK_VERSION = "1.0.0";
const SCENARIO_ID = "sales-pipeline";

function salesPlan({
  id,
  goal,
  retryable = true,
  requiresApproval = true,
} = {}) {
  return {
    id,
    goal,
    requiresApproval,
    totalSteps: 5,
    steps: [
      {
        id: "intake",
        title: "Capture intake",
        description: "Capture sanitized customer context for the delivery demo.",
        toolCalls: [],
        dependsOn: [],
        mode: "auto",
      },
      {
        id: "qualify",
        title: "Qualify lead",
        description: "Score the opportunity against the controlled playbook rules.",
        toolCalls: [],
        dependsOn: ["intake"],
        mode: "auto",
        onFailure: retryable ? { action: "retry", maxRetries: 1 } : { action: "fail_run" },
      },
      {
        id: "draft_outreach",
        title: "Draft outreach",
        description: "Prepare a governed outreach draft without raw sensitive payloads.",
        toolCalls: [],
        dependsOn: ["qualify"],
        mode: "auto",
      },
      {
        id: "human_review",
        title: "Human review",
        description: "Require an operator decision before writeback.",
        toolCalls: [],
        dependsOn: ["draft_outreach"],
        mode: "review",
      },
      {
        id: "writeback",
        title: "Write controlled assets",
        description: "Write approved assets into local stores.",
        toolCalls: [],
        dependsOn: ["human_review"],
        mode: "auto",
        writesTo: [
          { target: "sales_asset" },
          { target: "knowledge_asset" },
          { target: "workflow_run" },
          { target: "draft" },
          { target: "support_asset" },
        ],
      },
    ],
  };
}

function completedStep(stepId, startedAt, output = {}) {
  return {
    stepId,
    state: "completed",
    startedAt,
    finishedAt: startedAt + 1_000,
    input: { demo: true, source: "delivery-demo" },
    output,
    attempts: 1,
    toolCallResults: [],
    writebackReceipts: [],
  };
}

function writebackReceipts(now) {
  return [
    {
      target: "sales_asset",
      ok: true,
      summary: `Wrote sales asset ${DELIVERY_DEMO_SALES_ASSET_ID}`,
      writtenAt: now,
      assetId: DELIVERY_DEMO_SALES_ASSET_ID,
      sourceKey: `controlled-run:${DELIVERY_DEMO_COMPLETED_RUN_ID}:sales_asset`,
      workflowRunId: DELIVERY_DEMO_WORKFLOW_RUN_ID,
    },
    {
      target: "knowledge_asset",
      ok: true,
      summary: `Wrote knowledge asset ${DELIVERY_DEMO_KNOWLEDGE_ASSET_ID}`,
      writtenAt: now,
      assetId: DELIVERY_DEMO_KNOWLEDGE_ASSET_ID,
      sourceKey: `controlled-run:${DELIVERY_DEMO_COMPLETED_RUN_ID}:knowledge_asset`,
      workflowRunId: DELIVERY_DEMO_WORKFLOW_RUN_ID,
    },
    {
      target: "workflow_run",
      ok: true,
      summary: `Wrote workflow run ${DELIVERY_DEMO_WORKFLOW_RUN_ID} as completed`,
      writtenAt: now,
      sourceKey: `controlled-run:${DELIVERY_DEMO_COMPLETED_RUN_ID}:workflow_run`,
      workflowRunId: DELIVERY_DEMO_WORKFLOW_RUN_ID,
    },
    {
      target: "draft",
      ok: true,
      summary: `Wrote draft ${DELIVERY_DEMO_DRAFT_ID}`,
      writtenAt: now,
      assetId: DELIVERY_DEMO_DRAFT_ID,
      sourceKey: `controlled-run:${DELIVERY_DEMO_COMPLETED_RUN_ID}:draft`,
      workflowRunId: DELIVERY_DEMO_WORKFLOW_RUN_ID,
    },
    {
      target: "support_asset",
      ok: true,
      summary: `Wrote support asset ${DELIVERY_DEMO_SUPPORT_ASSET_ID}`,
      writtenAt: now,
      assetId: DELIVERY_DEMO_SUPPORT_ASSET_ID,
      sourceKey: `controlled-run:${DELIVERY_DEMO_COMPLETED_RUN_ID}:support_asset`,
      workflowRunId: DELIVERY_DEMO_WORKFLOW_RUN_ID,
    },
  ];
}

function buildCompletedRun(now) {
  const plan = salesPlan({
    id: `playbook:${PLAYBOOK_ID}:${PLAYBOOK_VERSION}`,
    goal: "Delivery demo controlled sales workflow",
  });
  const writeback = completedStep("writeback", now - 1_000, {
    demoResult: "approved assets written",
  });
  writeback.writebackReceipts = writebackReceipts(now);

  return {
    id: DELIVERY_DEMO_COMPLETED_RUN_ID,
    requestId: "delivery-demo-request-completed",
    sessionId: "delivery-demo-session",
    workflowRunId: DELIVERY_DEMO_WORKFLOW_RUN_ID,
    scenarioId: SCENARIO_ID,
    playbookId: PLAYBOOK_ID,
    playbookVersion: PLAYBOOK_VERSION,
    planId: plan.id,
    state: "completed",
    currentStepId: "writeback",
    createdAt: now - 12_000,
    updatedAt: now,
    finishedAt: now,
    auditEvents: [],
    plan,
    steps: [
      completedStep("intake", now - 11_000, { customerSegment: "B2B operations" }),
      completedStep("qualify", now - 9_000, { score: 82, priority: "high" }),
      completedStep("draft_outreach", now - 7_000, { draftReady: true }),
      {
        ...completedStep("human_review", now - 5_000, { approved: true }),
        approval: {
          id: "delivery-demo-approval-approved",
          executionId: DELIVERY_DEMO_COMPLETED_RUN_ID,
          stepId: "human_review",
          state: "approved",
          requestedAt: now - 5_000,
          decidedAt: now - 4_000,
          feedback: "Approved for delivery demo writeback.",
        },
      },
      writeback,
    ],
  };
}

function buildAwaitingApprovalRun(now) {
  const plan = salesPlan({
    id: `playbook:${PLAYBOOK_ID}:${PLAYBOOK_VERSION}:awaiting`,
    goal: "Delivery demo awaiting approval workflow",
  });
  return {
    id: DELIVERY_DEMO_AWAITING_APPROVAL_RUN_ID,
    requestId: "delivery-demo-request-awaiting",
    sessionId: "delivery-demo-session",
    workflowRunId: "delivery-demo-workflow-awaiting",
    scenarioId: SCENARIO_ID,
    playbookId: PLAYBOOK_ID,
    playbookVersion: PLAYBOOK_VERSION,
    planId: plan.id,
    state: "awaiting_approval",
    currentStepId: "human_review",
    createdAt: now - 10_000,
    updatedAt: now - 1_500,
    auditEvents: [],
    plan,
    steps: [
      completedStep("intake", now - 9_000, { customerSegment: "B2B operations" }),
      completedStep("qualify", now - 7_000, { score: 76, priority: "medium" }),
      completedStep("draft_outreach", now - 5_000, { draftReady: true }),
      {
        stepId: "human_review",
        state: "awaiting_approval",
        startedAt: now - 3_000,
        input: { demo: true, source: "delivery-demo" },
        output: null,
        attempts: 1,
        toolCallResults: [],
        writebackReceipts: [],
        approval: {
          id: "delivery-demo-approval-pending",
          executionId: DELIVERY_DEMO_AWAITING_APPROVAL_RUN_ID,
          stepId: "human_review",
          state: "pending",
          requestedAt: now - 3_000,
        },
      },
      {
        stepId: "writeback",
        state: "pending",
        input: null,
        output: null,
        attempts: 0,
        toolCallResults: [],
        writebackReceipts: [],
      },
    ],
  };
}

function buildFailedRun(now) {
  const plan = salesPlan({
    id: `playbook:${PLAYBOOK_ID}:${PLAYBOOK_VERSION}:retryable`,
    goal: "Delivery demo retryable failure workflow",
    requiresApproval: false,
  });
  return {
    id: DELIVERY_DEMO_FAILED_RUN_ID,
    requestId: "delivery-demo-request-failed",
    sessionId: "delivery-demo-session",
    workflowRunId: "delivery-demo-workflow-failed",
    scenarioId: SCENARIO_ID,
    playbookId: PLAYBOOK_ID,
    playbookVersion: PLAYBOOK_VERSION,
    planId: plan.id,
    state: "failed",
    currentStepId: "qualify",
    createdAt: now - 8_000,
    updatedAt: now - 1_000,
    finishedAt: now - 1_000,
    error: "Retryable delivery demo qualification failure.",
    auditEvents: [],
    plan,
    steps: [
      completedStep("intake", now - 7_000, { customerSegment: "B2B operations" }),
      {
        stepId: "qualify",
        state: "failed",
        startedAt: now - 5_000,
        finishedAt: now - 4_000,
        input: { demo: true, source: "delivery-demo" },
        output: null,
        error: "Temporary provider failure for delivery demo.",
        attempts: 1,
        toolCallResults: [],
        writebackReceipts: [],
      },
    ],
  };
}

export function buildDeliveryDemoData({ now = Date.now() } = {}) {
  return {
    controlledRuns: [
      buildCompletedRun(now),
      buildAwaitingApprovalRun(now),
      buildFailedRun(now),
    ],
    salesAssets: [
      {
        id: DELIVERY_DEMO_SALES_ASSET_ID,
        sourceKey: `controlled-run:${DELIVERY_DEMO_COMPLETED_RUN_ID}:sales_asset`,
        workflowRunId: DELIVERY_DEMO_WORKFLOW_RUN_ID,
        scenarioId: SCENARIO_ID,
        title: "Delivery demo qualified opportunity",
        customerName: "Delivery Demo Customer",
        summary: "Controlled playbook completed and wrote a sales asset.",
        createdAt: now,
        updatedAt: now,
      },
    ],
    knowledgeAssets: [
      {
        id: DELIVERY_DEMO_KNOWLEDGE_ASSET_ID,
        sourceKey: `controlled-run:${DELIVERY_DEMO_COMPLETED_RUN_ID}:knowledge_asset`,
        workflowRunId: DELIVERY_DEMO_WORKFLOW_RUN_ID,
        scenarioId: SCENARIO_ID,
        title: "Delivery demo playbook learning",
        type: "playbook_note",
        status: "active",
        summary: "Reusable governed knowledge from the delivery demo run.",
        createdAt: now,
        updatedAt: now,
      },
    ],
    workflowRuns: [
      {
        id: DELIVERY_DEMO_WORKFLOW_RUN_ID,
        scenarioId: SCENARIO_ID,
        title: "Delivery demo sales workflow",
        state: "completed",
        source: "delivery-demo",
        createdAt: now - 12_000,
        updatedAt: now,
        completedAt: now,
      },
    ],
    drafts: [
      {
        id: DELIVERY_DEMO_DRAFT_ID,
        sourceKey: `controlled-run:${DELIVERY_DEMO_COMPLETED_RUN_ID}:draft`,
        workflowRunId: DELIVERY_DEMO_WORKFLOW_RUN_ID,
        scenarioId: SCENARIO_ID,
        title: "Delivery demo outreach draft",
        status: "ready",
        body: "Governed delivery demo draft generated after human approval.",
        createdAt: now,
        updatedAt: now,
      },
    ],
    supportAssets: [
      {
        id: DELIVERY_DEMO_SUPPORT_ASSET_ID,
        sourceKey: `controlled-run:${DELIVERY_DEMO_COMPLETED_RUN_ID}:support_asset`,
        workflowRunId: DELIVERY_DEMO_WORKFLOW_RUN_ID,
        scenarioId: SCENARIO_ID,
        ticketId: "delivery-demo-support-ticket",
        title: "Delivery demo support follow-up",
        summary: "Support handoff generated from the controlled delivery demo run.",
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}
