import { useFloorPlan, useActiveFloor } from "@/store/floorPlanStore";
import { Button } from "@/components/ui/button";
import { Plus, Building2, X, Layers, Lock, Unlock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./ColorPicker";

export function FloorList() {
  const floors = useFloorPlan((s) => s.floors);
  const activeId = useFloorPlan((s) => s.activeFloorId);
  const setActive = useFloorPlan((s) => s.setActiveFloor);
  const addFloor = useFloorPlan((s) => s.addFloor);
  const removeFloor = useFloorPlan((s) => s.removeFloor);
  const renameFloor = useFloorPlan((s) => s.renameFloor);
  const toggleFloorLock = useFloorPlan((s) => s.toggleFloorLock);
  const updateFloor = useFloorPlan((s) => s.updateFloor);

  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Layers className="h-3.5 w-3.5" /> Floors
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addFloor}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="max-h-44">
        <div className="px-2 pb-2 space-y-1">
          {floors.map((f) => (
            <div
              key={f.id}
              onClick={() => setActive(f.id)}
              className={cn(
                "group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
                activeId === f.id ? "bg-primary/10 text-primary" : "hover:bg-muted",
                f.locked && "opacity-90"
              )}
            >
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <input
                value={f.name}
                onChange={(e) => renameFloor(f.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                disabled={f.locked}
                className="flex-1 bg-transparent outline-none min-w-0 truncate disabled:cursor-not-allowed"
              />
              {/* Floor BG color */}
              <div onClick={(e) => e.stopPropagation()}>
                <ColorPicker
                  compact
                  value={f.bgColor ?? "220 20% 97%"}
                  onChange={(c) => updateFloor(f.id, { bgColor: c })}
                  label="Floor background"
                />
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">{f.zones.length}</span>
              <button
                onClick={(e) => { e.stopPropagation(); toggleFloorLock(f.id); }}
                className={cn(
                  "transition-opacity",
                  f.locked ? "opacity-100 text-warning" : "opacity-50 hover:opacity-100"
                )}
                title={f.locked ? "Unlock floor" : "Lock floor"}
              >
                {f.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              </button>
              {floors.length > 1 && !f.locked && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeFloor(f.id); }}
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function ZoneList() {
  const floor = useActiveFloor();
  const selectedId = useFloorPlan((s) => s.selectedZoneId);
  const select = useFloorPlan((s) => s.selectZone);
  return (
    <div className="border-b border-border max-h-48 flex flex-col">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Zones — {floor.name}
      </div>
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2 space-y-1">
          {floor.zones.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4 px-2">
              No zones yet.
            </p>
          )}
          {floor.zones.map((z) => (
            <button
              key={z.id}
              onClick={() => select(z.id)}
              className={cn(
                "w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                selectedId === z.id ? "bg-muted ring-1 ring-ring" : "hover:bg-muted/60"
              )}
            >
              <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: `hsl(${z.color})` }} />
              <span className="flex-1 truncate">{z.name}</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {z.kind === "zone" ? z.seats.length : z.spaceKind}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
