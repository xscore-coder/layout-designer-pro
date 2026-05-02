import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Floor,
  Zone,
  Seat,
  FloorPlanState,
  ZoneShape,
  SeatType,
  ChangeLogEntry,
  Shift,
  SpaceKind,
  ThemePreset,
} from "@/types/floorplan";

const SNAP_GRID = 10;
const snapVal = (n: number, enabled: boolean) => (enabled ? Math.round(n / SNAP_GRID) * SNAP_GRID : n);

const uid = () => Math.random().toString(36).slice(2, 10);

const ZONE_PALETTE = [
  "221 83% 53%",
  "271 76% 53%",
  "199 89% 48%",
  "142 71% 45%",
  "38 92% 50%",
  "340 82% 52%",
  "173 80% 40%",
];

function makeSeats(rows: number, cols: number, startPc: number): Seat[] {
  const seats: Seat[] = [];
  for (let i = 0; i < rows * cols; i++) {
    seats.push({
      id: uid(),
      pcNumber: String(startPc + i),
      type: "pc",
      problemCount: 0,
      history: [],
    });
  }
  return seats;
}

function defaultFloor(name = "Floor 1"): Floor {
  return { id: uid(), name, zones: [] };
}

interface Snapshot {
  floors: Floor[];
}

interface Store extends FloorPlanState {
  // history stacks
  past: Snapshot[];
  future: Snapshot[];
  changeLog: ChangeLogEntry[];

  // floor ops
  addFloor: () => void;
  removeFloor: (id: string) => void;
  renameFloor: (id: string, name: string) => void;
  setActiveFloor: (id: string) => void;
  toggleFloorLock: (id: string) => void;
  updateFloor: (id: string, patch: Partial<Floor>) => void;

  // grouping
  groupSelectedAsSpace: () => void;
  ungroupSpace: (spaceId: string) => void;

  // versions
  saveVersion: (label?: string) => void;
  restoreVersion: (id: string) => void;
  removeVersion: (id: string) => void;
  /** Save one version per day (idempotent). Returns true if a new version was saved. */
  ensureDailySnapshot: () => boolean;

  // palette
  addPaletteColor: (hsl: string) => void;
  removePaletteColor: (hsl: string) => void;

  // visibility
  toggleZoneVisibility: (id: string) => void;
  toggleMiniMap: () => void;

  // zone ops
  addZone: (input: Partial<Zone> & { name: string; rows: number; cols: number }) => void;
  addSpace: (kind: SpaceKind, width: number, height: number) => void;
  updateZone: (id: string, patch: Partial<Zone>) => void;
  removeZone: (id: string) => void;
  duplicateZone: (id: string) => void;
  mergeZones: (idA: string, idB: string) => void;
  appendSeats: (zoneId: string, count: number) => void;
  toggleLock: (id: string) => void;

  // seat ops
  cycleSeatType: (zoneId: string, seatId: string) => void;
  updateSeat: (zoneId: string, seatId: string, patch: Partial<Seat>) => void;
  addSeatHistory: (zoneId: string, seatId: string, type: "problem" | "fix" | "change" | "note", description: string) => void;

  // selection / view
  selectZone: (id: string | null, opts?: { additive?: boolean }) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;
  selectSeat: (id: string | null, opts?: { additive?: boolean; range?: boolean }) => void;
  selectSeats: (ids: string[]) => void;
  clearSeatSelection: () => void;
  /** Apply a partial Seat patch to every selected seat across all zones */
  bulkUpdateSelectedSeats: (patch: Partial<Seat>) => void;
  bulkSetSelectedSeatType: (type: SeatType) => void;
  /** Select every zone on the active floor */
  selectAllZonesOnActiveFloor: () => void;
  setZoom: (z: number) => void;
  toggleDark: () => void;
  toggleHeatmap: () => void;
  toggleSnap: () => void;
  toggleSmartGuides: () => void;
  toggleLegend: () => void;
  toggleCompass: () => void;
  toggleScale: () => void;
  toggleGrid: () => void;
  toggleCollision: () => void;
  setTheme: (t: ThemePreset) => void;
  renumberZones: () => void;

  // multi-zone ops
  moveSelectedBy: (dx: number, dy: number) => void;
  alignSelected: (mode: "left" | "right" | "top" | "bottom" | "centerX" | "centerY") => void;
  distributeSelected: (axis: "horizontal" | "vertical") => void;
  bringSelectedToFront: () => void;
  sendSelectedToBack: () => void;

  // import
  importPCs: (rows: { pc: string; problems?: number; agent?: string; shift?: Shift }[]) => void;
  /** Smart-merge: only applies to selected PCs (by pcNumber). */
  importPCsSelective: (
    rows: { pc: string; problems?: number; agent?: string; shift?: Shift }[],
    selectedPcs: string[]
  ) => void;

