import type { CreatorAssetRecord } from "@/lib/creator-assets";
import type { PublishPlatformId } from "@/lib/publish";

export type CreatorAssetFilterId = "all" | "in_flight" | "successful" | "retryable";

export type CreatorAssetSortId = "updated" | "reviewed" | "success_signal" | "retry_priority";

export type CreatorAssetQuery = {
  q?: string;
  filter?: CreatorAssetFilterId;
  platform?: PublishPlatformId | "all";
  sort?: CreatorAssetSortId;
  limit?: number;
};

function isInFlight(asset: CreatorAssetRecord) {
  return (
    asset.status === "publishing" ||
    asset.publishStatus.endsWith("_queued") ||
    asset.publishStatus.endsWith("_running")
  );
}

function compareByUpdated(left: CreatorAssetRecord, right: CreatorAssetRecord) {
  if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt;
  if (left.createdAt !== right.createdAt) return right.createdAt - left.createdAt;
  return right.id.localeCompare(left.id, "en");
}

function compareByReviewed(left: CreatorAssetRecord, right: CreatorAssetRecord) {
  const leftReviewedAt = left.lastReviewedAt ?? 0;
  const rightReviewedAt = right.lastReviewedAt ?? 0;
  if (leftReviewedAt !== rightReviewedAt) return rightReviewedAt - leftReviewedAt;
  return compareByUpdated(left, right);
}

function compareBySuccessSignal(left: CreatorAssetRecord, right: CreatorAssetRecord) {
  if (left.successfulPlatforms.length !== right.successfulPlatforms.length) {
    return right.successfulPlatforms.length - left.successfulPlatforms.length;
  }
  const leftSignalCount = left.successfulPlatforms.length + left.failedPlatforms.length;
  const rightSignalCount = right.successfulPlatforms.length + right.failedPlatforms.length;
  if (leftSignalCount !== rightSignalCount) {
    return rightSignalCount - leftSignalCount;
  }
  if (left.failedPlatforms.length !== right.failedPlatforms.length) {
    return left.failedPlatforms.length - right.failedPlatforms.length;
  }
  return compareByReviewed(left, right);
}

function compareByRetryPriority(left: CreatorAssetRecord, right: CreatorAssetRecord) {
  if (left.retryablePlatforms.length !== right.retryablePlatforms.length) {
    return right.retryablePlatforms.length - left.retryablePlatforms.length;
  }
  if (left.failedPlatforms.length !== right.failedPlatforms.length) {
    return right.failedPlatforms.length - left.failedPlatforms.length;
  }
  return compareByReviewed(left, right);
}

function matchesPlatform(asset: CreatorAssetRecord, platform?: PublishPlatformId | "all") {
  if (!platform || platform === "all") return true;
  return (
    asset.publishTargets.includes(platform) ||
    asset.successfulPlatforms.includes(platform) ||
    asset.failedPlatforms.includes(platform) ||
    asset.retryablePlatforms.includes(platform)
  );
}

function matchesFilter(asset: CreatorAssetRecord, filter: CreatorAssetFilterId) {
  switch (filter) {
    case "in_flight":
      return isInFlight(asset);
    case "successful":
      return asset.successfulPlatforms.length > 0;
    case "retryable":
      return asset.retryablePlatforms.length > 0;
    case "all":
    default:
      return true;
  }
}

function matchesKeyword(asset: CreatorAssetRecord, q?: string) {
  const keyword = q?.trim().toLowerCase();
  if (!keyword) return true;
  return [
    asset.topic,
    asset.audience,
    asset.primaryAngle,
    asset.latestDraftTitle,
    asset.latestDraftBody,
    asset.latestPublishFeedback,
    asset.reuseNotes,
    asset.publishStatus,
    asset.publishTargets.join(" "),
    asset.successfulPlatforms.join(" "),
    asset.failedPlatforms.join(" "),
    asset.retryablePlatforms.join(" "),
  ]
    .join("\n")
    .toLowerCase()
    .includes(keyword);
}

export function queryCreatorAssets(
  items: CreatorAssetRecord[],
  query: CreatorAssetQuery = {},
) {
  const filter = query.filter ?? "all";
  const sort = query.sort ?? "updated";
  const platform = query.platform ?? "all";
  const limit = Number.isFinite(query.limit) ? Math.max(1, Number(query.limit)) : null;

  const filtered = items.filter(
    (asset) =>
      matchesFilter(asset, filter) &&
      matchesPlatform(asset, platform) &&
      matchesKeyword(asset, query.q),
  );

  const sorted = (() => {
    switch (sort) {
      case "reviewed":
        return filtered.sort(compareByReviewed);
      case "success_signal":
        return filtered.sort(compareBySuccessSignal);
      case "retry_priority":
        return filtered.sort(compareByRetryPriority);
      case "updated":
      default:
        return filtered.sort(compareByUpdated);
    }
  })();

  return limit ? sorted.slice(0, limit) : sorted;
}
