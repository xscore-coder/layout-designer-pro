import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFloorPlan } from "@/store/floorPlanStore";
import type { SpaceKind } from "@/types/floorplan";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

const KINDS: { value: SpaceKind; label: string; w: number; h: number }[] = [
  { value: "corridor", label: "Corridor", w: 400, h: 60 },
  { value: "office", label: "Office", w: 200, h: 200 },
  { value: "storage", label: "Storage", w: 150, h: 120 },
  { value: "pillar", label: "Pillar", w: 50, h: 50 },
  { value: "blank", label: "Empty Space", w: 200, h: 100 },
];

export function AddSpaceDialog({ open, onOpenChange }: Props) {
  const addSpace = useFloorPlan((s) => s.addSpace);
  const [kind, setKind] = useState<SpaceKind>("corridor");
  const [w, setW] = useState(400);
  const [h, setH] = useState(60);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add Space</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => {
              const k = v as SpaceKind;
              setKind(k);
              const d = KINDS.find((x) => x.value === k)!;
              setW(d.w); setH(d.h);
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Width</Label>
              <Input type="number" value={w} onChange={(e) => setW(+e.target.value)} />
            </div>
            <div>
              <Label>Height</Label>
              <Input type="number" value={h} onChange={(e) => setH(+e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { addSpace(kind, w, h); onOpenChange(false); }}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
