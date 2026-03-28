import type { AssetJumpTarget } from "@/lib/asset-jumps";

export type RecommendationHitKind =
  | "file"
  | "knowledge_asset"
  | "creator_asset"
  | (string & {});

export type RecommendationActionKind =
  | "review_file"
  | "reuse_knowledge_asset"
  | "resume_creator_workflow"
  | "ask_for_context"
  | (string & {});

export type RecommendationHit = {
  kind: RecommendationHitKind;
  id: string;
  title: string;
  summary: string;
  score: number;
  rationale: string;
  metadata: string[];
  jumpTarget?: AssetJumpTarget;
};

export type RecommendationSection = {
  id: string;
  label: string;
  hits: RecommendationHit[];
};

export type RecommendationAction = {
  kind: RecommendationActionKind;
  label: string;
  rationale: string;
  jumpTarget?: AssetJumpTarget;
};

export type RecommendationResult = {
  contractVersion: "v1";
  query: string;
  sections: RecommendationSection[];
  recommendedAction: RecommendationAction;
};
