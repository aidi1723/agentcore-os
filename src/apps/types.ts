import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

export type AppId =
  | "media_ops"
  | "creative_studio"
  | "knowledge_vault"
  | "account_center"
  | "task_manager"
  | "openclaw_console"
  | "publisher"
  | "solo_ops"
  | "settings";

export type AppWindowState = "opening" | "open" | "minimized" | "closing";
export type AppState = AppWindowState | "closed";

export type AppWindowProps = {
  state: AppWindowState;
  zIndex: number;
  active?: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
};

export type AppManifest = {
  id: AppId;
  name: string;
  icon: LucideIcon;
  window: ComponentType<AppWindowProps>;
  desktop: boolean;
  dock: boolean;
};

export type ModeId = "default" | "creator" | "solo";

export type ModeManifest = {
  id: ModeId;
  name: string;
  desktopApps: AppId[];
  dockApps: AppId[];
};
