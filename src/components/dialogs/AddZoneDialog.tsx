import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFloorPlan } from "@/store/floorPlanStore";
import { ALL_SHAPES, shapeLabel } from "@/lib/shapes";
import type { ZoneShape } from "@/types/floorplan";
import { LayoutGrid, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = [
  { hsl: "221 83% 53%", name: "Blue" },
  { hsl: "271 76% 53%", name: "Purple" },
  { hsl: "199 89% 48%", name: "Sky" },
  { hsl: "142 71% 45%", name: "Green" },
  { hsl: "38 92% 50%",  name: "Amber" },
  { hsl: "340 82% 52%", name: "Pink" },
  { hsl: "173 80% 40%", name: "Teal" },
  { hsl: "0 75% 55%",   name: "Red" },
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
  const [color, setColor] = useState(COLORS[0].hsl);

  const total = Math.max(0, rows) * Math.max(0, cols);
  const valid = name.trim().length > 0 && rows > 0 && cols > 0 && startPc > 0;

  const submit = () => {
    if (!valid) return;
    addZone({ name: name.trim(), description, rows, cols, startPc, shape, color });
    onOpenChange(false);
    setName("Zone " + String.fromCharCode(65 + Math.floor(Math.random() * 26)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        {/* Header with gradient accent */}
        <div
          className="px-6 pt-6 pb-5 border-b border-border relative"
          style={{
            background: `linear-gradient(135deg, hsl(${color} / 0.12), hsl(${color} / 0.02))`,
          }}
        >
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg shadow-sm"
                style={{ backgroundColor: `hsl(${color})`, color: "white" }}
              >
                <LayoutGrid className="h-4 w-4" />
              </span>
              Add New Zone
            </DialogTitle>
            <DialogDescription>
              Create a grid of seats grouped into a single working zone.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto scrollbar-thin">
          {/* Basic info */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="zone-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Name
              </Label>
              <Input
                id="zone-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales Team"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zone-desc" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Description <span className="text-muted-foreground/60 normal-case">(optional)</span>
              </Label>
              <Textarea
                id="zone-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this zone used for?"
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          {/* Layout */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Layout
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="zone-rows" className="text-xs text-muted-foreground">Rows</Label>
                <Input id="zone-rows" type="number" min={1} value={rows} onChange={(e) => setRows(Math.max(1, +e.target.value || 1))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="zone-cols" className="text-xs text-muted-foreground">Cols</Label>
                <Input id="zone-cols" type="number" min={1} value={cols} onChange={(e) => setCols(Math.max(1, +e.target.value || 1))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="zone-start" className="text-xs text-muted-foreground">Start PC #</Label>
                <Input id="zone-start" type="number" min={1} value={startPc} onChange={(e) => setStartPc(Math.max(1, +e.target.value || 1))} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Total seats</span>
              <span className="font-semibold tabular-nums">{total}</span>
            </div>
          </div>

          {/* Shape */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Shape</Label>
            <Select value={shape} onValueChange={(v) => setShape(v as ZoneShape)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_SHAPES.map((s) => <SelectItem key={s} value={s}>{shapeLabel(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Color</Label>
              <span className="text-xs text-muted-foreground">
                {COLORS.find((c) => c.hsl === color)?.name}
              </span>
            </div>
            <div className="grid grid-cols-8 gap-2">
              {COLORS.map((c) => {
                const active = color === c.hsl;
                return (
                  <button
                    key={c.hsl}
                    type="button"
                    onClick={() => setColor(c.hsl)}
                    title={c.name}
                    aria-label={c.name}
                    aria-pressed={active}
                    className={cn(
                      "relative h-9 w-9 rounded-lg transition-all hover:scale-110 hover:shadow-md",
                      active && "ring-2 ring-offset-2 ring-offset-background scale-110 shadow-md",
                    )}
                    style={{
                      backgroundColor: `hsl(${c.hsl})`,
                      // @ts-expect-error CSS var
                      "--tw-ring-color": `hsl(${c.hsl})`,
                    }}
                  >
                    {active && <Check className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Preview
            </Label>
            <div
              className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-center min-h-[110px]"
            >
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(cols, 12)}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: Math.min(rows, 6) * Math.min(cols, 12) }).map((_, i) => (
                  <div
                    key={i}
                    className="h-3 w-3 rounded-sm transition-all"
                    style={{ backgroundColor: `hsl(${color} / 0.7)` }}
                  />
                ))}
              </div>
            </div>
            {(rows > 6 || cols > 12) && (
              <p className="text-[11px] text-muted-foreground text-center">Preview truncated for large layouts.</p>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!valid}>
            Add Zone {total > 0 && <span className="opacity-75">· {total} seats</span>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
