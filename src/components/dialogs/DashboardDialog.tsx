import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFloorPlan } from "@/store/floorPlanStore";
import { Monitor, AlertTriangle, MinusCircle, Building2, Activity } from "lucide-react";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

interface FloorStats {
  id: string;
  name: string;
  total: number;
  working: number;
  broken: number;
  empty: number;
  zones: number;
  problems: number;
}

export function DashboardDialog({ open, onOpenChange }: Props) {
  const floors = useFloorPlan((s) => s.floors);

  const stats: FloorStats[] = floors.map((f) => {
    let total = 0, working = 0, broken = 0, empty = 0, problems = 0;
    const zoneCount = f.zones.filter((z) => z.kind === "zone").length;
    f.zones.forEach((z) => {
      if (z.kind !== "zone") return;
      z.seats.forEach((s) => {
        total++;
        problems += s.problemCount;
        if (s.hasProblem) broken++;
        else if (s.type === "pc") working++;
        else empty++;
      });
    });
    return { id: f.id, name: f.name, total, working, broken, empty, zones: zoneCount, problems };
  });

  const grand = stats.reduce(
    (a, s) => ({
      total: a.total + s.total,
      working: a.working + s.working,
      broken: a.broken + s.broken,
      empty: a.empty + s.empty,
      problems: a.problems + s.problems,
    }),
    { total: 0, working: 0, broken: 0, empty: 0, problems: 0 }
  );

  const occupancy = grand.total ? Math.round(((grand.working + grand.broken) / grand.total) * 100) : 0;
  const healthRate = (grand.working + grand.broken)
    ? Math.round((grand.working / (grand.working + grand.broken)) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Dashboard
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 pr-3">
            {/* Overall summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <SummaryCard label="إجمالي الأجهزة" value={grand.total} icon={Monitor} tone="primary" />
              <SummaryCard label="شغّال" value={grand.working} icon={Monitor} tone="success" />
              <SummaryCard label="بايظ" value={grand.broken} icon={AlertTriangle} tone="destructive" />
              <SummaryCard label="فاضي" value={grand.empty} icon={MinusCircle} tone="muted" />
              <SummaryCard label="إشغال" value={`${occupancy}%`} icon={Activity} tone="primary" />
            </div>

            <div className="text-xs text-muted-foreground px-1">
              نسبة الأجهزة السليمة من الشغّالة: <span className="font-semibold text-foreground">{healthRate}%</span>
              {" • "} عدد الـFloors: <span className="font-semibold text-foreground">{floors.length}</span>
            </div>

            {/* Per floor breakdown */}
            <div className="space-y-3">
              {stats.map((s) => {
                const pctWork = s.total ? (s.working / s.total) * 100 : 0;
                const pctBroken = s.total ? (s.broken / s.total) * 100 : 0;
                const pctEmpty = s.total ? (s.empty / s.total) * 100 : 0;
                return (
                  <div key={s.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        <h3 className="font-semibold truncate">{s.name}</h3>
                        <span className="text-[10px] text-muted-foreground shrink-0">{s.zones} zone(s)</span>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">
                        {s.total} جهاز • {s.problems} مشكلة
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Stat label="شغّال" value={s.working} color="hsl(142 71% 45%)" />
                      <Stat label="بايظ" value={s.broken} color="hsl(0 72% 51%)" />
                      <Stat label="فاضي" value={s.empty} color="hsl(220 13% 60%)" />
                    </div>

                    {/* Stacked bar */}
                    {s.total > 0 ? (
                      <div className="space-y-1.5">
                        <div className="h-2.5 w-full rounded-full overflow-hidden bg-muted flex">
                          <div style={{ width: `${pctWork}%`, backgroundColor: "hsl(142 71% 45%)" }} />
                          <div style={{ width: `${pctBroken}%`, backgroundColor: "hsl(0 72% 51%)" }} />
                          <div style={{ width: `${pctEmpty}%`, backgroundColor: "hsl(220 13% 60% / 0.5)" }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                          <span>شغّال {Math.round(pctWork)}%</span>
                          <span>بايظ {Math.round(pctBroken)}%</span>
                          <span>فاضي {Math.round(pctEmpty)}%</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-2">لا يوجد أجهزة في هذا الـFloor</p>
                    )}
                  </div>
                );
              })}

              {stats.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">لا يوجد Floors لعرضها</p>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  label, value, icon: Icon, tone,
}: { label: string; value: number | string; icon: any; tone: "primary" | "success" | "destructive" | "muted" }) {
  const toneClass = {
    primary: "text-primary bg-primary/10",
    success: "text-[hsl(142_71%_45%)] bg-[hsl(142_71%_45%/0.1)]",
    destructive: "text-destructive bg-destructive/10",
    muted: "text-muted-foreground bg-muted",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className={`h-7 w-7 rounded-md flex items-center justify-center mb-2 ${toneClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-lg font-bold font-mono">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-2 text-center">
      <div className="text-base font-bold font-mono" style={{ color }}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
