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

export type ControlledPlaybookLifecycleStatus =
  | "active"
  | "experimental"
  | "deprecated";

export type ControlledPlaybookLifecycle = {
  status: ControlledPlaybookLifecycleStatus;
  owner: string;
  lastReviewedAt: string;
  reviewCadenceDays: number;
  changePolicy: "spec_plan_tdd_fixture_required";
};

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
  lifecycle: ControlledPlaybookLifecycle;
  triggerTypes: ControlledPlaybookTriggerType[];
  steps: ControlledPlaybookStep[];
  resultAssets: string[];
};
