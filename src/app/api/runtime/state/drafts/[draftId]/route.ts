import { removeDraftFromStore } from "@/lib/server/draft-store";
import { createDeleteHandler } from "@/lib/server/state-route-factory";

export const runtime = "nodejs";

export const DELETE = createDeleteHandler({
  resourceName: "draft",
  paramName: "draftId",
  removeOne: removeDraftFromStore,
});
