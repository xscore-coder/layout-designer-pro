import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useFloorPlan } from "@/store/floorPlanStore";
import {
  LayoutTemplate,
  Headphones,
  Briefcase,
  GraduationCap,
  Building2,
  Users,
  Coffee,
  Stethoscope,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

type TemplateDef = {
  id: string;
  name: string;
  category: "Office" | "Call Center" | "Education" | "Hospitality" | "Healthcare";
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  accent: string; // hsl
  build: () => {
    zones: Array<{ name: string; rows: number; cols: number; x: number; y: number; color: string }>;
    spaces: Array<{ kind: "corridor" | "office" | "storage" | "pillar" | "blank"; x: number; y: number; w: number; h: number }>;
  };
};

const TEMPLATES: TemplateDef[] = [
  {
    id: "callcenter",
    name: "Call Center",
    category: "Call Center",
    icon: Headphones,
    desc: "4 teams · 96 seats · central corridor",
    accent: "221 83% 53%",
    build: () => ({
      zones: [
        { name: "Team A", rows: 4, cols: 6, x: 80, y: 100, color: "221 83% 53%" },
        { name: "Team B", rows: 4, cols: 6, x: 460, y: 100, color: "271 76% 53%" },
        { name: "Team C", rows: 4, cols: 6, x: 80, y: 380, color: "199 89% 48%" },
        { name: "Team D", rows: 4, cols: 6, x: 460, y: 380, color: "142 71% 45%" },
      ],
      spaces: [{ kind: "corridor", x: 60, y: 320, w: 720, h: 40 }],
    }),
  },
  {
    id: "callcenter-large",
    name: "Mega Call Center",
    category: "Call Center",
    icon: Headphones,
    desc: "6 teams · 180 seats · 2 corridors",
    accent: "271 76% 53%",
    build: () => ({
      zones: [
        { name: "Team 1", rows: 5, cols: 6, x: 80, y: 80, color: "221 83% 53%" },
        { name: "Team 2", rows: 5, cols: 6, x: 460, y: 80, color: "271 76% 53%" },
        { name: "Team 3", rows: 5, cols: 6, x: 840, y: 80, color: "199 89% 48%" },
        { name: "Team 4", rows: 5, cols: 6, x: 80, y: 420, color: "142 71% 45%" },
        { name: "Team 5", rows: 5, cols: 6, x: 460, y: 420, color: "38 92% 50%" },
        { name: "Team 6", rows: 5, cols: 6, x: 840, y: 420, color: "340 82% 52%" },
      ],
      spaces: [
        { kind: "corridor", x: 60, y: 360, w: 1100, h: 40 },
        { kind: "corridor", x: 440, y: 60, w: 40, h: 700 },
      ],
    }),
  },
  {
    id: "office",
    name: "Office Floor",
    category: "Office",
    icon: Briefcase,
    desc: "2 open spaces · 3 offices · storage",
    accent: "199 89% 48%",
    build: () => ({
      zones: [
        { name: "Open Space 1", rows: 3, cols: 5, x: 80, y: 100, color: "199 89% 48%" },
        { name: "Open Space 2", rows: 3, cols: 5, x: 80, y: 360, color: "271 76% 53%" },
      ],
      spaces: [
        { kind: "office", x: 460, y: 100, w: 180, h: 140 },
        { kind: "office", x: 460, y: 260, w: 180, h: 140 },
        { kind: "office", x: 460, y: 420, w: 180, h: 140 },
        { kind: "storage", x: 660, y: 100, w: 120, h: 200 },
      ],
    }),
  },
  {
    id: "executive",
    name: "Executive Suite",
    category: "Office",
    icon: Building2,
    desc: "4 private offices · meeting · waiting",
    accent: "340 82% 52%",
    build: () => ({
      zones: [
        { name: "Assistants", rows: 2, cols: 4, x: 80, y: 100, color: "271 76% 53%" },
      ],
      spaces: [
        { kind: "office", x: 80, y: 280, w: 160, h: 160 },
        { kind: "office", x: 260, y: 280, w: 160, h: 160 },
        { kind: "office", x: 440, y: 280, w: 160, h: 160 },
        { kind: "office", x: 620, y: 280, w: 160, h: 160 },
        { kind: "office", x: 440, y: 460, w: 340, h: 180 },
        { kind: "blank", x: 80, y: 460, w: 340, h: 180 },
      ],
    }),
  },
  {
    id: "openplan",
    name: "Open Plan Hub",
    category: "Office",
    icon: Users,
    desc: "Shared workstations · breakout zones",
    accent: "142 71% 45%",
    build: () => ({
      zones: [
        { name: "Pod A", rows: 2, cols: 8, x: 80, y: 80, color: "199 89% 48%" },
        { name: "Pod B", rows: 2, cols: 8, x: 80, y: 260, color: "142 71% 45%" },
        { name: "Pod C", rows: 2, cols: 8, x: 80, y: 440, color: "38 92% 50%" },
      ],
      spaces: [
        { kind: "blank", x: 700, y: 80, w: 200, h: 540 },
        { kind: "pillar", x: 60, y: 220, w: 24, h: 24 },
        { kind: "pillar", x: 60, y: 420, w: 24, h: 24 },
      ],
    }),
  },
  {
    id: "training",
    name: "Training Room",
    category: "Education",
    icon: GraduationCap,
    desc: "Classroom rows · instructor area",
    accent: "38 92% 50%",
    build: () => ({
      zones: [
        { name: "Row 1", rows: 1, cols: 8, x: 80, y: 200, color: "38 92% 50%" },
        { name: "Row 2", rows: 1, cols: 8, x: 80, y: 290, color: "38 92% 50%" },
        { name: "Row 3", rows: 1, cols: 8, x: 80, y: 380, color: "38 92% 50%" },
      ],
      spaces: [{ kind: "office", x: 280, y: 80, w: 200, h: 80 }],
    }),
  },
  {
    id: "computerlab",
    name: "Computer Lab",
    category: "Education",
    icon: GraduationCap,
    desc: "U-shaped lab · 24 PCs · instructor",
    accent: "199 89% 48%",
    build: () => ({
      zones: [
        { name: "Left Wing", rows: 4, cols: 3, x: 80, y: 120, color: "199 89% 48%" },
        { name: "Right Wing", rows: 4, cols: 3, x: 520, y: 120, color: "199 89% 48%" },
        { name: "Back Row", rows: 1, cols: 6, x: 220, y: 480, color: "199 89% 48%" },
      ],
      spaces: [
        { kind: "office", x: 280, y: 120, w: 220, h: 100 },
        { kind: "blank", x: 280, y: 240, w: 220, h: 220 },
      ],
    }),
  },
  {
    id: "cafe",
    name: "Café Layout",
    category: "Hospitality",
    icon: Coffee,
    desc: "Counter · seating zones · storage",
    accent: "25 75% 50%",
    build: () => ({
      zones: [
        { name: "Seating A", rows: 3, cols: 3, x: 80, y: 200, color: "25 75% 50%" },
        { name: "Seating B", rows: 3, cols: 3, x: 380, y: 200, color: "25 75% 50%" },
      ],
      spaces: [
        { kind: "office", x: 80, y: 80, w: 600, h: 80 },
        { kind: "storage", x: 700, y: 80, w: 120, h: 200 },
      ],
    }),
  },
  {
    id: "clinic",
    name: "Clinic / Reception",
    category: "Healthcare",
    icon: Stethoscope,
    desc: "Reception · waiting · 4 exam rooms",
    accent: "173 80% 40%",
    build: () => ({
      zones: [
        { name: "Reception", rows: 1, cols: 4, x: 80, y: 100, color: "173 80% 40%" },
        { name: "Waiting", rows: 3, cols: 4, x: 80, y: 240, color: "199 89% 48%" },
      ],
      spaces: [
        { kind: "office", x: 480, y: 100, w: 160, h: 140 },
        { kind: "office", x: 660, y: 100, w: 160, h: 140 },
        { kind: "office", x: 480, y: 260, w: 160, h: 140 },
        { kind: "office", x: 660, y: 260, w: 160, h: 140 },
      ],
    }),
  },
];

const CATEGORIES = ["All", "Office", "Call Center", "Education", "Hospitality", "Healthcare"] as const;

export function TemplatesDialog({ open, onOpenChange }: Props) {
  const addZone = useFloorPlan((s) => s.addZone);
  const addSpace = useFloorPlan((s) => s.addSpace);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");

  const filtered = useMemo(() => {
    return TEMPLATES.filter((t) => {
      if (cat !== "All" && t.category !== cat) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    });
  }, [query, cat]);

  const apply = (tpl: TemplateDef) => {
    const data = tpl.build();
    data.zones.forEach((z) => addZone({ ...z, startPc: 1, shape: "rect" }));
    data.spaces.forEach((s) => addSpace(s.kind, s.w, s.h));
    toast.success(`Inserted ${tpl.name} template`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <LayoutTemplate className="h-5 w-5 text-primary" />
              </div>
              Templates
              <Badge variant="secondary" className="ml-1 gap-1">
                <Sparkles className="h-3 w-3" /> {TEMPLATES.length}
              </Badge>
            </DialogTitle>
            <DialogDescription>Quick-start with a pre-built layout. Click any card to insert it on the active floor.</DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates…"
                className="pl-8 h-9 bg-background/70 backdrop-blur"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`text-xs px-2.5 py-1 rounded-full border whitespace-nowrap transition-colors ${
                    cat === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background/60 border-border hover:bg-accent"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No templates match your search.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((t) => {
                const Icon = t.icon;
                const data = t.build();
                const seatCount = data.zones.reduce((sum, z) => sum + z.rows * z.cols, 0);
                return (
                  <button
                    key={t.id}
                    onClick={() => apply(t)}
                    className="group relative flex flex-col gap-3 p-4 rounded-xl border-2 border-border bg-card hover:border-primary hover:shadow-lg hover:-translate-y-0.5 transition-all text-left overflow-hidden"
                    style={{ ["--accent" as string]: `hsl(${t.accent})` }}
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-1"
                      style={{ background: `hsl(${t.accent})` }}
                    />
                    <div className="flex items-start justify-between">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center"
                        style={{ background: `hsl(${t.accent} / 0.15)`, color: `hsl(${t.accent})` }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                    </div>

                    <div>
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.desc}</p>
                    </div>

                    {/* mini preview */}
                    <div className="rounded-md bg-muted/40 p-2 h-16 relative overflow-hidden border border-border/50">
                      {data.zones.slice(0, 6).map((z, i) => (
                        <div
                          key={i}
                          className="absolute rounded-sm opacity-80"
                          style={{
                            background: `hsl(${z.color})`,
                            left: `${(z.x / 1000) * 100}%`,
                            top: `${(z.y / 700) * 100}%`,
                            width: `${Math.max(6, (z.cols * 30 / 1000) * 100)}%`,
                            height: `${Math.max(4, (z.rows * 30 / 700) * 100)}%`,
                          }}
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{data.zones.length} zones · {data.spaces.length} spaces</span>
                      <span className="font-medium text-foreground">{seatCount} seats</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
