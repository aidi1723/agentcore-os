import { removeSupportTicketFromStore } from "@/lib/server/support-ticket-store";
import { createDeleteHandler } from "@/lib/server/state-route-factory";

export const runtime = "nodejs";

export const DELETE = createDeleteHandler({
  resourceName: "support ticket",
  paramName: "ticketId",
  removeOne: removeSupportTicketFromStore,
});
