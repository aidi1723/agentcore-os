type LogLevel = "info" | "warn" | "error";

type LogEntry = {
  ts: string;
  level: LogLevel;
  component: string;
  event: string;
  requestId?: string;
  stepId?: string;
  durationMs?: number;
  detail?: string;
};

function emit(entry: LogEntry) {
  const line = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function executorLog(
  level: LogLevel,
  event: string,
  ctx?: { requestId?: string; stepId?: string; durationMs?: number; detail?: string },
) {
  emit({
    ts: new Date().toISOString(),
    level,
    component: "executor",
    event,
    ...ctx,
  });
}
