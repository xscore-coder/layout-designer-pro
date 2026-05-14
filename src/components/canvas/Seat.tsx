import { useEffect, useRef, useState } from "react";
import { useFloorPlan } from "@/store/floorPlanStore";
import type { Seat as SeatT, SeatType, Zone } from "@/types/floorplan";
import { cn } from "@/lib/utils";
import { Monitor, AlertTriangle, MinusCircle, StickyNote, X, Lock, Unlock, Pencil } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuCheckboxItem,
} from "@/components/ui/context-menu";
import { toast } from "sonner";

interface Props {
  seat: SeatT;
  zone: Zone;
  highlighted?: boolean;
  heatmapMax: number;
}

const ICONS = {
  empty: MinusCircle,
  pc: Monitor,
} as const;

const TYPE_BG: Record<SeatType, string> = {
  empty: "bg-seat-empty text-muted-foreground",
  pc: "bg-seat-agent text-white",
};

export function Seat({ seat, zone, highlighted, heatmapMax }: Props) {
  const select = useFloorPlan((s) => s.selectSeat);
  const updateSeat = useFloorPlan((s) => s.updateSeat);
  const selected = useFloorPlan((s) => s.selectedSeatId === seat.id);
  const inMultiSelection = useFloorPlan((s) => s.selectedSeatIds.includes(seat.id));
  const heatmap = useFloorPlan((s) => s.heatmap);

  // Inline note popover
  const [noteOpen, setNoteOpen] = useState(false);
  const [draftNote, setDraftNote] = useState(seat.note ?? "");
  const clickTimerRef = useRef<number | null>(null);

  const Icon = ICONS[seat.type] ?? MinusCircle;

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    };
  }, []);

  let heatStyle: React.CSSProperties = {};
  if (heatmap && seat.problemCount > 0) {
    const ratio = Math.min(1, seat.problemCount / Math.max(1, heatmapMax));
    const hue = 120 - ratio * 120;
    heatStyle = { backgroundColor: `hsl(${hue} 75% 50%)`, color: "white" };
  }

  const setType = (t: SeatType) => {
    if (seat.locked) {
      toast.error("Cell is locked");
      return;
    }
    if (seat.type === t) return;
    updateSeat(zone.id, seat.id, { type: t });
    toast.success(`Set to ${t.toUpperCase()}`);
  };

  const toggleProblem = () => {
    if (seat.locked) {
      toast.error("Cell is locked");
      return;
    }
    const next = !seat.hasProblem;
    updateSeat(zone.id, seat.id, { hasProblem: next });
    toast.success(next ? "Marked as Problem" : "Cleared Problem");
  };

  const TYPE_LABEL: Record<SeatType, string> = {
    pc: "PC (Active)",
    empty: "Empty",
  };

  return (
    <ContextMenu>
      <Popover
        open={noteOpen}
        onOpenChange={(o) => {
          if (o) setDraftNote(seat.note ?? "");
          setNoteOpen(o);
        }}
      >
        <PopoverAnchor asChild>
          <ContextMenuTrigger asChild>
            <button
              type="button"
              data-seat-id={seat.id}
              data-zone-id={zone.id}
              onClick={(e) => {
                e.stopPropagation();
                const additive = e.metaKey || e.ctrlKey;
                const range = e.shiftKey;
                select(seat.id, { additive, range });
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                select(seat.id);
              }}
              title={`PC ${seat.pcNumber}${seat.lockNumber ? ` • Lock ${seat.lockNumber}` : ""}${seat.locked ? " • 🔒 Locked" : ""}${seat.hasProblem ? " • ⚠ Problem" : ""}${seat.problemCount ? ` • ${seat.problemCount} issue(s)` : ""}${seat.lastUpdate ? ` • ${seat.lastUpdate}` : ""}${seat.note ? `\n📝 ${seat.note}` : ""}\n(Click=select • Right-click=menu)`}
              className={cn(
                "relative h-9 w-9 rounded-md flex items-center justify-center text-[10px] font-semibold transition-all duration-150",
                "hover:scale-110 hover:z-10 hover:shadow-lg hover:brightness-110",
                "active:scale-95",
                TYPE_BG[seat.type] ?? TYPE_BG.empty,
                seat.hasProblem && "bg-seat-problem text-white",
                selected && "ring-2 ring-ring ring-offset-2 ring-offset-card scale-105 shadow-md z-10",
                inMultiSelection && !selected && "ring-2 ring-accent ring-offset-1 ring-offset-card",
                highlighted && "ring-2 ring-warning animate-pulse",
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
              {seat.hasProblem && (
                <span
                  className="absolute -top-1 -left-1 h-3 w-3 rounded-full bg-destructive text-white flex items-center justify-center shadow-sm border border-card"
                  title="Has problem"
                >
                  <AlertTriangle className="h-2 w-2" />
                </span>
              )}
              {seat.note && !seat.locked && (
                <span
                  className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-warning text-warning-foreground flex items-center justify-center shadow-sm border border-card"
                  title={seat.note}
                >
                  <StickyNote className="h-2 w-2" />
                </span>
              )}
            </button>
          </ContextMenuTrigger>
        </PopoverAnchor>

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

      <ContextMenuContent
        className="w-52"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <ContextMenuLabel className="text-[11px] font-mono">
          PC {seat.pcNumber}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Cell Type
        </ContextMenuLabel>
        <ContextMenuRadioGroup
          value={seat.type}
          onValueChange={(v) => {
            select(seat.id);
            setType(v as SeatType);
          }}
        >
          <ContextMenuRadioItem value="pc" disabled={seat.locked}>
            <Monitor className="h-3.5 w-3.5 mr-2 text-seat-agent" />
            {TYPE_LABEL.pc}
          </ContextMenuRadioItem>
          <ContextMenuRadioItem value="empty" disabled={seat.locked}>
            <MinusCircle className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            {TYPE_LABEL.empty}
          </ContextMenuRadioItem>
        </ContextMenuRadioGroup>
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem
          checked={!!seat.hasProblem}
          disabled={seat.locked}
          onCheckedChange={() => {
            select(seat.id);
            toggleProblem();
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5 mr-2 text-seat-problem" />
          Has problem
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={seat.locked}
          onClick={() => {
            select(seat.id);
            setDraftNote(seat.note ?? "");
            setNoteOpen(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5 mr-2" />
          Edit note…
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            updateSeat(zone.id, seat.id, { locked: !seat.locked });
            toast.success(seat.locked ? "Cell unlocked" : "Cell locked");
          }}
        >
          {seat.locked ? (
            <><Unlock className="h-3.5 w-3.5 mr-2" /> Unlock cell</>
          ) : (
            <><Lock className="h-3.5 w-3.5 mr-2" /> Lock cell</>
          )}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
