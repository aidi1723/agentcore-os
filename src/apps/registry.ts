"use client";

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
} from "lucide-react";
import type { AppManifest, AppId } from "@/apps/types";
import { CreativeStudioAppWindow } from "@/components/apps/CreativeStudioAppWindow";
import { AccountCenterAppWindow } from "@/components/apps/AccountCenterAppWindow";
import { MediaOpsAppWindow } from "@/components/apps/MediaOpsAppWindow";
import { KnowledgeVaultAppWindow } from "@/components/apps/KnowledgeVaultAppWindow";
import { OpenClawConsoleAppWindow } from "@/components/apps/OpenClawConsoleAppWindow";
import { SettingsAppWindow } from "@/components/apps/SettingsAppWindow";
import { TaskManagerAppWindow } from "@/components/apps/TaskManagerAppWindow";
import { PublisherAppWindow } from "@/components/apps/PublisherAppWindow";
import { SoloOpsAppWindow } from "@/components/apps/SoloOpsAppWindow";

const appList: AppManifest[] = [
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
    id: "openclaw_console",
    name: "OpenClaw 控制台",
    icon: TerminalSquare,
    window: OpenClawConsoleAppWindow,
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
    id: "settings",
    name: "设置",
    icon: Settings,
    window: SettingsAppWindow,
    desktop: true,
    dock: true,
  },
];

export function getApp(appId: AppId) {
  const app = appList.find((a) => a.id === appId);
  if (!app) throw new Error(`Unknown app: ${appId}`);
  return app;
}

export function listApps() {
  return appList;
}
