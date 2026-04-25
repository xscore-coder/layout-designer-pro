import { useFloorPlan, useActiveFloor } from "@/store/floorPlanStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_SHAPES, shapeLabel } from "@/lib/shapes";
import type { ZoneShape } from "@/types/floorplan";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ColorPicker } from "./ColorPicker";
import {
  Lock, Unlock, Copy, Trash2, Plus, AlertTriangle, Info, Ungroup,
} from "lucide-react";
import { toast } from "sonner";

export function Inspector() {
  const floor = useActiveFloor();
  const selectedZoneId = useFloorPlan((s) => s.selectedZoneId);
  const selectedSeatId = useFloorPlan((s) => s.selectedSeatId);
  const updateZone = useFloorPlan((s) => s.updateZone);
  const removeZone = useFloorPlan((s) => s.removeZone);
  const duplicateZone = useFloorPlan((s) => s.duplicateZone);
  const toggleLock = useFloorPlan((s) => s.toggleLock);
  const appendSeats = useFloorPlan((s) => s.appendSeats);
  const updateSeat = useFloorPlan((s) => s.updateSeat);
  const addSeatHistory = useFloorPlan((s) => s.addSeatHistory);
  const ungroupSpace = useFloorPlan((s) => s.ungroupSpace);

  const zone = floor.zones.find((z) => z.id === selectedZoneId);
  const seat = zone?.seats.find((s) => s.id === selectedSeatId);

  if (!zone) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        <Info className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Select a zone or seat to inspect & edit its properties.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <div className="h-8 w-8 rounded-md shrink-0" style={{ backgroundColor: `hsl(${zone.color})` }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Zone</p>
          <p className="font-semibold truncate">{zone.name}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={() => toggleLock(zone.id)} title={zone.locked ? "Unlock" : "Lock"}>
          {zone.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        </Button>
      </div>

      <Tabs defaultValue="zone" className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-2 m-2">
          <TabsTrigger value="zone">Zone</TabsTrigger>
          <TabsTrigger value="seat" disabled={!seat}>Seat</TabsTrigger>
        </TabsList>

        <TabsContent value="zone" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={zone.name} onChange={(e) => updateZone(zone.id, { name: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={zone.description ?? ""}
                  onChange={(e) => updateZone(zone.id, { description: e.target.value })}
                />
              </div>

              {/* Pro Color Picker */}
              <div>
                <Label>Color</Label>
                <ColorPicker
                  value={zone.color}
                  onChange={(c) => updateZone(zone.id, { color: c })}
                  fillMode={zone.fillMode ?? "solid"}
                  onFillModeChange={(m) => updateZone(zone.id, { fillMode: m })}
                  gradientTo={zone.gradientTo}
                  onGradientChange={(g) => updateZone(zone.id, { gradientTo: g })}
                  borderColor={zone.borderColor}
                  onBorderChange={(b) => updateZone(zone.id, { borderColor: b })}
                  opacity={zone.opacity ?? 1}
                  onOpacityChange={(o) => updateZone(zone.id, { opacity: o })}
                />
              </div>

              {/* Ungroup button for group spaces */}
              {zone.kind === "space" && zone.spaceKind === "group" && (
                <Button variant="outline" size="sm" className="w-full"
                  onClick={() => { ungroupSpace(zone.id); toast.success("Ungrouped"); }}>
                  <Ungroup className="h-3 w-3 mr-1" /> Ungroup
                </Button>
              )}

              {zone.kind === "zone" && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Rows</Label>
                      <Input type="number" min={1} value={zone.rows}
                        onChange={(e) => updateZone(zone.id, { rows: Math.max(1, +e.target.value) })} />
                    </div>
                    <div>
                      <Label>Cols</Label>
                      <Input type="number" min={1} value={zone.cols}
                        onChange={(e) => updateZone(zone.id, { cols: Math.max(1, +e.target.value) })} />
                    </div>
                    <div>
                      <Label>Start PC #</Label>
                      <Input type="number" min={1} value={zone.startPc}
                        onChange={(e) => updateZone(zone.id, { startPc: Math.max(1, +e.target.value) })} />
                    </div>
                  </div>
                  <div>
                    <Label>Shape</Label>
                    <Select value={zone.shape} onValueChange={(v) => updateZone(zone.id, { shape: v as ZoneShape })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALL_SHAPES.map((s) => <SelectItem key={s} value={s}>{shapeLabel(s)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label>Seat spacing</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={zone.seatGap ?? 8}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          updateZone(zone.id, { seatGap: v });
                        }}
                        className="h-7 w-20 text-xs font-mono text-right"
                      />
                    </div>
                    <Slider
                      min={0}
                      max={Math.max(64, (zone.seatGap ?? 8) + 8)}
                      step={1}
                      value={[zone.seatGap ?? 8]}
                      onValueChange={(v) => updateZone(zone.id, { seatGap: v[0] })}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      المسافة بين كل خلية والتانية داخل الزون (px) — اكتب أي رقم يدوياً
                    </p>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      rows={2}
                      value={zone.notes ?? ""}
                      onChange={(e) => updateZone(zone.id, { notes: e.target.value })}
                    />
                  </div>

                  <div className="pt-2 grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => appendSeats(zone.id, zone.cols || 1)}>
                      <Plus className="h-3 w-3 mr-1" /> Add row
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => duplicateZone(zone.id)}>
                      <Copy className="h-3 w-3 mr-1" /> Duplicate
                    </Button>
                  </div>

                  {/* Stats */}
                  <div className="bg-muted/50 rounded-md p-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total seats</span>
                      <span className="font-mono">{zone.seats.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Occupied</span>
                      <span className="font-mono">
                        {zone.seats.filter((s) => s.type !== "empty").length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Problems</span>
                      <span className="font-mono text-destructive">
                        {zone.seats.reduce((a, s) => a + s.problemCount, 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Capacity</span>
                      <span className="font-mono">
                        {zone.seats.length
                          ? Math.round(
                              (zone.seats.filter((s) => s.type !== "empty").length / zone.seats.length) * 100
                            )
                          : 0}%
                      </span>
                    </div>
                  </div>
                </>
              )}

              <Button variant="destructive" size="sm" className="w-full"
                onClick={() => { removeZone(zone.id); toast.success("Zone removed"); }}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete Zone
              </Button>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="seat" className="flex-1 mt-0 overflow-hidden">
          {seat && (
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">PC {seat.pcNumber}</Badge>
                  <Badge>{seat.type}</Badge>
                  {seat.problemCount > 0 && (
                    <Badge variant="destructive" className="ml-auto">
                      <AlertTriangle className="h-3 w-3 mr-1" /> {seat.problemCount}
                    </Badge>
                  )}
                </div>

                <div>
                  <Label>PC Number</Label>
                  <Input
                    value={seat.pcNumber}
                    onChange={(e) => updateSeat(zone.id, seat.id, { pcNumber: e.target.value })}
                    placeholder="e.g. PC-101"
                  />
                </div>
                <div>
                  <Label>Note</Label>
                  <Textarea
                    rows={2}
                    dir="auto"
                    value={seat.note ?? ""}
                    onChange={(e) => updateSeat(zone.id, seat.id, { note: e.target.value })}
                    placeholder="ملاحظات…"
                  />
                </div>
                <div>
                  <Label>Wasla SCT Feedback</Label>
                  <Textarea
                    rows={2}
                    dir="auto"
                    value={seat.waslaSctFeedback ?? ""}
                    onChange={(e) => updateSeat(zone.id, seat.id, { waslaSctFeedback: e.target.value })}
                    placeholder="Wasla SCT feedback…"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button size="sm" variant="outline"
                    onClick={() => addSeatHistory(zone.id, seat.id, "problem", "Reported issue")}>
                    + Problem
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => addSeatHistory(zone.id, seat.id, "fix", "Marked fixed")}>
                    + Fix
                  </Button>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">PC History</Label>
                  <div className="mt-2 space-y-1 max-h-60 overflow-auto">
                    {seat.history.length === 0 && (
                      <p className="text-xs text-muted-foreground py-3 text-center">No history yet.</p>
                    )}
                    {seat.history.map((h) => (
                      <div key={h.id} className="text-xs flex gap-2 border-l-2 pl-2 py-1"
                        style={{
                          borderColor:
                            h.type === "problem" ? "hsl(var(--destructive))" :
                            h.type === "fix" ? "hsl(var(--success))" :
                            "hsl(var(--border))",
                        }}>
                        <span className="font-mono text-muted-foreground shrink-0">
                          {new Date(h.date).toLocaleDateString()}
                        </span>
                        <span className="flex-1">{h.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
