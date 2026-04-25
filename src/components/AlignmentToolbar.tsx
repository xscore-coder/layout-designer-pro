import { useFloorPlan } from "@/store/floorPlanStore";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  ArrowUpToLine, ArrowDownToLine, Copy, Trash2, X,
} from "lucide-react";

export function AlignmentToolbar() {
  const ids = useFloorPlan((s) => s.selectedZoneIds);
  const align = useFloorPlan((s) => s.alignSelected);
  const distribute = useFloorPlan((s) => s.distributeSelected);
  const front = useFloorPlan((s) => s.bringSelectedToFront);
  const back = useFloorPlan((s) => s.sendSelectedToBack);
  const removeZone = useFloorPlan((s) => s.removeZone);
  const duplicateZone = useFloorPlan((s) => s.duplicateZone);
  const clear = useFloorPlan((s) => s.clearSelection);

  if (ids.length < 2) return null;

  const Btn = ({ tip, onClick, children }: { tip: string; onClick: () => void; children: React.ReactNode }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-card/95 backdrop-blur shadow-lg border border-border rounded-xl px-2 py-1 flex items-center gap-0.5 print:hidden animate-in fade-in slide-in-from-top-2">
      <span className="text-[11px] font-semibold text-muted-foreground px-2">
        {ids.length} selected
      </span>
      <div className="h-5 w-px bg-border mx-1" />

      <Btn tip="Align Left" onClick={() => align("left")}><AlignStartVertical className="h-4 w-4" /></Btn>
      <Btn tip="Align Center (X)" onClick={() => align("centerX")}><AlignCenterVertical className="h-4 w-4" /></Btn>
      <Btn tip="Align Right" onClick={() => align("right")}><AlignEndVertical className="h-4 w-4" /></Btn>

      <div className="h-5 w-px bg-border mx-1" />

      <Btn tip="Align Top" onClick={() => align("top")}><AlignStartHorizontal className="h-4 w-4" /></Btn>
      <Btn tip="Align Middle (Y)" onClick={() => align("centerY")}><AlignCenterHorizontal className="h-4 w-4" /></Btn>
      <Btn tip="Align Bottom" onClick={() => align("bottom")}><AlignEndHorizontal className="h-4 w-4" /></Btn>

      <div className="h-5 w-px bg-border mx-1" />

      <Btn tip="Distribute Horizontally" onClick={() => distribute("horizontal")}>
        <AlignHorizontalDistributeCenter className="h-4 w-4" />
      </Btn>
      <Btn tip="Distribute Vertically" onClick={() => distribute("vertical")}>
        <AlignVerticalDistributeCenter className="h-4 w-4" />
      </Btn>

      <div className="h-5 w-px bg-border mx-1" />

      <Btn tip="Bring to Front" onClick={front}><ArrowUpToLine className="h-4 w-4" /></Btn>
      <Btn tip="Send to Back" onClick={back}><ArrowDownToLine className="h-4 w-4" /></Btn>

      <div className="h-5 w-px bg-border mx-1" />

      <Btn tip="Duplicate" onClick={() => ids.forEach((id) => duplicateZone(id))}>
        <Copy className="h-4 w-4" />
      </Btn>
      <Btn tip="Delete" onClick={() => ids.forEach((id) => removeZone(id))}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Btn>

      <div className="h-5 w-px bg-border mx-1" />
      <Btn tip="Clear selection (Esc)" onClick={clear}><X className="h-4 w-4" /></Btn>
    </div>
  );
}
