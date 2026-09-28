import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublisherAppWindow } from "@/components/apps/PublisherAppWindow";

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/approve")) {
        return Response.json({
          ok: true,
          data: {
            draft: {
              id: "draft-pending",
              title: "待复核跟进",
              body: "还不能外发",
              source: "publisher",
              approvalState: "approved",
              createdAt: 1,
              updatedAt: 3,
            },
          },
        });
      }
      return Response.json({ ok: true, data: {} });
    }),
  );
});

function renderPublisher() {
  render(
    <PublisherAppWindow
      state="open"
      zIndex={1}
      active
      onFocus={vi.fn()}
      onMinimize={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

describe("PublisherAppWindow pending review", () => {
  it("disables publish actions for a pending review draft", async () => {
    window.localStorage.setItem(
      "openclaw.drafts.v1",
      JSON.stringify([
        {
          id: "draft-pending",
          title: "待复核跟进",
          body: "还不能外发",
          source: "publisher",
          approvalState: "pending_review",
          createdAt: 1,
          updatedAt: 2,
        },
      ]),
    );

    renderPublisher();

    expect(await screen.findByRole("button", { name: "预演发布" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "批准草稿" })).toBeEnabled();
    expect(screen.getByText(/待复核草稿不能进入发布队列/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "批准草稿" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "预演发布" })).toBeEnabled();
    });
    expect(screen.queryByRole("button", { name: "批准草稿" })).not.toBeInTheDocument();
    expect(screen.getByText("已批准")).toBeInTheDocument();
  });

  it("keeps publish available for a draft without review state", async () => {
    window.localStorage.setItem(
      "openclaw.drafts.v1",
      JSON.stringify([
        {
          id: "draft-open",
          title: "普通草稿",
          body: "可以排队",
          source: "publisher",
          createdAt: 1,
          updatedAt: 2,
        },
      ]),
    );

    renderPublisher();

    expect(await screen.findByRole("button", { name: "预演发布" })).toBeEnabled();
    expect(screen.queryByText(/待复核草稿不能进入发布队列/)).not.toBeInTheDocument();
  });
});
