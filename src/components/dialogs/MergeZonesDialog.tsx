import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFloorPlan } from "@/store/floorPlanStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

export function MergeZonesDialog({ open, onOpenChange }: Props) {
  const floors = useFloorPlan((s) => s.floors);
  const activeFloorId = useFloorPlan((s) => s.activeFloorId);
  const merge = useFloorPlan((s) => s.mergeZones);
  const zones = floors.find((f) => f.id === activeFloorId)?.zones.filter((z) => z.kind === "zone") ?? [];
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Merge Two Zones</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Zone A</Label>
            <Select value={a} onValueChange={setA}>
              <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
              <SelectContent>
                {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zone B</Label>
            <Select value={b} onValueChange={setB}>
              <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
              <SelectContent>
                {zones.filter((z) => z.id !== a).map((z) => (
                  <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            PC numbers will be renumbered sequentially starting from Zone A's start.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!a || !b}
            onClick={() => {
              merge(a, b);
              toast.success("Zones merged");
              onOpenChange(false);
              setA(""); setB("");
            }}
          >
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
