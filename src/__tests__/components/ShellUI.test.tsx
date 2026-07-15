import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModeSwitcher, AgentCoreBrand } from "@/components/ShellUI";

vi.mock("next/image", () => ({
  // The test double intentionally reduces next/image to a native element.
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}));

vi.mock("@/apps/modes", () => ({
  modes: [
    { id: "creator", name: "Creator" },
    { id: "ops", name: "Ops" },
  ],
}));

vi.mock("@/lib/app-display", () => ({
  getDisplayLanguage: () => "en",
  getModeDisplayName: (_id: string, name: string) => name,
  getShellLabel: (key: string) => key,
}));

vi.mock("@/lib/language", () => ({
  getLanguageLabel: () => "English",
}));

vi.mock("@/lib/desktop-helpers", () => ({
  providerLabel: (id: string) => id,
}));

describe("ModeSwitcher", () => {
  it("renders current mode and allows switching", () => {
    const onChange = vi.fn();
    render(<ModeSwitcher value="creator" language="en-US" onChange={onChange} />);
    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("creator");
    fireEvent.change(select, { target: { value: "ops" } });
    expect(onChange).toHaveBeenCalledWith("ops");
  });
});

describe("AgentCoreBrand", () => {
  it("renders brand name", () => {
    render(<AgentCoreBrand />);
    expect(screen.getByText("AgentCore OS")).toBeInTheDocument();
  });
});
