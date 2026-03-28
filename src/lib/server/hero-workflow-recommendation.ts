import {
  buildCreatorHeroWorkflowRecommendation,
  buildResearchHeroWorkflowRecommendation,
  buildSalesHeroWorkflowRecommendation,
  buildSupportHeroWorkflowRecommendation,
  type HeroWorkflowFamily,
} from "@/lib/hero-workflow-recommendation";
import type { RecommendationResult } from "@/lib/recommendation-contract";
import { CREATOR_WORKFLOW_SCENARIO_ID } from "@/lib/creator-workflow";
import { listCreatorAssetStoreSnapshot } from "@/lib/server/creator-asset-store";
import { listDraftStoreSnapshot } from "@/lib/server/draft-store";
import { listPublishJobs } from "@/lib/server/publish-job-store";
import { listTaskStoreSnapshot } from "@/lib/server/task-store";
import { RESEARCH_WORKFLOW_SCENARIO_ID } from "@/lib/research-workflow";
import { listResearchAssetStoreSnapshot } from "@/lib/server/research-asset-store";
import { listSalesAssetStoreSnapshot } from "@/lib/server/sales-asset-store";
import { listSupportAssetStoreSnapshot } from "@/lib/server/support-asset-store";
import { listWorkflowRunsFromStore } from "@/lib/server/workflow-run-store";
import { SALES_WORKFLOW_SCENARIO_ID } from "@/lib/sales-workflow";
import { SUPPORT_WORKFLOW_SCENARIO_ID } from "@/lib/support-workflow";

export type HeroWorkflowRecommendationInput = {
  family: HeroWorkflowFamily;
  workflowRunId?: string | null;
  source?: string;
  nextStep?: string;
};

export type HeroWorkflowRecommendationOutput = {
  family: HeroWorkflowFamily;
  workflowRunId: string | null;
  recommendation: RecommendationResult;
};

function getScenarioIdByFamily(family: HeroWorkflowFamily) {
  switch (family) {
    case "sales":
      return SALES_WORKFLOW_SCENARIO_ID;
    case "creator":
      return CREATOR_WORKFLOW_SCENARIO_ID;
    case "support":
      return SUPPORT_WORKFLOW_SCENARIO_ID;
    case "research":
      return RESEARCH_WORKFLOW_SCENARIO_ID;
  }
}

