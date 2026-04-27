import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFloorPlan } from "@/store/floorPlanStore";
import type { SpaceKind } from "@/types/floorplan";
import { cn } from "@/lib/utils";
import {
  Route,
  Building,
  Package,
  Columns,
  Square,
  DoorOpen,
  Coffee,
  Bath,
  ArrowUpDown,
  Trees,
} from "lucide-react";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

type SpacePreset = {
  value: SpaceKind;
  label: string;
  description: string;
  w: number;
  h: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string; // tailwind text color class for the icon background
};

const PRESETS: SpacePreset[] = [
  { value: "corridor", label: "Corridor",    description: "Hallway / passage",      w: 400, h: 60,  icon: Route,        color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  { value: "office",   label: "Office",      description: "Closed room",            w: 200, h: 200, icon: Building,     color: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  { value: "storage",  label: "Storage",     description: "Storeroom / closet",     w: 150, h: 120, icon: Package,      color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { value: "pillar",   label: "Pillar",      description: "Structural column",      w: 50,  h: 50,  icon: Columns,      color: "bg-stone-500/15 text-stone-600 dark:text-stone-400" },
  { value: "blank",    label: "Empty Space", description: "Generic blank area",     w: 200, h: 100, icon: Square,       color: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
  // Extra suggestions reusing existing kinds (mapped to closest)
  { value: "office",   label: "Meeting Room", description: "Conference space",      w: 240, h: 180, icon: DoorOpen,     color: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  { value: "blank",    label: "Kitchen",      description: "Pantry / break area",   w: 200, h: 150, icon: Coffee,       color: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  { value: "blank",    label: "Restroom",     description: "WC / toilets",          w: 150, h: 120, icon: Bath,         color: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" },
  { value: "blank",    label: "Stairs",       description: "Stairwell",             w: 120, h: 160, icon: ArrowUpDown,  color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { value: "blank",    label: "Outdoor",      description: "Garden / open area",    w: 250, h: 180, icon: Trees,        color: "bg-green-500/15 text-green-600 dark:text-green-400" },
];

const SIZE_PRESETS = [
  { label: "S", w: 100, h: 80 },
  { label: "M", w: 200, h: 150 },
  { label: "L", w: 300, h: 220 },
  { label: "XL", w: 450, h: 300 },
];

export function AddSpaceDialog({ open, onOpenChange }: Props) {
  const addSpace = useFloorPlan((s) => s.addSpace);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [w, setW] = useState(PRESETS[0].w);
  const [h, setH] = useState(PRESETS[0].h);

  const selected = PRESETS[selectedIdx];

  const pickPreset = (idx: number) => {
    setSelectedIdx(idx);
    setW(PRESETS[idx].w);
    setH(PRESETS[idx].h);
  };

  const handleAdd = () => {
    addSpace(selected.value, w, h);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/30">
          <DialogTitle className="flex items-center gap-2">
            <Square className="h-4 w-4" />
            Add Space
          </DialogTitle>
          <DialogDescription>
            اختر نوع المساحة اللي عاوز تضيفها للأرضية، وعدّل الأبعاد لو محتاج.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Preset Grid */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
              Space Type
            </Label>
            <ScrollArea className="max-h-[280px] pr-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESETS.map((p, i) => {
                  const Icon = p.icon;
                  const active = i === selectedIdx;
                  return (
                    <button
                      key={`${p.label}-${i}`}
                      type="button"
                      onClick={() => pickPreset(i)}
                      className={cn(
                        "group text-left p-3 rounded-lg border-2 transition-all flex flex-col gap-1.5",
                        "hover:border-primary/50 hover:bg-muted/40",
                        active
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0", p.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-sm truncate">{p.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                        {p.description}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground/70 mt-auto">
                        {p.w}×{p.h}px
                      </p>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Size presets */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
              Quick Size
            </Label>
            <div className="flex gap-2">
              {SIZE_PRESETS.map((s) => (
                <Button
                  key={s.label}
                  type="button"
                  variant={w === s.w && h === s.h ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setW(s.w); setH(s.h); }}
                  className="flex-1"
                >
                  {s.label}
                  <span className="ml-1 text-[10px] opacity-70 font-mono">
                    {s.w}×{s.h}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {/* Custom dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Width (px)</Label>
              <Input
                type="number"
                min={20}
                value={w}
                onChange={(e) => setW(Math.max(20, +e.target.value || 0))}
              />
            </div>
            <div>
              <Label className="text-xs">Height (px)</Label>
              <Input
                type="number"
                min={20}
                value={h}
                onChange={(e) => setH(Math.max(20, +e.target.value || 0))}
              />
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
              Preview
            </Label>
            <div className="flex items-center justify-center min-h-[120px]">
              <div
                className={cn("rounded-md border-2 flex items-center justify-center text-xs font-medium", selected.color)}
                style={{
                  width: Math.min(w / 2, 320),
                  height: Math.min(h / 2, 160),
                  borderColor: "currentColor",
                }}
              >
                {selected.label}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd}>
            Add {selected.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
