export class RequestBodyError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestBodyError";
    this.status = status;
  }
}

function isJsonContentType(value: string | null) {
  if (!value) return true;
  const normalized = value.toLowerCase();
  return normalized.includes("application/json") || normalized.includes("+json");
}

async function readTextWithLimit(req: Request, maxBytes: number) {
  const body = req.body;
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let raw = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RequestBodyError("Request body too large.", 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    return raw;
  } finally {
    reader.releaseLock();
  }
}

export async function readJsonBodyWithLimit<T>(
  req: Request,
  maxBytes: number,
): Promise<T | null> {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new RequestBodyError("Invalid body size limit.", 500);
  }

  const contentType = req.headers.get("content-type");
  if (!isJsonContentType(contentType)) {
    throw new RequestBodyError("Content-Type must be application/json.", 415);
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyError("Request body too large.", 413);
  }

  const raw = await readTextWithLimit(req, maxBytes);
  if (!raw.trim()) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new RequestBodyError("Invalid JSON body.", 400);
  }
}

export function getRequestBodyErrorStatus(error: unknown, fallbackStatus = 500) {
  if (error instanceof RequestBodyError) return error.status;
  return fallbackStatus;
}
