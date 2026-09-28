import { POST as runAgent } from "../../openclaw/agent/route";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;


  return runAgent(req);
}
