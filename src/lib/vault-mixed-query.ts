import type { AssetJumpTarget } from "@/lib/asset-jumps";
import type {
  RecommendationAction,
  RecommendationHit,
  RecommendationResult,
  RecommendationSection,
} from "@/lib/recommendation-contract";

export type VaultFileSummary = {
  id: string;
  folderId: string;
  name: string;
  size: number;
  addedAt: number;
};

export type VaultKnowledgeAssetSummary = {
  id: string;
  title: string;
  assetType: string;
  status: string;
  applicableScene: string;
  tags?: string[];
  body?: string;
  reuseCount?: number;
  jumpTarget?: AssetJumpTarget;
};

export type VaultCreatorAssetSummary = {
  id: string;
  topic: string;
  primaryAngle?: string;
  publishStatus?: string;
  latestPublishFeedback?: string;
  nextAction?: string;
  publishTargets?: string[];
  successfulPlatforms?: string[];
  retryablePlatforms?: string[];
  jumpTarget?: AssetJumpTarget;
};

export type VaultQueryHit = RecommendationHit;
export type VaultRecommendedAction = RecommendationAction;
export type VaultMixedQueryStructuredResult = RecommendationResult;

function normalizeText(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function clipText(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(1, limit - 1)).trimEnd()}...`;
}

function buildTerms(query: string) {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  const parts = normalized
    .split(/[\s,，。！？!?:：/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const terms = new Set<string>([normalized, ...parts]);
  if (parts.length <= 1 && normalized.length >= 4) {
    for (let index = 0; index <= normalized.length - 2; index += 1) {
      terms.add(normalized.slice(index, index + 2));
    }
  }
  return Array.from(terms).filter((term) => term.length >= 2);
}

function scoreText(query: string, primary: string[], secondary: string[]) {
  const normalizedQuery = normalizeText(query);
  const terms = buildTerms(query);
  let score = 0;
  const hitTerms = new Set<string>();

  for (const text of primary) {
    const normalized = normalizeText(text);
    if (!normalized) continue;
    if (normalizedQuery && normalized.includes(normalizedQuery)) {
      score += 12;
      hitTerms.add(normalizedQuery);
    }
    for (const term of terms) {
      if (normalized.includes(term)) {
        score += 4;
        hitTerms.add(term);
      }
    }
  }

  for (const text of secondary) {
    const normalized = normalizeText(text);
    if (!normalized) continue;
    if (normalizedQuery && normalized.includes(normalizedQuery)) {
      score += 6;
      hitTerms.add(normalizedQuery);
    }
    for (const term of terms) {
      if (normalized.includes(term)) {
        score += 2;
        hitTerms.add(term);
      }
    }
  }

  return {
    score,
    hitTerms: Array.from(hitTerms),
  };
}

function buildFileHit(query: string, file: VaultFileSummary): RecommendationHit {
  const { score, hitTerms } = scoreText(query, [file.name], [file.folderId]);
  const summary = `${file.name} (${Math.round(file.size / 1024)}KB)`;
  return {
    kind: "file",
    id: file.id,
    title: file.name,
    summary,
    score,
    rationale:
      hitTerms.length > 0
        ? `文件名命中了 ${hitTerms.join(" / ")}`
        : "当前只基于文件名判断相关性",
    metadata: [`添加于 ${new Date(file.addedAt).toLocaleString()}`],
  };
}

function buildKnowledgeHit(query: string, asset: VaultKnowledgeAssetSummary): RecommendationHit {
  const { score, hitTerms } = scoreText(
    query,
    [asset.title, asset.applicableScene, ...(asset.tags ?? [])],
    [asset.body ?? "", asset.assetType, asset.status],
  );
  const reuseBonus = typeof asset.reuseCount === "number" ? Math.min(4, asset.reuseCount) : 0;
  return {
    kind: "knowledge_asset",
    id: asset.id,
    title: asset.title,
    summary: clipText(asset.body?.trim() || asset.applicableScene || "知识资产摘要", 180),
    score: score + reuseBonus,
    rationale:
      hitTerms.length > 0
        ? `知识资产命中了 ${hitTerms.join(" / ")}`
        : "基于标题、场景和标签做初步匹配",
    metadata: [
      `类型 ${asset.assetType}`,
      `状态 ${asset.status}`,
      `场景 ${asset.applicableScene}`,
      typeof asset.reuseCount === "number" ? `复用 ${asset.reuseCount} 次` : "",
    ].filter(Boolean),
    jumpTarget: asset.jumpTarget,
  };
}

function buildCreatorHit(query: string, asset: VaultCreatorAssetSummary): RecommendationHit {
  const { score, hitTerms } = scoreText(
    query,
    [
      asset.topic,
      asset.primaryAngle ?? "",
      ...(asset.publishTargets ?? []),
      ...(asset.successfulPlatforms ?? []),
      ...(asset.retryablePlatforms ?? []),
    ],
    [asset.latestPublishFeedback ?? "", asset.nextAction ?? "", asset.publishStatus ?? ""],
  );
  const successBonus = Math.min(6, asset.successfulPlatforms?.length ?? 0);
  const retryBonus = Math.min(5, asset.retryablePlatforms?.length ?? 0);
  return {
    kind: "creator_asset",
    id: asset.id,
    title: asset.topic || "内容工作流资产",
    summary: clipText(
      asset.latestPublishFeedback?.trim() || asset.nextAction?.trim() || "内容工作流反馈摘要",
      180,
    ),
    score: score + successBonus + retryBonus,
    rationale:
      hitTerms.length > 0
        ? `内容资产命中了 ${hitTerms.join(" / ")}`
        : "基于选题、平台和发布反馈做初步匹配",
    metadata: [
      asset.publishStatus ? `状态 ${asset.publishStatus}` : "",
      asset.publishTargets?.length ? `平台 ${asset.publishTargets.join(" / ")}` : "",
      asset.successfulPlatforms?.length ? `成功 ${asset.successfulPlatforms.join(" / ")}` : "",
      asset.retryablePlatforms?.length ? `重试 ${asset.retryablePlatforms.join(" / ")}` : "",
    ].filter(Boolean),
    jumpTarget: asset.jumpTarget,
  };
}

function compareHits(left: RecommendationHit, right: RecommendationHit) {
  if (left.score !== right.score) return right.score - left.score;
  return left.title.localeCompare(right.title, "zh-CN");
}

export function buildVaultMixedQueryStructuredResult(input: {
  query: string;
  files?: VaultFileSummary[];
  knowledgeAssets?: VaultKnowledgeAssetSummary[];
  creatorAssets?: VaultCreatorAssetSummary[];
}) {
  const files = (input.files ?? [])
    .map((file) => buildFileHit(input.query, file))
    .sort(compareHits)
    .slice(0, 3);
  const knowledgeAssets = (input.knowledgeAssets ?? [])
    .map((asset) => buildKnowledgeHit(input.query, asset))
    .sort(compareHits)
    .slice(0, 3);
  const creatorAssets = (input.creatorAssets ?? [])
    .map((asset) => buildCreatorHit(input.query, asset))
    .sort(compareHits)
    .slice(0, 3);

  const bestCreator = creatorAssets[0];
  const bestKnowledge = knowledgeAssets[0];
  const bestFile = files[0];

  const recommendedAction: RecommendationAction =
    bestCreator && bestCreator.score >= Math.max(bestKnowledge?.score ?? 0, bestFile?.score ?? 0, 4)
      ? {
          kind: "resume_creator_workflow",
          label: "回到 Creator Studio",
          rationale: `当前最相关的是内容工作流资产「${bestCreator.title}」，更适合回到发布或复盘节点继续推进。`,
          jumpTarget: bestCreator.jumpTarget,
        }
      : bestKnowledge && bestKnowledge.score >= Math.max(bestFile?.score ?? 0, 4)
        ? {
            kind: "reuse_knowledge_asset",
            label: "优先复用知识资产",
            rationale: `当前最相关的是知识资产「${bestKnowledge.title}」，更适合先复用已有结构。`,
            jumpTarget: bestKnowledge.jumpTarget,
          }
        : bestFile && bestFile.score > 0
          ? {
              kind: "review_file",
              label: "先看相关文件",
              rationale: `当前最直接的线索来自文件「${bestFile.title}」，需要正文后才能进一步判断。`,
            }
          : {
              kind: "ask_for_context",
          label: "补充更多上下文",
          rationale: "当前命中信号不足，建议补充文件正文、知识资产关键词或更明确的业务问题。",
        };

  const sections: RecommendationSection[] = [
    { id: "files", label: "相关文件", hits: files },
    { id: "knowledge_assets", label: "相关知识资产", hits: knowledgeAssets },
    { id: "creator_assets", label: "相关内容资产", hits: creatorAssets },
  ];

  return {
    contractVersion: "v1",
    query: input.query,
    sections,
    recommendedAction,
  } satisfies RecommendationResult;
}
