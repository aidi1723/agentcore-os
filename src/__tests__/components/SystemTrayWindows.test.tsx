import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SystemTrayWindows } from "@/components/SystemTrayWindows";

vi.mock("@/apps/registry", () => ({
  getApp: (id: string) => ({
    id,
    name: id,
    icon: ({ className }: { className?: string }) => <span data-testid={`icon-${id}`} className={className} />,
  }),
}));

vi.mock("@/lib/app-display", () => ({
  getAppDisplayName: (id: string) => `App ${id}`,
  getShellLabel: (key: string) => key,
}));

describe("SystemTrayWindows", () => {
  const baseProps = {
    language: "zh-CN" as const,
    appStateById: {
      editor: "open",
      browser: "minimized",
      settings: "closed",
    } as any,
    appZOrder: ["editor", "browser"] as any[],
    activeWindow: "editor" as any,
    onRestore: vi.fn(),
    onMinimize: vi.fn(),
    onClose: vi.fn(),
    onFocus: vi.fn(),
  };

  it("renders the tray toggle button", () => {
    render(<SystemTrayWindows {...baseProps} />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("shows window count badge for active windows", () => {
    render(<SystemTrayWindows {...baseProps} />);
    // Should show count of non-closed windows (editor + browser = 2)
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
