import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFloorPlan } from "@/store/floorPlanStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, RotateCcw, Trash2, Save, Clock, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

export function VersionsDialog({ open, onOpenChange }: Props) {
  const versions = useFloorPlan((s) => s.versions);
  const saveVersion = useFloorPlan((s) => s.saveVersion);
  const restoreVersion = useFloorPlan((s) => s.restoreVersion);
  const removeVersion = useFloorPlan((s) => s.removeVersion);
  const [label, setLabel] = useState("");

  const kindOf = (l: string) => {
    if (l.startsWith("Hourly")) return { icon: Clock, color: "199 89% 48%", text: "Hourly" };
    if (l.startsWith("Daily")) return { icon: Calendar, color: "271 76% 53%", text: "Daily" };
    return { icon: Save, color: "142 71% 45%", text: "Manual" };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <History className="h-5 w-5 text-primary" />
              </div>
              Versions
              <Badge variant="secondary" className="ml-1">{versions.length}</Badge>
            </DialogTitle>
            <DialogDescription>
              Snapshots are auto-saved every hour. You can also save manual checkpoints anytime.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex gap-2">
            <Input
              placeholder="Version label (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-9 bg-background/70 backdrop-blur"
            />
            <Button
              onClick={() => {
                saveVersion(label || undefined);
                setLabel("");
                toast.success("Version saved");
              }}
            >
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
          </div>
        </div>

        <div className="px-3 py-3">
          <ScrollArea className="max-h-[55vh]">
            <div className="space-y-1 pr-2">
              {versions.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-10">No versions yet.</p>
              )}
              {versions.map((v) => {
                const k = kindOf(v.label);
                const Icon = k.icon;
                return (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-border hover:bg-muted/60 transition-colors"
                  >
                    <div
                      className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: `hsl(${k.color} / 0.15)`, color: `hsl(${k.color})` }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{v.label}</p>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">{k.text}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {new Date(v.date).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        restoreVersion(v.id);
                        toast.success("Restored");
                        onOpenChange(false);
                      }}
                      title="Restore"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => removeVersion(v.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
