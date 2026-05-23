"use client";

import { create } from "zustand";
import type { ModeId } from "@/apps/types";
import type {
  InterfaceLanguage,
  LlmProviderId,
  PersonalizationSettings,
} from "@/lib/settings";
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  hasSavedSettings,
  hydrateSettingsFromDesktopBridge,
} from "@/lib/settings";
import { requestOpenSettings } from "@/lib/ui-events";

export type DesktopStoreState = {
  modeId: ModeId;
  personalization: PersonalizationSettings;
  activeProvider: LlmProviderId;
  spotlightOpen: boolean;
  volumeLevel: number;
  showLanguageWelcome: boolean;
  showRuntimeOnboarding: boolean;
  agentSidebarWidth: number;
  agentSidebarCollapsed: boolean;
};

export type DesktopStoreActions = {
  setModeId: (id: ModeId) => void;
  setSpotlightOpen: (open: boolean) => void;
  toggleSpotlight: () => void;
  setVolumeLevel: (level: number) => void;
  cycleVolume: () => void;
  setPersonalization: (p: PersonalizationSettings) => void;
  setActiveProvider: (p: LlmProviderId) => void;
  applyLanguage: (next: InterfaceLanguage) => void;
  dismissLanguageWelcome: () => void;
  dismissRuntimeOnboarding: () => void;
  setAgentSidebarWidth: (w: number) => void;
  setAgentSidebarCollapsed: (c: boolean) => void;
  hydrate: () => Promise<void>;
};

const LANGUAGE_WELCOME_KEY = "openclaw.language_welcome.v1";
const RUNTIME_ONBOARDING_KEY = "agentcore.runtime_onboarding.dismissed.v1";

export const useDesktopStore = create<DesktopStoreState & DesktopStoreActions>((set, get) => ({
  modeId: "creator",
  personalization: defaultSettings.personalization,
  activeProvider: "kimi",
  spotlightOpen: false,
  volumeLevel: 2,
  showLanguageWelcome: false,
  showRuntimeOnboarding: false,
  agentSidebarWidth: 296,
  agentSidebarCollapsed: true,

  setModeId: (id) => set({ modeId: id }),
  setSpotlightOpen: (open) => set({ spotlightOpen: open }),
  toggleSpotlight: () => set((s) => ({ spotlightOpen: !s.spotlightOpen })),
  setVolumeLevel: (level) => set({ volumeLevel: level }),
  cycleVolume: () => set((s) => ({ volumeLevel: (s.volumeLevel + 1) % 3 })),
  setPersonalization: (p) => set({ personalization: p }),
  setActiveProvider: (p) => set({ activeProvider: p }),
  setAgentSidebarWidth: (w) => set({ agentSidebarWidth: Math.max(260, Math.min(420, Math.round(w))) }),
  setAgentSidebarCollapsed: (c) => set({ agentSidebarCollapsed: c }),

  applyLanguage: (next) => {
    const settings = loadSettings();
    if (next === "custom" && !settings.personalization.customLanguageLabel.trim()) {
      requestOpenSettings("personalization");
      return;
    }
    saveSettings({
      ...settings,
      personalization: { ...settings.personalization, interfaceLanguage: next },
    });
    try {
      window.localStorage.setItem(LANGUAGE_WELCOME_KEY, "1");
    } catch {}
    set({ showLanguageWelcome: false });
  },

  dismissLanguageWelcome: () => {
    try {
      window.localStorage.setItem(LANGUAGE_WELCOME_KEY, "1");
    } catch {}
    set({ showLanguageWelcome: false });
  },

  dismissRuntimeOnboarding: () => {
    try {
      window.localStorage.setItem(RUNTIME_ONBOARDING_KEY, "1");
    } catch {}
    set({ showRuntimeOnboarding: false });
  },

  hydrate: async () => {
    const settings = loadSettings();
    set({
      personalization: settings.personalization,
      activeProvider: settings.llm.activeProvider,
    });

    // Check welcome/onboarding state
    try {
      const hasSeenWelcome = window.localStorage.getItem(LANGUAGE_WELCOME_KEY) === "1";
      if (!hasSeenWelcome && !hasSavedSettings()) {
        set({ showLanguageWelcome: true });
      }
    } catch {}

    // Hydrate from desktop bridge
    const hydrated = await hydrateSettingsFromDesktopBridge();
    if (hydrated) {
      set({
        personalization: hydrated.personalization,
        activeProvider: hydrated.llm.activeProvider,
      });
    }
  },
}));
