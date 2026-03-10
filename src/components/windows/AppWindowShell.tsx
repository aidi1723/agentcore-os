"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Minus, X } from "lucide-react";

type DragOffset = { dx: number; dy: number };

function loadOffset(storageKey: string): DragOffset | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as any).dx === "number" &&
      typeof (parsed as any).dy === "number"
    ) {
      return { dx: (parsed as any).dx, dy: (parsed as any).dy };
    }
    return null;
  } catch {
    return null;
  }
}

function saveOffset(storageKey: string, offset: DragOffset) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(offset));
  } catch {
    // ignore
  }
}

function removeOffset(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

export function AppWindowShell({
  state,
  zIndex,
  active = false,
  title,
  icon: Icon,
  widthClassName = "w-[620px]",
  storageKey,
  onFocus,
  onMinimize,
  onClose,
  children,
}: {
  state: "opening" | "open" | "minimized" | "closing";
  zIndex: number;
  active?: boolean;
  title: string;
  icon: LucideIcon;
  widthClassName?: string;
  storageKey?: string;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const windowRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<DragOffset>({ dx: 0, dy: 0 });
  const dragContextRef = useRef<{
    startX: number;
    startY: number;
    startDx: number;
    startDy: number;
    width: number;
    height: number;
    baseLeft: number;
    baseTop: number;
  } | null>(null);

  const [dragOffset, setDragOffset] = useState<DragOffset>({ dx: 0, dy: 0 });

  const isDraggable = state === "open" || state === "opening";

  useEffect(() => {
    if (!storageKey) return;
    const saved = loadOffset(storageKey);
    if (saved) setDragOffset(saved);
  }, [storageKey]);

  useEffect(() => {
    dragOffsetRef.current = dragOffset;
  }, [dragOffset]);

  const chromeClassName = useMemo(() => {
    return [
      "fixed left-1/2 top-1/2 flex max-h-[calc(100vh-140px)] flex-col overflow-hidden rounded-3xl",
      "border border-white/15 bg-white/10 backdrop-blur-2xl",
      "shadow-[0_25px_80px_rgba(0,0,0,0.55)]",
      widthClassName,
      "transition-[opacity,transform,box-shadow] duration-200 ease-out",
      active ? "ring-1 ring-white/25" : "ring-0",
    ].join(" ");
  }, [active, widthClassName]);

  const onTitleBarPointerDown = (e: React.PointerEvent) => {
    onFocus();
    if (!isDraggable) return;
    if (!windowRef.current) return;

    const rect = windowRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const baseLeft = window.innerWidth / 2 - width / 2;
    const baseTop = window.innerHeight / 2 - height / 2;

    dragContextRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startDx: dragOffset.dx,
      startDy: dragOffset.dy,
      width,
      height,
      baseLeft,
      baseTop,
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onTitleBarPointerMove = (e: React.PointerEvent) => {
    if (!isDraggable) return;
    const ctx = dragContextRef.current;
    if (!ctx) return;

    const nextDx = ctx.startDx + (e.clientX - ctx.startX);
    const nextDy = ctx.startDy + (e.clientY - ctx.startY);

    const margin = 10;
    const dockBottomSafe = 96;
    const snap = 18;

    const minDx = margin - ctx.baseLeft;
    const maxDx = window.innerWidth - ctx.width - margin - ctx.baseLeft;
    const minDy = margin - ctx.baseTop;
    const maxDy =
      window.innerHeight - dockBottomSafe - ctx.height - margin - ctx.baseTop;

    const clampedDx = Math.min(Math.max(nextDx, minDx), maxDx);
    const clampedDy = Math.min(Math.max(nextDy, minDy), maxDy);

    setDragOffset({
      dx: Math.abs(clampedDx - minDx) <= snap ? minDx : Math.abs(clampedDx - maxDx) <= snap ? maxDx : clampedDx,
      dy: Math.abs(clampedDy - minDy) <= snap ? minDy : Math.abs(clampedDy - maxDy) <= snap ? maxDy : clampedDy,
    });
  };

  const onTitleBarPointerUp = () => {
    dragContextRef.current = null;
    if (storageKey) saveOffset(storageKey, dragOffsetRef.current);
  };

  const isHidden = state === "minimized" || state === "closing";
  const scale = state === "open" ? 1 : 0.98;
  const translateY = state === "minimized" ? 26 : state === "open" ? 0 : 10;

  return (
    <div
      ref={windowRef}
      className={[chromeClassName, isHidden ? "pointer-events-none opacity-0" : "opacity-100"].join(
        " ",
      )}
      style={{
        zIndex,
        transform: `translate(-50%, -50%) translate(${dragOffset.dx}px, ${
          dragOffset.dy + translateY
        }px) scale(${scale})`,
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={() => onFocus()}
    >
      <div
        className="flex items-center justify-between border-b border-white/10 bg-white/10 px-4 py-3 select-none"
        onPointerDown={onTitleBarPointerDown}
        onPointerMove={onTitleBarPointerMove}
        onPointerUp={onTitleBarPointerUp}
        onPointerCancel={onTitleBarPointerUp}
        onDoubleClick={() => {
          setDragOffset({ dx: 0, dy: 0 });
          if (storageKey) removeOffset(storageKey);
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-8 w-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
            <Icon className="h-4 w-4 text-white/90" />
          </span>
          <span className="font-semibold text-white/90 truncate">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/85 hover:bg-white/10 transition-colors"
            aria-label="最小化"
            title="最小化"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/85 text-white hover:bg-red-500 transition-colors"
            aria-label="关闭"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
