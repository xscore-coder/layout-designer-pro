import { useRef, useState, useEffect } from "react";
import type { Zone as ZoneT } from "@/types/floorplan";
import { useFloorPlan } from "@/store/floorPlanStore";
import { Seat } from "./Seat";
import { shapeClipPath } from "@/lib/shapes";
import { cn } from "@/lib/utils";
import { Lock, MoreHorizontal } from "lucide-react";

interface Props {
  zone: ZoneT;
  searchQuery: string;
  zoom: number;
  heatmapMax: number;
}

const SPACE_LABELS: Record<string, string> = {
  corridor: "Corridor",
  office: "Office",
  storage: "Storage",
  pillar: "Pillar",
  blank: "Empty",
};

export function Zone({ zone, searchQuery, zoom, heatmapMax }: Props) {
  const updateZone = useFloorPlan((s) => s.updateZone);
  const selectZone = useFloorPlan((s) => s.selectZone);
  const selected = useFloorPlan((s) => s.selectedZoneId === zone.id);
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ ox: number; oy: number } | null>(null);
  const [resize, setResize] = useState<{ w: number; h: number; x: number; y: number } | null>(null);

  // mouse move/up listeners
  useEffect(() => {
    if (!drag && !resize) return;
    const onMove = (e: MouseEvent) => {
      if (drag) {
        updateZone(zone.id, {
          x: Math.max(0, (e.clientX - drag.ox) / zoom),
          y: Math.max(0, (e.clientY - drag.oy) / zoom),
        });
      } else if (resize) {
        updateZone(zone.id, {
          width: Math.max(120, resize.w + (e.clientX - resize.x) / zoom),
          height: Math.max(80, resize.h + (e.clientY - resize.y) / zoom),
        });
      }
    };
    const onUp = () => {
      setDrag(null);
      setResize(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, resize, updateZone, zone.id, zoom]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (zone.locked) return;
    const rect = ref.current!.getBoundingClientRect();
    setDrag({ ox: e.clientX - rect.left, oy: e.clientY - rect.top });
    selectZone(zone.id);
  };

  const clip = shapeClipPath(zone.shape);
  const isSpace = zone.kind === "space";

  // Highlight if PC matches search
  const highlightSeatIds = new Set<string>();
  if (searchQuery && !isSpace) {
    const q = searchQuery.toLowerCase();
    zone.seats.forEach((s) => {
      if (
        s.pcNumber.toLowerCase().includes(q) ||
        s.agentName?.toLowerCase().includes(q)
      ) highlightSeatIds.add(s.id);
    });
  }

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      onClick={(e) => { e.stopPropagation(); selectZone(zone.id); }}
      className={cn(
        "absolute group transition-shadow",
        zone.locked ? "cursor-not-allowed" : "cursor-move",
        selected && "z-20"
      )}
      style={{
        left: zone.x,
        top: zone.y,
        width: zone.width,
        height: zone.height,
      }}
    >
      <div
        className={cn(
          "h-full w-full relative overflow-hidden border-2 transition-all",
          zone.shape === "rounded" ? "rounded-3xl" : zone.shape === "rect" ? "rounded-md" : "",
          isSpace
            ? "bg-muted/40 border-dashed border-muted-foreground/40"
            : "bg-card/95 backdrop-blur shadow-md",
          selected && !isSpace && "shadow-lg",
        )}
        style={{
          clipPath: clip,
          borderColor: selected ? `hsl(var(--ring))` : isSpace ? undefined : `hsl(${zone.color})`,
          backgroundColor: !isSpace ? `hsl(${zone.color} / 0.06)` : undefined,
        }}
      >
        {/* Header */}
        <div
          className="px-3 py-1.5 flex items-center justify-between text-xs font-semibold"
          style={{
            backgroundColor: !isSpace ? `hsl(${zone.color} / 0.15)` : undefined,
            color: !isSpace ? `hsl(${zone.color})` : undefined,
          }}
        >
          <span className="flex items-center gap-1.5 truncate">
            {zone.locked && <Lock className="h-3 w-3" />}
            {isSpace ? SPACE_LABELS[zone.spaceKind ?? "blank"] : zone.name}
          </span>
          {!isSpace && (
            <span className="text-[10px] font-mono opacity-70">
              {zone.seats.length} PCs
            </span>
          )}
        </div>

        {/* Body */}
        {isSpace ? (
          <div className="flex-1 h-full flex items-center justify-center text-muted-foreground/60 text-xs uppercase tracking-widest">
            {zone.spaceKind}
          </div>
        ) : (
          <div className="p-3 pb-5">
            <div
              className="grid gap-2 mx-auto"
              style={{
                gridTemplateColumns: `repeat(${zone.cols}, minmax(0, 1fr))`,
                width: "fit-content",
              }}
            >
              {zone.seats.map((seat) => (
                <Seat
                  key={seat.id}
                  seat={seat}
                  zone={zone}
                  highlighted={highlightSeatIds.has(seat.id)}
                  heatmapMax={heatmapMax}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resize handle */}
      {!zone.locked && (
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            setResize({ w: zone.width, h: zone.height, x: e.clientX, y: e.clientY });
            selectZone(zone.id);
          }}
          className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-primary/60 hover:bg-primary rounded-tl"
        />
      )}
    </div>
  );
}
