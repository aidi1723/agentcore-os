import type { AppId } from "@/apps/types";
import type { PublishPlatformId } from "@/lib/publish";
import type { ContactStatus } from "@/lib/crm";
import type { DealStage } from "@/lib/deals";
import type { EmailTone } from "@/lib/email-assistant";
import type { ProjectHealth } from "@/lib/project-ops";
import type { RecruitingStage } from "@/lib/recruiting";
import type { CreatorWorkflowMeta } from "@/lib/creator-workflow";
import type { SalesWorkflowMeta } from "@/lib/sales-workflow";
import { dispatchRuntimeEvent, normalizeRuntimeAppId, RuntimeEventNames } from "@/lib/runtime-events";
import type { LlmProviderId } from "@/lib/settings";
import type { SupportChannel, SupportStatus } from "@/lib/support";
import type { WorkflowContextMeta } from "@/lib/workflow-context";

export type SettingsTargetTab = "llm" | "engine" | "matrix" | "personalization";

export type DealDeskPrefill = {
  assetId?: string;
  sourceKey?: string;
  company?: string;
  contact?: string;
  inquiryChannel?: string;
  preferredLanguage?: string;
  productLine?: string;
  need?: string;
  budget?: string;
  timing?: string;
  notes?: string;
  stage?: DealStage;
} & SalesWorkflowMeta;

export type EmailAssistantPrefill = {
  subject?: string;
  recipient?: string;
  context?: string;
  goal?: string;
  tone?: EmailTone;
  draft?: string;
} & SalesWorkflowMeta;

export type PersonalCrmPrefill = {
  name?: string;
  company?: string;
  role?: string;
  status?: ContactStatus;
  lastTouch?: string;
  nextStep?: string;
  notes?: string;
} & SalesWorkflowMeta;

export type KnowledgeVaultPrefill = {
  assetId?: string;
  sourceKey?: string;
  workflowRunId?: string;
  query?: string;
};

export type SupportCopilotPrefill = {
  customer?: string;
  channel?: SupportChannel;
  subject?: string;
  message?: string;
  status?: SupportStatus;
  replyDraft?: string;
} & WorkflowContextMeta;

export type ResearchHubPrefill = {
  topic?: string;
  sources?: string;
  angle?: string;
  audience?: string;
  notes?: string;
  report?: string;
} & WorkflowContextMeta;

export type ProjectOpsPrefill = {
  project?: string;
  owner?: string;
  health?: ProjectHealth;
  objective?: string;
  updates?: string;
  blockers?: string;
  brief?: string;
};

export type RecruitingDeskPrefill = {
  role?: string;
  candidate?: string;
  stage?: RecruitingStage;
  profile?: string;
  notes?: string;
  scorecard?: string;
};

export type ContentRepurposerPrefill = {
  title?: string;
  sourceType?: import("@/lib/content-repurposer").RepurposeSourceType;
  audience?: string;
  goal?: string;
  sourceContent?: string;
  workflowSource?: string;
  workflowNextStep?: string;
} & CreatorWorkflowMeta;

export type CreatorRadarPrefill = {
  title?: string;
  channels?: string;
  audience?: string;
  goal?: string;
  notes?: string;
  digest?: string;
} & CreatorWorkflowMeta;

export type MorningBriefPrefill = {
  focus?: string;
  notes?: string;
} & WorkflowContextMeta;

export type PublisherPrefill = {
  draftId?: string;
  title?: string;
  body?: string;
  platforms?: PublishPlatformId[];
  dispatchMode?: "dry-run" | "dispatch";
  workflowSource?: string;
  workflowNextStep?: string;
} & CreatorWorkflowMeta;

