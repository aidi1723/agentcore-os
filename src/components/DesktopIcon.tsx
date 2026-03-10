"use client";

import type { ReactNode } from "react";

export function DesktopIcon({
  icon,
  name,
  onClick,
  onDoubleClick,
}: {
  icon: ReactNode;
  name: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="flex flex-col items-center gap-2 p-2 rounded-2xl cursor-pointer transition-transform active:scale-[0.98] select-none bg-transparent border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
      aria-label={name}
      onClick={(e) => {
        // Prevent duplicate actions on double-click (2nd click has detail=2).
        if (e.detail > 1) return;
        onClick?.();
      }}
      onDoubleClick={onDoubleClick}
    >
      <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 shadow-xl flex items-center justify-center hover:bg-white/20 transition-colors">
        <div className="drop-shadow-2xl">{icon}</div>
      </div>
      <span className="text-white/90 text-sm font-medium text-center drop-shadow-lg px-2">
        {name}
      </span>
    </button>
  );
}
