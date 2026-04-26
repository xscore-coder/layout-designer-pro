import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useFloorPlan } from "@/store/floorPlanStore";
import { toast } from "sonner";
import { GitMerge, Plus, Pencil, Minus, Search, AlertTriangle } from "lucide-react";

export interface IncomingRow {
  pc: string;
  problems?: number;
  agent?: string;
  shift?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: IncomingRow[];
}

type DiffKind = "new" | "changed" | "unchanged" | "removed";

interface DiffRow {
  pc: string;
  kind: DiffKind;
  currentProblems: number;
  incomingProblems: number;
  delta: number;
  exists: boolean;
}

export function ImportMergeDialog({ open, onOpenChange, rows }: Props) {
  const floors = useFloorPlan((s) => s.floors);
  const importPCsSelective = useFloorPlan((s) => s.importPCsSelective);
  const [filter, setFilter] = useState<"all" | DiffKind>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // index existing seats by pcNumber
  const existing = useMemo(() => {
    const m = new Map<string, { problems: number }>();
    floors.forEach((f) =>
      f.zones.forEach((z) =>
        z.seats.forEach((s) => m.set(s.pcNumber, { problems: s.problemCount }))
      )
    );
    return m;
  }, [floors]);

  const diff: DiffRow[] = useMemo(() => {
    const out: DiffRow[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const pc = String(r.pc).trim();
      if (!pc) continue;
      seen.add(pc);
      const cur = existing.get(pc);
      const inc = r.problems ?? 0;
      if (!cur) {
        out.push({ pc, kind: "new", currentProblems: 0, incomingProblems: inc, delta: inc, exists: false });
      } else if (inc > 0) {
        out.push({
          pc, kind: "changed",
          currentProblems: cur.problems, incomingProblems: inc, delta: inc, exists: true,
        });
      } else {
        out.push({
          pc, kind: "unchanged",
          currentProblems: cur.problems, incomingProblems: 0, delta: 0, exists: true,
        });
      }
    }
    // missing in CSV but exists in plan
    existing.forEach((v, pc) => {
      if (!seen.has(pc)) {
        out.push({ pc, kind: "removed", currentProblems: v.problems, incomingProblems: 0, delta: 0, exists: true });
      }
    });
    return out.sort((a, b) => a.pc.localeCompare(b.pc, undefined, { numeric: true }));
  }, [rows, existing]);

  const counts = useMemo(() => {
    const c = { new: 0, changed: 0, unchanged: 0, removed: 0 };
    diff.forEach((d) => c[d.kind]++);
    return c;
  }, [diff]);

  const visible = useMemo(() => {
    return diff.filter((d) => {
      if (filter !== "all" && d.kind !== filter) return false;
      if (search && !d.pc.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [diff, filter, search]);

  // selectable = rows that would actually change something (new + changed)
  const applicable = useMemo(
    () => diff.filter((d) => d.kind === "new" || d.kind === "changed").map((d) => d.pc),
    [diff]
  );

  // initialize selection when dialog opens / rows change
  useMemo(() => {
    if (open) setSelected(new Set(applicable));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rows]);

  const toggleAll = (checked: boolean) => {
    if (checked) {
      const next = new Set(selected);
      visible.forEach((d) => {
        if (d.kind === "new" || d.kind === "changed") next.add(d.pc);
      });
      setSelected(next);
    } else {
      const next = new Set(selected);
      visible.forEach((d) => next.delete(d.pc));
      setSelected(next);
    }
  };

  const apply = () => {
    if (!selected.size) {
      toast.error("No rows selected");
      return;
    }
    importPCsSelective(rows as any, Array.from(selected));
    toast.success(`Merged ${selected.size} PCs`);
    onOpenChange(false);
  };

  const KIND_META: Record<DiffKind, { label: string; cls: string; icon: any }> = {
    new: { label: "New", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", icon: Plus },
    changed: { label: "Changed", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", icon: Pencil },
    unchanged: { label: "Unchanged", cls: "bg-muted text-muted-foreground border-border", icon: GitMerge },
    removed: { label: "Missing", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30", icon: Minus },
  };

  const allVisibleApplicable = visible.filter((d) => d.kind === "new" || d.kind === "changed");
  const allVisibleSelected =
    allVisibleApplicable.length > 0 && allVisibleApplicable.every((d) => selected.has(d.pc));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" /> Smart Import Merge
          </DialogTitle>
          <DialogDescription>
            راجع التغييرات قبل تطبيقها. اختر الصفوف اللي عاوز تستوردها فقط.
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-2">
          {(["new", "changed", "unchanged", "removed"] as DiffKind[]).map((k) => {
            const M = KIND_META[k];
            const active = filter === k;
            return (
              <button
                key={k}
                onClick={() => setFilter(active ? "all" : k)}
                className={`rounded-md border p-2 text-left transition ${M.cls} ${
                  active ? "ring-2 ring-ring" : "opacity-90 hover:opacity-100"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wide flex items-center gap-1">
                  <M.icon className="h-3 w-3" /> {M.label}
                </div>
                <div className="text-xl font-bold font-mono">{counts[k]}</div>
              </button>
            );
          })}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PC number…"
              className="pl-7 h-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFilter("all")}
            className={filter === "all" ? "bg-muted" : ""}
          >
            All
          </Button>
        </div>

        {/* Table */}
        <div className="border border-border rounded-md overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 px-3 py-2 bg-muted/60 text-[10px] uppercase font-semibold text-muted-foreground items-center">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={(v) => toggleAll(!!v)}
              aria-label="Select all visible"
            />
            <span>PC</span>
            <span className="text-right">Current</span>
            <span className="text-right">Incoming</span>
            <span className="text-right pr-1">Status</span>
          </div>
          <ScrollArea className="h-72">
            {visible.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-10">
                لا توجد صفوف لعرضها بهذا الفلتر.
              </p>
            ) : (
              visible.map((d) => {
                const M = KIND_META[d.kind];
                const selectable = d.kind === "new" || d.kind === "changed";
                const checked = selected.has(d.pc);
                return (
                  <div
                    key={d.pc}
                    className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 px-3 py-1.5 items-center text-xs border-t border-border hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!selectable}
                      onCheckedChange={(v) => {
                        const next = new Set(selected);
                        if (v) next.add(d.pc);
                        else next.delete(d.pc);
                        setSelected(next);
                      }}
                    />
                    <span className="font-mono font-semibold">{d.pc}</span>
                    <span className="text-right font-mono text-muted-foreground">
                      {d.currentProblems}
                    </span>
                    <span className="text-right font-mono">
                      {d.incomingProblems > 0 ? `+${d.incomingProblems}` : "—"}
                    </span>
                    <span className="text-right">
                      <Badge variant="outline" className={`${M.cls} text-[10px] gap-1`}>
                        <M.icon className="h-2.5 w-2.5" /> {M.label}
                      </Badge>
                    </span>
                  </div>
                );
              })
            )}
          </ScrollArea>
        </div>

        {counts.removed > 0 && (
          <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              فيه {counts.removed} جهاز موجود في الخريطة بس مش في ملف الاستيراد — مش هيتأثروا.
            </span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={apply} disabled={selected.size === 0}>
            <GitMerge className="h-4 w-4 mr-1" /> Merge {selected.size} {selected.size === 1 ? "PC" : "PCs"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
