import {
  listTaskStoreSnapshot,
  upsertTaskInStore,
  writeTasksToStore,
} from "@/lib/server/task-store";
import { createStateRouteHandlers } from "@/lib/server/state-route-factory";

export const runtime = "nodejs";

export const { GET, PUT, POST } = createStateRouteHandlers({
  resourceName: "task",
  pluralName: "tasks",
  listSnapshot: listTaskStoreSnapshot,
  writeAll: writeTasksToStore,
  upsertOne: upsertTaskInStore,
});