type OpenAppDetail = {
  appId: AppId;
  settingsTab?: SettingsTargetTab;
  providerId?: LlmProviderId;
  dealPrefill?: DealDeskPrefill;
  emailDraft?: EmailAssistantPrefill;
  crmPrefill?: PersonalCrmPrefill;
  supportPrefill?: SupportCopilotPrefill;
  researchPrefill?: ResearchHubPrefill;
  projectOpsPrefill?: ProjectOpsPrefill;
  recruitingPrefill?: RecruitingDeskPrefill;
  vaultPrefill?: KnowledgeVaultPrefill;
  repurposerPrefill?: ContentRepurposerPrefill;
  creatorRadarPrefill?: CreatorRadarPrefill;
  morningBriefPrefill?: MorningBriefPrefill;
  publisherPrefill?: PublisherPrefill;
};

export function requestOpenApp(
  appId: AppId,
  options?: Omit<OpenAppDetail, "appId">,
) {
  if (typeof window === "undefined") return;
  dispatchRuntimeEvent(RuntimeEventNames.openApp, {
    appId: normalizeRuntimeAppId(appId),
    ...options,
  } satisfies OpenAppDetail);
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

export function requestOpenSupportCopilot(prefill?: SupportCopilotPrefill) {
  requestOpenApp("support_copilot", { supportPrefill: prefill });
}

export function requestOpenResearchHub(prefill?: ResearchHubPrefill) {
  requestOpenApp("deep_research_hub", { researchPrefill: prefill });
}

export function requestOpenProjectOps(prefill?: ProjectOpsPrefill) {
  requestOpenApp("project_ops", { projectOpsPrefill: prefill });
}

export function requestOpenRecruitingDesk(prefill?: RecruitingDeskPrefill) {
  requestOpenApp("recruiting_desk", { recruitingPrefill: prefill });
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

export function requestOpenPublisher(prefill?: PublisherPrefill) {
  requestOpenApp("publisher", { publisherPrefill: prefill });
}

export function dispatchOpenAppPrefill(appId: AppId, detail: Partial<OpenAppDetail>) {
  if (typeof window === "undefined") return;
  if (appId === "settings" && detail.settingsTab) {
    window.setTimeout(() => {
      dispatchRuntimeEvent(RuntimeEventNames.settingsFocus, {
        tab: detail.settingsTab,
      });
    }, 0);
  }

  const dispatchPrefill = (eventName: string, prefill: unknown) => {
    if (!prefill) return;
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(eventName, { detail: prefill }));
    }, 80);
  };

  dispatchPrefill(
    "openclaw:deal-desk-prefill",
    appId === "deal_desk" ? detail.dealPrefill : undefined,
  );
  dispatchPrefill(
    "openclaw:email-assistant-prefill",
    appId === "email_assistant" ? detail.emailDraft : undefined,
  );
  dispatchPrefill(
    "openclaw:crm-prefill",
    appId === "personal_crm" ? detail.crmPrefill : undefined,
  );
  dispatchPrefill(
    "openclaw:vault-prefill",
    appId === "knowledge_vault" ? detail.vaultPrefill : undefined,
  );
  dispatchPrefill(
    "openclaw:support-copilot-prefill",
    appId === "support_copilot" ? detail.supportPrefill : undefined,
  );
  dispatchPrefill(
    "openclaw:research-hub-prefill",
    appId === "deep_research_hub" ? detail.researchPrefill : undefined,
  );
  dispatchPrefill(
    "openclaw:project-ops-prefill",
    appId === "project_ops" ? detail.projectOpsPrefill : undefined,
  );
  dispatchPrefill(
    "openclaw:recruiting-desk-prefill",
    appId === "recruiting_desk" ? detail.recruitingPrefill : undefined,
  );
  dispatchPrefill(
    "openclaw:content-repurposer-prefill",
    appId === "content_repurposer" ? detail.repurposerPrefill : undefined,
  );
  dispatchPrefill(
    "openclaw:creator-radar-prefill",
    appId === "creator_radar" ? detail.creatorRadarPrefill : undefined,
  );
  dispatchPrefill(
    "openclaw:morning-brief-prefill",
    appId === "morning_brief" ? detail.morningBriefPrefill : undefined,
  );
  dispatchPrefill(
    "openclaw:publisher-prefill",
    appId === "publisher" ? detail.publisherPrefill : undefined,
  );
}
