"use client";

import dynamic from "next/dynamic";
import {
  Activity,
  Clapperboard,
  HardDrive,
  Shield,
  FileText,
  TerminalSquare,
  Settings,
  Share2,
  BriefcaseBusiness,
  Building2,
  Layers,
  Mic2,
  Newspaper,
  Rss,
  Users,
  Inbox,
  Headphones,
  Brain,
  Mail,
  Briefcase,
  CalendarDays,
  HeartPulse,
  Target,
  Compass,
  RefreshCw,
  UserSearch,
  KanbanSquare,
  SearchCheck,
  Globe2,
  Languages,
} from "lucide-react";
import type { AppManifest, AppId } from "@/apps/types";

const IndustryHubAppWindow = dynamic(() => import("@/components/apps/IndustryHubAppWindow").then((m) => m.IndustryHubAppWindow));
const RecruitingDeskAppWindow = dynamic(() => import("@/components/apps/RecruitingDeskAppWindow").then((m) => m.RecruitingDeskAppWindow), { loading: () => null });
const ProjectOpsAppWindow = dynamic(() => import("@/components/apps/ProjectOpsAppWindow").then((m) => m.ProjectOpsAppWindow));
const DeepResearchHubAppWindow = dynamic(() => import("@/components/apps/DeepResearchHubAppWindow").then((m) => m.DeepResearchHubAppWindow), { loading: () => null });
const FinancialDocumentBotAppWindow = dynamic(() => import("@/components/apps/FinancialDocumentBotAppWindow").then((m) => m.FinancialDocumentBotAppWindow), { loading: () => null });
const SocialMediaAutopilotAppWindow = dynamic(() => import("@/components/apps/SocialMediaAutopilotAppWindow").then((m) => m.SocialMediaAutopilotAppWindow), { loading: () => null });
const WebsiteSeoStudioAppWindow = dynamic(() => import("@/components/apps/WebsiteSeoStudioAppWindow").then((m) => m.WebsiteSeoStudioAppWindow), { loading: () => null });
const LanguageLearningDeskAppWindow = dynamic(() => import("@/components/apps/LanguageLearningDeskAppWindow").then((m) => m.LanguageLearningDeskAppWindow), { loading: () => null });
const TechNewsDigestAppWindow = dynamic(() => import("@/components/apps/TechNewsDigestAppWindow").then((m) => m.TechNewsDigestAppWindow), { loading: () => null });
const MorningBriefAppWindow = dynamic(() => import("@/components/apps/MorningBriefAppWindow").then((m) => m.MorningBriefAppWindow), { loading: () => null });
const MeetingCopilotAppWindow = dynamic(() => import("@/components/apps/MeetingCopilotAppWindow").then((m) => m.MeetingCopilotAppWindow), { loading: () => null });
const PersonalCRMAppWindow = dynamic(() => import("@/components/apps/PersonalCRMAppWindow").then((m) => m.PersonalCRMAppWindow), { loading: () => null });
const InboxDeclutterAppWindow = dynamic(() => import("@/components/apps/InboxDeclutterAppWindow").then((m) => m.InboxDeclutterAppWindow), { loading: () => null });
const SupportCopilotAppWindow = dynamic(() => import("@/components/apps/SupportCopilotAppWindow").then((m) => m.SupportCopilotAppWindow));
const SecondBrainAppWindow = dynamic(() => import("@/components/apps/SecondBrainAppWindow").then((m) => m.SecondBrainAppWindow), { loading: () => null });
const EmailAssistantAppWindow = dynamic(() => import("@/components/apps/EmailAssistantAppWindow").then((m) => m.EmailAssistantAppWindow), { loading: () => null });
const DealDeskAppWindow = dynamic(() => import("@/components/apps/DealDeskAppWindow").then((m) => m.DealDeskAppWindow));
const FamilyCalendarAppWindow = dynamic(() => import("@/components/apps/FamilyCalendarAppWindow").then((m) => m.FamilyCalendarAppWindow), { loading: () => null });
const HabitTrackerAppWindow = dynamic(() => import("@/components/apps/HabitTrackerAppWindow").then((m) => m.HabitTrackerAppWindow), { loading: () => null });
const HealthTrackerAppWindow = dynamic(() => import("@/components/apps/HealthTrackerAppWindow").then((m) => m.HealthTrackerAppWindow), { loading: () => null });
const CreatorRadarAppWindow = dynamic(() => import("@/components/apps/CreatorRadarAppWindow").then((m) => m.CreatorRadarAppWindow), { loading: () => null });
const ContentRepurposerAppWindow = dynamic(() => import("@/components/apps/ContentRepurposerAppWindow").then((m) => m.ContentRepurposerAppWindow), { loading: () => null });
const MediaOpsAppWindow = dynamic(() => import("@/components/apps/MediaOpsAppWindow").then((m) => m.MediaOpsAppWindow), { loading: () => null });
const CreativeStudioAppWindow = dynamic(() => import("@/components/apps/CreativeStudioAppWindow").then((m) => m.CreativeStudioAppWindow));
const KnowledgeVaultAppWindow = dynamic(() => import("@/components/apps/KnowledgeVaultAppWindow").then((m) => m.KnowledgeVaultAppWindow));
const AccountCenterAppWindow = dynamic(() => import("@/components/apps/AccountCenterAppWindow").then((m) => m.AccountCenterAppWindow));
const TaskManagerAppWindow = dynamic(() => import("@/components/apps/TaskManagerAppWindow").then((m) => m.TaskManagerAppWindow));
const ClawRuntimeConsoleAppWindow = dynamic(() => import("@/components/apps/ClawRuntimeConsoleAppWindow").then((m) => m.ClawRuntimeConsoleAppWindow));
const PublisherAppWindow = dynamic(() => import("@/components/apps/PublisherAppWindow").then((m) => m.PublisherAppWindow));
const SoloOpsAppWindow = dynamic(() => import("@/components/apps/SoloOpsAppWindow").then((m) => m.SoloOpsAppWindow));
const SolutionsHubAppWindow = dynamic(() => import("@/components/apps/SolutionsHubAppWindow").then((m) => m.SolutionsHubAppWindow));
const SettingsAppWindow = dynamic(() => import("@/components/apps/SettingsAppWindow").then((m) => m.SettingsAppWindow));

