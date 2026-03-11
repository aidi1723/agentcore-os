import { loadSettings, type InterfaceLanguage, type PersonalizationSettings } from "@/lib/settings";

export function getLanguageLabel(
  language: InterfaceLanguage,
  customLanguageLabel?: string,
) {
  if (language === "zh-CN") return "中文";
  if (language === "en-US") return "English";
  if (language === "ja-JP") return "日本語";
  return customLanguageLabel?.trim() || "other language";
}

export function getOutputLanguageInstruction(
  personalization?: Pick<PersonalizationSettings, "interfaceLanguage" | "customLanguageLabel">,
) {
  const settings = personalization ?? loadSettings().personalization;
  return `请使用${getLanguageLabel(
    settings.interfaceLanguage,
    settings.customLanguageLabel,
  )}输出。`;
}

export function getAssistantPromptHint(
  personalization?: Pick<PersonalizationSettings, "interfaceLanguage" | "customLanguageLabel">,
) {
  const settings = personalization ?? loadSettings().personalization;
  return (
    "例如：你是我的系统助手。说话简洁、注重可执行步骤；默认使用" +
    getLanguageLabel(settings.interfaceLanguage, settings.customLanguageLabel) +
    "回答；需要时给出安全提醒。"
  );
}
