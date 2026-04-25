import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFloorPlan } from "@/store/floorPlanStore";
import { Badge } from "@/components/ui/badge";

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

export function HistoryDrawer({ open, onOpenChange }: Props) {
  const log = useFloorPlan((s) => s.changeLog);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-md">
        <SheetHeader><SheetTitle>Change History</SheetTitle></SheetHeader>
        <ScrollArea className="h-[calc(100vh-80px)] mt-4">
          <div className="space-y-1 pr-2">
            {log.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No changes yet.</p>
            )}
            {log.map((e) => (
              <div key={e.id} className="flex items-start gap-3 py-2 border-b border-border/50 text-sm">
                <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                  {new Date(e.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{e.action}</p>
                  {e.details && <p className="text-xs text-muted-foreground truncate">{e.details}</p>}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
