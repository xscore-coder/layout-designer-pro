import { useFloorPlan, useActiveFloor } from "@/store/floorPlanStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, EyeOff, Lock, Unlock, Layers as LayersIcon, Square, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./ColorPicker";

export function LayersPanel() {
  const floor = useActiveFloor();
  const selectedIds = useFloorPlan((s) => s.selectedZoneIds);
  const select = useFloorPlan((s) => s.selectZone);
  const toggleHidden = useFloorPlan((s) => s.toggleZoneVisibility);
  const toggleLock = useFloorPlan((s) => s.toggleLock);
  const updateZone = useFloorPlan((s) => s.updateZone);

  // Build a tree: top-level (no parentId) → children
  const top = floor.zones.filter((z) => !z.parentId);
  const childrenOf = (id: string) => floor.zones.filter((z) => z.parentId === id);

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-t border-border">
      <div className="px-3 py-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <LayersIcon className="h-3.5 w-3.5" /> Layers
      </div>
      <ScrollArea className="flex-1">
        <div className="px-1 pb-2">
          {top.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-3 px-2">No layers yet.</p>
          )}
          {top.slice().reverse().map((z) => (
            <LayerRow
              key={z.id}
              zone={z}
              level={0}
              selected={selectedIds.includes(z.id)}
              onSelect={(e) => select(z.id, { additive: e.shiftKey || e.metaKey || e.ctrlKey })}
              onToggleHidden={() => toggleHidden(z.id)}
              onToggleLock={() => toggleLock(z.id)}
              onColor={(c) => updateZone(z.id, { color: c })}
            >
              {childrenOf(z.id).slice().reverse().map((c) => (
                <LayerRow
                  key={c.id}
                  zone={c}
                  level={1}
                  selected={selectedIds.includes(c.id)}
                  onSelect={(e) => select(c.id, { additive: e.shiftKey || e.metaKey || e.ctrlKey })}
                  onToggleHidden={() => toggleHidden(c.id)}
                  onToggleLock={() => toggleLock(c.id)}
                  onColor={(col) => updateZone(c.id, { color: col })}
                />
              ))}
            </LayerRow>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function LayerRow({
  zone, level, selected, onSelect, onToggleHidden, onToggleLock, onColor, children,
}: {
  zone: any;
  level: number;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onToggleHidden: () => void;
  onToggleLock: () => void;
  onColor: (c: string) => void;
  children?: React.ReactNode;
}) {
  const isSpace = zone.kind === "space";
  return (
    <>
      <div
        onClick={onSelect}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-[12px] cursor-pointer transition-colors group",
          selected ? "bg-primary/10 text-primary" : "hover:bg-muted",
          zone.hidden && "opacity-40"
        )}
        style={{ paddingLeft: 8 + level * 14 }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggleHidden(); }}
          className="opacity-50 hover:opacity-100"
          title={zone.hidden ? "Show" : "Hide"}
        >
          {zone.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
          className="opacity-50 hover:opacity-100"
          title={zone.locked ? "Unlock" : "Lock"}
        >
          {zone.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
        </button>
        <div onClick={(e) => e.stopPropagation()}>
          <ColorPicker
            value={zone.color}
            onChange={onColor}
            compact
          />
        </div>
        {isSpace ? <Square className="h-3 w-3 opacity-60" /> : <Users className="h-3 w-3 opacity-60" />}
        <span className="flex-1 truncate">{zone.name}</span>
        {!isSpace && (
          <span className="text-[9px] font-mono opacity-50">{zone.seats?.length ?? 0}</span>
        )}
      </div>
      {children}
    </>
  );
}
