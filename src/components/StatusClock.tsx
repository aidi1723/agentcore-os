"use client";

import { useEffect, useMemo, useState } from "react";

export function StatusClock({
  locale = "en-US",
}: {
  locale?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timeText = useMemo(() => {
    return now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }, [locale, now]);

  const dateText = useMemo(() => {
    return now.toLocaleDateString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [locale, now]);

  return (
    <>
      <span className="text-sm font-semibold">{timeText}</span>
      <span className="text-xs text-white/70">{dateText}</span>
    </>
  );
}

