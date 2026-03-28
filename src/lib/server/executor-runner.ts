import {
  runAgentCoreTask,
} from "@/lib/executor/core";
import {
  normalizeAgentCoreTaskRequest,
  type AgentCoreLegacyTaskRequest,
  type AgentCoreTaskRequest,
} from "@/lib/executor/contracts";
import { appendExecutorSessionTurn } from "@/lib/server/executor-session-store";

export async function executeAgentCoreTask(
  request: (AgentCoreTaskRequest | AgentCoreLegacyTaskRequest) & { source?: string },
) {
  const normalizedRequest =
    "executionPolicy" in request &&
    "session" in request &&
    "taskInput" in request &&
    "context" in request &&
    "skillPolicy" in request
      ? request
      : {
          ...normalizeAgentCoreTaskRequest(request),
          source: request.source,
        };
  const startedAt = Date.now();
  const result = await runAgentCoreTask(normalizedRequest);
  const finishedAt = Date.now();

  await appendExecutorSessionTurn({
    sessionId: normalizedRequest.session.id,
    source: normalizedRequest.source ?? "api/openclaw/agent",
    engine: result.trace.engine,
    ok: result.ok,
    message: normalizedRequest.taskInput.userMessage,
    systemPrompt: normalizedRequest.context.systemPrompt ?? "",
    useSkills: normalizedRequest.skillPolicy.enabled,
    workspaceContext: normalizedRequest.context.workspace ?? null,
    llmProvider: normalizedRequest.modelConfig?.provider ?? "",
    llmModel: normalizedRequest.modelConfig?.model ?? "",
    timeoutSeconds: normalizedRequest.executionPolicy.timeoutSeconds,
    outputText: result.ok ? result.text : undefined,
    error: result.ok ? undefined : result.trace.error,
    durationMs: finishedAt - startedAt,
    createdAt: startedAt,
  });

  return result;
}
