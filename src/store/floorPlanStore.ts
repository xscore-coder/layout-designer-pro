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
      type: "agent",
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
  selectZone: (id: string | null) => void;
  selectSeat: (id: string | null) => void;
  setZoom: (z: number) => void;
  toggleDark: () => void;
  toggleHeatmap: () => void;
  toggleSnap: () => void;
  toggleSmartGuides: () => void;
  toggleLegend: () => void;
  toggleCompass: () => void;
  toggleScale: () => void;
  setTheme: (t: ThemePreset) => void;
  renumberZones: () => void;

  // import
  importPCs: (rows: { pc: string; problems?: number; agent?: string; shift?: Shift }[]) => void;

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
      selectedSeatId: null,
      darkMode: false,
      heatmap: false,
      zoom: 1,
      snapToGrid: true,
      smartGuides: true,
      showLegend: true,
      showCompass: true,
      showScale: true,
      theme: "modern",
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
          const snap = s.snapToGrid;
          const snapped: Partial<Zone> = { ...patch };
          if (snap) {
            if (typeof snapped.x === "number") snapped.x = snapVal(snapped.x, true);
            if (typeof snapped.y === "number") snapped.y = snapVal(snapped.y, true);
            if (typeof snapped.width === "number") snapped.width = snapVal(snapped.width, true);
            if (typeof snapped.height === "number") snapped.height = snapVal(snapped.height, true);
          }
          return withHistory(s, {
            floors: updateActiveFloor(s, (f) => ({
              ...f,
              zones: f.zones.map((z) => {
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
                      agentName: oldSeats[i].agentName,
                      shift: oldSeats[i].shift,
                      team: oldSeats[i].team,
                      note: oldSeats[i].note,
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
        const order: SeatType[] = ["agent", "leader", "super", "empty", "problem"];
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
                  seats: z.seats.map((seat) => (seat.id === seatId ? { ...seat, ...patch } : seat)),
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

      selectZone: (id) => set({ selectedZoneId: id, selectedSeatId: null }),
      selectSeat: (id) => set({ selectedSeatId: id }),
      setZoom: (z) => set({ zoom: Math.min(2, Math.max(0.4, z)) }),
      toggleDark: () =>
        set((s) => {
          const dark = !s.darkMode;
          document.documentElement.classList.toggle("dark", dark);
          return { darkMode: dark };
        }),
      toggleHeatmap: () => set((s) => ({ heatmap: !s.heatmap })),
      toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
      toggleSmartGuides: () => set((s) => ({ smartGuides: !s.smartGuides })),
      toggleLegend: () => set((s) => ({ showLegend: !s.showLegend })),
      toggleCompass: () => set((s) => ({ showCompass: !s.showCompass })),
      toggleScale: () => set((s) => ({ showScale: !s.showScale })),
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

      importPCs: (rows) =>
        set((s) => {
          const map = new Map(rows.map((r) => [r.pc, r]));
          let updated = 0;
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
                  agentName: r.agent ?? seat.agentName,
                  shift: r.shift ?? seat.shift,
                  problemCount: seat.problemCount + problems,
                  type: problems > 0 ? "problem" : seat.type,
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
    }),
    {
      name: "floorplan-v1",
      partialize: (s) => ({
        floors: s.floors,
        activeFloorId: s.activeFloorId,
        darkMode: s.darkMode,
        changeLog: s.changeLog,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.darkMode) document.documentElement.classList.add("dark");
      },
    }
  )
);

export const useActiveFloor = () => {
  const floors = useFloorPlan((s) => s.floors);
  const id = useFloorPlan((s) => s.activeFloorId);
  return floors.find((f) => f.id === id) ?? floors[0];
};
