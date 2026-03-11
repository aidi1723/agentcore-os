import type { AppId } from "@/apps/types";
import type { ContactStatus } from "@/lib/crm";
import type { DealStage } from "@/lib/deals";
import type { EmailTone } from "@/lib/email-assistant";
import type { LlmProviderId } from "@/lib/settings";

export type SettingsTargetTab = "llm" | "engine" | "matrix" | "personalization";

export type DealDeskPrefill = {
  company?: string;
  contact?: string;
  need?: string;
  budget?: string;
  timing?: string;
  notes?: string;
  stage?: DealStage;
};

export type EmailAssistantPrefill = {
  subject?: string;
  recipient?: string;
  context?: string;
  goal?: string;
  tone?: EmailTone;
  draft?: string;
};

export type PersonalCrmPrefill = {
  name?: string;
  company?: string;
  role?: string;
  status?: ContactStatus;
  lastTouch?: string;
  nextStep?: string;
  notes?: string;
};

export type KnowledgeVaultPrefill = {
  query?: string;
};

export type ContentRepurposerPrefill = {
  title?: string;
  sourceType?: import("@/lib/content-repurposer").RepurposeSourceType;
  audience?: string;
  goal?: string;
  sourceContent?: string;
};

export type CreatorRadarPrefill = {
  title?: string;
  channels?: string;
  audience?: string;
  goal?: string;
  notes?: string;
  digest?: string;
};

export type MorningBriefPrefill = {
  focus?: string;
  notes?: string;
};

type OpenAppDetail = {
  appId: AppId;
  settingsTab?: SettingsTargetTab;
  providerId?: LlmProviderId;
  dealPrefill?: DealDeskPrefill;
  emailDraft?: EmailAssistantPrefill;
  crmPrefill?: PersonalCrmPrefill;
  vaultPrefill?: KnowledgeVaultPrefill;
  repurposerPrefill?: ContentRepurposerPrefill;
  creatorRadarPrefill?: CreatorRadarPrefill;
  morningBriefPrefill?: MorningBriefPrefill;
};

export function requestOpenApp(
  appId: AppId,
  options?: Omit<OpenAppDetail, "appId">,
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenAppDetail>("openclaw:open-app", {
      detail: { appId, ...options },
    }),
  );
}

export function requestOpenSettings(settingsTab: SettingsTargetTab) {
  requestOpenApp("settings", { settingsTab });
}

export function requestOpenDealDesk(prefill?: DealDeskPrefill) {
  requestOpenApp("deal_desk", { dealPrefill: prefill });
}

export function requestComposeEmail(prefill?: EmailAssistantPrefill) {
  requestOpenApp("email_assistant", { emailDraft: prefill });
}

export function requestOpenCrm(prefill?: PersonalCrmPrefill) {
  requestOpenApp("personal_crm", { crmPrefill: prefill });
}

export function requestOpenKnowledgeVault(prefill?: KnowledgeVaultPrefill) {
  requestOpenApp("knowledge_vault", { vaultPrefill: prefill });
}

export function requestOpenContentRepurposer(prefill?: ContentRepurposerPrefill) {
  requestOpenApp("content_repurposer", { repurposerPrefill: prefill });
}

export function requestOpenCreatorRadar(prefill?: CreatorRadarPrefill) {
  requestOpenApp("creator_radar", { creatorRadarPrefill: prefill });
}

export function requestOpenMorningBrief(prefill?: MorningBriefPrefill) {
  requestOpenApp("morning_brief", { morningBriefPrefill: prefill });
}
