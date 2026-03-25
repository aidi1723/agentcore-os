import { execText } from "@/lib/safeExec";

export async function getGatewayStatusText() {
  return await execText("openclaw", ["status", "--deep"], 20_000);
}

export async function getNodesStatusText() {
  return await execText("openclaw", ["nodes", "status"], 20_000);
}
