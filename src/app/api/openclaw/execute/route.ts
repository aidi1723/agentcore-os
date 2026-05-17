import { POST as executeMediaRuntime } from "../../runtime/media/process/route";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return executeMediaRuntime(req);
}

