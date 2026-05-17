import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function GET() {
  const icon = await readFile(join(process.cwd(), "public", "agentcore-logo.png"));
  return new Response(icon, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "image/png",
    },
  });
}
