import { Bell, BellRing, AlertTriangle, AlertOctagon, Info, X, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useReminders, type Reminder } from "@/hooks/useReminders";
import { useFloorPlan } from "@/store/floorPlanStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SEV_STYLE: Record<Reminder["severity"], { ring: string; bg: string; icon: JSX.Element; label: string }> = {
  critical: {
    ring: "ring-destructive/40",
    bg: "bg-destructive/10",
    icon: <AlertOctagon className="h-3.5 w-3.5 text-destructive" />,
    label: "Critical",
  },
  warning: {
    ring: "ring-warning/40",
    bg: "bg-warning/10",
    icon: <AlertTriangle className="h-3.5 w-3.5 text-warning" />,
    label: "Warning",
  },
  info: {
    ring: "ring-accent/40",
    bg: "bg-accent/10",
    icon: <Info className="h-3.5 w-3.5 text-accent" />,
    label: "Info",
  },
};

export function NotificationsBell() {
  const {
    reminders, counts, total,
    dismiss, dismissAll, restoreAll,
    browserPermission, requestBrowserPermission,
  } = useReminders();
  const setActiveFloor = useFloorPlan((s) => s.setActiveFloor);
  const selectZone = useFloorPlan((s) => s.selectZone);

  const handleJump = (r: Reminder) => {
    setActiveFloor(r.floorId);
    selectZone(r.zoneId);
    // Scroll the zone into view (best-effort)
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-canvas-stage]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const hasCritical = counts.critical > 0;
  const BellIcon = total > 0 ? BellRing : Bell;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="relative"
              aria-label={`Notifications (${total})`}
            >
              <BellIcon
                className={cn(
                  "h-4 w-4",
                  hasCritical ? "text-destructive bell-pulse" : total > 0 ? "text-warning" : ""
                )}
              />
              {total > 0 && (
                <span
                  className={cn(
                    "absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white shadow-sm",
                    hasCritical ? "bg-destructive" : "bg-warning"
                  )}
                >
                  {total > 99 ? "99+" : total}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Notifications & Reminders</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-[360px] p-0">
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5" /> Notifications
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
              {counts.critical > 0 && <span className="text-destructive font-medium">● {counts.critical} critical</span>}
              {counts.warning > 0 && <span className="text-warning font-medium">● {counts.warning} warning</span>}
              {counts.info > 0 && <span className="text-accent">● {counts.info} info</span>}
              {total === 0 && <span>All clear ✓</span>}
            </div>
          </div>
          {total > 0 && (
            <Button size="sm" variant="ghost" className="text-[11px] h-7" onClick={dismissAll}>
              <Check className="h-3 w-3 mr-1" /> Dismiss all
            </Button>
          )}
        </div>

        {/* Browser permission prompt */}
        {browserPermission !== "granted" && (
          <div className="px-3 py-2 bg-muted/40 border-b border-border text-[11px] flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              {browserPermission === "denied"
                ? "🔕 Browser notifications blocked"
                : "Enable browser notifications for important alerts"}
            </span>
            {browserPermission !== "denied" && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2"
                onClick={async () => {
                  const r = await requestBrowserPermission();
                  if (r === "granted") toast.success("Browser notifications enabled");
                  else if (r === "denied") toast.error("Permission denied");
                }}
              >
                Enable
              </Button>
            )}
          </div>
        )}

        {/* List */}
        {reminders.length === 0 ? (
          <div className="px-6 py-10 text-center text-xs text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No reminders right now</p>
            <p className="mt-1 opacity-70">You're all caught up 🎉</p>
            <Button size="sm" variant="ghost" className="text-[11px] h-7 mt-3" onClick={restoreAll}>
              <RotateCcw className="h-3 w-3 mr-1" /> Restore dismissed
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-[420px]">
            <ul className="py-1">
              {reminders.map((r) => {
                const sev = SEV_STYLE[r.severity];
                return (
                  <li
                    key={r.id}
                    className={cn(
                      "group mx-1.5 my-0.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors",
                      "hover:bg-accent/10",
                      sev.bg
                    )}
                    onClick={() => handleJump(r)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 shrink-0">{sev.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-semibold truncate">
                            PC {r.pcNumber} <span className="opacity-60 font-normal">• {r.zoneName}</span>
                          </span>
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">
                            {r.floorName}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{r.message}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); dismiss(r.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5"
                        aria-label="Dismiss"
                        title="Dismiss"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="px-3 py-2 border-t border-border flex justify-end">
              <Button size="sm" variant="ghost" className="text-[11px] h-6" onClick={restoreAll}>
                <RotateCcw className="h-3 w-3 mr-1" /> Restore dismissed
              </Button>
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
