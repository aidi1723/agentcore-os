import { removeDealFromStore } from "@/lib/server/deal-store";
import { createDeleteHandler } from "@/lib/server/state-route-factory";

export const runtime = "nodejs";

export const DELETE = createDeleteHandler({
  resourceName: "deal",
  paramName: "dealId",
  removeOne: removeDealFromStore,
});
