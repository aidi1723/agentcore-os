import { serveOutputAsset } from "@/lib/server/output-asset-route";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";

export const runtime = "nodejs";
export const dynamicParams = false;

export function generateStaticParams() {
  return [];
}

export async function GET(req: Request,
  ctx: { params: Promise<{ name: string }> },) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;


  const { name } = await ctx.params;
  return serveOutputAsset(name);
}
