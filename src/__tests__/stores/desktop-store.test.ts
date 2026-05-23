import { describe, it, expect, beforeEach } from "vitest";
import { useDesktopStore } from "@/stores/desktop-store";

describe("desktop-store", () => {
  beforeEach(() => {
    useDesktopStore.setState({
      modeId: "creator",
      spotlightOpen: false,
      volumeLevel: 2,
      activeProvider: "kimi",
      agentSidebarWidth: 296,
      agentSidebarCollapsed: true,
    });
  });

  it("sets mode id", () => {
    useDesktopStore.getState().setModeId("solo");
    expect(useDesktopStore.getState().modeId).toBe("solo");
  });

  it("toggles spotlight", () => {
    useDesktopStore.getState().toggleSpotlight();
    expect(useDesktopStore.getState().spotlightOpen).toBe(true);
    useDesktopStore.getState().toggleSpotlight();
    expect(useDesktopStore.getState().spotlightOpen).toBe(false);
  });

  it("cycles volume through 0, 1, 2", () => {
    useDesktopStore.getState().cycleVolume();
    expect(useDesktopStore.getState().volumeLevel).toBe(0);
    useDesktopStore.getState().cycleVolume();
    expect(useDesktopStore.getState().volumeLevel).toBe(1);
    useDesktopStore.getState().cycleVolume();
    expect(useDesktopStore.getState().volumeLevel).toBe(2);
  });

  it("clamps sidebar width", () => {
    useDesktopStore.getState().setAgentSidebarWidth(100);
    expect(useDesktopStore.getState().agentSidebarWidth).toBe(260);
    useDesktopStore.getState().setAgentSidebarWidth(500);
    expect(useDesktopStore.getState().agentSidebarWidth).toBe(420);
  });

  it("sets active provider", () => {
    useDesktopStore.getState().setActiveProvider("deepseek");
    expect(useDesktopStore.getState().activeProvider).toBe("deepseek");
  });
});
