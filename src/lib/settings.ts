import { getJsonFromStorage, setJsonToStorage } from "@/lib/storage";

export type LlmProviderId = "kimi" | "deepseek" | "openai" | "qwen";

export type LlmProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type LlmLibrarySettings = {
  activeProvider: LlmProviderId;
  providers: Record<LlmProviderId, LlmProviderConfig>;
};

export type AssistantSettings = {
  systemPrompt: string;
};

export type OpenClawEngineSettings = {
  baseUrl: string;
  apiToken: string;
};

export type MatrixAccountsSettings = {
  xiaohongshu: { token: string; webhookUrl: string };
  douyin: { token: string; webhookUrl: string };
  instagram: { token: string; webhookUrl: string };
  tiktok: { token: string; webhookUrl: string };
  storefront: { token: string; webhookUrl: string };
};

export type PersonalizationSettings = {
  desktopBackground: "aurora" | "ocean" | "sunset";
};

export type AppSettings = {
  llm: LlmLibrarySettings;
  assistant: AssistantSettings;
  openclaw: OpenClawEngineSettings;
  matrixAccounts: MatrixAccountsSettings;
  personalization: PersonalizationSettings;
};

export const defaultSettings: AppSettings = {
  llm: {
    activeProvider: "kimi",
    providers: {
      kimi: {
        apiKey: "",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "moonshot-v1-8k",
      },
      deepseek: {
        apiKey: "",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-chat",
      },
      openai: {
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      },
      qwen: {
        apiKey: "",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: "qwen-plus",
      },
    },
  },
  assistant: {
    systemPrompt: "",
  },
  openclaw: {
    // Leave empty by default: local-first. Creative Studio can fallback to local video-frames (ffmpeg).
    baseUrl: "",
    apiToken: "",
  },
  matrixAccounts: {
    xiaohongshu: { token: "", webhookUrl: "" },
    douyin: { token: "", webhookUrl: "" },
    instagram: { token: "", webhookUrl: "" },
    tiktok: { token: "", webhookUrl: "" },
    storefront: { token: "", webhookUrl: "" },
  },
  personalization: {
    desktopBackground: "aurora",
  },
};

const SETTINGS_KEY = "openclaw.settings.v1";

function mergeSettings(saved: Partial<AppSettings> | null | undefined): AppSettings {
  const savedAny = saved as any;
  const legacyKimi = savedAny?.kimi as
    | undefined
    | { apiKey?: string; baseUrl?: string; model?: string };
  const llmFromSaved = (saved as any)?.llm as Partial<LlmLibrarySettings> | undefined;

  const llmMerged: LlmLibrarySettings = {
    ...defaultSettings.llm,
    ...(llmFromSaved ?? {}),
    providers: {
      ...defaultSettings.llm.providers,
      ...(llmFromSaved?.providers ?? {}),
    },
  };

  // Back-compat: if old `kimi` exists, merge it into llm.providers.kimi
  if (legacyKimi && (!llmFromSaved || !llmFromSaved.providers?.kimi)) {
    llmMerged.providers.kimi = {
      ...llmMerged.providers.kimi,
      ...(legacyKimi as any),
    };
  }

  return {
    ...defaultSettings,
    ...(saved ?? {}),
    llm: llmMerged,
    assistant: { ...defaultSettings.assistant, ...(saved?.assistant ?? {}) },
    openclaw: (() => {
      const merged = { ...defaultSettings.openclaw, ...(saved?.openclaw ?? {}) };
      const legacyDefaults = new Set([
        "http://localhost:7777",
        "http://127.0.0.1:7777",
        "localhost:7777",
        "127.0.0.1:7777",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "127.0.0.1:8000",
        "localhost:8000",
      ]);
      if (legacyDefaults.has((merged.baseUrl ?? "").trim())) {
        return { ...merged, baseUrl: defaultSettings.openclaw.baseUrl };
      }
      return merged;
    })(),
    matrixAccounts: {
      ...defaultSettings.matrixAccounts,
      ...(saved?.matrixAccounts ?? {}),
      xiaohongshu: {
        ...defaultSettings.matrixAccounts.xiaohongshu,
        ...(saved?.matrixAccounts?.xiaohongshu ?? {}),
      },
      douyin: {
        ...defaultSettings.matrixAccounts.douyin,
        ...(saved?.matrixAccounts?.douyin ?? {}),
      },
      instagram: {
        ...defaultSettings.matrixAccounts.instagram,
        ...(saved?.matrixAccounts?.instagram ?? {}),
      },
      tiktok: {
        ...defaultSettings.matrixAccounts.tiktok,
        ...(saved?.matrixAccounts?.tiktok ?? {}),
      },
      storefront: {
        ...defaultSettings.matrixAccounts.storefront,
        ...(saved?.matrixAccounts?.storefront ?? {}),
      },
    },
    personalization: {
      ...defaultSettings.personalization,
      ...(saved?.personalization ?? {}),
    },
  };
}

export function loadSettings(): AppSettings {
  const saved = getJsonFromStorage<Partial<AppSettings>>(
    SETTINGS_KEY,
    defaultSettings,
  );
  return mergeSettings(saved);
}

export function saveSettings(next: AppSettings) {
  setJsonToStorage(SETTINGS_KEY, next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:settings"));
  }
}

export function getActiveLlmConfig(settings: AppSettings) {
  const id = settings.llm.activeProvider;
  return { id, config: settings.llm.providers[id] };
}
