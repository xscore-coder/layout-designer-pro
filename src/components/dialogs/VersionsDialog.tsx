import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFloorPlan } from "@/store/floorPlanStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, RotateCcw, Trash2, Save } from "lucide-react";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Versions
          </DialogTitle>
          <DialogDescription>Save snapshots and restore them at any time.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Version label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-9"
          />
          <Button onClick={() => { saveVersion(label || undefined); setLabel(""); toast.success("Version saved"); }}>
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
        </div>

        <ScrollArea className="max-h-72">
          <div className="space-y-1">
            {versions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No versions yet.</p>
            )}
            {versions.map((v) => (
              <div key={v.id} className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.label}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {new Date(v.date).toLocaleString()}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => { restoreVersion(v.id); toast.success("Restored"); onOpenChange(false); }}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => removeVersion(v.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
