import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useActiveFloor, useFloorPlan } from "@/store/floorPlanStore";
import { Zone } from "./Zone";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize, Ruler, Lock } from "lucide-react";
import { AlignmentToolbar } from "@/components/AlignmentToolbar";
import { BulkSeatActions } from "@/components/BulkSeatActions";

interface Props { searchQuery: string }

export interface CanvasHandle {
  getStageEl: () => HTMLDivElement | null;
  resetView: () => void;
}

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas({ searchQuery }, ref) {
  const floor = useActiveFloor();
  const zoom = useFloorPlan((s) => s.zoom);
  const setZoom = useFloorPlan((s) => s.setZoom);
  const selectZone = useFloorPlan((s) => s.selectZone);
  const selectMany = useFloorPlan((s) => s.selectMany);
  const clearSelection = useFloorPlan((s) => s.clearSelection);
  const selectAll = useFloorPlan((s) => s.selectAllZonesOnActiveFloor);
  const removeZone = useFloorPlan((s) => s.removeZone);
  const selectedZoneId = useFloorPlan((s) => s.selectedZoneId);
  const selectedZoneIds = useFloorPlan((s) => s.selectedZoneIds);
  const moveSelectedBy = useFloorPlan((s) => s.moveSelectedBy);
  const undo = useFloorPlan((s) => s.undo);
  const redo = useFloorPlan((s) => s.redo);
  const duplicateZone = useFloorPlan((s) => s.duplicateZone);
  const showCompass = useFloorPlan((s) => s.showCompass);
  const showScale = useFloorPlan((s) => s.showScale);
  const showLegend = useFloorPlan((s) => s.showLegend);
  const theme = useFloorPlan((s) => s.theme);
  const groupSelected = useFloorPlan((s) => s.groupSelectedAsSpace);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState<{ ox: number; oy: number; sx: number; sy: number } | null>(null);
  // Lasso (marquee) selection — coordinates are in canvas (stage) space
  const [lasso, setLasso] = useState<{ x0: number; y0: number; x1: number; y1: number; additive: boolean } | null>(null);

  useImperativeHandle(ref, () => ({
    getStageEl: () => stageRef.current,
    resetView: () => { setZoom(1); setPanOffset({ x: 0, y: 0 }); },
  }));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        if (selectedZoneId) {
          e.preventDefault();
          duplicateZone(selectedZoneId);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
        if (selectedZoneIds.length >= 1) {
          e.preventDefault();
          groupSelected();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll();
      } else if (e.key === "Escape") {
        clearSelection();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedZoneIds.length) {
          e.preventDefault();
          selectedZoneIds.forEach((id) => removeZone(id));
        }
      } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (!selectedZoneIds.length) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        moveSelectedBy(dx, dy);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, selectedZoneId, selectedZoneIds, removeZone, moveSelectedBy, clearSelection, duplicateZone, groupSelected, selectAll]);

  useEffect(() => {
    if (!pan) return;
    const onMove = (e: MouseEvent) => {
      setPanOffset({ x: pan.sx + (e.clientX - pan.ox), y: pan.sy + (e.clientY - pan.oy) });
    };
    const onUp = () => setPan(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [pan]);

  // ===== Lasso (marquee) selection =====
  useEffect(() => {
    if (!lasso) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const onMove = (e: MouseEvent) => {
      // convert client coords to stage (canvas) coords
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      setLasso((l) => (l ? { ...l, x1: x, y1: y } : l));
    };
    const onUp = () => {
      setLasso((l) => {
        if (!l) return null;
        const x = Math.min(l.x0, l.x1);
        const y = Math.min(l.y0, l.y1);
        const w = Math.abs(l.x1 - l.x0);
        const h = Math.abs(l.y1 - l.y0);
        // Tiny drag = treat as click → keep selection cleared
        if (w < 4 && h < 4) {
          if (!l.additive) clearSelection();
          return null;
        }
        const hits = floor.zones
          .filter((z) => !z.hidden && z.x < x + w && z.x + z.width > x && z.y < y + h && z.y + z.height > y)
          .map((z) => z.id);
        const finalIds = l.additive
          ? Array.from(new Set([...selectedZoneIds, ...hits]))
          : hits;
        selectMany(finalIds);
        return null;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [lasso, zoom, floor.zones, selectedZoneIds, selectMany, clearSelection]);

  const heatmapMax = Math.max(
    1,
    ...floor.zones.flatMap((z) => z.seats.map((s) => s.problemCount))
  );

  const otherZones = floor.zones.filter((z) => !selectedZoneIds.includes(z.id));

  // Theme styling for canvas background
  const themeBg: Record<string, string> = {
    modern: "canvas-grid-bg",
    blueprint: "canvas-grid-bg theme-blueprint",
    corporate: "canvas-grid-bg theme-corporate",
    minimal: "canvas-grid-bg theme-minimal",
    darkpro: "canvas-grid-bg theme-darkpro",
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 overflow-hidden ${themeBg[theme] ?? "canvas-grid-bg"}`}
      style={floor.bgColor ? { backgroundColor: `hsl(${floor.bgColor})` } : undefined}
      onMouseDown={(e) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
          e.preventDefault();
          setPan({ ox: e.clientX, oy: e.clientY, sx: panOffset.x, sy: panOffset.y });
        } else if (e.target === e.currentTarget || (e.target as HTMLElement).closest("[data-canvas-stage]") === stageRef.current && e.target === stageRef.current) {
          clearSelection();
        }
      }}
      onWheel={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom(zoom + (e.deltaY < 0 ? 0.1 : -0.1));
        }
      }}
    >
      <div
        ref={stageRef}
        data-canvas-stage
        onMouseDown={(e) => {
          // Only initiate lasso when clicking the stage background (not a zone/seat)
          if (e.target === e.currentTarget && e.button === 0 && !e.altKey) {
            const rect = stageRef.current!.getBoundingClientRect();
            const x = (e.clientX - rect.left) / zoom;
            const y = (e.clientY - rect.top) / zoom;
            const additive = e.shiftKey || e.metaKey || e.ctrlKey;
            setLasso({ x0: x, y0: y, x1: x, y1: y, additive });
            if (!additive) clearSelection();
          }
        }}
        className="absolute origin-top-left"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          width: 4000,
          height: 3000,
        }}
      >
        {floor.zones.map((zone) => (
          <Zone
            key={zone.id}
            zone={zone}
            searchQuery={searchQuery}
            zoom={zoom}
            heatmapMax={heatmapMax}
            otherZones={otherZones}
          />
        ))}

        {/* Lasso (marquee) rectangle — drawn in stage (canvas) coordinates */}
        {lasso && (
          <div
            className="absolute pointer-events-none border-2 border-primary bg-primary/10 rounded-sm z-50"
            style={{
              left: Math.min(lasso.x0, lasso.x1),
              top: Math.min(lasso.y0, lasso.y1),
              width: Math.abs(lasso.x1 - lasso.x0),
              height: Math.abs(lasso.y1 - lasso.y0),
            }}
          />
        )}
      </div>

      {/* Bulk seat actions bar (shown when 2+ seats selected) */}
      <BulkSeatActions />

      {/* Multi-select Alignment toolbar */}
      <AlignmentToolbar />

      {/* Map Essentials Overlays */}
      {showScale && <ScaleBar zoom={zoom} />}

      {/* Floor lock badge */}
      {floor.locked && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-warning/95 text-warning-foreground rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2 text-xs font-semibold print:hidden z-30">
          <Lock className="h-3.5 w-3.5" />
          Floor Locked — All edits disabled
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 bg-card/90 backdrop-blur rounded-lg shadow-md border border-border p-1 print:hidden">
        <Button size="icon" variant="ghost" onClick={() => setZoom(zoom + 0.1)}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <div className="text-center text-[10px] font-mono text-muted-foreground py-1">
          {Math.round(zoom * 100)}%
        </div>
        <Button size="icon" variant="ghost" onClick={() => setZoom(zoom - 0.1)}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}>
          <Maximize className="h-4 w-4" />
        </Button>
      </div>

      {floor.zones.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center max-w-md p-8">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-primary opacity-30 mb-4" />
            <h3 className="text-xl font-semibold text-foreground/70 mb-2">Empty Floor</h3>
            <p className="text-sm text-muted-foreground">
              Click <span className="font-semibold text-foreground">+ Add Zone</span> in the toolbar to start designing your floor plan.
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

function LegendCard() {
  const items = [
    { color: "hsl(var(--seat-agent))", label: "Agent" },
    { color: "hsl(var(--seat-leader))", label: "Leader" },
    { color: "hsl(var(--seat-super))", label: "Supervisor" },
    { color: "hsl(var(--seat-problem))", label: "Problem" },
    { color: "hsl(var(--seat-empty))", label: "Empty" },
  ];
  const shifts = [
    { color: "hsl(38 92% 50%)", label: "Morning" },
    { color: "hsl(271 76% 53%)", label: "Evening" },
    { color: "hsl(217 91% 50%)", label: "Night" },
  ];
  return (
    <div className="absolute top-4 right-4 bg-card/95 backdrop-blur rounded-lg shadow-md border border-border p-3 text-[11px] min-w-[140px]">
      <div className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground mb-2">Legend</div>
      <div className="space-y-1">
        {items.map((i) => (
          <div key={i.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: i.color }} />
            <span>{i.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-border">
        <div className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground mb-1">Shifts</div>
        {shifts.map((s) => (
          <div key={s.label} className="flex items-center gap-2 mt-0.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


function ScaleBar({ zoom }: { zoom: number }) {
  // 100px on canvas at zoom=1 represents arbitrary scale: 1m
  const width = 100 * zoom;
  return (
    <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur rounded-md shadow-sm border border-border px-3 py-1.5 flex items-center gap-2">
      <Ruler className="h-3 w-3 text-muted-foreground" />
      <div>
        <div className="flex items-end h-3" style={{ width: `${Math.max(40, width)}px` }}>
          <div className="flex-1 border-l-2 border-r-2 border-b-2 border-foreground/70 h-2" />
        </div>
        <div className="text-[9px] font-mono text-muted-foreground text-center mt-0.5">1 m</div>
      </div>
    </div>
  );
}
