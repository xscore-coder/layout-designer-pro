import { useFloorPlan } from "@/store/floorPlanStore";
import { Button } from "@/components/ui/button";
import { Monitor, AlertTriangle, MinusCircle, Lock, Unlock, X, Eraser, CalendarDays } from "lucide-react";
import { toast } from "sonner";

/**
 * Floating bulk-action bar that appears when 2+ seats are selected.
 * Lets the user apply a status / lock / clear notes to all selected seats at once.
 */
export function BulkSeatActions() {
  const ids = useFloorPlan((s) => s.selectedSeatIds);
  const bulkSetType = useFloorPlan((s) => s.bulkSetSelectedSeatType);
  const bulkUpdate = useFloorPlan((s) => s.bulkUpdateSelectedSeats);
  const clearSel = useFloorPlan((s) => s.clearSeatSelection);

  if (ids.length < 2) return null;

  const today = () => new Date().toISOString().slice(0, 10);

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 print:hidden">
      <div className="flex items-center gap-1 bg-card/95 backdrop-blur border border-border shadow-lg rounded-full px-2 py-1.5">
        <span className="px-2 text-xs font-semibold text-muted-foreground">
          {ids.length} selected
        </span>
        <div className="h-5 w-px bg-border mx-1" />

        <Button size="sm" variant="ghost" className="h-7 px-2 gap-1"
          onClick={() => { bulkSetType("pc"); toast.success(`${ids.length} → PC`); }}
          title="Set status: PC">
          <Monitor className="h-3.5 w-3.5" /> PC
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-destructive"
          onClick={() => { bulkSetType("problem"); toast.success(`${ids.length} → Problem`); }}
          title="Set status: Problem">
          <AlertTriangle className="h-3.5 w-3.5" /> Problem
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 gap-1"
          onClick={() => { bulkSetType("empty"); toast.success(`${ids.length} → Empty`); }}
          title="Set status: Empty">
          <MinusCircle className="h-3.5 w-3.5" /> Empty
        </Button>

        <div className="h-5 w-px bg-border mx-1" />

        <Button size="sm" variant="ghost" className="h-7 px-2 gap-1"
          onClick={() => { bulkUpdate({ locked: true }); toast.success(`${ids.length} locked`); }}
          title="Lock all selected">
          <Lock className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 gap-1"
          onClick={() => { bulkUpdate({ locked: false }); toast.success(`${ids.length} unlocked`); }}
          title="Unlock all selected">
          <Unlock className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 gap-1"
          onClick={() => { bulkUpdate({ lastUpdate: today() }); toast.success(`${ids.length} dated today`); }}
          title="Set Last Update = today">
          <CalendarDays className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 gap-1"
          onClick={() => { bulkUpdate({ note: "", waslaSctFeedback: "" }); toast.success(`Notes cleared`); }}
          title="Clear notes & feedback">
          <Eraser className="h-3.5 w-3.5" />
        </Button>

        <div className="h-5 w-px bg-border mx-1" />

        <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-muted-foreground"
          onClick={clearSel}
          title="Clear selection (Esc)">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
