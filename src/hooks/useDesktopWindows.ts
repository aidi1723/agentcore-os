"use client";

import { useCallback, useEffect, useRef } from "react";

import type { AppId, AppState } from "@/apps/types";
import { useWindowStore } from "@/stores/window-store";
import { dispatchRuntimeEvent, RuntimeEventNames } from "@/lib/runtime-events";

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

function isVisibleState(state: AppState | undefined) {
  return state === "open" || state === "opening";
}

export function useDesktopWindows(options: {
  spotlightOpen: boolean;
  onToggleSpotlight: () => void;
}) {
  const store = useWindowStore();
  const {
    activeWindow,
    appStateById,
    appZOrder,
    openApp,
    restoreApp,
    minimizeApp,
    focusApp,
    startClosing,
    finishClosing,
    finishOpening,
    restoreAll,
  } = store;

  const spotlightOpenRef = useRef(options.spotlightOpen);
  const onToggleSpotlightRef = useRef(options.onToggleSpotlight);

  useEffect(() => { spotlightOpenRef.current = options.spotlightOpen; }, [options.spotlightOpen]);
  useEffect(() => { onToggleSpotlightRef.current = options.onToggleSpotlight; }, [options.onToggleSpotlight]);

  // Keyboard shortcuts
  useEffect(() => {
    const getVisibleWindows = () => {
      const states = useWindowStore.getState().appStateById;
      const order = useWindowStore.getState().appZOrder;
      return order.filter((appId) => isVisibleState(states[appId]));
    };

    const getTopWindow = () => {
      const { appStateById: states, appZOrder: order, activeWindow: active } = useWindowStore.getState();
      if (active && isVisibleState(states[active])) return active;
      return [...order].reverse().find((appId) => isVisibleState(states[appId])) ?? null;
    };

    const onGlobalKeys = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onToggleSpotlightRef.current();
        return;
      }

      if (spotlightOpenRef.current) return;

      if ((e.metaKey || e.ctrlKey) && e.altKey) {
        if (isTypingTarget(e.target)) return;
        const top = getTopWindow();
        if (!top) return;
        const storageKey = `openclaw.window.${top}`;
        const commandByKey = {
          ArrowLeft: "tile_left",
          ArrowRight: "tile_right",
          ArrowUp: "maximize",
          ArrowDown: "restore",
        } as const;
        const command = commandByKey[e.key as keyof typeof commandByKey];
        if (!command) return;
        e.preventDefault();
        dispatchRuntimeEvent(RuntimeEventNames.windowCommand, { storageKey, command });
        return;
      }

      if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "w")) {
        const top = getTopWindow();
        if (!top) return;
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        useWindowStore.getState().startClosing(top);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "m") {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        if (e.shiftKey) {
          useWindowStore.getState().restoreAll();
        } else {
          const top = getTopWindow();
          if (!top) return;
          useWindowStore.getState().minimizeApp(top);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "[" || e.key === "]")) {
        if (isTypingTarget(e.target)) return;
        const visible = getVisibleWindows();
        if (visible.length <= 1) return;
        e.preventDefault();
        const cur = getTopWindow();
        const idx = cur ? visible.indexOf(cur) : visible.length - 1;
        const dir = e.key === "]" ? 1 : -1;
        const next = visible[(idx + dir + visible.length) % visible.length];
        useWindowStore.getState().focusApp(next);
      }
    };

    window.addEventListener("keydown", onGlobalKeys);
    return () => window.removeEventListener("keydown", onGlobalKeys);
  }, []);

  // Animation transitions: opening → open, closing → closed
  useEffect(() => {
    const ids = Object.keys(appStateById) as AppId[];
    const timers: number[] = [];
    const rafIds: number[] = [];

    for (const appId of ids) {
      const state = appStateById[appId];
      if (state === "opening") {
        const rafId = window.requestAnimationFrame(() => finishOpening(appId));
        const timeoutId = window.setTimeout(() => finishOpening(appId), 120);
        rafIds.push(rafId);
        timers.push(timeoutId);
      } else if (state === "closing") {
        const timeoutId = window.setTimeout(() => finishClosing(appId), 200);
        timers.push(timeoutId);
      }
    }

    return () => {
      for (const id of rafIds) window.cancelAnimationFrame(id);
      for (const id of timers) window.clearTimeout(id);
    };
  }, [appStateById, finishOpening, finishClosing]);

  // Derive activeWindow from z-order when state changes
  useEffect(() => {
    const nextActive = [...appZOrder].reverse().find((appId) => isVisibleState(appStateById[appId])) ?? null;
    const current = useWindowStore.getState().activeWindow;
    if (current !== nextActive) {
      useWindowStore.setState({ activeWindow: nextActive });
    }
  }, [appZOrder, appStateById]);

  const closeApp = useCallback((appId: AppId) => startClosing(appId), [startClosing]);

  const isAnyAppVisible = Object.values(appStateById).some(isVisibleState);

  return {
    activeWindow,
    appStateById,
    appZOrder,
    openApp,
    restoreApp,
    minimizeApp,
    closeApp,
    focusApp,
    isAnyAppVisible,
  };
}
