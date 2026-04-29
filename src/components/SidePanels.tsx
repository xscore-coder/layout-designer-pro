import { useEffect, useState } from "react";
import { useFloorPlan, useActiveFloor } from "@/store/floorPlanStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Building2, X, Layers, Lock, Unlock, Pencil, Trash2, Copy } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./ColorPicker";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type RenameTarget =
  | { kind: "floor"; id: string; name: string }
  | { kind: "zone"; id: string; name: string }
  | null;

function RenameDialog({
  target,
  onClose,
  onSubmit,
}: {
  target: RenameTarget;
  onClose: () => void;
  onSubmit: (newName: string) => void;
}) {
  const [value, setValue] = useState("");

  // Properly sync value whenever the target changes (open/swap)
  useEffect(() => {
    if (target) setValue(target.name);
  }, [target]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open) {
          setValue("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            Rename {target?.kind === "floor" ? "Floor" : "Layer"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="rename-input">Name</Label>
          <Input
            id="rename-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setValue(""); onClose(); }}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!value.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FloorList() {
  const floors = useFloorPlan((s) => s.floors);
  const activeId = useFloorPlan((s) => s.activeFloorId);
  const setActive = useFloorPlan((s) => s.setActiveFloor);
  const addFloor = useFloorPlan((s) => s.addFloor);
  const removeFloor = useFloorPlan((s) => s.removeFloor);
  const renameFloor = useFloorPlan((s) => s.renameFloor);
  const toggleFloorLock = useFloorPlan((s) => s.toggleFloorLock);
  const updateFloor = useFloorPlan((s) => s.updateFloor);

  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null);

  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-muted/40 to-transparent">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Layers className="h-3.5 w-3.5" /> Floors
          <span className="ml-1 px-1.5 py-px rounded-full bg-muted text-[9px] font-mono text-muted-foreground/80">{floors.length}</span>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-primary/10 hover:text-primary" onClick={addFloor} title="Add floor">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="max-h-44">
        <div className="px-2 pb-2 space-y-1">
          {floors.map((f) => (
            <ContextMenu key={f.id}>
              <ContextMenuTrigger asChild>
                <div
                  onClick={() => setActive(f.id)}
                  onDoubleClick={() => setRenameTarget({ kind: "floor", id: f.id, name: f.name })}
                  className={cn(
                    "group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-all duration-150 min-w-0 border border-transparent",
                    activeId === f.id
                      ? "bg-gradient-to-r from-primary/15 to-primary/5 text-primary border-primary/30 shadow-sm"
                      : "hover:bg-muted hover:border-border",
                    f.locked && "opacity-90"
                  )}
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 min-w-0 truncate select-none">{f.name}</span>
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <ColorPicker
                      compact
                      value={f.bgColor ?? "220 20% 97%"}
                      onChange={(c) => updateFloor(f.id, { bgColor: c })}
                      label="Floor background"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0 w-5 text-right">
                    {f.zones.length}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFloorLock(f.id); }}
                    className={cn(
                      "transition-opacity shrink-0",
                      f.locked ? "opacity-100 text-warning" : "opacity-50 hover:opacity-100"
                    )}
                    title={f.locked ? "Unlock floor" : "Lock floor"}
                  >
                    {f.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  </button>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-44">
                <ContextMenuItem
                  onClick={() => setRenameTarget({ kind: "floor", id: f.id, name: f.name })}
                  disabled={f.locked}
                >
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                </ContextMenuItem>
                <ContextMenuItem onClick={() => toggleFloorLock(f.id)}>
                  {f.locked ? (
                    <><Unlock className="h-3.5 w-3.5 mr-2" /> Unlock</>
                  ) : (
                    <><Lock className="h-3.5 w-3.5 mr-2" /> Lock</>
                  )}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={floors.length <= 1 || f.locked}
                  onClick={() => removeFloor(f.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      </ScrollArea>

      <RenameDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={(newName) => {
          if (renameTarget?.kind === "floor") {
            renameFloor(renameTarget.id, newName);
          }
          setRenameTarget(null);
        }}
      />
    </div>
  );
}

export function ZoneList() {
  const floor = useActiveFloor();
  const selectedId = useFloorPlan((s) => s.selectedZoneId);
  const select = useFloorPlan((s) => s.selectZone);
  const updateZone = useFloorPlan((s) => s.updateZone);
  const removeZone = useFloorPlan((s) => s.removeZone);
  const duplicateZone = useFloorPlan((s) => s.duplicateZone);
  const toggleLock = useFloorPlan((s) => s.toggleLock);

  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null);

  return (
    <div className="border-b border-border max-h-48 flex flex-col">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
        Zones — {floor.name}
      </div>
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2 space-y-1">
          {floor.zones.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4 px-2">
              No zones yet.
            </p>
          )}
          {floor.zones.map((z) => (
            <ContextMenu key={z.id}>
              <ContextMenuTrigger asChild>
                <button
                  onClick={() => select(z.id)}
                  onDoubleClick={() => setRenameTarget({ kind: "zone", id: z.id, name: z.name })}
                  className={cn(
                    "w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors min-w-0",
                    selectedId === z.id ? "bg-muted ring-1 ring-ring" : "hover:bg-muted/60"
                  )}
                >
                  <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: `hsl(${z.color})` }} />
                  <span className="flex-1 truncate min-w-0">{z.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {z.kind === "zone" ? z.seats.length : z.spaceKind}
                  </span>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-44">
                <ContextMenuItem
                  onClick={() => setRenameTarget({ kind: "zone", id: z.id, name: z.name })}
                  disabled={z.locked}
                >
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                </ContextMenuItem>
                <ContextMenuItem onClick={() => duplicateZone(z.id)}>
                  <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                </ContextMenuItem>
                <ContextMenuItem onClick={() => toggleLock(z.id)}>
                  {z.locked ? (
                    <><Unlock className="h-3.5 w-3.5 mr-2" /> Unlock</>
                  ) : (
                    <><Lock className="h-3.5 w-3.5 mr-2" /> Lock</>
                  )}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={z.locked}
                  onClick={() => removeZone(z.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      </ScrollArea>

      <RenameDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={(newName) => {
          if (renameTarget?.kind === "zone") {
            updateZone(renameTarget.id, { name: newName });
          }
          setRenameTarget(null);
        }}
      />
    </div>
  );
}
