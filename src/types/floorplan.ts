export type ZoneShape = "rect" | "rounded" | "hex" | "oval" | "rhombus" | "parallelogram";
export type SeatType = "empty" | "agent" | "leader" | "super" | "problem";
export type Shift = "morning" | "evening" | "night" | "off";
export type SpaceKind = "corridor" | "office" | "storage" | "pillar" | "blank";

export interface PCHistoryEntry {
  id: string;
  date: string; // ISO
  type: "problem" | "fix" | "change" | "note";
  description: string;
}

export interface Seat {
  id: string;
  pcNumber: string;
  type: SeatType;
  agentName?: string;
  shift?: Shift;
  team?: string;
  note?: string;
  problemCount: number;
  history: PCHistoryEntry[];
}

export interface Zone {
  id: string;
  name: string;
  description?: string;
  shape: ZoneShape;
  rows: number;
  cols: number;
  startPc: number;
  color: string; // hsl values e.g. "221 83% 53%"
  x: number;
  y: number;
  width: number;
  height: number;
  locked: boolean;
  notes?: string;
  seats: Seat[]; // length = rows*cols
  kind: "zone" | "space";
  spaceKind?: SpaceKind;
}

export interface Floor {
  id: string;
  name: string;
  zones: Zone[];
}

export interface FloorPlanState {
  floors: Floor[];
  activeFloorId: string;
  selectedZoneId: string | null;
  selectedSeatId: string | null;
  darkMode: boolean;
  heatmap: boolean;
  zoom: number;
}

export interface ChangeLogEntry {
  id: string;
  date: string;
  action: string;
  details?: string;
}
