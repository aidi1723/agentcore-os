"use client";

import { create } from "zustand";
import type { AppId, AppState } from "@/apps/types";
import { listApps } from "@/apps/registry";

export type WindowStoreState = {
  activeWindow: AppId | null;
  appStateById: Record<AppId, AppState>;
  appZOrder: AppId[];
};

export type WindowStoreActions = {
  openApp: (appId: AppId) => void;
  closeApp: (appId: AppId) => void;
  startClosing: (appId: AppId) => void;
  finishClosing: (appId: AppId) => void;
  finishOpening: (appId: AppId) => void;
  minimizeApp: (appId: AppId) => void;
  minimizeAll: () => void;
  restoreAll: () => void;
  restoreApp: (appId: AppId) => void;
  focusApp: (appId: AppId) => void;
  isAnyAppVisible: () => boolean;
};

function buildInitialAppState(): Record<AppId, AppState> {
  const initial = {} as Record<AppId, AppState>;
  for (const app of listApps()) {
    initial[app.id] = "closed";
  }
  return initial;
}

export const useWindowStore = create<WindowStoreState & WindowStoreActions>((set, get) => ({
  activeWindow: null,
  appStateById: buildInitialAppState(),
  appZOrder: [],

  focusApp: (appId) =>
    set((state) => ({
      appZOrder: [...state.appZOrder.filter((id) => id !== appId), appId],
      activeWindow: appId,
    })),

  openApp: (appId) =>
    set((state) => {
      const cur = state.appStateById[appId];
      let nextState: AppState;
      if (cur === "closed") nextState = "opening";
      else if (cur === "minimized") nextState = "open";
      else if (cur === "closing") nextState = "opening";
      else nextState = "open";

      return {
        appStateById: { ...state.appStateById, [appId]: nextState },
        appZOrder: [...state.appZOrder.filter((id) => id !== appId), appId],
        activeWindow: appId,
      };
    }),

  restoreApp: (appId) => get().openApp(appId),

  minimizeApp: (appId) =>
    set((state) => ({
      appStateById: { ...state.appStateById, [appId]: "minimized" },
    })),

  minimizeAll: () =>
    set((state) => {
      const next = { ...state.appStateById };
      for (const id of Object.keys(next) as AppId[]) {
        if (next[id] === "open" || next[id] === "opening") next[id] = "minimized";
      }
      return { appStateById: next };
    }),

  restoreAll: () =>
    set((state) => {
      const next = { ...state.appStateById };
      for (const id of Object.keys(next) as AppId[]) {
        if (next[id] === "minimized") next[id] = "open";
      }
      return { appStateById: next };
    }),

  closeApp: (appId) =>
    set((state) => ({
      appStateById: { ...state.appStateById, [appId]: "closed" },
      appZOrder: state.appZOrder.filter((id) => id !== appId),
      activeWindow: state.activeWindow === appId ? null : state.activeWindow,
    })),

  startClosing: (appId) =>
    set((state) => ({
      appStateById: { ...state.appStateById, [appId]: "closing" },
    })),

  finishClosing: (appId) =>
    set((state) => {
      if (state.appStateById[appId] !== "closing") return state;
      return {
        appStateById: { ...state.appStateById, [appId]: "closed" },
        appZOrder: state.appZOrder.filter((id) => id !== appId),
        activeWindow: state.activeWindow === appId ? null : state.activeWindow,
      };
    }),

  finishOpening: (appId) =>
    set((state) => {
      if (state.appStateById[appId] !== "opening") return state;
      return { appStateById: { ...state.appStateById, [appId]: "open" } };
    }),

  isAnyAppVisible: () => {
    const { appStateById } = get();
    return Object.values(appStateById).some(
      (s) => s === "open" || s === "opening",
    );
  },
}));
