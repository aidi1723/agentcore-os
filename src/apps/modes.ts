import type { ModeManifest } from "@/apps/types";

export const modes: ModeManifest[] = [
  {
    id: "default",
    name: "默认桌面",
    desktopApps: [
      "solo_ops",
      "media_ops",
      "creative_studio",
      "knowledge_vault",
      "account_center",
      "task_manager",
      "openclaw_console",
      "publisher",
      "settings",
    ],
    dockApps: [
      "solo_ops",
      "media_ops",
      "creative_studio",
      "knowledge_vault",
      "account_center",
      "task_manager",
      "openclaw_console",
      "publisher",
      "settings",
    ],
  },
  {
    id: "creator",
    name: "AI 文案",
    desktopApps: [
      "solo_ops",
      "media_ops",
      "creative_studio",
      "knowledge_vault",
      "account_center",
      "task_manager",
      "openclaw_console",
      "publisher",
      "settings",
    ],
    dockApps: [
      "solo_ops",
      "media_ops",
      "creative_studio",
      "knowledge_vault",
      "account_center",
      "task_manager",
      "openclaw_console",
      "publisher",
      "settings",
    ],
  },
  {
    id: "solo",
    name: "工作流",
    desktopApps: [
      "solo_ops",
      "media_ops",
      "creative_studio",
      "publisher",
      "knowledge_vault",
      "account_center",
      "task_manager",
      "openclaw_console",
      "settings",
    ],
    dockApps: [
      "solo_ops",
      "media_ops",
      "creative_studio",
      "publisher",
      "task_manager",
      "settings",
    ],
  },
];

export function getMode(modeId: ModeManifest["id"]) {
  return modes.find((mode) => mode.id === modeId) ?? modes[0];
}
