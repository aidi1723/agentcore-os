"use client";

import type { TimedToast } from "@/hooks/useTimedToast";

export function AppToast({ toast }: { toast: TimedToast | null }) {
  if (!toast) return null;

  return (
    <div className="absolute right-4 top-4 z-10 sm:right-5 sm:top-5">
      <div
        className={[
          "rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-lg backdrop-blur",
          toast.tone === "ok"
            ? "border-emerald-400/40 bg-emerald-600/90 text-white"
            : "border-red-400/40 bg-red-600/90 text-white",
        ].join(" ")}
        role="status"
        aria-live="polite"
      >
        {toast.message}
      </div>
    </div>
  );
}
