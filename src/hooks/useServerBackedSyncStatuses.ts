"use client";

import { useEffect, useState } from "react";
import "@/lib/deals";
import "@/lib/support";
import "@/lib/workflow-runs";
import {
  getServerBackedSyncStatusEventName,
  listServerBackedSyncStatuses,
  type ServerBackedSyncStatus,
} from "@/lib/server-backed-list-state";

export function useServerBackedSyncStatuses(enabled = true) {
  const [statuses, setStatuses] = useState<ServerBackedSyncStatus[]>(() =>
    enabled ? listServerBackedSyncStatuses() : [],
  );

  useEffect(() => {
    if (!enabled) {
      setStatuses([]);
      return;
    }

    const sync = () => setStatuses(listServerBackedSyncStatuses());
    sync();
    const eventName = getServerBackedSyncStatusEventName();
    window.addEventListener(eventName, sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(eventName, sync);
      window.removeEventListener("focus", sync);
    };
  }, [enabled]);

  return statuses;
}
