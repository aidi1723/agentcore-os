import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { POST as generateCopy } from "@/app/api/copy/generate/route";
import { POST as testKimi } from "@/app/api/kimi/test/route";
import { GET as gatewayHealth } from "@/app/api/openclaw/gateway/health/route";
import { GET as listJobs, POST as createJob } from "@/app/api/publish/jobs/route";
import { DELETE as deleteWorkflowRun } from "@/app/api/runtime/state/workflow-runs/[runId]/route";
import { GET as readAsset } from "@/app/api/runtime/media/assets/[name]/route";

function walkRoutes(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...walkRoutes(fullPath));
      continue;
    }
    if (entry === "route.ts") files.push(fullPath);
  }
  return files;
}

describe("API local host gate", () => {
  it("calls the local guard, the state route factory, or the delete factory in every route", () => {
    const routeDir = path.join(process.cwd(), "src/app/api");
    const missing = walkRoutes(routeDir).filter((file) => {
      const source = readFileSync(file, "utf8");
      return !(
        source.includes("rejectUnauthorizedLocalApiRequest(") ||
        source.includes("createStateRouteHandlers(") ||
        source.includes("createDeleteHandler(")
      );
    });
    expect(missing).toEqual([]);
  });

  it("rejects non-local callers before route work", async () => {
    const remote = "http://10.1.2.3";
    const responses = await Promise.all([
      generateCopy(new Request(`${remote}/api/copy/generate`, { method: "POST" })),
      testKimi(
        new Request(`${remote}/api/kimi/test`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            apiKey: "secret",
            baseUrl: "http://169.254.169.254",
          }),
        }),
      ),
      gatewayHealth(new Request(`${remote}/api/openclaw/gateway/health`)),
      listJobs(new Request(`${remote}/api/publish/jobs`)),
      createJob(
        new Request(`${remote}/api/publish/jobs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ draftTitle: "remote" }),
        }),
      ),
      deleteWorkflowRun(new Request(`${remote}/api/runtime/state/workflow-runs/run-1`, { method: "DELETE" }), {
        params: Promise.resolve({ runId: "run-1" }),
      }),
      readAsset(new Request(`${remote}/api/runtime/media/assets/demo.png`), {
        params: Promise.resolve({ name: "demo.png" }),
      }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([403, 403, 403, 403, 403, 403, 403]);
  });

  it("rejects a local Kimi test aimed at a loopback address", async () => {
    const response = await testKimi(
      new Request("http://127.0.0.1/api/kimi/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey: "secret",
          baseUrl: "http://127.0.0.1:9",
        }),
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Base URL 不在允许的外连范围内",
    });
  });

  it("still accepts a local copy request that reaches validation", async () => {
    const response = await generateCopy(
      new Request("http://127.0.0.1/api/copy/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: "本地发布" }),
      }),
    );
    expect(response.status).toBe(200);
  });
});
