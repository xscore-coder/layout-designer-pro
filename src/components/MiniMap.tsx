import { useEffect, useRef, useState } from "react";
import { useActiveFloor, useFloorPlan } from "@/store/floorPlanStore";
import { Map as MapIcon, X } from "lucide-react";

export function MiniMap() {
  const floor = useActiveFloor();
  const showMiniMap = useFloorPlan((s) => s.showMiniMap);
  const toggleMiniMap = useFloorPlan((s) => s.toggleMiniMap);
  const ref = useRef<HTMLDivElement>(null);
  const [size] = useState({ w: 180, h: 130 });

  if (!showMiniMap) return null;

  // Compute bounds
  const zones = floor.zones.filter((z) => !z.hidden);
  const bounds = zones.length
    ? zones.reduce(
        (acc, z) => ({
          minX: Math.min(acc.minX, z.x),
          minY: Math.min(acc.minY, z.y),
          maxX: Math.max(acc.maxX, z.x + z.width),
          maxY: Math.max(acc.maxY, z.y + z.height),
        }),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      )
    : { minX: 0, minY: 0, maxX: 1000, maxY: 800 };

  const w = Math.max(100, bounds.maxX - bounds.minX + 100);
  const h = Math.max(100, bounds.maxY - bounds.minY + 100);
  const scale = Math.min(size.w / w, size.h / h);

  return (
    <div
      ref={ref}
      className="absolute bottom-20 right-4 bg-card/95 backdrop-blur rounded-lg border border-border shadow-lg p-2 print:hidden z-30"
      style={{ width: size.w + 16 }}
    >
      <div className="flex items-center justify-between mb-1 text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
        <span className="flex items-center gap-1"><MapIcon className="h-3 w-3" /> Mini Map</span>
        <button onClick={toggleMiniMap} className="hover:text-foreground"><X className="h-3 w-3" /></button>
      </div>
      <svg width={size.w} height={size.h} className="bg-muted/30 rounded">
        <g transform={`translate(${-bounds.minX * scale + 10}, ${-bounds.minY * scale + 10})`}>
          {zones.map((z) => (
            <rect
              key={z.id}
              x={z.x * scale}
              y={z.y * scale}
              width={Math.max(2, z.width * scale)}
              height={Math.max(2, z.height * scale)}
              fill={z.kind === "space" ? "hsl(var(--muted-foreground) / 0.3)" : `hsl(${z.color} / 0.6)`}
              stroke={`hsl(${z.color})`}
              strokeWidth={0.5}
              rx={2}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
