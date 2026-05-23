import { removeTaskFromStore } from "@/lib/server/task-store";
import { createDeleteHandler } from "@/lib/server/state-route-factory";

export const runtime = "nodejs";

export const DELETE = createDeleteHandler({
  resourceName: "task",
  paramName: "taskId",
  removeOne: removeTaskFromStore,
});
