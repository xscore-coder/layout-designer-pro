import { useRef, useState } from "react";
import { useFloorPlan } from "@/store/floorPlanStore";
import type { Seat as SeatT, Zone } from "@/types/floorplan";
import { cn } from "@/lib/utils";
import { Monitor, AlertTriangle, MinusCircle, StickyNote, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

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
  const updateSeat = useFloorPlan((s) => s.updateSeat);
  const selected = useFloorPlan((s) => s.selectedSeatId === seat.id);
  const inMultiSelection = useFloorPlan((s) => s.selectedSeatIds.includes(seat.id));
  const heatmap = useFloorPlan((s) => s.heatmap);

  // Inline note popover
  const [noteOpen, setNoteOpen] = useState(false);
  const [draftNote, setDraftNote] = useState(seat.note ?? "");

  const Icon = ICONS[seat.type] ?? MinusCircle;

  let heatStyle: React.CSSProperties = {};
  if (heatmap && seat.problemCount > 0) {
    const ratio = Math.min(1, seat.problemCount / Math.max(1, heatmapMax));
    const hue = 120 - ratio * 120; // green->red
    heatStyle = { backgroundColor: `hsl(${hue} 75% 50%)`, color: "white" };
  }

  return (
    <Popover
      open={noteOpen}
      onOpenChange={(o) => {
        if (o) setDraftNote(seat.note ?? "");
        setNoteOpen(o);
      }}
    >
      <PopoverTrigger asChild>
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
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (seat.locked) return;
            // open inline note editor (revert the cycle that single-click did)
            setDraftNote(seat.note ?? "");
            setNoteOpen(true);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            select(seat.id);
          }}
          title={`PC ${seat.pcNumber}${seat.lockNumber ? ` • Lock ${seat.lockNumber}` : ""}${seat.locked ? " • 🔒 Locked" : ""}${seat.problemCount ? ` • ${seat.problemCount} issue(s)` : ""}${seat.note ? `\n📝 ${seat.note}` : ""}\n(Click=cycle • Double-click=note • Ctrl=multi • Shift=range)`}
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
          {/* Note indicator */}
          {seat.note && !seat.locked && (
            <span
              className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-warning text-warning-foreground flex items-center justify-center shadow-sm border border-card"
              title={seat.note}
            >
              <StickyNote className="h-2 w-2" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3"
        side="top"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5 text-warning" />
            PC {seat.pcNumber} — Quick Note
          </div>
          <button
            type="button"
            onClick={() => setNoteOpen(false)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <Textarea
          autoFocus
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              updateSeat(zone.id, seat.id, { note: draftNote.trim() || undefined });
              setNoteOpen(false);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setNoteOpen(false);
            }
          }}
          placeholder="Type a note... (Ctrl+Enter to save)"
          rows={3}
          className="text-xs resize-none"
        />
        <div className="flex items-center justify-between mt-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-xs h-7 text-destructive hover:text-destructive"
            onClick={() => {
              updateSeat(zone.id, seat.id, { note: undefined });
              setDraftNote("");
              setNoteOpen(false);
            }}
            disabled={!seat.note}
          >
            Clear
          </Button>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-xs h-7"
              onClick={() => setNoteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                updateSeat(zone.id, seat.id, { note: draftNote.trim() || undefined });
                setNoteOpen(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
