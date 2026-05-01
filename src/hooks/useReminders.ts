import { useEffect, useMemo, useState } from "react";
import { useFloorPlan } from "@/store/floorPlanStore";
import type { Floor, Seat, Zone } from "@/types/floorplan";

export type ReminderSeverity = "info" | "warning" | "critical";
export type ReminderKind =
  | "stale-problem"   // a seat with problems hasn't been updated in N days
  | "follow-up"       // note contains TODO / FOLLOW UP
  | "missing-update"  // seat has problemCount > 0 but no lastUpdate
  | "feedback";       // wasla SCT feedback present and recent

export interface Reminder {
  id: string;
  kind: ReminderKind;
  severity: ReminderSeverity;
  floorId: string;
  floorName: string;
  zoneId: string;
  zoneName: string;
  seatId: string;
  pcNumber: string;
  message: string;
  ageDays?: number;
}

const FOLLOW_UP_RX = /\b(todo|follow[- ]?up|متابعة|تذكير|مهم)\b/i;
const STALE_DAYS = 7;

function daysAgo(iso?: string): number | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function buildReminders(floors: Floor[]): Reminder[] {
  const out: Reminder[] = [];
  for (const floor of floors) {
    for (const zone of floor.zones) {
      if (zone.kind !== "zone") continue;
      for (const seat of zone.seats) {
        pushSeatReminders(out, floor, zone, seat);
      }
    }
  }
  // Sort: critical → warning → info, then by ageDays desc
  const sevRank: Record<ReminderSeverity, number> = { critical: 0, warning: 1, info: 2 };
  out.sort((a, b) => {
    const s = sevRank[a.severity] - sevRank[b.severity];
    if (s !== 0) return s;
    return (b.ageDays ?? 0) - (a.ageDays ?? 0);
  });
  return out;
}

function pushSeatReminders(out: Reminder[], floor: Floor, zone: Zone, seat: Seat) {
  const baseMeta = {
    floorId: floor.id,
    floorName: floor.name,
    zoneId: zone.id,
    zoneName: zone.name,
    seatId: seat.id,
    pcNumber: seat.pcNumber,
  };

  // Follow-up keywords in note
  if (seat.note && FOLLOW_UP_RX.test(seat.note)) {
    out.push({
      id: `${seat.id}:follow-up`,
      kind: "follow-up",
      severity: "warning",
      message: `Follow-up note: "${seat.note.slice(0, 60)}${seat.note.length > 60 ? "…" : ""}"`,
      ...baseMeta,
    });
  }

  // Stale problem
  if (seat.hasProblem || seat.problemCount > 0) {
    const age = daysAgo(seat.lastUpdate);
    if (age === undefined) {
      out.push({
        id: `${seat.id}:missing-update`,
        kind: "missing-update",
        severity: "warning",
        message: `Has issue${seat.problemCount > 1 ? "s" : ""} but no last-update date`,
        ...baseMeta,
      });
    } else if (age >= STALE_DAYS) {
      out.push({
        id: `${seat.id}:stale-problem`,
        kind: "stale-problem",
        severity: age >= 14 ? "critical" : "warning",
        ageDays: age,
        message: `Unresolved for ${age} day${age === 1 ? "" : "s"}`,
        ...baseMeta,
      });
    }
  }

  // Wasla SCT feedback present
  if (seat.waslaSctFeedback && seat.waslaSctFeedback.trim()) {
    out.push({
      id: `${seat.id}:feedback`,
      kind: "feedback",
      severity: "info",
      message: `SCT feedback recorded`,
      ...baseMeta,
    });
  }
}

const DISMISS_KEY = "floorplan-dismissed-reminders-v1";
const NOTIFIED_KEY = "floorplan-notified-reminders-v1";

function loadSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}
function saveSet(key: string, s: Set<string>) {
  try { localStorage.setItem(key, JSON.stringify([...s])); } catch { /* ignore */ }
}

export function useReminders() {
  const floors = useFloorPlan((s) => s.floors);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadSet(DISMISS_KEY));
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  const all = useMemo(() => buildReminders(floors), [floors]);
  const visible = useMemo(() => all.filter((r) => !dismissed.has(r.id)), [all, dismissed]);

  // Browser-push: only for NEW critical/warning reminders we haven't notified before
  useEffect(() => {
    if (browserPermission !== "granted") return;
    const notified = loadSet(NOTIFIED_KEY);
    const fresh = visible.filter(
      (r) => (r.severity === "critical" || r.severity === "warning") && !notified.has(r.id)
    );
    if (!fresh.length) return;

    // Throttle: at most 3 native notifications per batch
    fresh.slice(0, 3).forEach((r) => {
      try {
        new Notification(`PC ${r.pcNumber} • ${r.zoneName}`, {
          body: r.message,
          tag: r.id,
          icon: "/favicon.ico",
        });
      } catch { /* ignore */ }
      notified.add(r.id);
    });
    saveSet(NOTIFIED_KEY, notified);
  }, [visible, browserPermission]);

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveSet(DISMISS_KEY, next);
      return next;
    });
  };

  const dismissAll = () => {
    setDismissed((prev) => {
      const next = new Set(prev);
      visible.forEach((r) => next.add(r.id));
      saveSet(DISMISS_KEY, next);
      return next;
    });
  };

  const restoreAll = () => {
    setDismissed(new Set());
    saveSet(DISMISS_KEY, new Set());
  };

  const requestBrowserPermission = async () => {
    if (typeof Notification === "undefined") return "denied" as NotificationPermission;
    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      setBrowserPermission(result);
      return result;
    }
    setBrowserPermission(Notification.permission);
    return Notification.permission;
  };

  // Counts by severity (for badge)
  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, info: 0 };
    for (const r of visible) c[r.severity]++;
    return c;
  }, [visible]);

  return {
    reminders: visible,
    counts,
    total: visible.length,
    dismiss,
    dismissAll,
    restoreAll,
    browserPermission,
    requestBrowserPermission,
  };
}
