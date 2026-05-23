import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceAppWidgetGrid } from "@/components/WorkspaceAppWidgetGrid";

vi.mock("@/apps/registry", () => ({
  getApp: (id: string) => ({
    id,
    name: id,
    icon: ({ className }: { className?: string }) => <span data-testid={`icon-${id}`} className={className} />,
  }),
}));

vi.mock("@/lib/app-display", () => ({
  getAppDisplayName: (id: string) => id,
  getAppCategory: () => "core",
  getCategoryMeta: (_cat: string, _lang: string) => ({
    label: "Core",
    description: "Core apps",
    helper: "helper",
  }),
}));

vi.mock("@/lib/desktop-helpers", () => ({
  getAppShortName: (id: string) => id,
  workspaceCategoryOrder: ["core", "insight", "ops", "creative", "utility"],
}));

describe("WorkspaceAppWidgetGrid", () => {
  const baseProps = {
    appIds: ["app_a", "app_b"] as any[],
    dockApps: ["app_a"] as any[],
    language: "zh-CN" as const,
    appStateById: { app_a: "open", app_b: "closed" } as any,
    onOpenApp: vi.fn(),
  };

  it("renders app buttons", () => {
    render(<WorkspaceAppWidgetGrid {...baseProps} />);
    expect(screen.getByText("app_a")).toBeInTheDocument();
    expect(screen.getByText("app_b")).toBeInTheDocument();
  });

  it("shows Dock badge for pinned apps", () => {
    render(<WorkspaceAppWidgetGrid {...baseProps} />);
    expect(screen.getByText("Dock")).toBeInTheDocument();
  });

  it("calls onOpenApp when clicking an app", () => {
    render(<WorkspaceAppWidgetGrid {...baseProps} />);
    fireEvent.click(screen.getByText("app_b"));
    expect(baseProps.onOpenApp).toHaveBeenCalledWith("app_b");
  });

  it("shows running indicator for open apps", () => {
    render(<WorkspaceAppWidgetGrid {...baseProps} />);
    expect(screen.getByText("运行中")).toBeInTheDocument();
  });
});
