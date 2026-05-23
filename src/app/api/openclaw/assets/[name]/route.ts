import { serveOutputAsset } from "@/lib/server/output-asset-route";

export const runtime = "nodejs";
export const dynamicParams = false;

export function generateStaticParams() {
  return [];
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  return serveOutputAsset(name);
}
