import { Link, useParams } from "react-router-dom";
import { useFloorPlan } from "@/store/floorPlanStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Monitor, AlertTriangle, Lock, StickyNote, Calendar, Hash } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

export default function PCView() {
  const { zoneId = "", seatId = "" } = useParams();
  const floors = useFloorPlan((s) => s.floors);
  const updateSeat = useFloorPlan((s) => s.updateSeat);
  const addSeatHistory = useFloorPlan((s) => s.addSeatHistory);

  const found = floors
    .flatMap((f) => f.zones.map((z) => ({ floor: f, zone: z })))
    .find(({ zone }) => zone.id === zoneId);

  const seat = found?.zone.seats.find((s) => s.id === seatId);

  const [issueText, setIssueText] = useState("");

  if (!found || !seat) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-center gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold">PC Not Found</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          هذا الـ PC غير موجود أو تم حذفه. تأكد من الـ QR Code.
        </p>
        <Button asChild><Link to="/"><ArrowLeft className="h-4 w-4 mr-2" /> Back to floor plan</Link></Button>
      </div>
    );
  }

  const { floor, zone } = found;

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header
        className="text-white px-4 py-5 shadow-md"
        style={{ background: `linear-gradient(135deg, hsl(${zone.color}), hsl(${zone.gradientTo ?? zone.color}))` }}
      >
        <div className="max-w-2xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-1 text-xs opacity-90 hover:opacity-100 mb-3">
            <ArrowLeft className="h-3 w-3" /> Back
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <Monitor className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-widest opacity-80">{floor.name} • {zone.name}</p>
              <h1 className="text-2xl font-bold font-mono truncate">PC {seat.pcNumber}</h1>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge variant="secondary" className="bg-white/25 text-white border-0">{seat.type.toUpperCase()}</Badge>
                {seat.hasProblem && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Problem</Badge>}
                {seat.locked && <Badge variant="secondary" className="bg-white/25 text-white border-0"><Lock className="h-3 w-3 mr-1" />Locked</Badge>}
                {seat.problemCount > 0 && (
                  <Badge variant="secondary" className="bg-white/25 text-white border-0">{seat.problemCount} issues</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Quick info */}
        <Card className="p-4 grid grid-cols-2 gap-3 text-sm">
          {seat.lockNumber && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Hash className="h-3 w-3" /> Lock #</p>
              <p className="font-mono font-semibold">{seat.lockNumber}</p>
            </div>
          )}
          {seat.lastUpdate && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Last update</p>
              <p className="font-semibold">{seat.lastUpdate}</p>
            </div>
          )}
        </Card>

        {/* Quick actions for engineer */}
        {!seat.locked && (
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Engineer Actions</h2>
            <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Mark as Problem</p>
                <p className="text-[11px] text-muted-foreground">Highlight this PC as faulty</p>
              </div>
              <Switch
                checked={!!seat.hasProblem}
                onCheckedChange={(v) => {
                  updateSeat(zone.id, seat.id, { hasProblem: v });
                  toast.success(v ? "Marked as Problem" : "Cleared");
                }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Log new entry</Label>
              <Textarea
                rows={2}
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
                placeholder="Describe the issue or fix…"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const desc = issueText.trim() || "Reported issue";
                    addSeatHistory(zone.id, seat.id, "problem", desc);
                    setIssueText("");
                    toast.success("Problem logged");
                  }}
                >
                  + Problem
                </Button>
                <Button
                  onClick={() => {
                    const desc = issueText.trim() || "Marked fixed";
                    addSeatHistory(zone.id, seat.id, "fix", desc);
                    setIssueText("");
                    toast.success("Fix logged");
                  }}
                >
                  + Fix
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs">Quick Note</Label>
              <Input
                value={seat.note ?? ""}
                onChange={(e) => updateSeat(zone.id, seat.id, { note: e.target.value })}
                placeholder="Add a quick note…"
              />
            </div>
          </Card>
        )}

        {/* History */}
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <StickyNote className="h-4 w-4" /> History ({seat.history.length})
          </h2>
          {seat.history.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No history yet.</p>
          ) : (
            <ol className="space-y-2">
              {seat.history.map((h) => (
                <li
                  key={h.id}
                  className="rounded-md border-l-4 bg-muted/30 px-3 py-2 text-sm"
                  style={{
                    borderColor:
                      h.type === "problem" ? "hsl(var(--destructive))" :
                      h.type === "fix" ? "hsl(142 71% 45%)" :
                      "hsl(var(--border))",
                  }}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <Badge variant="outline" className="text-[10px] uppercase">{h.type}</Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(h.date).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs">{h.description}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </main>
    </div>
  );
}
