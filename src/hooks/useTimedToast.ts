"use client";

import { useEffect, useRef, useState } from "react";

export type ToastTone = "ok" | "error";

export type TimedToast = {
  message: string;
  tone: ToastTone;
};

export function useTimedToast(durationMs = 2000) {
  const [toast, setToast] = useState<TimedToast | null>(null);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const clearToast = () => {
    if (!mountedRef.current) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  };

  const showToast = (message: string, tone: ToastTone = "ok") => {
    if (!mountedRef.current) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    setToast({ message, tone });
    timerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setToast(null);
      timerRef.current = null;
    }, durationMs);
  };

  return { toast, showToast, clearToast };
}
