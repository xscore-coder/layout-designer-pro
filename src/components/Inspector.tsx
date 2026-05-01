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
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorPicker } from "./ColorPicker";
import {
  Lock, Unlock, Copy, Trash2, Plus, AlertTriangle, Info, Ungroup, X, ShieldCheck, Sparkles,
  Monitor, MinusCircle, CalendarIcon,
} from "lucide-react";
import type { SeatType } from "@/types/floorplan";
import { toast } from "sonner";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";

/** Shared quick-pick note templates (English). */
const NOTE_TEMPLATES = [
  "Monitor not working",
  "Keyboard broken",
  "Mouse not working",
  "Speaker broken",
  "Needs format",
  "No internet connection",
  "PC running very slow",
  "Needs RAM upgrade",
  "Hard drive failure",
  "Fixed ✓",
  "Needs replacement",
  "Under maintenance",
  "Power supply issue",
  "Overheating",
  "Missing peripherals",
];

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
      <div className="p-8 flex flex-col items-center justify-center text-center min-h-[60vh] animate-fade-in">
        <div className="relative mb-5">
          <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-2xl rounded-full" />
          <div className="relative h-16 w-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Info className="h-7 w-7 text-primary-foreground" />
          </div>
        </div>
        <h3 className="text-sm font-semibold mb-1.5">Nothing selected</h3>
        <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed mb-4">
          اختار <span className="text-foreground font-medium">Zone</span> أو <span className="text-foreground font-medium">Cell</span> من الكانفس أو من القائمة الجانبية عشان تعرض و تعدّل الخصائص.
        </p>
        <div className="grid grid-cols-1 gap-1.5 text-[11px] text-muted-foreground w-full max-w-[240px]">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
            <kbd className="font-mono text-[10px] bg-card border border-border rounded px-1.5 py-0.5">Click</kbd>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
            <kbd className="font-mono text-[10px] bg-card border border-border rounded px-1.5 py-0.5">Dbl-Click</kbd>
            <span>Quick note</span>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
            <kbd className="font-mono text-[10px] bg-card border border-border rounded px-1.5 py-0.5">Right-Click</kbd>
            <span>Change type</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="p-4 border-b border-border bg-gradient-to-br from-card to-muted/30 flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-lg shrink-0 ring-2 ring-border shadow-sm"
          style={{ backgroundColor: `hsl(${zone.color})` }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            {zone.kind === "space" ? "Space" : "Zone"}
          </p>
          <p className="font-semibold truncate text-sm">{zone.name}</p>
        </div>
        <Button size="icon" variant="ghost" className="shrink-0" onClick={() => toggleLock(zone.id)} title={zone.locked ? "Unlock" : "Lock"}>
          {zone.locked ? <Lock className="h-4 w-4 text-warning" /> : <Unlock className="h-4 w-4" />}
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
          {seat && (() => {
            const seatLocked = !!seat.locked;
            return (
              <ScrollArea className="h-full">
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono">PC {seat.pcNumber}</Badge>
                    <Badge>{seat.type}</Badge>
                    {seat.hasProblem && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> Problem
                      </Badge>
                    )}
                    {seat.problemCount > 0 && (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" /> {seat.problemCount}
                      </Badge>
                    )}
                    {seatLocked && (
                      <Badge variant="secondary" className="ml-auto gap-1">
                        <Lock className="h-3 w-3" /> Locked
                      </Badge>
                    )}
                  </div>

                  {/* Lock toggle */}
                  <div
                    className={`rounded-md border p-2.5 flex items-center gap-2 ${
                      seatLocked
                        ? "bg-amber-500/10 border-amber-500/40"
                        : "bg-emerald-500/10 border-emerald-500/40"
                    }`}
                  >
                    <ShieldCheck className={`h-4 w-4 ${seatLocked ? "text-amber-600" : "text-emerald-600"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">
                        {seatLocked ? "Cell Locked — fields are read-only" : "Cell Unlocked — editing enabled"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {seatLocked
                          ? "اضغط Unlock عشان تقدر تعدل البيانات"
                          : "اقفل الخلية بعد التعديل عشان متتغيرش بالغلط"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={seatLocked ? "default" : "outline"}
                      onClick={() => {
                        updateSeat(zone.id, seat.id, { locked: !seatLocked });
                        toast.success(seatLocked ? "Cell unlocked" : "Cell locked");
                      }}
                    >
                      {seatLocked ? (
                        <><Unlock className="h-3 w-3 mr-1" /> Unlock</>
                      ) : (
                        <><Lock className="h-3 w-3 mr-1" /> Lock</>
                      )}
                    </Button>
                  </div>

                  <fieldset disabled={seatLocked} className="space-y-3 disabled:opacity-60">
                    <div>
                      <Label className="mb-1.5 block">Cell Type</Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {([
                          { type: "pc" as SeatType, label: "PC", Icon: Monitor, cls: "data-[active=true]:bg-seat-agent data-[active=true]:text-white data-[active=true]:border-seat-agent" },
                          { type: "empty" as SeatType, label: "Empty", Icon: MinusCircle, cls: "data-[active=true]:bg-muted data-[active=true]:text-foreground" },
                        ]).map(({ type, label, Icon, cls }) => {
                          const active = seat.type === type;
                          return (
                            <button
                              key={type}
                              type="button"
                              data-active={active}
                              onClick={() => {
                                if (seat.type === type) return;
                                updateSeat(zone.id, seat.id, { type });
                                toast.success(`Set to ${label}`);
                              }}
                              className={`flex flex-col items-center justify-center gap-1 rounded-md border border-border bg-card hover:bg-muted/60 transition-colors py-2 text-[11px] font-medium ${cls}`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Independent Has-Problem toggle */}
                    <div
                      className={cn(
                        "rounded-md border p-2.5 flex items-center gap-3 transition-colors",
                        seat.hasProblem
                          ? "bg-destructive/10 border-destructive/40"
                          : "bg-muted/30 border-border"
                      )}
                    >
                      <AlertTriangle
                        className={cn(
                          "h-4 w-4 shrink-0",
                          seat.hasProblem ? "text-destructive" : "text-muted-foreground"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">
                          {seat.hasProblem ? "Has Problem" : "No Problem"}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          {seat.hasProblem
                            ? "الخلية فيها مشكلة — هتظهر بلون أحمر"
                            : "علّم الـ toggle لو الخلية فيها مشكلة"}
                        </p>
                      </div>
                      <Switch
                        checked={!!seat.hasProblem}
                        onCheckedChange={(v) => {
                          updateSeat(zone.id, seat.id, { hasProblem: v });
                          toast.success(v ? "Marked as Problem" : "Cleared Problem");
                        }}
                      />
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
                      <Label>Lock Number</Label>
                      <Input
                        value={seat.lockNumber ?? ""}
                        onChange={(e) => updateSeat(zone.id, seat.id, { lockNumber: e.target.value })}
                        placeholder="e.g. LK-2034"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label>Note</Label>
                        <div className="flex items-center gap-1">
                          <Select
                            value=""
                            onValueChange={(tpl) => {
                              if (!tpl) return;
                              const current = seat.note?.trim() ?? "";
                              const next = current ? `${current}\n${tpl}` : tpl;
                              updateSeat(zone.id, seat.id, { note: next });
                              toast.success("Template added");
                            }}
                          >
                            <SelectTrigger className="h-6 px-2 text-xs w-auto gap-1 border-0 bg-transparent hover:bg-muted">
                              <Sparkles className="h-3 w-3" />
                              <span>Templates</span>
                            </SelectTrigger>
                            <SelectContent align="end" className="max-h-64">
                              {NOTE_TEMPLATES.map((tpl) => (
                                <SelectItem key={tpl} value={tpl} dir="auto">
                                  {tpl}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {seat.note && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                updateSeat(zone.id, seat.id, { note: "" });
                                toast.success("Note cleared");
                              }}
                            >
                              <X className="h-3 w-3 mr-1" /> Clear
                            </Button>
                          )}
                        </div>
                      </div>
                      <Textarea
                        rows={2}
                        dir="auto"
                        value={seat.note ?? ""}
                        onChange={(e) => updateSeat(zone.id, seat.id, { note: e.target.value })}
                        placeholder="ملاحظات… أو اختر من Templates"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label>Last Update</Label>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">
                            (auto on edit)
                          </span>
                          {seat.lastUpdate && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                updateSeat(zone.id, seat.id, { lastUpdate: "" });
                                toast.success("Cleared");
                              }}
                            >
                              <X className="h-3 w-3 mr-1" /> Clear
                            </Button>
                          )}
                        </div>
                      </div>
                      {(() => {
                        const parsed = seat.lastUpdate ? parseISO(seat.lastUpdate) : undefined;
                        const valid = parsed && isValid(parsed) ? parsed : undefined;
                        return (
                          <div className="flex gap-1.5">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "flex-1 justify-start text-left font-normal h-9",
                                    !valid && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                                  {valid ? format(valid, "PPP") : <span>Pick a date</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={valid}
                                  onSelect={(d) => {
                                    if (!d) return;
                                    const iso = format(d, "yyyy-MM-dd");
                                    updateSeat(zone.id, seat.id, { lastUpdate: iso });
                                    toast.success(`Date set: ${iso}`);
                                  }}
                                  initialFocus
                                  className={cn("p-3 pointer-events-auto")}
                                />
                              </PopoverContent>
                            </Popover>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 px-3 text-xs"
                              onClick={() => {
                                const today = new Date().toISOString().slice(0, 10);
                                updateSeat(zone.id, seat.id, { lastUpdate: today });
                                toast.success("Set to today");
                              }}
                            >
                              Today
                            </Button>
                          </div>
                        );
                      })()}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label>Wasla SCT Feedback</Label>
                        {seat.waslaSctFeedback && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              updateSeat(zone.id, seat.id, { waslaSctFeedback: "" });
                              toast.success("Feedback cleared");
                            }}
                          >
                            <X className="h-3 w-3 mr-1" /> Clear
                          </Button>
                        )}
                      </div>
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
                  </fieldset>

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
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
