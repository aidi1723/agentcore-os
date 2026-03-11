export type FinancialDocumentType = "invoice" | "receipt" | "bill" | "expense";

export type FinancialDocumentRecord = {
  id: string;
  title: string;
  documentType: FinancialDocumentType;
  rawText: string;
  extracted: string;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const FINANCIAL_DOCS_KEY = "openclaw.financial_docs.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:financial-docs"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as FinancialDocumentRecord[];
  try {
    const raw = window.localStorage.getItem(FINANCIAL_DOCS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as FinancialDocumentRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: FinancialDocumentRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FINANCIAL_DOCS_KEY, JSON.stringify(next.slice(0, 80)));
  } catch {
    // ignore
  }
}

export function getFinancialDocuments() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createFinancialDocument(
  input?: Partial<Omit<FinancialDocumentRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const record: FinancialDocumentRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    title: input?.title?.trim() || "未命名财务文档",
    documentType: input?.documentType ?? "invoice",
    rawText: input?.rawText ?? "",
    extracted: input?.extracted ?? "",
    createdAt: now,
    updatedAt: now,
  };
  save([record, ...load()]);
  emit();
  return record.id;
}

export function updateFinancialDocument(
  id: string,
  patch: Partial<Omit<FinancialDocumentRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  save(
    load().map((record) =>
      record.id === id
        ? {
            ...record,
            ...patch,
            updatedAt: now,
          }
        : record,
    ),
  );
  emit();
}

export function removeFinancialDocument(id: string) {
  save(load().filter((record) => record.id !== id));
  emit();
}

export function subscribeFinancialDocuments(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
