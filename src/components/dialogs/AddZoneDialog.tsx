import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFloorPlan } from "@/store/floorPlanStore";
import { ALL_SHAPES, shapeLabel } from "@/lib/shapes";
import type { ZoneShape } from "@/types/floorplan";

const COLORS = [
  "221 83% 53%", "271 76% 53%", "199 89% 48%", "142 71% 45%",
  "38 92% 50%", "340 82% 52%", "173 80% 40%", "0 75% 55%",
];

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

export function AddZoneDialog({ open, onOpenChange }: Props) {
  const addZone = useFloorPlan((s) => s.addZone);
  const [name, setName] = useState("Zone A");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(6);
  const [startPc, setStartPc] = useState(1);
  const [shape, setShape] = useState<ZoneShape>("rect");
  const [color, setColor] = useState(COLORS[0]);

  const submit = () => {
    addZone({ name, description, rows, cols, startPc, shape, color });
    onOpenChange(false);
    setName("Zone " + String.fromCharCode(65 + Math.floor(Math.random() * 26)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Zone</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Rows</Label>
              <Input type="number" min={1} value={rows} onChange={(e) => setRows(+e.target.value)} />
            </div>
            <div>
              <Label>Cols</Label>
              <Input type="number" min={1} value={cols} onChange={(e) => setCols(+e.target.value)} />
            </div>
            <div>
              <Label>Start PC #</Label>
              <Input type="number" min={1} value={startPc} onChange={(e) => setStartPc(+e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Shape</Label>
            <Select value={shape} onValueChange={(v) => setShape(v as ZoneShape)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_SHAPES.map((s) => <SelectItem key={s} value={s}>{shapeLabel(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full ring-offset-2 ring-offset-card transition-all"
                  style={{
                    backgroundColor: `hsl(${c})`,
                    boxShadow: color === c ? `0 0 0 2px hsl(${c})` : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Add Zone</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
