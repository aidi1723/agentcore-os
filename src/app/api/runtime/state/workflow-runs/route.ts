import {
  listWorkflowRunStoreSnapshot,
  upsertWorkflowRunInStore,
  writeWorkflowRunsToStore,
} from "@/lib/server/workflow-run-store";
import { createStateRouteHandlers } from "@/lib/server/state-route-factory";

export const runtime = "nodejs";

export const { GET, PUT, POST } = createStateRouteHandlers({
  resourceName: "workflowRun",
  pluralName: "workflowRuns",
  listSnapshot: listWorkflowRunStoreSnapshot,
  writeAll: writeWorkflowRunsToStore,
  upsertOne: upsertWorkflowRunInStore,
});
