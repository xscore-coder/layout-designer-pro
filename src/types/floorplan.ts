export type ZoneShape = "rect" | "rounded" | "hex" | "oval" | "rhombus" | "parallelogram";
export type SeatType = "empty" | "pc";
export type Shift = "morning" | "evening" | "night" | "off";
export type SpaceKind = "corridor" | "office" | "storage" | "pillar" | "blank" | "group";

export interface PCHistoryEntry {
  id: string;
  date: string; // ISO
  type: "problem" | "fix" | "change" | "note";
  description: string;
}

export interface Seat {
  id: string;
  pcNumber: string;
  lockNumber?: string;
  type: SeatType;
  /** Independent flag: cell has a reported problem (regardless of type). */
  hasProblem?: boolean;
  note?: string;
  waslaSctFeedback?: string;
  /** Manual last update date (e.g. "2026-04-26") entered by the user */
  lastUpdate?: string;
  problemCount: number;
  history: PCHistoryEntry[];
  /** When true, seat fields cannot be edited until unlocked */
  locked?: boolean;
}

export interface ColorStyle {
  /** primary HSL string e.g. "221 83% 53%" */
  color: string;
  /** Optional second color for gradient */
  gradientTo?: string;
  /** "solid" | "gradient" */
  fillMode?: "solid" | "gradient";
  /** Border color HSL string. Defaults to color */
  borderColor?: string;
  /** 0..1 fill opacity */
  opacity?: number;
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
  gradientTo?: string;
  fillMode?: "solid" | "gradient";
  borderColor?: string;
  opacity?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  locked: boolean;
  hidden?: boolean;
  rotation?: number; // degrees
  zIndex?: number;
  notes?: string;
  /** Gap (px) between seats inside the zone grid */
  seatGap?: number;
  seats: Seat[]; // length = rows*cols
  kind: "zone" | "space";
  spaceKind?: SpaceKind;
  /** id of a parent space-group containing this element */
  parentId?: string;
}

export interface Floor {
  id: string;
  name: string;
  zones: Zone[];
  locked?: boolean;
  bgColor?: string; // optional HSL, overrides theme background
}

export type ThemePreset = "modern" | "blueprint" | "corporate" | "minimal" | "darkpro";

export interface Version {
  id: string;
  date: string;
  label: string;
  data: { floors: Floor[] };
}

export interface FloorPlanState {
  floors: Floor[];
  activeFloorId: string;
  selectedZoneId: string | null;
  selectedZoneIds: string[];
  selectedSeatId: string | null;
  selectedSeatIds: string[];
  collisionDetection: boolean;
  darkMode: boolean;
  heatmap: boolean;
  zoom: number;
  snapToGrid: boolean;
  smartGuides: boolean;
  showLegend: boolean;
  showCompass: boolean;
  showScale: boolean;
  showMiniMap: boolean;
  showGrid: boolean;
  theme: ThemePreset;
  customPalette: string[];
  versions: Version[];
}

export interface ChangeLogEntry {
  id: string;
  date: string;
  action: string;
  details?: string;
}
