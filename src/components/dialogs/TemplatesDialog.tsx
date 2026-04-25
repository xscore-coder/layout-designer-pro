import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFloorPlan } from "@/store/floorPlanStore";
import { LayoutTemplate, Headphones, Briefcase, GraduationCap } from "lucide-react";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

const TEMPLATES = [
  {
    id: "callcenter",
    name: "Call Center",
    icon: Headphones,
    desc: "4 zones, 96 seats, central corridor",
    build: () => ({
      zones: [
        { name: "Team A", rows: 4, cols: 6, x: 80, y: 100, color: "221 83% 53%" },
        { name: "Team B", rows: 4, cols: 6, x: 460, y: 100, color: "271 76% 53%" },
        { name: "Team C", rows: 4, cols: 6, x: 80, y: 380, color: "199 89% 48%" },
        { name: "Team D", rows: 4, cols: 6, x: 460, y: 380, color: "142 71% 45%" },
      ],
      spaces: [
        { kind: "corridor" as const, x: 60, y: 320, w: 720, h: 40 },
      ],
    }),
  },
  {
    id: "office",
    name: "Office Floor",
    icon: Briefcase,
    desc: "2 open spaces + 3 offices + storage",
    build: () => ({
      zones: [
        { name: "Open Space 1", rows: 3, cols: 5, x: 80, y: 100, color: "199 89% 48%" },
        { name: "Open Space 2", rows: 3, cols: 5, x: 80, y: 360, color: "271 76% 53%" },
      ],
      spaces: [
        { kind: "office" as const, x: 460, y: 100, w: 180, h: 140 },
        { kind: "office" as const, x: 460, y: 260, w: 180, h: 140 },
        { kind: "office" as const, x: 460, y: 420, w: 180, h: 140 },
        { kind: "storage" as const, x: 660, y: 100, w: 120, h: 200 },
      ],
    }),
  },
  {
    id: "training",
    name: "Training Room",
    icon: GraduationCap,
    desc: "Classroom layout + instructor area",
    build: () => ({
      zones: [
        { name: "Row 1", rows: 1, cols: 8, x: 80, y: 200, color: "38 92% 50%" },
        { name: "Row 2", rows: 1, cols: 8, x: 80, y: 290, color: "38 92% 50%" },
        { name: "Row 3", rows: 1, cols: 8, x: 80, y: 380, color: "38 92% 50%" },
      ],
      spaces: [
        { kind: "office" as const, x: 280, y: 80, w: 200, h: 80 },
      ],
    }),
  },
];

export function TemplatesDialog({ open, onOpenChange }: Props) {
  const addZone = useFloorPlan((s) => s.addZone);
  const addSpace = useFloorPlan((s) => s.addSpace);

  const apply = (tpl: typeof TEMPLATES[number]) => {
    const data = tpl.build();
    data.zones.forEach((z) => addZone({ ...z, startPc: 1, shape: "rect" }));
    data.spaces.forEach((s) => addSpace(s.kind, s.w, s.h));
    toast.success(`Inserted ${tpl.name} template`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4" /> Templates
          </DialogTitle>
          <DialogDescription>Quick-start with a pre-built layout.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => apply(t)}
                className="flex items-start gap-3 p-3 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left"
              >
                <Icon className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
