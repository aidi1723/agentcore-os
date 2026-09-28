import { POST as generateCopy } from "../../openclaw/copy/route";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;


  return generateCopy(req);
}
