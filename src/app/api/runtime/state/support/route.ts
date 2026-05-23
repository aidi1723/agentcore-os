import {
  listSupportTicketStoreSnapshot,
  upsertSupportTicketInStore,
  writeSupportTicketsToStore,
} from "@/lib/server/support-ticket-store";
import { createStateRouteHandlers } from "@/lib/server/state-route-factory";

export const runtime = "nodejs";

export const { GET, PUT, POST } = createStateRouteHandlers({
  resourceName: "ticket",
  pluralName: "tickets",
  listSnapshot: listSupportTicketStoreSnapshot,
  writeAll: writeSupportTicketsToStore,
  upsertOne: upsertSupportTicketInStore,
});
