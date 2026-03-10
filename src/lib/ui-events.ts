import type { AppId } from "@/apps/types";

type OpenAppDetail = { appId: AppId };

export function requestOpenApp(appId: AppId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<OpenAppDetail>("openclaw:open-app", { detail: { appId } }));
}

