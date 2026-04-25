import { useRef, useState, useEffect } from "react";
import { useActiveFloor, useFloorPlan } from "@/store/floorPlanStore";
import { Zone } from "./Zone";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";

interface Props { searchQuery: string }

export function Canvas({ searchQuery }: Props) {
  const floor = useActiveFloor();
  const zoom = useFloorPlan((s) => s.zoom);
  const setZoom = useFloorPlan((s) => s.setZoom);
  const selectZone = useFloorPlan((s) => s.selectZone);
  const removeZone = useFloorPlan((s) => s.removeZone);
  const selectedZoneId = useFloorPlan((s) => s.selectedZoneId);
  const undo = useFloorPlan((s) => s.undo);
  const redo = useFloorPlan((s) => s.redo);
  const containerRef = useRef<HTMLDivElement>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState<{ ox: number; oy: number; sx: number; sy: number } | null>(null);

  // Keyboard shortcuts
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
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedZoneId) {
          e.preventDefault();
          removeZone(selectedZoneId);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, selectedZoneId, removeZone]);

  // Pan with middle mouse / space + drag (simplified: middle button)
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

  // compute heatmap max
  const heatmapMax = Math.max(
    1,
    ...floor.zones.flatMap((z) => z.seats.map((s) => s.problemCount))
  );

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden canvas-grid-bg"
      onMouseDown={(e) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
          e.preventDefault();
          setPan({ ox: e.clientX, oy: e.clientY, sx: panOffset.x, sy: panOffset.y });
        } else if (e.target === e.currentTarget) {
          selectZone(null);
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
          />
        ))}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 bg-card/90 backdrop-blur rounded-lg shadow-md border border-border p-1">
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
}
