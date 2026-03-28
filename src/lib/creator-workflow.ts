import { getWorkspaceScenario } from "@/lib/workspace-presets";
import type { PublishPlatformId } from "@/lib/publish";
import type {
  WorkflowRunRecord,
  WorkflowRunState,
  WorkflowStageRunState,
  WorkflowTriggerType,
} from "@/lib/workflow-runs";
import type { WorkflowContextMeta } from "@/lib/workflow-context";

export const CREATOR_WORKFLOW_SCENARIO_ID = "creator-studio";

export type CreatorWorkflowOriginApp =
  | "creator_radar"
  | "content_repurposer"
  | "publisher";

export type CreatorWorkflowMeta = WorkflowContextMeta & {
  workflowOriginApp?: CreatorWorkflowOriginApp;
  workflowOriginId?: string;
  workflowOriginLabel?: string;
  workflowAudience?: string;
  workflowPrimaryAngle?: string;
  workflowSourceSummary?: string;
  workflowBlockLabel?: string;
  workflowSuggestedPlatforms?: PublishPlatformId[];
  workflowPublishNotes?: string;
};

function normalizeText(value?: string) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizePlatforms(input?: PublishPlatformId[]) {
  if (!Array.isArray(input)) return undefined;
  const result: PublishPlatformId[] = [];
  for (const item of input) {
    if (typeof item !== "string" || !item.trim()) continue;
    const normalized = item.trim() as PublishPlatformId;
    if (result.includes(normalized)) continue;
    result.push(normalized);
  }
  return result.length > 0 ? result : undefined;
}

export function getCreatorWorkflowScenario() {
  return getWorkspaceScenario(CREATOR_WORKFLOW_SCENARIO_ID);
}

export function buildCreatorWorkflowMeta(input?: CreatorWorkflowMeta): CreatorWorkflowMeta {
  return {
    workflowRunId: input?.workflowRunId,
    workflowScenarioId: input?.workflowScenarioId ?? CREATOR_WORKFLOW_SCENARIO_ID,
    workflowStageId: normalizeText(input?.workflowStageId),
    workflowSource: normalizeText(input?.workflowSource),
    workflowNextStep: normalizeText(input?.workflowNextStep),
    workflowTriggerType: input?.workflowTriggerType,
    workflowOriginApp: input?.workflowOriginApp,
    workflowOriginId: normalizeText(input?.workflowOriginId),
    workflowOriginLabel: normalizeText(input?.workflowOriginLabel),
    workflowAudience: normalizeText(input?.workflowAudience),
    workflowPrimaryAngle: normalizeText(input?.workflowPrimaryAngle),
    workflowSourceSummary: normalizeText(input?.workflowSourceSummary),
    workflowBlockLabel: normalizeText(input?.workflowBlockLabel),
    workflowSuggestedPlatforms: normalizePlatforms(input?.workflowSuggestedPlatforms),
    workflowPublishNotes: normalizeText(input?.workflowPublishNotes),
  };
}

export function getCreatorWorkflowOriginLabel(originApp?: CreatorWorkflowOriginApp | null) {
  switch (originApp) {
    case "creator_radar":
      return "Creator Radar";
    case "content_repurposer":
      return "Content Repurposer";
    case "publisher":
      return "Publisher";
    default:
      return "内容工作流";
  }
}

export function getCreatorRuntimeLabel(state?: WorkflowRunState | null) {
  switch (state) {
    case "running":
      return "内容生产中";
    case "awaiting_human":
      return "等待发布确认";
    case "completed":
      return "已沉淀完成";
    case "error":
      return "执行异常";
    default:
      return "未启动";
  }
}

export function getCreatorTriggerLabel(triggerType?: WorkflowTriggerType) {
  switch (triggerType) {
    case "schedule":
      return "内容日历";
    case "manual":
      return "手动选题";
    default:
      return "手动启动";
  }
}

export function getCreatorStageStateLabel(state: WorkflowStageRunState) {
  switch (state) {
    case "running":
      return "处理中";
    case "awaiting_human":
      return "待确认";
    case "completed":
      return "已完成";
    case "error":
      return "失败";
    default:
      return "待开始";
  }
}

export function getCreatorWorkflowNextAction(run: WorkflowRunRecord | null) {
  switch (run?.currentStageId) {
    case "radar":
      return "先在 Creator Radar 确定今天最值得推进的一条内容角度。";
    case "repurpose":
      return "把摘要送到 Content Repurposer，生成多平台内容包。";
    case "preflight":
      return "在 Publisher 里做标题、CTA 和平台适配检查。";
    case "publish-loop":
      return "完成预演或发布后，把高表现结构沉淀成可复用资产。";
    default:
      return run?.state === "completed"
        ? "这一轮内容增长链已经完成，可以复用沉淀下来的模板与结构。"
        : "从内容日历或手动选题启动一条 Creator Hero Workflow。";
  }
}