const appList: AppManifest[] = [
  {
    id: "industry_hub",
    name: "Industry App Center",
    icon: Building2,
    window: IndustryHubAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "recruiting_desk",
    name: "Recruiting Desk",
    icon: UserSearch,
    window: RecruitingDeskAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "project_ops",
    name: "Project Ops Board",
    icon: KanbanSquare,
    window: ProjectOpsAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "deep_research_hub",
    name: "Deep Research Hub",
    icon: SearchCheck,
    window: DeepResearchHubAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "financial_document_bot",
    name: "Financial Document Bot",
    icon: FileText,
    window: FinancialDocumentBotAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "social_media_autopilot",
    name: "Social Media Auto-pilot",
    icon: Share2,
    window: SocialMediaAutopilotAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "website_seo_studio",
    name: "Website SEO Studio",
    icon: Globe2,
    window: WebsiteSeoStudioAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "language_learning_desk",
    name: "Language Learning Desk",
    icon: Languages,
    window: LanguageLearningDeskAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "tech_news_digest",
    name: "Tech News Digest",
    icon: Rss,
    window: TechNewsDigestAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "morning_brief",
    name: "Morning Brief",
    icon: Newspaper,
    window: MorningBriefAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "meeting_copilot",
    name: "Meeting Copilot",
    icon: Mic2,
    window: MeetingCopilotAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "personal_crm",
    name: "Personal CRM",
    icon: Users,
    window: PersonalCRMAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "inbox_declutter",
    name: "Inbox De-clutter",
    icon: Inbox,
    window: InboxDeclutterAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "support_copilot",
    name: "Support Copilot",
    icon: Headphones,
    window: SupportCopilotAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "second_brain",
    name: "Second Brain",
    icon: Brain,
    window: SecondBrainAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "email_assistant",
    name: "Email Assistant",
    icon: Mail,
    window: EmailAssistantAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "deal_desk",
    name: "Deal Desk",
    icon: Briefcase,
    window: DealDeskAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "family_calendar",
    name: "Family Calendar",
    icon: CalendarDays,
    window: FamilyCalendarAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "habit_tracker",
    name: "Habit Tracker",
    icon: Target,
    window: HabitTrackerAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "health_tracker",
    name: "Health Tracker",
    icon: HeartPulse,
    window: HealthTrackerAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "creator_radar",
    name: "Creator Radar",
    icon: Compass,
    window: CreatorRadarAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "content_repurposer",
    name: "Content Repurposer",
    icon: RefreshCw,
    window: ContentRepurposerAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "media_ops",
    name: "AI 文案",
    icon: FileText,
    window: MediaOpsAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "creative_studio",
    name: "AI 视觉工坊",
    icon: Clapperboard,
    window: CreativeStudioAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "knowledge_vault",
    name: "专属知识库",
    icon: HardDrive,
    window: KnowledgeVaultAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "account_center",
    name: "矩阵授权中心",
    icon: Shield,
    window: AccountCenterAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "task_manager",
    name: "任务调度中心",
    icon: Activity,
    window: TaskManagerAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "runtime_console",
    name: "AgentCoreOS Runtime Console",
    icon: TerminalSquare,
    window: ClawRuntimeConsoleAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "publisher",
    name: "矩阵发布中心",
    icon: Share2,
    window: PublisherAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "solo_ops",
    name: "SoloOps 作战台",
    icon: BriefcaseBusiness,
    window: SoloOpsAppWindow,
    desktop: true,
    dock: true,
  },
  {
    id: "solutions_hub",
    name: "方案库",
    icon: Layers,
    window: SolutionsHubAppWindow,
    desktop: true,
    dock: false,
  },
  {
    id: "settings",
    name: "设置",
    icon: Settings,
    window: SettingsAppWindow,
    desktop: true,
    dock: true,
  },
];

export function getApp(appId: AppId) {
  const resolvedId = appId === "openclaw_console" ? "runtime_console" : appId;
  const app = appList.find((a) => a.id === resolvedId);
  if (!app) throw new Error(`Unknown app: ${appId}`);
  return app;
}

export function listApps() {
  return appList;
}
