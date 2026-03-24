import { readJsonFile, readModifyWrite } from "@/lib/server/json-store";

const FILE_NAME = "executor-sessions.json";
const MAX_SESSIONS = 120;
const MAX_TURNS_PER_SESSION = 80;

export type ExecutorSessionTurnRecord = {
  id: string;
  createdAt: number;
  durationMs: number;
  source: string;
  engine: string;
  ok: boolean;
  message: string;
  systemPrompt: string;
  useSkills: boolean;
  workspaceContext: Record<string, string | number | boolean>;
  llmProvider: string;
  llmModel: string;
  timeoutSeconds: number;
  outputText?: string;
  error?: string;
};

export type ExecutorSessionRecord = {
  id: string;
  title: string;
  updatedAt: number;
  lastEngine: string;
  lastStatus: "ok" | "error";
  lastMessage: string;
  lastOutputPreview: string;
  turns: ExecutorSessionTurnRecord[];
};

function clipText(value: string, limit: number) {
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, Math.max(1, limit - 1))}…`;
}

function sanitizeWorkspaceContext(
  input?: Record<string, unknown> | null,
): Record<string, string | number | boolean> {
  if (!input || typeof input !== "object") return {};

  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) result[key] = clipText(trimmed, 240);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      result[key] = value;
    }
  }
  return result;
}

function normalizeTurn(input: ExecutorSessionTurnRecord): ExecutorSessionTurnRecord {
  return {
    id: clipText(input.id, 120),
    createdAt:
      typeof input.createdAt === "number" && Number.isFinite(input.createdAt)
        ? input.createdAt
        : Date.now(),
    durationMs:
      typeof input.durationMs === "number" && Number.isFinite(input.durationMs)
        ? Math.max(0, Math.floor(input.durationMs))
        : 0,
    source: clipText(input.source || "agentcore", 120) || "agentcore",
    engine: clipText(input.engine || "unknown", 120) || "unknown",
    ok: Boolean(input.ok),
    message: clipText(input.message || "", 12_000),
    systemPrompt: clipText(input.systemPrompt || "", 12_000),
    useSkills: Boolean(input.useSkills),
    workspaceContext: sanitizeWorkspaceContext(input.workspaceContext),
    llmProvider: clipText(input.llmProvider || "", 120),
    llmModel: clipText(input.llmModel || "", 240),
    timeoutSeconds:
      typeof input.timeoutSeconds === "number" && Number.isFinite(input.timeoutSeconds)
        ? Math.max(0, Math.floor(input.timeoutSeconds))
        : 0,
    outputText:
      typeof input.outputText === "string" && input.outputText.trim()
        ? clipText(input.outputText, 20_000)
        : undefined,
    error:
      typeof input.error === "string" && input.error.trim()
        ? clipText(input.error, 4_000)
        : undefined,
  };
}

function normalizeSession(input: unknown): ExecutorSessionRecord | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  if (!id) return null;

  const rawTurns = Array.isArray(item.turns) ? item.turns : [];
  const turns = rawTurns
    .filter((turn): turn is ExecutorSessionTurnRecord => Boolean(turn && typeof turn === "object"))
    .map((turn) => normalizeTurn(turn))
    .slice(-MAX_TURNS_PER_SESSION);

  return {
    id,
    title:
      typeof item.title === "string" && item.title.trim()
        ? clipText(item.title, 120)
        : clipText(turns[0]?.message ?? "新会话", 120) || "新会话",
    updatedAt:
      typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
        ? item.updatedAt
        : turns[turns.length - 1]?.createdAt ?? Date.now(),
    lastEngine:
      typeof item.lastEngine === "string" && item.lastEngine.trim()
        ? clipText(item.lastEngine, 120)
        : turns[turns.length - 1]?.engine ?? "unknown",
    lastStatus: item.lastStatus === "error" ? "error" : "ok",
    lastMessage:
      typeof item.lastMessage === "string"
        ? clipText(item.lastMessage, 240)
        : clipText(turns[turns.length - 1]?.message ?? "", 240),
    lastOutputPreview:
      typeof item.lastOutputPreview === "string"
        ? clipText(item.lastOutputPreview, 240)
        : clipText(turns[turns.length - 1]?.outputText ?? turns[turns.length - 1]?.error ?? "", 240),
    turns,
  };
}

async function readAllSessions() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  return raw
    .map(normalizeSession)
    .filter((session): session is ExecutorSessionRecord => Boolean(session))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_SESSIONS);
}

export async function listExecutorSessions() {
  return readAllSessions();
}

export async function getExecutorSession(sessionId: string) {
  const sessions = await readAllSessions();
  return sessions.find((session) => session.id === sessionId) ?? null;
}

export async function appendExecutorSessionTurn(input: {
  sessionId: string;
  source: string;
  engine: string;
  ok: boolean;
  message: string;
  systemPrompt?: string;
  useSkills?: boolean;
  workspaceContext?: Record<string, unknown> | null;
  llmProvider?: string;
  llmModel?: string;
  timeoutSeconds?: number;
  outputText?: string;
  error?: string;
  durationMs?: number;
  createdAt?: number;
}) {
  const sessionId = input.sessionId.trim();
  if (!sessionId) return null;

  const turn = normalizeTurn({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: input.createdAt ?? Date.now(),
    durationMs: input.durationMs ?? 0,
    source: input.source,
    engine: input.engine,
    ok: input.ok,
    message: input.message,
    systemPrompt: input.systemPrompt ?? "",
    useSkills: input.useSkills ?? false,
    workspaceContext: sanitizeWorkspaceContext(input.workspaceContext),
    llmProvider: input.llmProvider ?? "",
    llmModel: input.llmModel ?? "",
    timeoutSeconds: input.timeoutSeconds ?? 0,
    outputText: input.outputText,
    error: input.error,
  });

  let updatedRecord: ExecutorSessionRecord | null = null;
  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const sessions = current
      .map(normalizeSession)
      .filter((session): session is ExecutorSessionRecord => Boolean(session));

    const existing = sessions.find((session) => session.id === sessionId);
    const nextTurns = [...(existing?.turns ?? []), turn].slice(-MAX_TURNS_PER_SESSION);
    const nextRecord: ExecutorSessionRecord = {
      id: sessionId,
      title:
        existing?.title && existing.title !== "新会话"
          ? existing.title
          : clipText(turn.message, 120) || "新会话",
      updatedAt: turn.createdAt,
      lastEngine: turn.engine,
      lastStatus: turn.ok ? "ok" : "error",
      lastMessage: clipText(turn.message, 240),
      lastOutputPreview: clipText(turn.outputText ?? turn.error ?? "", 240),
      turns: nextTurns,
    };
    updatedRecord = nextRecord;

    const nextSessions = [
      nextRecord,
      ...sessions.filter((session) => session.id !== sessionId),
    ]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_SESSIONS);

    return nextSessions;
  });

  return updatedRecord;
}
