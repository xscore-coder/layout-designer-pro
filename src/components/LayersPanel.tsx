import { useState } from "react";
import { useFloorPlan, useActiveFloor } from "@/store/floorPlanStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, EyeOff, Lock, Unlock, Layers as LayersIcon, Square, Users, Pencil, Trash2, Copy } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LayersPanel() {
  const floor = useActiveFloor();
  const selectedIds = useFloorPlan((s) => s.selectedZoneIds);
  const select = useFloorPlan((s) => s.selectZone);
  const toggleHidden = useFloorPlan((s) => s.toggleZoneVisibility);
  const toggleLock = useFloorPlan((s) => s.toggleLock);
  const updateZone = useFloorPlan((s) => s.updateZone);
  const removeZone = useFloorPlan((s) => s.removeZone);
  const duplicateZone = useFloorPlan((s) => s.duplicateZone);

  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const top = floor.zones.filter((z) => !z.parentId);
  const childrenOf = (id: string) => floor.zones.filter((z) => z.parentId === id);

  const openRename = (id: string, name: string) => {
    setRenameTarget({ id, name });
    setRenameValue(name);
  };

  const submitRename = () => {
    if (renameTarget && renameValue.trim()) {
      updateZone(renameTarget.id, { name: renameValue.trim() });
    }
    setRenameTarget(null);
    setRenameValue("");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-t border-border min-h-0">
      <div className="px-3 py-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
        <LayersIcon className="h-3.5 w-3.5" /> Layers
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-1 pb-2">
          {top.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-3 px-2">No layers yet.</p>
          )}
          {top.slice().reverse().map((z) => (
            <LayerRow
              key={z.id}
              zone={z}
              level={0}
              selected={selectedIds.includes(z.id)}
              onSelect={(e) => select(z.id, { additive: e.shiftKey || e.metaKey || e.ctrlKey })}
              onToggleHidden={() => toggleHidden(z.id)}
              onToggleLock={() => toggleLock(z.id)}
              onColor={(c) => updateZone(z.id, { color: c })}
              onRename={() => openRename(z.id, z.name)}
              onDuplicate={() => duplicateZone(z.id)}
              onDelete={() => removeZone(z.id)}
            >
              {childrenOf(z.id).slice().reverse().map((c) => (
                <LayerRow
                  key={c.id}
                  zone={c}
                  level={1}
                  selected={selectedIds.includes(c.id)}
                  onSelect={(e) => select(c.id, { additive: e.shiftKey || e.metaKey || e.ctrlKey })}
                  onToggleHidden={() => toggleHidden(c.id)}
                  onToggleLock={() => toggleLock(c.id)}
                  onColor={(col) => updateZone(c.id, { color: col })}
                  onRename={() => openRename(c.id, c.name)}
                  onDuplicate={() => duplicateZone(c.id)}
                  onDelete={() => removeZone(c.id)}
                />
              ))}
            </LayerRow>
          ))}
        </div>
      </ScrollArea>

      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => { if (!open) { setRenameTarget(null); setRenameValue(""); } }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename Layer</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="layer-rename">Name</Label>
            <Input
              id="layer-rename"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") submitRename(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenameTarget(null); setRenameValue(""); }}>Cancel</Button>
            <Button onClick={submitRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LayerRow({
  zone, level, selected, onSelect, onToggleHidden, onToggleLock, onColor,
  onRename, onDuplicate, onDelete, children,
}: {
  zone: any;
  level: number;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onToggleHidden: () => void;
  onToggleLock: () => void;
  onColor: (c: string) => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  children?: React.ReactNode;
}) {
  const isSpace = zone.kind === "space";
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={onSelect}
            onDoubleClick={onRename}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[12px] cursor-pointer transition-colors group min-w-0",
              selected ? "bg-primary/10 text-primary" : "hover:bg-muted",
              zone.hidden && "opacity-40"
            )}
            style={{ paddingLeft: 8 + level * 14 }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onToggleHidden(); }}
              className="opacity-50 hover:opacity-100 shrink-0"
              title={zone.hidden ? "Show" : "Hide"}
            >
              {zone.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
              className="opacity-50 hover:opacity-100 shrink-0"
              title={zone.locked ? "Unlock" : "Lock"}
            >
              {zone.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            </button>
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              <ColorPicker
                value={zone.color}
                onChange={onColor}
                compact
              />
            </div>
            {isSpace ? <Square className="h-3 w-3 opacity-60 shrink-0" /> : <Users className="h-3 w-3 opacity-60 shrink-0" />}
            <span className="flex-1 truncate min-w-0 select-none">{zone.name}</span>
            {!isSpace && (
              <span className="text-[9px] font-mono opacity-50 shrink-0">{zone.seats?.length ?? 0}</span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-44">
          <ContextMenuItem onClick={onRename} disabled={zone.locked}>
            <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
          </ContextMenuItem>
          <ContextMenuItem onClick={onToggleHidden}>
            {zone.hidden ? (
              <><Eye className="h-3.5 w-3.5 mr-2" /> Show</>
            ) : (
              <><EyeOff className="h-3.5 w-3.5 mr-2" /> Hide</>
            )}
          </ContextMenuItem>
          <ContextMenuItem onClick={onToggleLock}>
            {zone.locked ? (
              <><Unlock className="h-3.5 w-3.5 mr-2" /> Unlock</>
            ) : (
              <><Lock className="h-3.5 w-3.5 mr-2" /> Lock</>
            )}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            disabled={zone.locked}
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {children}
    </>
  );
}
