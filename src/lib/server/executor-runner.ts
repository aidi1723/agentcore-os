import {
  runAgentCoreTask,
  type AgentCoreTaskRequest,
} from "@/lib/executor/core";
import { appendExecutorSessionTurn } from "@/lib/server/executor-session-store";

export async function executeAgentCoreTask(
  request: AgentCoreTaskRequest & { source?: string },
) {
  const startedAt = Date.now();
  const result = await runAgentCoreTask(request);
  const finishedAt = Date.now();

  await appendExecutorSessionTurn({
    sessionId: request.sessionId,
    source: request.source ?? "api/openclaw/agent",
    engine: result.engine,
    ok: result.ok,
    message: request.message,
    systemPrompt: request.systemPrompt ?? "",
    useSkills: request.useSkills ?? false,
    workspaceContext: request.workspaceContext ?? null,
    llmProvider: request.llm?.provider ?? "",
    llmModel: request.llm?.model ?? "",
    timeoutSeconds: request.timeoutSeconds ?? 60,
    outputText: result.ok ? result.text : undefined,
    error: result.ok ? undefined : result.error,
    durationMs: finishedAt - startedAt,
    createdAt: startedAt,
  });

  return result;
}