  // undo/redo
  undo: () => void;
  redo: () => void;

  // utility
  reset: () => void;
  loadFromJSON: (data: { floors: Floor[] }) => void;
}

const initialFloor = defaultFloor();

const log = (state: Store, action: string, details?: string): ChangeLogEntry[] =>
  [{ id: uid(), date: new Date().toISOString(), action, details }, ...state.changeLog].slice(0, 200);

const snapshot = (s: Store): Snapshot => ({ floors: JSON.parse(JSON.stringify(s.floors)) });

const withHistory = <T extends Partial<Store>>(s: Store, patch: T): Partial<Store> => ({
  past: [...s.past, snapshot(s)].slice(-50),
  future: [],
  ...patch,
});

const activeFloor = (s: Store): Floor | undefined => s.floors.find((f) => f.id === s.activeFloorId);

const updateActiveFloor = (s: Store, fn: (f: Floor) => Floor): Floor[] =>
  s.floors.map((f) => (f.id === s.activeFloorId ? fn(f) : f));

export const useFloorPlan = create<Store>()(
  persist(
    (set, get) => ({
      floors: [initialFloor],
      activeFloorId: initialFloor.id,
      selectedZoneId: null,
      selectedZoneIds: [],
      selectedSeatId: null,
      selectedSeatIds: [],
      darkMode: false,
      heatmap: false,
      zoom: 1,
      snapToGrid: true,
      smartGuides: true,
      showLegend: true,
      showCompass: true,
      showScale: true,
      showMiniMap: true,
      showGrid: false,
      collisionDetection: false,
      theme: "modern",
      customPalette: [],
      versions: [],
      past: [],
      future: [],
      changeLog: [],

      addFloor: () =>
        set((s) => {
          const f = defaultFloor(`Floor ${s.floors.length + 1}`);
          return withHistory(s, {
            floors: [...s.floors, f],
            activeFloorId: f.id,
            changeLog: log(s, "Added floor", f.name),
          });
        }),

      removeFloor: (id) =>
        set((s) => {
          if (s.floors.length === 1) return {};
          const floors = s.floors.filter((f) => f.id !== id);
          return withHistory(s, {
            floors,
            activeFloorId: s.activeFloorId === id ? floors[0].id : s.activeFloorId,
            changeLog: log(s, "Removed floor"),
          });
        }),

      renameFloor: (id, name) =>
        set((s) =>
          withHistory(s, {
            floors: s.floors.map((f) => (f.id === id ? { ...f, name } : f)),
            changeLog: log(s, "Renamed floor", name),
          })
        ),

      setActiveFloor: (id) => set({ activeFloorId: id, selectedZoneId: null, selectedSeatId: null }),

      addZone: (input) =>
        set((s) => {
          const rows = Math.max(1, input.rows);
          const cols = Math.max(1, input.cols);
          const startPc = input.startPc ?? 1;
          const color = input.color ?? ZONE_PALETTE[(activeFloor(s)?.zones.length ?? 0) % ZONE_PALETTE.length];
          const zone: Zone = {
            id: uid(),
            name: input.name,
            description: input.description,
            shape: (input.shape ?? "rect") as ZoneShape,
            rows,
            cols,
            startPc,
            color,
            x: input.x ?? 60,
            y: input.y ?? 60,
            width: input.width ?? Math.max(160, cols * 44 + 24),
            height: input.height ?? Math.max(120, rows * 44 + 48),
            locked: false,
            seats: makeSeats(rows, cols, startPc),
            kind: "zone",
          };
          return withHistory(s, {
            floors: updateActiveFloor(s, (f) => ({ ...f, zones: [...f.zones, zone] })),
            selectedZoneId: zone.id,
            changeLog: log(s, "Added zone", input.name),
          });
        }),

      addSpace: (kind, width, height) =>
        set((s) => {
          const zone: Zone = {
            id: uid(),
            name: kind.charAt(0).toUpperCase() + kind.slice(1),
            shape: "rect",
            rows: 0,
            cols: 0,
            startPc: 0,
            color: "215 16% 65%",
            x: 80,
            y: 80,
            width,
            height,
            locked: false,
            seats: [],
            kind: "space",
            spaceKind: kind,
          };
          return withHistory(s, {
            floors: updateActiveFloor(s, (f) => ({ ...f, zones: [...f.zones, zone] })),
            selectedZoneId: zone.id,
            changeLog: log(s, "Added space", kind),
          });
        }),

      updateZone: (id, patch) =>
        set((s) => {
          // floor-level lock blocks all edits
          const af = activeFloor(s);
          if (af?.locked) return {};
          const snap = s.snapToGrid;
          const snapped: Partial<Zone> = { ...patch };
          if (snap) {
            if (typeof snapped.x === "number") snapped.x = snapVal(snapped.x, true);
            if (typeof snapped.y === "number") snapped.y = snapVal(snapped.y, true);
            if (typeof snapped.width === "number") snapped.width = snapVal(snapped.width, true);
            if (typeof snapped.height === "number") snapped.height = snapVal(snapped.height, true);
          }
          // If moving a group container, move its children together
          const movingGroup =
            (typeof patch.x === "number" || typeof patch.y === "number") &&
            af?.zones.find((z) => z.id === id)?.spaceKind === "group";
          let dx = 0, dy = 0;
          if (movingGroup) {
            const orig = af!.zones.find((z) => z.id === id)!;
            dx = (snapped.x ?? orig.x) - orig.x;
            dy = (snapped.y ?? orig.y) - orig.y;
          }
          return withHistory(s, {
            floors: updateActiveFloor(s, (f) => ({
              ...f,
              zones: f.zones.map((z) => {
                // child of moving group
                if (movingGroup && z.parentId === id && !z.locked) {
                  return { ...z, x: Math.max(0, z.x + dx), y: Math.max(0, z.y + dy) };
                }
                if (z.id !== id) return z;
                if (z.locked && !("locked" in patch)) return z;
                let next = { ...z, ...snapped };
                // re-build seats if grid/start changed
                if (
                  z.kind === "zone" &&
                  (("rows" in patch && patch.rows !== z.rows) ||
                    ("cols" in patch && patch.cols !== z.cols) ||
                    ("startPc" in patch && patch.startPc !== z.startPc))
                ) {
                  const oldSeats = z.seats;
                  const newSeats = makeSeats(next.rows, next.cols, next.startPc);
                  // try to preserve existing seat data by index
                  for (let i = 0; i < newSeats.length && i < oldSeats.length; i++) {
                    newSeats[i] = {
                      ...newSeats[i],
                      type: oldSeats[i].type,
                      note: oldSeats[i].note,
                      waslaSctFeedback: oldSeats[i].waslaSctFeedback,
                      problemCount: oldSeats[i].problemCount,
                      history: oldSeats[i].history,
                    };
                  }
                  next.seats = newSeats;
                }
                return next;
              }),
            })),
            changeLog: log(s, "Updated zone"),
          });
        }),

      removeZone: (id) =>
        set((s) =>
          withHistory(s, {
            floors: updateActiveFloor(s, (f) => ({ ...f, zones: f.zones.filter((z) => z.id !== id) })),
            selectedZoneId: s.selectedZoneId === id ? null : s.selectedZoneId,
            changeLog: log(s, "Removed zone"),
          })
        ),

      duplicateZone: (id) =>
        set((s) => {
          const f = activeFloor(s);
          const z = f?.zones.find((z) => z.id === id);
          if (!z) return {};
          const copy: Zone = {
            ...JSON.parse(JSON.stringify(z)),
            id: uid(),
            name: z.name + " (copy)",
            x: z.x + 30,
            y: z.y + 30,
            seats: z.seats.map((seat) => ({ ...seat, id: uid() })),
          };
          return withHistory(s, {
            floors: updateActiveFloor(s, (fl) => ({ ...fl, zones: [...fl.zones, copy] })),
            selectedZoneId: copy.id,
            changeLog: log(s, "Duplicated zone", z.name),
          });
        }),

      mergeZones: (idA, idB) =>
        set((s) => {
          const f = activeFloor(s);
          const a = f?.zones.find((z) => z.id === idA);
          const b = f?.zones.find((z) => z.id === idB);
          if (!a || !b || a.kind !== "zone" || b.kind !== "zone") return {};
          const cols = Math.max(a.cols, b.cols);
          const rows = a.rows + b.rows;
          const seats = [...a.seats, ...b.seats];
          // re-number sequentially from a.startPc
          seats.forEach((seat, i) => (seat.pcNumber = String(a.startPc + i)));
          const merged: Zone = {
            ...a,
            id: uid(),
            name: `${a.name} + ${b.name}`,
            rows,
            cols,
            seats,
            width: Math.max(a.width, b.width),
            height: a.height + b.height,
          };
          return withHistory(s, {
            floors: updateActiveFloor(s, (fl) => ({
              ...fl,
              zones: [...fl.zones.filter((z) => z.id !== idA && z.id !== idB), merged],
            })),
            selectedZoneId: merged.id,
            changeLog: log(s, "Merged zones", `${a.name} + ${b.name}`),
          });
        }),

      appendSeats: (zoneId, count) =>
        set((s) =>
          withHistory(s, {
            floors: updateActiveFloor(s, (f) => ({
              ...f,
              zones: f.zones.map((z) => {
                if (z.id !== zoneId || z.kind !== "zone") return z;
                const lastPc = z.seats.length
                  ? parseInt(z.seats[z.seats.length - 1].pcNumber, 10) || z.startPc + z.seats.length - 1
                  : z.startPc - 1;
                const newSeats = makeSeats(1, count, lastPc + 1);
                const total = z.seats.length + count;
                const newCols = Math.min(Math.max(z.cols, count), 12);
                const newRows = Math.ceil(total / newCols);
                return { ...z, seats: [...z.seats, ...newSeats], cols: newCols, rows: newRows };
              }),
            })),
            changeLog: log(s, "Added seats"),
          })
        ),

      toggleLock: (id) =>
        set((s) =>
          withHistory(s, {
            floors: updateActiveFloor(s, (f) => ({
              ...f,
              zones: f.zones.map((z) => (z.id === id ? { ...z, locked: !z.locked } : z)),
            })),
            changeLog: log(s, "Toggled lock"),
          })
        ),

      cycleSeatType: (zoneId, seatId) => {
        const order: SeatType[] = ["pc", "empty"];
        set((s) =>
          withHistory(s, {
            floors: updateActiveFloor(s, (f) => ({
              ...f,
              zones: f.zones.map((z) => {
                if (z.id !== zoneId || z.locked) return z;
                return {
                  ...z,
                  seats: z.seats.map((seat) => {
                    if (seat.id !== seatId) return seat;
                    const next = order[(order.indexOf(seat.type) + 1) % order.length];
                    return {
                      ...seat,
                      type: next,
                      lastUpdate: new Date().toISOString().slice(0, 10),
                      history: [
                        { id: uid(), date: new Date().toISOString(), type: "change" as const, description: `Type → ${next}` },
                        ...seat.history,
                      ].slice(0, 50),
                    };
                  }),
                };
              }),
            })),
            changeLog: log(s, "Changed seat type"),
          })
        );
      },

      updateSeat: (zoneId, seatId, patch) =>
        set((s) =>
          withHistory(s, {
            floors: updateActiveFloor(s, (f) => ({
              ...f,
              zones: f.zones.map((z) => {
                if (z.id !== zoneId) return z;
                return {
                  ...z,
                  seats: z.seats.map((seat) => {
                    if (seat.id !== seatId) return seat;
                    // When seat is locked, only allow toggling the `locked` flag itself.
                    if (seat.locked && !("locked" in patch)) return seat;
                    // Auto-stamp lastUpdate unless caller provides one explicitly
                    const auto =
                      "lastUpdate" in patch
                        ? {}
                        : { lastUpdate: new Date().toISOString().slice(0, 10) };
                    return { ...seat, ...patch, ...auto };
                  }),
                };
              }),
            })),
            changeLog: log(s, "Updated seat"),
          })
        ),

      addSeatHistory: (zoneId, seatId, type, description) =>
        set((s) => ({
          floors: updateActiveFloor(s, (f) => ({
            ...f,
            zones: f.zones.map((z) => {
              if (z.id !== zoneId) return z;
              return {
                ...z,
                seats: z.seats.map((seat) =>
                  seat.id === seatId
                    ? {
                        ...seat,
                        history: [
                          { id: uid(), date: new Date().toISOString(), type, description },
                          ...seat.history,
                        ].slice(0, 50),
                        problemCount: type === "problem" ? seat.problemCount + 1 : seat.problemCount,
                      }
                    : seat
                ),
              };
            }),
          })),
        })),

      selectZone: (id, opts) =>
        set((s) => {
          if (id === null) return { selectedZoneId: null, selectedZoneIds: [], selectedSeatId: null, selectedSeatIds: [] };
          if (opts?.additive) {
            const exists = s.selectedZoneIds.includes(id);
            const ids = exists ? s.selectedZoneIds.filter((x) => x !== id) : [...s.selectedZoneIds, id];
            return { selectedZoneIds: ids, selectedZoneId: ids[ids.length - 1] ?? null, selectedSeatId: null, selectedSeatIds: [] };
          }
          return { selectedZoneId: id, selectedZoneIds: [id], selectedSeatId: null, selectedSeatIds: [] };
        }),
      selectMany: (ids) =>
        set((s) => {
          // Guard: only update state if the selection actually changed.
          // Prevents infinite render loops when callers pass equivalent arrays.
          const cur = s.selectedZoneIds;
          if (cur.length === ids.length) {
            const a = [...cur].sort();
            const b = [...ids].sort();
            let same = true;
            for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; }
            if (same) return {};
          }
          return { selectedZoneIds: ids, selectedZoneId: ids[ids.length - 1] ?? null };
        }),
      clearSelection: () =>
        set({ selectedZoneId: null, selectedZoneIds: [], selectedSeatId: null, selectedSeatIds: [] }),

      selectSeat: (id, opts) =>
        set((s) => {
          if (id === null) return { selectedSeatId: null, selectedSeatIds: [] };
          // Range select (Shift): pick all seats between last selected and current within the same zone
          if (opts?.range && s.selectedSeatId) {
            const af = activeFloor(s);
            if (af) {
              const zone = af.zones.find(
                (z) => z.seats.some((x) => x.id === id) && z.seats.some((x) => x.id === s.selectedSeatId)
              );
              if (zone) {
                const ai = zone.seats.findIndex((x) => x.id === s.selectedSeatId);
                const bi = zone.seats.findIndex((x) => x.id === id);
                const [lo, hi] = ai < bi ? [ai, bi] : [bi, ai];
                const ids = zone.seats.slice(lo, hi + 1).map((x) => x.id);
                return { selectedSeatId: id, selectedSeatIds: ids };
              }
            }
          }
          if (opts?.additive) {
            const set2 = new Set(s.selectedSeatIds.length ? s.selectedSeatIds : s.selectedSeatId ? [s.selectedSeatId] : []);
            if (set2.has(id)) set2.delete(id); else set2.add(id);
            const arr = Array.from(set2);
            return { selectedSeatId: id, selectedSeatIds: arr };
          }
          return { selectedSeatId: id, selectedSeatIds: [id] };
        }),
      selectSeats: (ids) =>
        set((s) => {
          const cur = s.selectedSeatIds;
          if (cur.length === ids.length) {
            const a = [...cur].sort();
            const b = [...ids].sort();
            let same = true;
            for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; }
            if (same) return {};
          }
          return { selectedSeatIds: ids, selectedSeatId: ids[ids.length - 1] ?? null };
        }),
      clearSeatSelection: () => set({ selectedSeatId: null, selectedSeatIds: [] }),

      bulkUpdateSelectedSeats: (patch) =>
        set((s) => {
          const ids = new Set(s.selectedSeatIds.length ? s.selectedSeatIds : s.selectedSeatId ? [s.selectedSeatId] : []);
          if (!ids.size) return {};
          let count = 0;
          const auto =
            "lastUpdate" in patch
              ? {}
              : { lastUpdate: new Date().toISOString().slice(0, 10) };
          return withHistory(s, {
            floors: s.floors.map((f) => ({
              ...f,
              zones: f.zones.map((z) => ({
                ...z,
                seats: z.seats.map((seat) => {
                  if (!ids.has(seat.id)) return seat;
                  if (seat.locked && !("locked" in patch)) return seat;
                  count++;
                  return { ...seat, ...patch, ...auto };
                }),
              })),
            })),
            changeLog: log(s, "Bulk-updated seats", `${count} seat(s)`),
          });
        }),

      bulkSetSelectedSeatType: (type) =>
        set((s) => {
          const ids = new Set(s.selectedSeatIds.length ? s.selectedSeatIds : s.selectedSeatId ? [s.selectedSeatId] : []);
          if (!ids.size) return {};
          let count = 0;
          const today = new Date().toISOString().slice(0, 10);
          return withHistory(s, {
            floors: s.floors.map((f) => ({
              ...f,
              zones: f.zones.map((z) => ({
                ...z,
                seats: z.seats.map((seat) => {
                  if (!ids.has(seat.id) || seat.locked) return seat;
                  count++;
                  return {
                    ...seat,
                    type,
                    lastUpdate: today,
                    history: [
                      { id: uid(), date: new Date().toISOString(), type: "change" as const, description: `Bulk → ${type}` },
                      ...seat.history,
                    ].slice(0, 50),
                  };
                }),
              })),
            })),
            changeLog: log(s, "Bulk-set seat type", `${count} → ${type}`),
          });
        }),

      selectAllZonesOnActiveFloor: () =>
        set((s) => {
          const f = activeFloor(s);
          if (!f) return {};
          const ids = f.zones.map((z) => z.id);
          return { selectedZoneIds: ids, selectedZoneId: ids[ids.length - 1] ?? null, selectedSeatId: null, selectedSeatIds: [] };
        }),
      setZoom: (z) => set({ zoom: Math.min(2, Math.max(0.4, z)) }),
      toggleDark: () =>
        set((s) => {
          const dark = !s.darkMode;
          // smooth color transition for ~250ms
          const root = document.documentElement;
          root.classList.add("theme-transition");
          root.classList.toggle("dark", dark);
          window.setTimeout(() => root.classList.remove("theme-transition"), 260);
          return { darkMode: dark };
        }),
      toggleHeatmap: () => set((s) => ({ heatmap: !s.heatmap })),
      toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
      toggleSmartGuides: () => set((s) => ({ smartGuides: !s.smartGuides })),
      toggleLegend: () => set((s) => ({ showLegend: !s.showLegend })),
      toggleCompass: () => set((s) => ({ showCompass: !s.showCompass })),
      toggleScale: () => set((s) => ({ showScale: !s.showScale })),
      toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
      toggleCollision: () => set((s) => ({ collisionDetection: !s.collisionDetection })),
      setTheme: (t) => set({ theme: t }),
      renumberZones: () =>
        set((s) =>
          withHistory(s, {
            floors: updateActiveFloor(s, (f) => ({
              ...f,
              zones: f.zones.map((z, i) =>
                z.kind === "zone" ? { ...z, name: `Z${i + 1} • ${z.name.replace(/^Z\d+\s*•\s*/, "")}` } : z
              ),
            })),
            changeLog: log(s, "Renumbered zones"),
          })
        ),

      moveSelectedBy: (dx, dy) =>
        set((s) => {
          const ids = new Set(s.selectedZoneIds);
          if (!ids.size) return {};
          return withHistory(s, {
            floors: updateActiveFloor(s, (f) => ({
              ...f,
              zones: f.zones.map((z) =>
                ids.has(z.id) && !z.locked
                  ? { ...z, x: Math.max(0, z.x + dx), y: Math.max(0, z.y + dy) }
                  : z
              ),
            })),
            changeLog: log(s, "Moved selection"),
          });
        }),

      alignSelected: (mode) =>
        set((s) => {
          const f = activeFloor(s);
          if (!f) return {};
          const sel = f.zones.filter((z) => s.selectedZoneIds.includes(z.id) && !z.locked);
          if (sel.length < 2) return {};
          const lefts = sel.map((z) => z.x);
          const rights = sel.map((z) => z.x + z.width);
          const tops = sel.map((z) => z.y);
          const bottoms = sel.map((z) => z.y + z.height);
          const minL = Math.min(...lefts), maxR = Math.max(...rights);
          const minT = Math.min(...tops), maxB = Math.max(...bottoms);
          const cx = (minL + maxR) / 2, cy = (minT + maxB) / 2;
          const ids = new Set(sel.map((z) => z.id));
          return withHistory(s, {
            floors: updateActiveFloor(s, (fl) => ({
              ...fl,
              zones: fl.zones.map((z) => {
                if (!ids.has(z.id)) return z;
                switch (mode) {
                  case "left": return { ...z, x: minL };
                  case "right": return { ...z, x: maxR - z.width };
                  case "top": return { ...z, y: minT };
                  case "bottom": return { ...z, y: maxB - z.height };
                  case "centerX": return { ...z, x: cx - z.width / 2 };
                  case "centerY": return { ...z, y: cy - z.height / 2 };
                }
              }),
            })),
            changeLog: log(s, `Aligned ${mode}`),
          });
        }),

      distributeSelected: (axis) =>
        set((s) => {
          const f = activeFloor(s);
          if (!f) return {};
          const sel = f.zones.filter((z) => s.selectedZoneIds.includes(z.id) && !z.locked);
          if (sel.length < 3) return {};
          const sorted = [...sel].sort((a, b) => (axis === "horizontal" ? a.x - b.x : a.y - b.y));
          const first = sorted[0], last = sorted[sorted.length - 1];
          const totalSize = sorted.reduce((acc, z) => acc + (axis === "horizontal" ? z.width : z.height), 0);
          const span = axis === "horizontal"
            ? (last.x + last.width) - first.x
            : (last.y + last.height) - first.y;
          const gap = (span - totalSize) / (sorted.length - 1);
          let cursor = axis === "horizontal" ? first.x : first.y;
          const positions = new Map<string, number>();
          for (const z of sorted) {
            positions.set(z.id, cursor);
            cursor += (axis === "horizontal" ? z.width : z.height) + gap;
          }
          return withHistory(s, {
            floors: updateActiveFloor(s, (fl) => ({
              ...fl,
              zones: fl.zones.map((z) =>
                positions.has(z.id)
                  ? axis === "horizontal"
                    ? { ...z, x: positions.get(z.id)! }
                    : { ...z, y: positions.get(z.id)! }
                  : z
              ),
            })),
            changeLog: log(s, `Distributed ${axis}`),
          });
        }),

      bringSelectedToFront: () =>
        set((s) => {
          const ids = new Set(s.selectedZoneIds);
          if (!ids.size) return {};
          return withHistory(s, {
            floors: updateActiveFloor(s, (f) => {
              const others = f.zones.filter((z) => !ids.has(z.id));
              const selected = f.zones.filter((z) => ids.has(z.id));
              return { ...f, zones: [...others, ...selected] };
            }),
            changeLog: log(s, "Brought to front"),
          });
        }),

      sendSelectedToBack: () =>
        set((s) => {
          const ids = new Set(s.selectedZoneIds);
          if (!ids.size) return {};
          return withHistory(s, {
            floors: updateActiveFloor(s, (f) => {
              const others = f.zones.filter((z) => !ids.has(z.id));
              const selected = f.zones.filter((z) => ids.has(z.id));
              return { ...f, zones: [...selected, ...others] };
            }),
            changeLog: log(s, "Sent to back"),
          });
        }),

      importPCs: (rows) =>
        set((s) => {
          const map = new Map(rows.map((r) => [r.pc, r]));
          let updated = 0;
          const today = new Date().toISOString().slice(0, 10);
          const floors = s.floors.map((f) => ({
            ...f,
            zones: f.zones.map((z) => ({
              ...z,
              seats: z.seats.map((seat) => {
                const r = map.get(seat.pcNumber);
                if (!r) return seat;
                updated++;
                const problems = r.problems ?? 0;
                return {
                  ...seat,
                  problemCount: seat.problemCount + problems,
                  hasProblem: problems > 0 ? true : seat.hasProblem,
                  lastUpdate: today,
                  history:
                    problems > 0
                      ? [
                          {
                            id: uid(),
                            date: new Date().toISOString(),
                            type: "problem" as const,
                            description: `Imported: ${problems} problem(s)`,
                          },
                          ...seat.history,
                        ].slice(0, 50)
                      : seat.history,
                };
              }),
            })),
          }));
          return withHistory(s, {
            floors,
            changeLog: log(s, "Imported CSV", `${updated} PCs updated`),
          });
        }),

      importPCsSelective: (rows, selectedPcs) =>
        set((s) => {
          const allowed = new Set(selectedPcs);
          const map = new Map(rows.filter((r) => allowed.has(r.pc)).map((r) => [r.pc, r]));
          let updated = 0;
          const today = new Date().toISOString().slice(0, 10);
          const floors = s.floors.map((f) => ({
            ...f,
            zones: f.zones.map((z) => ({
              ...z,
              seats: z.seats.map((seat) => {
                const r = map.get(seat.pcNumber);
                if (!r) return seat;
                updated++;
                const problems = r.problems ?? 0;
                return {
                  ...seat,
                  problemCount: seat.problemCount + problems,
                  hasProblem: problems > 0 ? true : seat.hasProblem,
                  lastUpdate: today,
                  history:
                    problems > 0
                      ? [
                          {
                            id: uid(),
                            date: new Date().toISOString(),
                            type: "problem" as const,
                            description: `Imported (merge): ${problems} problem(s)`,
                          },
                          ...seat.history,
                        ].slice(0, 50)
                      : seat.history,
                };
              }),
            })),
          }));
          return withHistory(s, {
            floors,
            changeLog: log(s, "Smart-merge import", `${updated} PCs updated`),
          });
        }),

      undo: () =>
        set((s) => {
          if (!s.past.length) return {};
          const prev = s.past[s.past.length - 1];
          return {
            past: s.past.slice(0, -1),
            future: [snapshot(s), ...s.future].slice(0, 50),
            floors: prev.floors,
          };
        }),

      redo: () =>
        set((s) => {
          if (!s.future.length) return {};
          const next = s.future[0];
          return {
            past: [...s.past, snapshot(s)].slice(-50),
            future: s.future.slice(1),
            floors: next.floors,
          };
        }),

      reset: () => {
        const f = defaultFloor();
        set({
          floors: [f],
          activeFloorId: f.id,
          past: [],
          future: [],
          selectedSeatId: null,
          selectedZoneId: null,
          changeLog: [],
        });
      },

      loadFromJSON: (data) =>
        set((s) =>
          withHistory(s, {
            floors: data.floors,
            activeFloorId: data.floors[0]?.id ?? s.activeFloorId,
            changeLog: log(s, "Loaded JSON"),
          })
        ),

      // ===== Floor Lock + Floor properties =====
      toggleFloorLock: (id) =>
        set((s) =>
          withHistory(s, {
            floors: s.floors.map((f) => (f.id === id ? { ...f, locked: !f.locked } : f)),
            changeLog: log(s, "Toggled floor lock"),
          })
        ),

      updateFloor: (id, patch) =>
        set((s) =>
          withHistory(s, {
            floors: s.floors.map((f) => (f.id === id ? { ...f, ...patch } : f)),
            changeLog: log(s, "Updated floor"),
          })
        ),

      // ===== Group selected zones into a Space container =====
      groupSelectedAsSpace: () =>
        set((s) => {
          const f = activeFloor(s);
          if (!f || s.selectedZoneIds.length < 1) return {};
          const sel = f.zones.filter((z) => s.selectedZoneIds.includes(z.id));
          if (!sel.length) return {};
          const PAD = 24;
          const minX = Math.min(...sel.map((z) => z.x)) - PAD;
          const minY = Math.min(...sel.map((z) => z.y)) - PAD - 10;
          const maxX = Math.max(...sel.map((z) => z.x + z.width)) + PAD;
          const maxY = Math.max(...sel.map((z) => z.y + z.height)) + PAD;
          const groupId = uid();
          const container: Zone = {
            id: groupId,
            name: "Group",
            shape: "rect",
            rows: 0, cols: 0, startPc: 0,
            color: "215 16% 65%",
            x: minX, y: minY,
            width: maxX - minX,
            height: maxY - minY,
            locked: false,
            seats: [],
            kind: "space",
            spaceKind: "group",
          };
          return withHistory(s, {
            floors: updateActiveFloor(s, (fl) => {
              // place group BEHIND its children
              const others = fl.zones.filter((z) => !sel.find((x) => x.id === z.id));
              const childrenWithParent = sel.map((z) => ({ ...z, parentId: groupId }));
              return { ...fl, zones: [...others, container, ...childrenWithParent] };
            }),
            selectedZoneId: groupId,
            selectedZoneIds: [groupId],
            changeLog: log(s, "Grouped into space"),
          });
        }),

      ungroupSpace: (spaceId) =>
        set((s) =>
          withHistory(s, {
            floors: updateActiveFloor(s, (f) => ({
              ...f,
              zones: f.zones
                .filter((z) => z.id !== spaceId)
                .map((z) => (z.parentId === spaceId ? { ...z, parentId: undefined } : z)),
            })),
            selectedZoneId: null,
            selectedZoneIds: [],
            changeLog: log(s, "Ungrouped space"),
          })
        ),

      // ===== Versions (autosave / manual) =====
      saveVersion: (label) =>
        set((s) => ({
          versions: [
            {
              id: uid(),
              date: new Date().toISOString(),
              label: label ?? `Snapshot ${new Date().toLocaleTimeString()}`,
              data: { floors: JSON.parse(JSON.stringify(s.floors)) },
            },
            ...s.versions,
          ].slice(0, 30),
          changeLog: log(s, "Saved version", label),
        })),

      restoreVersion: (id) =>
        set((s) => {
          const v = s.versions.find((x) => x.id === id);
          if (!v) return {};
          return withHistory(s, {
            floors: JSON.parse(JSON.stringify(v.data.floors)),
            changeLog: log(s, "Restored version", v.label),
          });
        }),

      removeVersion: (id) =>
        set((s) => ({ versions: s.versions.filter((v) => v.id !== id) })),

      ensureDailySnapshot: () => {
        const today = new Date().toISOString().slice(0, 10);
        const tag = `Daily ${today}`;
        const s = get();
        if (s.versions.some((v) => v.label === tag)) return false;
        set((st) => ({
          versions: [
            {
              id: uid(),
              date: new Date().toISOString(),
              label: tag,
              data: { floors: JSON.parse(JSON.stringify(st.floors)) },
            },
            ...st.versions,
          ].slice(0, 60),
          changeLog: log(st, "Daily auto-snapshot", tag),
        }));
        return true;
      },

      // ===== Custom Palette =====
      addPaletteColor: (hsl) =>
        set((s) => ({
          customPalette: s.customPalette.includes(hsl) ? s.customPalette : [hsl, ...s.customPalette].slice(0, 24),
        })),
      removePaletteColor: (hsl) =>
        set((s) => ({ customPalette: s.customPalette.filter((c) => c !== hsl) })),

      // ===== Visibility =====
      toggleZoneVisibility: (id) =>
        set((s) => ({
          floors: updateActiveFloor(s, (f) => ({
            ...f,
            zones: f.zones.map((z) => (z.id === id ? { ...z, hidden: !z.hidden } : z)),
          })),
        })),
      toggleMiniMap: () => set((s) => ({ showMiniMap: !s.showMiniMap })),
    }),
    {
      name: "floorplan-v1",
      partialize: (s) => ({
        floors: s.floors,
        activeFloorId: s.activeFloorId,
        darkMode: s.darkMode,
        changeLog: s.changeLog,
        snapToGrid: s.snapToGrid,
        smartGuides: s.smartGuides,
        showLegend: s.showLegend,
        showCompass: s.showCompass,
        showScale: s.showScale,
        showMiniMap: s.showMiniMap,
        collisionDetection: s.collisionDetection,
        theme: s.theme,
        customPalette: s.customPalette,
        versions: s.versions,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply persisted dark choice; fall back to system preference on first run.
        const sysDark = typeof window !== "undefined"
          && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
        const shouldDark = state ? !!state.darkMode : !!sysDark;
        if (shouldDark) document.documentElement.classList.add("dark");
        if (state && !state.darkMode && sysDark) {
          state.darkMode = true;
        }
        // Migration: legacy seat.type === "problem" → type:"pc" + hasProblem:true
        if (state?.floors) {
          state.floors.forEach((f) => {
            f.zones.forEach((z) => {
              z.seats.forEach((seat) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((seat.type as any) === "problem") {
                  seat.type = "pc";
                  seat.hasProblem = true;
                }
              });
            });
          });
        }
      },
    }
  )
);

export const useActiveFloor = () => {
  const floors = useFloorPlan((s) => s.floors);
  const id = useFloorPlan((s) => s.activeFloorId);
  return floors.find((f) => f.id === id) ?? floors[0];
};