export async function buildRuntimeHeroWorkflowRecommendation(
  input: HeroWorkflowRecommendationInput,
): Promise<HeroWorkflowRecommendationOutput> {
  const workflowRuns = await listWorkflowRunsFromStore();
  const { tasks } = await listTaskStoreSnapshot();
  const run =
    (input.workflowRunId
      ? workflowRuns.find((item) => item.id === input.workflowRunId) ?? null
      : workflowRuns.find((item) => item.scenarioId === getScenarioIdByFamily(input.family)) ?? null) ??
    null;

  if (input.family === "sales") {
    const { salesAssets } = await listSalesAssetStoreSnapshot();
    const asset =
      (input.workflowRunId
        ? salesAssets.find((item) => item.workflowRunId === input.workflowRunId) ?? null
        : salesAssets[0] ?? null) ?? null;
    return {
      family: input.family,
      workflowRunId: run?.id ?? input.workflowRunId ?? asset?.workflowRunId ?? null,
      recommendation: buildSalesHeroWorkflowRecommendation({
        run,
        asset,
        tasks: tasks
          .filter((item) =>
            input.workflowRunId
              ? item.workflowRunId === input.workflowRunId
              : item.workflowScenarioId === SALES_WORKFLOW_SCENARIO_ID,
          )
          .sort((left, right) => right.updatedAt - left.updatedAt)
          .slice(0, 3),
        source: input.source,
        nextStep: input.nextStep,
      }),
    };
  }

  if (input.family === "support") {
    const { supportAssets } = await listSupportAssetStoreSnapshot();
    const asset =
      (input.workflowRunId
        ? supportAssets.find((item) => item.workflowRunId === input.workflowRunId) ?? null
        : supportAssets[0] ?? null) ?? null;
    return {
      family: input.family,
      workflowRunId: run?.id ?? input.workflowRunId ?? asset?.workflowRunId ?? null,
      recommendation: buildSupportHeroWorkflowRecommendation({
        run,
        asset,
        tasks: tasks
          .filter((item) =>
            input.workflowRunId
              ? item.workflowRunId === input.workflowRunId
              : item.workflowScenarioId === SUPPORT_WORKFLOW_SCENARIO_ID,
          )
          .sort((left, right) => right.updatedAt - left.updatedAt)
          .slice(0, 3),
        source: input.source,
        nextStep: input.nextStep,
      }),
    };
  }

  if (input.family === "creator") {
    const { creatorAssets } = await listCreatorAssetStoreSnapshot();
    const { drafts } = await listDraftStoreSnapshot();
    const publishJobs = await listPublishJobs();
    const asset =
      (input.workflowRunId
        ? creatorAssets.find((item) => item.workflowRunId === input.workflowRunId) ?? null
        : creatorAssets[0] ?? null) ?? null;
    const draft =
      (asset?.draftId
        ? drafts.find((item) => item.id === asset.draftId) ?? null
        : input.workflowRunId
          ? drafts.find((item) => item.workflowRunId === input.workflowRunId) ?? null
          : drafts.find((item) => item.workflowScenarioId === CREATOR_WORKFLOW_SCENARIO_ID) ?? null) ??
      null;
    const publishJob =
      ((draft?.id
        ? publishJobs.find((item) => item.draftId === draft.id) ?? null
        : asset?.draftId
          ? publishJobs.find((item) => item.draftId === asset.draftId) ?? null
          : null) ??
        null);
    const linkedTasks = (input.workflowRunId
      ? tasks.filter((item) => item.workflowRunId === input.workflowRunId)
      : asset?.workflowRunId
        ? tasks.filter((item) => item.workflowRunId === asset.workflowRunId)
        : tasks.filter((item) => item.workflowScenarioId === CREATOR_WORKFLOW_SCENARIO_ID)
    )
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 3);
    return {
      family: input.family,
      workflowRunId: run?.id ?? input.workflowRunId ?? asset?.workflowRunId ?? null,
      recommendation: buildCreatorHeroWorkflowRecommendation({
        run,
        asset,
        draft,
        publishJob,
        tasks: linkedTasks,
        source: input.source,
        nextStep: input.nextStep,
      }),
    };
  }

  const { researchAssets } = await listResearchAssetStoreSnapshot();
  const asset =
    (input.workflowRunId
      ? researchAssets.find((item) => item.workflowRunId === input.workflowRunId) ?? null
      : researchAssets[0] ?? null) ?? null;
  return {
    family: input.family,
    workflowRunId: run?.id ?? input.workflowRunId ?? asset?.workflowRunId ?? null,
    recommendation: buildResearchHeroWorkflowRecommendation({
      run,
      asset,
      tasks: tasks
        .filter((item) =>
          input.workflowRunId
            ? item.workflowRunId === input.workflowRunId
            : item.workflowScenarioId === RESEARCH_WORKFLOW_SCENARIO_ID,
        )
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 3),
      source: input.source,
      nextStep: input.nextStep,
    }),
  };
}

export async function buildRuntimeHeroWorkflowRecommendationSummary() {
  const families: HeroWorkflowFamily[] = ["sales", "creator", "support", "research"];
  const items = await Promise.all(
    families.map((family) => buildRuntimeHeroWorkflowRecommendation({ family })),
  );
  return {
    sales: items.find((item) => item.family === "sales") ?? null,
    creator: items.find((item) => item.family === "creator") ?? null,
    support: items.find((item) => item.family === "support") ?? null,
    research: items.find((item) => item.family === "research") ?? null,
  };
}
