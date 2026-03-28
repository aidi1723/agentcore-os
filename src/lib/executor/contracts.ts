export type AgentCoreExecutorLlmConfig = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export type AgentCoreTaskInput = {
  userMessage: string;
};

export type AgentCoreSessionRef = {
  id: string;
};

export type AgentCoreExecutionContext = {
  systemPrompt?: string;
  workspace?: Record<string, unknown> | null;
};

export type AgentCoreSkillPolicy = {
  enabled: boolean;
};

export type AgentCoreExecutionPolicy = {
  timeoutSeconds: number;
};

export type AgentCoreTaskRequest = {
  taskInput: AgentCoreTaskInput;
  session: AgentCoreSessionRef;
  context: AgentCoreExecutionContext;
  skillPolicy: AgentCoreSkillPolicy;
  modelConfig?: AgentCoreExecutorLlmConfig | null;
  executionPolicy: AgentCoreExecutionPolicy;
};

export type AgentCoreLegacyTaskRequest = {
  message?: string;
  sessionId?: string;
  timeoutSeconds?: number;
  systemPrompt?: string;
  useSkills?: boolean;
  workspaceContext?: Record<string, unknown> | null;
  llm?: AgentCoreExecutorLlmConfig | null;
};

export type AgentCoreTaskTrace = {
  source?: string;
  engine: "agentcore_executor" | "openclaw_cli_fallback";
  provider?: string;
  model?: string;
  sessionId: string;
  success: boolean;
  error?: string;
};

function normalizeTimeoutSeconds(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(5, Math.min(600, Math.floor(value)))
    : 60;
}

export function normalizeAgentCoreTaskRequest(
  input: AgentCoreLegacyTaskRequest,
  defaults?: { sessionId?: string },
): AgentCoreTaskRequest {
  const message = (input.message ?? "").trim();
  const sessionId = (input.sessionId ?? defaults?.sessionId ?? "webos-spotlight").trim();

  return {
    taskInput: {
      userMessage: message,
    },
    session: {
      id: sessionId || defaults?.sessionId || "webos-spotlight",
    },
    context: {
      systemPrompt: typeof input.systemPrompt === "string" ? input.systemPrompt : "",
      workspace:
        input.workspaceContext && typeof input.workspaceContext === "object"
          ? input.workspaceContext
          : null,
    },
    skillPolicy: {
      enabled: input.useSkills !== false,
    },
    modelConfig: input.llm ?? null,
    executionPolicy: {
      timeoutSeconds: normalizeTimeoutSeconds(input.timeoutSeconds),
    },
  };
}
