import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFloorPlan } from "@/store/floorPlanStore";
import { toast } from "sonner";
import { Copy } from "lucide-react";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

function buildReport(floors: ReturnType<typeof useFloorPlan.getState>["floors"]) {
  const lines: string[] = [];
  lines.push(`📊 WEEKLY FLOOR PLAN REPORT — ${new Date().toLocaleDateString()}`);
  lines.push("=".repeat(50));
  let totalSeats = 0, totalAgents = 0, totalProblems = 0;
  for (const f of floors) {
    lines.push(`\n🏢 ${f.name}`);
    for (const z of f.zones) {
      if (z.kind !== "zone") continue;
      const seats = z.seats.length;
      const agents = z.seats.filter((s) => s.type === "pc" || s.type === "problem").length;
      const problems = z.seats.reduce((acc, s) => acc + s.problemCount, 0);
      totalSeats += seats; totalAgents += agents; totalProblems += problems;
      lines.push(`  • ${z.name}: ${agents}/${seats} occupied — ${problems} problem(s)`);
      const issued = z.seats.filter((s) => s.problemCount > 0).sort((a, b) => b.problemCount - a.problemCount).slice(0, 5);
      issued.forEach((s) => lines.push(`      - PC ${s.pcNumber}: ${s.problemCount} issue(s)`));
    }
  }
  lines.push("\n" + "=".repeat(50));
  lines.push(`TOTAL: ${totalSeats} seats • ${totalAgents} occupied • ${totalProblems} problems`);
  lines.push(`Occupancy: ${totalSeats ? Math.round((totalAgents / totalSeats) * 100) : 0}%`);
  return lines.join("\n");
}

export function ReportDialog({ open, onOpenChange }: Props) {
  const floors = useFloorPlan((s) => s.floors);
  const text = buildReport(floors);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Weekly Report</DialogTitle></DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <pre className="text-xs font-mono bg-muted p-4 rounded-md whitespace-pre-wrap">{text}</pre>
        </ScrollArea>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              const subject = encodeURIComponent("Weekly Floor Plan Report");
              const body = encodeURIComponent(text);
              window.open(`mailto:?subject=${subject}&body=${body}`);
            }}
          >
            Email
          </Button>
          <Button onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); }}>
            <Copy className="h-4 w-4 mr-1" /> Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
