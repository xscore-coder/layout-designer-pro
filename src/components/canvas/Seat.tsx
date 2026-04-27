import { useFloorPlan } from "@/store/floorPlanStore";
import type { Seat as SeatT, Zone } from "@/types/floorplan";
import { cn } from "@/lib/utils";
import { Monitor, AlertTriangle, MinusCircle } from "lucide-react";

interface Props {
  seat: SeatT;
  zone: Zone;
  highlighted?: boolean;
  heatmapMax: number;
}

const ICONS = {
  empty: MinusCircle,
  pc: Monitor,
  problem: AlertTriangle,
} as const;

const TYPE_BG: Record<string, string> = {
  empty: "bg-seat-empty text-muted-foreground",
  pc: "bg-seat-agent text-white",
  problem: "bg-seat-problem text-white",
};

export function Seat({ seat, zone, highlighted, heatmapMax }: Props) {
  const cycle = useFloorPlan((s) => s.cycleSeatType);
  const select = useFloorPlan((s) => s.selectSeat);
  const selected = useFloorPlan((s) => s.selectedSeatId === seat.id);
  const inMultiSelection = useFloorPlan((s) => s.selectedSeatIds.includes(seat.id));
  const heatmap = useFloorPlan((s) => s.heatmap);

  const Icon = ICONS[seat.type] ?? MinusCircle;

  let heatStyle: React.CSSProperties = {};
  if (heatmap && seat.problemCount > 0) {
    const ratio = Math.min(1, seat.problemCount / Math.max(1, heatmapMax));
    const hue = 120 - ratio * 120; // green->red
    heatStyle = { backgroundColor: `hsl(${hue} 75% 50%)`, color: "white" };
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        const additive = e.metaKey || e.ctrlKey;
        const range = e.shiftKey;
        if (additive || range) {
          // Multi-select mode — DON'T cycle, just toggle/extend selection
          select(seat.id, { additive, range });
        } else {
          if (!seat.locked) cycle(zone.id, seat.id);
          select(seat.id);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        select(seat.id);
      }}
      title={`PC ${seat.pcNumber}${seat.lockNumber ? ` • Lock ${seat.lockNumber}` : ""}${seat.locked ? " • 🔒 Locked" : ""}${seat.problemCount ? ` • ${seat.problemCount} issue(s)` : ""}\n(Ctrl/Cmd-click = multi-select • Shift-click = range)`}
      className={cn(
        "relative h-9 w-9 rounded-md flex items-center justify-center text-[10px] font-semibold transition-all",
        "hover:scale-110 hover:z-10 hover:shadow-md",
        TYPE_BG[seat.type] ?? TYPE_BG.empty,
        selected && "ring-2 ring-ring ring-offset-1 ring-offset-card",
        inMultiSelection && !selected && "ring-2 ring-accent ring-offset-1 ring-offset-card",
        highlighted && "ring-2 ring-warning",
        seat.locked && "outline outline-1 outline-amber-400/70"
      )}
      style={heatStyle}
    >
      <Icon className="absolute inset-0 m-auto h-3.5 w-3.5 opacity-70" />
      <span className="absolute -bottom-3 text-[8px] text-foreground/70 font-mono">{seat.pcNumber}</span>
      {seat.lockNumber && (
        <span className="absolute -top-3 text-[8px] text-foreground/60 font-mono">🔒{seat.lockNumber}</span>
      )}
      {seat.locked && (
        <span className="absolute -top-1 -right-1 text-[9px] leading-none">🔐</span>
      )}
    </button>
  );
}
