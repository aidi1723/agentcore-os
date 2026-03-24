import { runOpenClawAgent, type OpenClawAgentResult } from "@/lib/openclaw-cli";
import { normalizeBaseUrl } from "@/lib/url-utils";

export type AgentCoreExecutorLlmConfig = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export type AgentCoreTaskRequest = {
  message: string;
  sessionId: string;
  timeoutSeconds?: number;
  systemPrompt?: string;
  useSkills?: boolean;
  workspaceContext?: Record<string, unknown> | null;
  llm?: AgentCoreExecutorLlmConfig | null;
};

export type AgentCoreTaskResult = OpenClawAgentResult & {
  engine: "agentcore_executor" | "openclaw_cli_fallback";
};

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

function normalizeTimeoutSeconds(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(5, Math.min(600, Math.floor(value)))
    : 60;
}

function detectProvider(config: Required<Pick<AgentCoreExecutorLlmConfig, "provider" | "baseUrl" | "model">>) {
  const provider = config.provider.trim().toLowerCase();
  const baseUrl = config.baseUrl.trim().toLowerCase();
  const model = config.model.trim().toLowerCase();

  if (provider === "anthropic") return "anthropic";
  if (baseUrl.includes("anthropic")) return "anthropic";
  if (model.startsWith("claude")) return "anthropic";
  return "openai_compatible";
}

function hasUsableLlmConfig(
  config?: AgentCoreExecutorLlmConfig | null,
): config is Required<AgentCoreExecutorLlmConfig> {
  return Boolean(
    config?.apiKey?.trim() &&
      normalizeBaseUrl(config?.baseUrl ?? "") &&
      config?.model?.trim(),
  );
}

function buildWorkspaceContextText(context?: Record<string, unknown> | null) {
  if (!context || typeof context !== "object") return "";

  const entries = Object.entries(context)
    .filter(([, value]) =>
      typeof value === "string" || typeof value === "number" || typeof value === "boolean",
    )
    .map(([key, value]) => `${key}=${String(value).trim()}`)
    .filter((entry) => !entry.endsWith("="));

  return entries.length > 0 ? entries.join(", ") : "";
}

export function buildAgentCoreSystemPrompt(request: AgentCoreTaskRequest) {
  const parts: string[] = [];
  const explicit = String(request.systemPrompt ?? "").trim();
  if (explicit) parts.push(explicit);

  parts.push(
    "You are AgentCore OS, an execution-focused business operating system.",
    "Prioritize stability, precision, and efficiency.",
    "Return concrete, reviewable outputs that can be used directly in a business workflow.",
  );

  const workspaceText = buildWorkspaceContextText(request.workspaceContext);
  if (workspaceText) {
    parts.push(`Workspace context: ${workspaceText}`);
  }

  if (request.useSkills) {
    parts.push(
      "Use the available AgentCore OS operating context to produce structured, execution-ready outputs.",
      "Do not invent facts, policies, prices, timelines, or workflow state that were not provided.",
      "If key information is missing, say so explicitly and request the missing fields.",
    );
  }

  return parts.filter(Boolean).join("\n\n").trim();
}

function shouldUseMaxCompletionTokens(model: string) {
  const normalized = model.trim().toLowerCase();
  const parts = normalized.split("/");
  const resolved = parts[parts.length - 1] || normalized;
  return (
    resolved.startsWith("gpt-5") ||
    resolved.startsWith("o1") ||
    resolved.startsWith("o3") ||
    resolved.startsWith("o4")
  );
}

function buildOpenAiCompatibleChatUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";
  if (normalized.endsWith("/chat/completions")) return normalized;
  if (normalized.endsWith("/v1")) return `${normalized}/chat/completions`;
  return `${normalized}/v1/chat/completions`;
}

function buildAnthropicMessagesUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";
  if (normalized.endsWith("/v1/messages")) return normalized;
  return `${normalized.replace(/\/+$/, "")}/v1/messages`;
}

async function callOpenAiCompatibleModel(
  config: Required<AgentCoreExecutorLlmConfig>,
  messages: ChatMessage[],
  timeoutSeconds: number,
) {
  const url = buildOpenAiCompatibleChatUrl(config.baseUrl);
  if (!url) {
    throw new Error("缺少可用的模型 Base URL");
  }

  const payload: Record<string, unknown> = {
    model: config.model,
    messages,
    stream: false,
  };

  if (shouldUseMaxCompletionTokens(config.model)) {
    payload.max_completion_tokens = 4096;
  } else {
    payload.max_tokens = 4096;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });

    const data = (await response.json().catch(() => null)) as
      | null
      | {
          choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
          error?: unknown;
        };

    if (!response.ok) {
      const detail =
        data && typeof data === "object" && "error" in data
          ? JSON.stringify(data.error)
          : `${response.status} ${response.statusText}`;
      throw new Error(`模型接口调用失败：${detail}`);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim()) return content.trim();
    if (Array.isArray(content)) {
      const text = content
        .map((item) => (typeof item?.text === "string" ? item.text : ""))
        .filter(Boolean)
        .join("\n")
        .trim();
      if (text) return text;
    }
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callAnthropicModel(
  config: Required<AgentCoreExecutorLlmConfig>,
  userMessage: string,
  systemPrompt: string,
  timeoutSeconds: number,
) {
  const url = buildAnthropicMessagesUrl(config.baseUrl);
  if (!url) {
    throw new Error("缺少可用的模型 Base URL");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        system: systemPrompt || undefined,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const data = (await response.json().catch(() => null)) as
      | null
      | { content?: Array<{ type?: string; text?: string }>; error?: unknown };

    if (!response.ok) {
      const detail =
        data && typeof data === "object" && "error" in data
          ? JSON.stringify(data.error)
          : `${response.status} ${response.statusText}`;
      throw new Error(`模型接口调用失败：${detail}`);
    }

    const text = Array.isArray(data?.content)
      ? data.content
          .map((item) =>
            item?.type === "text" && typeof item.text === "string" ? item.text : "",
          )
          .filter(Boolean)
          .join("\n")
          .trim()
      : "";
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function runAgentCoreTask(
  request: AgentCoreTaskRequest,
): Promise<AgentCoreTaskResult> {
  const timeoutSeconds = normalizeTimeoutSeconds(request.timeoutSeconds);
  const llm = request.llm ?? null;

  if (!hasUsableLlmConfig(llm)) {
    const fallback = await runOpenClawAgent({
      message: request.message,
      sessionId: request.sessionId,
      timeoutSeconds,
    });
    return { ...fallback, engine: "openclaw_cli_fallback" };
  }

  const normalizedLlm: Required<AgentCoreExecutorLlmConfig> = {
    provider: String(llm.provider ?? "openai"),
    apiKey: llm.apiKey.trim(),
    baseUrl: normalizeBaseUrl(llm.baseUrl),
    model: llm.model.trim(),
  };

  const systemPrompt = buildAgentCoreSystemPrompt(request);
  const provider = detectProvider(normalizedLlm);

  try {
    const text =
      provider === "anthropic"
        ? await callAnthropicModel(
            normalizedLlm,
            request.message,
            systemPrompt,
            timeoutSeconds,
          )
        : await callOpenAiCompatibleModel(
            normalizedLlm,
            [
              ...(systemPrompt
                ? ([{ role: "system", content: systemPrompt }] as ChatMessage[])
                : []),
              { role: "user", content: request.message },
            ],
            timeoutSeconds,
          );

    return {
      ok: true,
      text: text.trim(),
      raw: { provider, sessionId: request.sessionId },
      engine: "agentcore_executor",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "执行失败",
      engine: "agentcore_executor",
    };
  }
}
