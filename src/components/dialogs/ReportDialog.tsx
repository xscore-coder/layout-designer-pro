import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFloorPlan } from "@/store/floorPlanStore";
import { toast } from "sonner";
import {
  Copy, Mail, FileBarChart, Building2, Monitor, AlertTriangle,
  CheckCircle2, MinusCircle, TrendingUp,
} from "lucide-react";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

interface ZoneRow {
  name: string;
  seats: number;
  occupied: number;
  problems: number;
  topIssues: { pc: string; count: number }[];
}
interface FloorRow {
  id: string;
  name: string;
  zones: ZoneRow[];
  seats: number;
  occupied: number;
  problems: number;
}

function buildData(floors: ReturnType<typeof useFloorPlan.getState>["floors"]): {
  floorRows: FloorRow[];
  totals: { seats: number; occupied: number; problems: number; broken: number; working: number };
} {
  const floorRows: FloorRow[] = [];
  let tSeats = 0, tOcc = 0, tProb = 0, tBroken = 0, tWorking = 0;

  for (const f of floors) {
    const zones: ZoneRow[] = [];
    let fSeats = 0, fOcc = 0, fProb = 0;
    for (const z of f.zones) {
      if (z.kind !== "zone") continue;
      const seats = z.seats.length;
      const occupied = z.seats.filter((s) => s.type === "pc" || s.type === "problem").length;
      const problems = z.seats.reduce((a, s) => a + s.problemCount, 0);
      const broken = z.seats.filter((s) => s.type === "problem").length;
      const working = z.seats.filter((s) => s.type === "pc").length;
      tBroken += broken; tWorking += working;
      const topIssues = z.seats
        .filter((s) => s.problemCount > 0)
        .sort((a, b) => b.problemCount - a.problemCount)
        .slice(0, 5)
        .map((s) => ({ pc: s.pcNumber, count: s.problemCount }));
      zones.push({ name: z.name, seats, occupied, problems, topIssues });
      fSeats += seats; fOcc += occupied; fProb += problems;
    }
    floorRows.push({ id: f.id, name: f.name, zones, seats: fSeats, occupied: fOcc, problems: fProb });
    tSeats += fSeats; tOcc += fOcc; tProb += fProb;
  }
  return { floorRows, totals: { seats: tSeats, occupied: tOcc, problems: tProb, broken: tBroken, working: tWorking } };
}

function buildText(data: ReturnType<typeof buildData>) {
  const { floorRows, totals } = data;
  const lines: string[] = [];
  lines.push(`📊 WEEKLY FLOOR PLAN REPORT — ${new Date().toLocaleDateString()}`);
  lines.push("=".repeat(50));
  for (const f of floorRows) {
    lines.push(`\n🏢 ${f.name}  (${f.occupied}/${f.seats} occupied • ${f.problems} problems)`);
    for (const z of f.zones) {
      lines.push(`  • ${z.name}: ${z.occupied}/${z.seats} — ${z.problems} problem(s)`);
      z.topIssues.forEach((s) => lines.push(`      - PC ${s.pc}: ${s.count} issue(s)`));
    }
  }
  lines.push("\n" + "=".repeat(50));
  lines.push(`TOTAL: ${totals.seats} seats • ${totals.occupied} occupied • ${totals.problems} problems`);
  lines.push(`Occupancy: ${totals.seats ? Math.round((totals.occupied / totals.seats) * 100) : 0}%`);
  return lines.join("\n");
}

export function ReportDialog({ open, onOpenChange }: Props) {
  const floors = useFloorPlan((s) => s.floors);
  const data = buildData(floors);
  const { floorRows, totals } = data;
  const occupancy = totals.seats ? Math.round((totals.occupied / totals.seats) * 100) : 0;
  const empty = totals.seats - totals.occupied;
  const text = buildText(data);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" />
            Weekly Report
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-3">
          <div className="space-y-4">
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Kpi icon={Monitor} label="Total Seats" value={totals.seats} tone="primary" />
              <Kpi icon={CheckCircle2} label="Working" value={totals.working} tone="success" />
              <Kpi icon={AlertTriangle} label="Broken" value={totals.broken} tone="destructive" />
              <Kpi icon={MinusCircle} label="Empty" value={empty} tone="muted" />
              <Kpi icon={TrendingUp} label="Occupancy" value={`${occupancy}%`} tone="primary" />
            </div>

            {/* Floors */}
            <div className="space-y-3">
              {floorRows.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
              )}
              {floorRows.map((f) => (
                <div key={f.id} className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="font-semibold truncate">{f.name}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground shrink-0">
                      <span><span className="text-foreground font-semibold">{f.occupied}</span>/{f.seats} occupied</span>
                      <span className="text-destructive">{f.problems} issue(s)</span>
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {f.zones.length === 0 && (
                      <p className="text-xs text-muted-foreground px-4 py-3 text-center">No zones</p>
                    )}
                    {f.zones.map((z, i) => {
                      const pct = z.seats ? Math.round((z.occupied / z.seats) * 100) : 0;
                      return (
                        <div key={i} className="px-4 py-3 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-sm font-medium">{z.name}</span>
                            <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                              <span>{z.occupied}/{z.seats}</span>
                              <span className={z.problems > 0 ? "text-destructive font-semibold" : ""}>
                                {z.problems} problem(s)
                              </span>
                              <span className="text-primary">{pct}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                          </div>
                          {z.topIssues.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {z.topIssues.map((s) => (
                                <span
                                  key={s.pc}
                                  className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20"
                                >
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  PC {s.pc} • {s.count}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const subject = encodeURIComponent("Weekly Floor Plan Report");
              const body = encodeURIComponent(text);
              window.open(`mailto:?subject=${subject}&body=${body}`);
            }}
          >
            <Mail className="h-4 w-4 mr-1" /> Email
          </Button>
          <Button onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); }}>
            <Copy className="h-4 w-4 mr-1" /> Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({
  icon: Icon, label, value, tone,
}: { icon: any; label: string; value: number | string; tone: "primary" | "success" | "destructive" | "muted" }) {
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
