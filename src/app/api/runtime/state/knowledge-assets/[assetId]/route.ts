import { removeKnowledgeAssetFromStore } from "@/lib/server/knowledge-asset-store";
import { createDeleteHandler } from "@/lib/server/state-route-factory";

export const runtime = "nodejs";

export const DELETE = createDeleteHandler({
  resourceName: "knowledge asset",
  paramName: "assetId",
  removeOne: removeKnowledgeAssetFromStore,
});
