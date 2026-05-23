import { describe, it, expect, beforeEach } from "vitest";
import { useWindowStore } from "@/stores/window-store";

describe("window-store", () => {
  beforeEach(() => {
    useWindowStore.setState({
      activeWindow: null,
      appStateById: { deal_desk: "closed", task_manager: "closed" } as any,
      appZOrder: [],
    });
  });

  it("opens an app from closed state", () => {
    useWindowStore.getState().openApp("deal_desk");
    const state = useWindowStore.getState();
    expect(state.appStateById.deal_desk).toBe("opening");
    expect(state.activeWindow).toBe("deal_desk");
    expect(state.appZOrder).toContain("deal_desk");
  });

  it("restores a minimized app", () => {
    useWindowStore.setState({
      appStateById: { deal_desk: "minimized", task_manager: "closed" } as any,
      appZOrder: ["deal_desk"],
      activeWindow: null,
    });
    useWindowStore.getState().openApp("deal_desk");
    expect(useWindowStore.getState().appStateById.deal_desk).toBe("open");
  });

  it("minimizes an app", () => {
    useWindowStore.setState({
      appStateById: { deal_desk: "open", task_manager: "closed" } as any,
      appZOrder: ["deal_desk"],
      activeWindow: "deal_desk",
    });
    useWindowStore.getState().minimizeApp("deal_desk");
    expect(useWindowStore.getState().appStateById.deal_desk).toBe("minimized");
  });

  it("closes an app and removes from z-order", () => {
    useWindowStore.setState({
      appStateById: { deal_desk: "open", task_manager: "closed" } as any,
      appZOrder: ["deal_desk"],
      activeWindow: "deal_desk",
    });
    useWindowStore.getState().closeApp("deal_desk");
    const state = useWindowStore.getState();
    expect(state.appStateById.deal_desk).toBe("closed");
    expect(state.appZOrder).not.toContain("deal_desk");
    expect(state.activeWindow).toBeNull();
  });

  it("focuses an app and moves it to top of z-order", () => {
    useWindowStore.setState({
      appStateById: { deal_desk: "open", task_manager: "open" } as any,
      appZOrder: ["deal_desk", "task_manager"],
      activeWindow: "task_manager",
    });
    useWindowStore.getState().focusApp("deal_desk");
    const state = useWindowStore.getState();
    expect(state.appZOrder[state.appZOrder.length - 1]).toBe("deal_desk");
    expect(state.activeWindow).toBe("deal_desk");
  });

  it("isAnyAppVisible returns true when an app is open", () => {
    useWindowStore.setState({
      appStateById: { deal_desk: "open", task_manager: "closed" } as any,
      appZOrder: ["deal_desk"],
      activeWindow: "deal_desk",
    });
    expect(useWindowStore.getState().isAnyAppVisible()).toBe(true);
  });

  it("isAnyAppVisible returns false when all apps are closed", () => {
    expect(useWindowStore.getState().isAnyAppVisible()).toBe(false);
  });
});
