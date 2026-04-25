import { useRef, useState, useEffect } from "react";
import type { Zone as ZoneT } from "@/types/floorplan";
import { useFloorPlan } from "@/store/floorPlanStore";
import { Seat } from "./Seat";
import { shapeClipPath } from "@/lib/shapes";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

interface Props {
  zone: ZoneT;
  searchQuery: string;
  zoom: number;
  heatmapMax: number;
  otherZones?: ZoneT[];
}

const SPACE_LABELS: Record<string, string> = {
  corridor: "Corridor",
  office: "Office",
  storage: "Storage",
  pillar: "Pillar",
  blank: "Empty",
};

const GUIDE_THRESHOLD = 6;

export function Zone({ zone, searchQuery, zoom, heatmapMax, otherZones = [] }: Props) {
  const updateZone = useFloorPlan((s) => s.updateZone);
  const selectZone = useFloorPlan((s) => s.selectZone);
  const selected = useFloorPlan((s) => s.selectedZoneId === zone.id);
  const smartGuides = useFloorPlan((s) => s.smartGuides);
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ ox: number; oy: number } | null>(null);
  const [resize, setResize] = useState<{ w: number; h: number; x: number; y: number } | null>(null);
  const [guides, setGuides] = useState<{ v?: number; h?: number }>({});

  useEffect(() => {
    if (!drag && !resize) return;
    const onMove = (e: MouseEvent) => {
      if (drag) {
        let nx = Math.max(0, (e.clientX - drag.ox) / zoom);
        let ny = Math.max(0, (e.clientY - drag.oy) / zoom);
        const newGuides: { v?: number; h?: number } = {};
        if (smartGuides) {
          const xCandidates = [nx, nx + zone.width / 2, nx + zone.width];
          const yCandidates = [ny, ny + zone.height / 2, ny + zone.height];
          for (const oz of otherZones) {
            const ozX = [oz.x, oz.x + oz.width / 2, oz.x + oz.width];
            const ozY = [oz.y, oz.y + oz.height / 2, oz.y + oz.height];
            xCandidates.forEach((cx, i) => {
              ozX.forEach((ox) => {
                if (Math.abs(cx - ox) < GUIDE_THRESHOLD) {
                  const offset = i === 0 ? 0 : i === 1 ? zone.width / 2 : zone.width;
                  nx = ox - offset;
                  newGuides.v = ox;
                }
              });
            });
            yCandidates.forEach((cy, i) => {
              ozY.forEach((oy) => {
                if (Math.abs(cy - oy) < GUIDE_THRESHOLD) {
                  const offset = i === 0 ? 0 : i === 1 ? zone.height / 2 : zone.height;
                  ny = oy - offset;
                  newGuides.h = oy;
                }
              });
            });
          }
        }
        setGuides(newGuides);
        updateZone(zone.id, { x: nx, y: ny });
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
      setGuides({});
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, resize, updateZone, zone.id, zone.width, zone.height, zoom, smartGuides, otherZones]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (zone.locked) return;
    const rect = ref.current!.getBoundingClientRect();
    setDrag({ ox: e.clientX - rect.left, oy: e.clientY - rect.top });
    selectZone(zone.id);
  };

  const clip = shapeClipPath(zone.shape);
  const isSpace = zone.kind === "space";

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
    <>
      {/* Smart guides */}
      {guides.v !== undefined && (
        <div className="absolute pointer-events-none z-30" style={{
          left: guides.v, top: 0, width: 1, height: 3000,
          background: "hsl(340 82% 52%)", boxShadow: "0 0 4px hsl(340 82% 52%)",
        }} />
      )}
      {guides.h !== undefined && (
        <div className="absolute pointer-events-none z-30" style={{
          top: guides.h, left: 0, height: 1, width: 4000,
          background: "hsl(340 82% 52%)", boxShadow: "0 0 4px hsl(340 82% 52%)",
        }} />
      )}

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

        {!zone.locked && (
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              setResize({ w: zone.width, h: zone.height, x: e.clientX, y: e.clientY });
              selectZone(zone.id);
            }}
            className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-primary/60 hover:bg-primary rounded-tl print:hidden"
          />
        )}
      </div>
    </>
  );
}
