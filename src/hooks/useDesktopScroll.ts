"use client";

import { useEffect, useRef, useState } from "react";
import type { AppId } from "@/apps/types";

export function useDesktopScroll(desktopApps: AppId[]) {
  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const [desktopCanScrollUp, setDesktopCanScrollUp] = useState(false);
  const [desktopCanScrollDown, setDesktopCanScrollDown] = useState(false);

  const updateDesktopScrollState = () => {
    const el = desktopScrollRef.current;
    if (!el) {
      setDesktopCanScrollUp(false);
      setDesktopCanScrollDown(false);
      return;
    }
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    setDesktopCanScrollUp(el.scrollTop > 12);
    setDesktopCanScrollDown(maxScrollTop - el.scrollTop > 12);
  };

  const scrollDesktopByPage = (direction: -1 | 1) => {
    const el = desktopScrollRef.current;
    if (!el) return;
    const distance = Math.max(240, Math.floor(el.clientHeight * 0.72)) * direction;
    el.scrollBy({ top: distance, behavior: "smooth" });
  };

  useEffect(() => {
    const el = desktopScrollRef.current;
    if (!el) return;
    const onScroll = () => updateDesktopScrollState();
    const onResize = () => updateDesktopScrollState();

    updateDesktopScrollState();
    const rafId = window.requestAnimationFrame(updateDesktopScrollState);
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(rafId);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [desktopApps]);

  return {
    desktopScrollRef,
    desktopCanScrollUp,
    desktopCanScrollDown,
    scrollDesktopByPage,
  };
}
