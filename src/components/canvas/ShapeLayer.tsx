import { useEffect, useRef, useState } from "react";
import { useActiveFloor, useFloorPlan } from "@/store/floorPlanStore";
import type { Shape, ShapeKind } from "@/types/floorplan";

const PX_PER_M = 100; // 100 px = 1 m
const SNAP = 10;

const snap = (n: number, on: boolean) => (on ? Math.round(n / SNAP) * SNAP : n);
const fmtMeters = (px: number) => `${(px / PX_PER_M).toFixed(2)} m`;

interface Props {
  zoom: number;
}

export function ShapeLayer({ zoom }: Props) {
  const floor = useActiveFloor();
  const tool = useFloorPlan((s) => s.drawingTool);
  const setTool = useFloorPlan((s) => s.setDrawingTool);
  const addShape = useFloorPlan((s) => s.addShape);
  const updateShape = useFloorPlan((s) => s.updateShape);
  const removeShape = useFloorPlan((s) => s.removeShape);
  const selectedShapeId = useFloorPlan((s) => s.selectedShapeId);
  const selectShape = useFloorPlan((s) => s.selectShape);
  const snapToGrid = useFloorPlan((s) => s.snapToGrid);

  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const shapes = floor.shapes ?? [];

  // Delete key when a shape is selected
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable) return;
      if (e.key === "Shift") setShiftHeld(true);
      if (e.key === "Escape") { setTool(null); selectShape(null); setDraft(null); }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedShapeId) {
        e.preventDefault();
        removeShape(selectedShapeId);
      }
    };
    const onUp = (e: KeyboardEvent) => { if (e.key === "Shift") setShiftHeld(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onUp); };
  }, [selectedShapeId, removeShape, setTool, selectShape]);

  const toLocal = (e: React.MouseEvent | MouseEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  };

  // Snap angle to 0/45/90 when shift held (line-like shapes)
  const angleSnap = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (!len) return { x2, y2 };
    const ang = Math.atan2(dy, dx);
    const step = Math.PI / 4; // 45°
    const snapped = Math.round(ang / step) * step;
    return { x2: x1 + Math.cos(snapped) * len, y2: y1 + Math.sin(snapped) * len };
  };

  const onSvgDown = (e: React.MouseEvent) => {
    if (!tool) return;
    e.stopPropagation();
    const { x, y } = toLocal(e);
    const sx = snap(x, snapToGrid), sy = snap(y, snapToGrid);
    setDraft({
      id: "draft",
      kind: tool,
      x1: sx, y1: sy, x2: sx, y2: sy,
    });
  };

  useEffect(() => {
    if (!draft) return;
    const onMove = (e: MouseEvent) => {
      const { x, y } = toLocal(e);
      let x2 = snap(x, snapToGrid), y2 = snap(y, snapToGrid);
      if (shiftHeld && draft.kind !== "rect") {
        const a = angleSnap(draft.x1, draft.y1, x2, y2);
        x2 = a.x2; y2 = a.y2;
      }
      setDraft((d) => (d ? { ...d, x2, y2 } : d));
    };
    const onUp = () => {
      setDraft((d) => {
        if (!d) return null;
        const dx = d.x2 - d.x1, dy = d.y2 - d.y1;
        if (Math.hypot(dx, dy) < 4) return null; // ignore tiny click
        const { id: _id, ...rest } = d;
        addShape(rest);
        return null;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [draft, snapToGrid, shiftHeld, addShape]);

  // Pointer events: only intercept when drawing OR clicking a shape
  const interactive = !!tool;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0"
      width={4000}
      height={3000}
      style={{ pointerEvents: interactive ? "auto" : "none", cursor: tool ? "crosshair" : "default", zIndex: 5 }}
      onMouseDown={onSvgDown}
    >
      {shapes.map((s) => (
        <ShapeRender
          key={s.id}
          shape={s}
          selected={s.id === selectedShapeId}
          onSelect={() => { if (!tool) selectShape(s.id); }}
          onUpdate={(p) => updateShape(s.id, p)}
          snapOn={snapToGrid}
          zoom={zoom}
        />
      ))}
      {draft && <ShapeRender shape={draft} selected isDraft snapOn={snapToGrid} zoom={zoom} />}
    </svg>
  );
}

interface RenderProps {
  shape: Shape;
  selected: boolean;
  isDraft?: boolean;
  onSelect?: () => void;
  onUpdate?: (p: Partial<Shape>) => void;
  snapOn: boolean;
  zoom: number;
}

function ShapeRender({ shape, selected, isDraft, onSelect, onUpdate, snapOn, zoom }: RenderProps) {
  const { kind, x1, y1, x2, y2 } = shape;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
  const stroke = selected ? "hsl(var(--primary))" : "hsl(var(--foreground))";
  const baseProps = {
    onMouseDown: (e: React.MouseEvent) => {
      if (isDraft) return;
      e.stopPropagation();
      onSelect?.();
      // start drag-move
      const startX = e.clientX, startY = e.clientY;
      const ox1 = x1, oy1 = y1, ox2 = x2, oy2 = y2;
      const onMove = (ev: MouseEvent) => {
        const ddx = (ev.clientX - startX) / zoom;
        const ddy = (ev.clientY - startY) / zoom;
        const nx1 = snapOn ? Math.round((ox1 + ddx) / 10) * 10 : ox1 + ddx;
        const ny1 = snapOn ? Math.round((oy1 + ddy) / 10) * 10 : oy1 + ddy;
        const nx2 = snapOn ? Math.round((ox2 + ddx) / 10) * 10 : ox2 + ddx;
        const ny2 = snapOn ? Math.round((oy2 + ddy) / 10) * 10 : oy2 + ddy;
        onUpdate?.({ x1: nx1, y1: ny1, x2: nx2, y2: ny2 });
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    style: { cursor: isDraft ? "crosshair" : "move" },
  };

  // dimension label perpendicular offset
  const ang = Math.atan2(dy, dx);
  const labelOffset = 14;
  const lx = midX - Math.sin(ang) * labelOffset;
  const ly = midY + Math.cos(ang) * labelOffset;

  if (kind === "rect") {
    const x = Math.min(x1, x2), y = Math.min(y1, y2);
    const w = Math.abs(dx), h = Math.abs(dy);
    return (
      <g {...baseProps}>
        <rect
          x={x} y={y} width={w} height={h}
          fill={selected ? "hsl(var(--primary) / 0.08)" : "transparent"}
          stroke={stroke}
          strokeWidth={selected ? 2 : 1.5}
          strokeDasharray={isDraft ? "4 4" : undefined}
        />
        {(selected || isDraft) && (
          <>
            <DimLabel x={x + w / 2} y={y - 6} text={fmtMeters(w)} />
            <DimLabel x={x - 6} y={y + h / 2} text={fmtMeters(h)} anchor="end" />
          </>
        )}
      </g>
    );
  }

  // line / wall / door / window — all line-based
  const thickness =
    kind === "wall" ? 6 :
    kind === "window" ? 6 :
    kind === "door" ? 2 : 2;

  return (
    <g {...baseProps}>
      {/* invisible thick hit area */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={Math.max(12, thickness + 8)} />

      {kind === "wall" && (
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={selected ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
          strokeWidth={thickness} strokeLinecap="butt"
          strokeDasharray={isDraft ? "6 4" : undefined}
        />
      )}

      {kind === "line" && (
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={stroke} strokeWidth={2}
          strokeDasharray={isDraft ? "4 4" : undefined}
        />
      )}

      {kind === "window" && (
        <>
          {/* outer wall band */}
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={thickness} />
          {/* inner glass line */}
          <line
            x1={x1 + Math.sin(ang) * 1.5} y1={y1 - Math.cos(ang) * 1.5}
            x2={x2 + Math.sin(ang) * 1.5} y2={y2 - Math.cos(ang) * 1.5}
            stroke="hsl(var(--background))" strokeWidth={2}
          />
        </>
      )}

      {kind === "door" && (
        <>
          {/* hinge line (door panel) */}
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={2} />
          {/* swing arc */}
          <path
            d={`M ${x2} ${y2} A ${len} ${len} 0 0 1 ${x1 + Math.cos(ang - Math.PI / 2) * len} ${y1 + Math.sin(ang - Math.PI / 2) * len}`}
            fill="none" stroke={stroke} strokeWidth={1} strokeDasharray="3 3"
          />
          {/* hinge dot */}
          <circle cx={x1} cy={y1} r={3} fill={stroke} />
        </>
      )}

      {(selected || isDraft) && len > 6 && (
        <DimLabel x={lx} y={ly} text={fmtMeters(len)} />
      )}

      {/* endpoint handles */}
      {selected && !isDraft && (
        <>
          <Handle cx={x1} cy={y1} onDrag={(nx, ny) => onUpdate?.({ x1: nx, y1: ny })} snapOn={snapOn} zoom={zoom} />
          <Handle cx={x2} cy={y2} onDrag={(nx, ny) => onUpdate?.({ x2: nx, y2: ny })} snapOn={snapOn} zoom={zoom} />
        </>
      )}
    </g>
  );
}

function DimLabel({ x, y, text, anchor = "middle" }: { x: number; y: number; text: string; anchor?: "middle" | "end" | "start" }) {
  return (
    <g pointerEvents="none">
      <rect
        x={x - (anchor === "end" ? 52 : anchor === "start" ? 0 : 26)}
        y={y - 9}
        width={52} height={14} rx={3}
        fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth={0.5} opacity={0.95}
      />
      <text
        x={x} y={y + 1}
        fontSize={10} fontFamily="ui-monospace, monospace"
        fill="hsl(var(--foreground))" textAnchor={anchor} dominantBaseline="middle"
      >
        {text}
      </text>
    </g>
  );
}

function Handle({ cx, cy, onDrag, snapOn, zoom }: { cx: number; cy: number; onDrag: (x: number, y: number) => void; snapOn: boolean; zoom: number }) {
  return (
    <circle
      cx={cx} cy={cy} r={5}
      fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={2}
      style={{ cursor: "nwse-resize" }}
      onMouseDown={(e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY;
        const ox = cx, oy = cy;
        const onMove = (ev: MouseEvent) => {
          const nx = ox + (ev.clientX - startX) / zoom;
          const ny = oy + (ev.clientY - startY) / zoom;
          onDrag(snapOn ? Math.round(nx / 10) * 10 : nx, snapOn ? Math.round(ny / 10) * 10 : ny);
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      }}
    />
  );
}
