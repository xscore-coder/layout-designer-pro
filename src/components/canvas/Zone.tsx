import { useRef, useState, useEffect } from "react";
import type { Zone as ZoneT } from "@/types/floorplan";
import { useFloorPlan } from "@/store/floorPlanStore";
import { Seat } from "./Seat";
import { shapeClipPath } from "@/lib/shapes";
import { cn } from "@/lib/utils";
import { Lock, GripHorizontal, RotateCw } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

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

interface DragState {
  ox: number;
  oy: number;
  startX: number;
  startY: number;
  // ghost position (canvas coords)
  gx: number;
  gy: number;
  collides: boolean;
  // group offsets (for multi-select)
  group: { id: string; dx: number; dy: number }[];
}

interface ResizeState {
  w: number;
  h: number;
  x: number;
  y: number;
}

interface RotateState {
  cx: number;
  cy: number;
  startAngle: number;
  startRotation: number;
}

const aabbOverlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

export function Zone({ zone, searchQuery, zoom, heatmapMax, otherZones = [] }: Props) {
  const updateZone = useFloorPlan((s) => s.updateZone);
  const selectZone = useFloorPlan((s) => s.selectZone);
  const selected = useFloorPlan((s) => s.selectedZoneId === zone.id);
  const isMulti = useFloorPlan((s) => s.selectedZoneIds.includes(zone.id));
  const selectedIds = useFloorPlan((s) => s.selectedZoneIds);
  const smartGuides = useFloorPlan((s) => s.smartGuides);
  const collisionOn = useFloorPlan((s) => s.collisionDetection);
  const duplicateZone = useFloorPlan((s) => s.duplicateZone);
  const removeZone = useFloorPlan((s) => s.removeZone);
  const toggleLock = useFloorPlan((s) => s.toggleLock);
  const bringToFront = useFloorPlan((s) => s.bringSelectedToFront);
  const sendToBack = useFloorPlan((s) => s.sendSelectedToBack);
  const floorLocked = useFloorPlan((s) => s.floors.find((f) => f.id === s.activeFloorId)?.locked ?? false);
  const isLocked = zone.locked || floorLocked;

  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [rotateS, setRotateS] = useState<RotateState | null>(null);
  const [guides, setGuides] = useState<{ v?: number; h?: number }>({});
  const [hoverHandle, setHoverHandle] = useState(false);

  // ===== DRAG (header handle only) =====
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      let nx = Math.max(0, drag.startX + (e.clientX - drag.ox) / zoom);
      let ny = Math.max(0, drag.startY + (e.clientY - drag.oy) / zoom);
      const newGuides: { v?: number; h?: number } = {};
      if (smartGuides) {
        const xCands = [nx, nx + zone.width / 2, nx + zone.width];
        const yCands = [ny, ny + zone.height / 2, ny + zone.height];
        for (const oz of otherZones) {
          const ozX = [oz.x, oz.x + oz.width / 2, oz.x + oz.width];
          const ozY = [oz.y, oz.y + oz.height / 2, oz.y + oz.height];
          xCands.forEach((cx, i) => {
            ozX.forEach((ox) => {
              if (Math.abs(cx - ox) < GUIDE_THRESHOLD) {
                const offset = i === 0 ? 0 : i === 1 ? zone.width / 2 : zone.width;
                nx = ox - offset;
                newGuides.v = ox;
              }
            });
          });
          yCands.forEach((cy, i) => {
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

      // collision check (against non-selected zones only)
      let collides = false;
      if (collisionOn) {
        const proposed = { x: nx, y: ny, width: zone.width, height: zone.height };
        const selSet = new Set(drag.group.map((g) => g.id));
        for (const oz of otherZones) {
          if (selSet.has(oz.id)) continue;
          if (aabbOverlap(proposed, oz)) { collides = true; break; }
        }
      }
      setGuides(newGuides);
      setDrag({ ...drag, gx: nx, gy: ny, collides });
    };
    const onUp = () => {
      if (drag && (!collisionOn || !drag.collides)) {
        const dx = drag.gx - zone.x;
        const dy = drag.gy - zone.y;
        // commit primary
        updateZone(zone.id, { x: drag.gx, y: drag.gy });
        // commit group
        for (const g of drag.group) {
          if (g.id === zone.id) continue;
          const oz = otherZones.find((o) => o.id === g.id);
          if (oz && !oz.locked) {
            updateZone(g.id, { x: Math.max(0, oz.x + dx), y: Math.max(0, oz.y + dy) });
          }
        }
      }
      setDrag(null);
      setGuides({});
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, zoom, smartGuides, otherZones, collisionOn, zone.width, zone.height, zone.x, zone.y, zone.id, updateZone]);

  // ===== RESIZE =====
  useEffect(() => {
    if (!resize) return;
    const onMove = (e: MouseEvent) => {
      updateZone(zone.id, {
        width: Math.max(120, resize.w + (e.clientX - resize.x) / zoom),
        height: Math.max(80, resize.h + (e.clientY - resize.y) / zoom),
      });
    };
    const onUp = () => setResize(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resize, updateZone, zone.id, zoom]);

  // ===== ROTATE =====
  useEffect(() => {
    if (!rotateS) return;
    const onMove = (e: MouseEvent) => {
      const angle = Math.atan2(e.clientY - rotateS.cy, e.clientX - rotateS.cx) * (180 / Math.PI);
      let next = rotateS.startRotation + (angle - rotateS.startAngle);
      if (e.shiftKey) next = Math.round(next / 15) * 15;
      updateZone(zone.id, { rotation: Math.round(next) });
    };
    const onUp = () => setRotateS(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [rotateS, updateZone, zone.id]);

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if (isLocked) return;
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    // ensure selection includes this zone
    if (!selectedIds.includes(zone.id) || additive) {
      selectZone(zone.id, { additive });
    }
    // build group (other selected zones, except locked)
    const groupIds = additive
      ? Array.from(new Set([...selectedIds, zone.id]))
      : selectedIds.includes(zone.id) && selectedIds.length > 1
        ? selectedIds
        : [zone.id];
    const group = groupIds
      .map((id) => {
        const z = id === zone.id ? zone : otherZones.find((o) => o.id === id);
        return z ? { id, dx: z.x - zone.x, dy: z.y - zone.y } : null;
      })
      .filter(Boolean) as { id: string; dx: number; dy: number }[];

    setDrag({
      ox: e.clientX,
      oy: e.clientY,
      startX: zone.x,
      startY: zone.y,
      gx: zone.x,
      gy: zone.y,
      collides: false,
      group,
    });
  };

  const onZoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    if (drag) return; // handled in mousedown
    selectZone(zone.id, { additive });
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

  const rotation = zone.rotation ?? 0;

  // Cursor logic
  const cursor = isLocked
    ? "not-allowed"
    : drag
      ? "grabbing"
      : "default";

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

      {/* Ghost preview during drag */}
      {drag && (
        <div
          className={cn(
            "absolute pointer-events-none z-40 border-2 border-dashed rounded-md transition-colors",
            drag.collides
              ? "border-destructive bg-destructive/10"
              : "border-primary bg-primary/10"
          )}
          style={{
            left: drag.gx,
            top: drag.gy,
            width: zone.width,
            height: zone.height,
            transform: rotation ? `rotate(${rotation}deg)` : undefined,
            transformOrigin: "center",
          }}
        >
          <div className="absolute -top-6 left-0 text-[10px] font-mono bg-card px-1.5 py-0.5 rounded shadow-sm border border-border">
            {Math.round(drag.gx)}, {Math.round(drag.gy)}
            {drag.collides && <span className="text-destructive ml-1">⚠ collision</span>}
          </div>
        </div>
      )}

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={ref}
            onClick={onZoneClick}
            className={cn(
              "absolute group transition-shadow",
              selected && "z-20",
              drag && "opacity-40",
              zone.hidden && "opacity-20 pointer-events-none"
            )}
            style={{
              left: zone.x,
              top: zone.y,
              width: zone.width,
              height: zone.height,
              cursor,
              transform: rotation ? `rotate(${rotation}deg)` : undefined,
              transformOrigin: "center",
            }}
          >
            <div
              className={cn(
                "h-full w-full relative overflow-hidden border-2 transition-all",
                zone.shape === "rounded" ? "rounded-3xl" : zone.shape === "rect" ? "rounded-md" : "",
                isSpace
                  ? zone.spaceKind === "group"
                    ? "border-dashed"
                    : "bg-muted/40 border-dashed border-muted-foreground/40"
                  : "backdrop-blur shadow-md",
                selected && !isSpace && "shadow-lg",
                isMulti && !selected && "ring-2 ring-accent ring-offset-2 ring-offset-background/50",
              )}
              style={{
                clipPath: clip,
                borderColor: selected
                  ? `hsl(var(--ring))`
                  : zone.borderColor
                    ? `hsl(${zone.borderColor})`
                    : isSpace
                      ? zone.spaceKind === "group" ? `hsl(${zone.color})` : undefined
                      : `hsl(${zone.color})`,
                background: !isSpace
                  ? zone.fillMode === "gradient" && zone.gradientTo
                    ? `linear-gradient(135deg, hsl(${zone.color} / ${(zone.opacity ?? 1) * 0.15}), hsl(${zone.gradientTo} / ${(zone.opacity ?? 1) * 0.15}))`
                    : `hsl(${zone.color} / ${(zone.opacity ?? 1) * 0.06})`
                  : zone.spaceKind === "group"
                    ? `hsl(${zone.color} / 0.04)`
                    : undefined,
              }}
            >
              {/* HEADER = drag handle */}
              <div
                onMouseDown={onHeaderMouseDown}
                onMouseEnter={() => setHoverHandle(true)}
                onMouseLeave={() => setHoverHandle(false)}
                className={cn(
                  "px-3 py-1.5 flex items-center justify-between text-xs font-semibold select-none transition-colors",
                  isLocked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
                  hoverHandle && !isLocked && "brightness-110"
                )}
                style={{
                  backgroundColor: !isSpace ? `hsl(${zone.color} / 0.15)` : undefined,
                  color: !isSpace ? `hsl(${zone.color})` : undefined,
                }}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <GripHorizontal className="h-3 w-3 opacity-60 shrink-0" />
                  {isLocked && <Lock className="h-3 w-3" />}
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

            {/* Resize handle */}
            {!isLocked && selected && (
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setResize({ w: zone.width, h: zone.height, x: e.clientX, y: e.clientY });
                  selectZone(zone.id);
                }}
                className="absolute -bottom-1 -right-1 h-4 w-4 cursor-se-resize bg-primary hover:bg-primary/80 rounded-sm border-2 border-card shadow-md print:hidden"
                title="Resize"
              />
            )}

            {/* Rotation handle */}
            {!isLocked && selected && (
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const rect = ref.current!.getBoundingClientRect();
                  const cx = rect.left + rect.width / 2;
                  const cy = rect.top + rect.height / 2;
                  const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
                  setRotateS({ cx, cy, startAngle, startRotation: rotation });
                  selectZone(zone.id);
                }}
                className="absolute -top-8 left-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-accent hover:bg-accent/80 text-accent-foreground flex items-center justify-center cursor-grab active:cursor-grabbing shadow-md border-2 border-card print:hidden"
                title="Rotate (hold Shift to snap 15°)"
              >
                <RotateCw className="h-3 w-3" />
              </div>
            )}
            {!isLocked && selected && (
              <div
                className="absolute -top-4 left-1/2 -translate-x-1/2 w-px h-4 bg-accent print:hidden pointer-events-none"
              />
            )}

            {/* Rotation indicator */}
            {rotateS && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-[10px] font-mono bg-card px-2 py-0.5 rounded shadow border border-border">
                {Math.round(rotation)}°
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuItem onClick={() => duplicateZone(zone.id)}>
            Duplicate <span className="ml-auto text-xs text-muted-foreground">⌘D</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => toggleLock(zone.id)}>
            {zone.locked ? "Unlock" : "Lock"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => { selectZone(zone.id); bringToFront(); }}>
            Bring to Front
          </ContextMenuItem>
          <ContextMenuItem onClick={() => { selectZone(zone.id); sendToBack(); }}>
            Send to Back
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => updateZone(zone.id, { rotation: 0 })}>
            Reset Rotation
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => removeZone(zone.id)}
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  );
}
