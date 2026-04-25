import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFloorPlan } from "@/store/floorPlanStore";
import { Palette, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "221 83% 53%", "271 76% 53%", "199 89% 48%", "142 71% 45%",
  "38 92% 50%", "340 82% 52%", "173 80% 40%", "0 75% 55%",
  "262 83% 58%", "31 95% 50%", "189 94% 43%", "159 64% 51%",
  "215 16% 65%", "220 13% 30%", "220 13% 91%", "0 0% 100%",
];

const parseHsl = (s: string): [number, number, number] => {
  const m = s.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  return m ? [+m[1], +m[2], +m[3]] : [220, 50, 50];
};
const fmtHsl = (h: number, s: number, l: number) => `${h} ${s}% ${l}%`;

interface Props {
  /** current primary color HSL string */
  value: string;
  onChange: (color: string) => void;
  gradientTo?: string;
  onGradientChange?: (g: string | undefined) => void;
  fillMode?: "solid" | "gradient";
  onFillModeChange?: (m: "solid" | "gradient") => void;
  borderColor?: string;
  onBorderChange?: (b: string | undefined) => void;
  opacity?: number;
  onOpacityChange?: (o: number) => void;
  /** Compact swatch trigger only (for inline use) */
  compact?: boolean;
  label?: string;
}

export function ColorPicker({
  value, onChange, gradientTo, onGradientChange,
  fillMode = "solid", onFillModeChange,
  borderColor, onBorderChange,
  opacity = 1, onOpacityChange,
  compact, label,
}: Props) {
  const customPalette = useFloorPlan((s) => s.customPalette);
  const addPaletteColor = useFloorPlan((s) => s.addPaletteColor);
  const removePaletteColor = useFloorPlan((s) => s.removePaletteColor);
  const [editing, setEditing] = useState<"primary" | "gradient" | "border">("primary");

  const target =
    editing === "primary" ? value :
    editing === "gradient" ? (gradientTo ?? value) :
    (borderColor ?? value);

  const setTarget = (c: string) => {
    if (editing === "primary") onChange(c);
    else if (editing === "gradient") onGradientChange?.(c);
    else onBorderChange?.(c);
  };

  const [h, s, l] = parseHsl(target);

  const swatchPreview = fillMode === "gradient" && gradientTo
    ? `linear-gradient(135deg, hsl(${value}), hsl(${gradientTo}))`
    : `hsl(${value})`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {compact ? (
          <button
            className="h-7 w-7 rounded-md border-2 border-border shrink-0 transition-transform hover:scale-110 shadow-sm"
            style={{ background: swatchPreview }}
            title={label ?? "Color"}
          />
        ) : (
          <Button variant="outline" size="sm" className="h-9 w-full justify-start gap-2">
            <span
              className="h-5 w-5 rounded-sm border border-border"
              style={{ background: swatchPreview }}
            />
            <span className="text-xs font-mono opacity-80">hsl({value})</span>
            <Palette className="h-3.5 w-3.5 ml-auto opacity-60" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        {/* Mode tabs */}
        {onFillModeChange && (
          <Tabs value={fillMode} onValueChange={(v) => onFillModeChange(v as "solid" | "gradient")}>
            <TabsList className="grid grid-cols-2 h-8 mb-2">
              <TabsTrigger value="solid" className="text-xs">Solid</TabsTrigger>
              <TabsTrigger value="gradient" className="text-xs">Gradient</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Channel selector when gradient/border are available */}
        {(onGradientChange || onBorderChange) && (
          <div className="flex gap-1 mb-2">
            <button
              onClick={() => setEditing("primary")}
              className={cn(
                "flex-1 text-[10px] px-2 py-1 rounded border-2 font-semibold uppercase",
                editing === "primary" ? "border-ring" : "border-transparent bg-muted"
              )}
            >Fill</button>
            {fillMode === "gradient" && onGradientChange && (
              <button
                onClick={() => setEditing("gradient")}
                className={cn(
                  "flex-1 text-[10px] px-2 py-1 rounded border-2 font-semibold uppercase",
                  editing === "gradient" ? "border-ring" : "border-transparent bg-muted"
                )}
              >Gradient</button>
            )}
            {onBorderChange && (
              <button
                onClick={() => setEditing("border")}
                className={cn(
                  "flex-1 text-[10px] px-2 py-1 rounded border-2 font-semibold uppercase",
                  editing === "border" ? "border-ring" : "border-transparent bg-muted"
                )}
              >Border</button>
            )}
          </div>
        )}

        {/* Preview */}
        <div className="h-12 rounded-md border-2 border-border mb-3" style={{ background: swatchPreview, opacity }} />

        {/* Presets */}
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Presets</Label>
        <div className="grid grid-cols-8 gap-1 my-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setTarget(c)}
              className={cn(
                "h-6 w-6 rounded border-2 transition-transform hover:scale-110",
                target === c ? "border-ring shadow-md" : "border-border/40"
              )}
              style={{ backgroundColor: `hsl(${c})` }}
            />
          ))}
        </div>

        {/* Custom palette */}
        {customPalette.length > 0 && (
          <>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Saved</Label>
            <div className="grid grid-cols-8 gap-1 my-2">
              {customPalette.map((c) => (
                <div key={c} className="relative group">
                  <button
                    onClick={() => setTarget(c)}
                    className={cn(
                      "h-6 w-6 rounded border-2 transition-transform hover:scale-110",
                      target === c ? "border-ring" : "border-border/40"
                    )}
                    style={{ backgroundColor: `hsl(${c})` }}
                  />
                  <button
                    onClick={() => removePaletteColor(c)}
                    className="absolute -top-1 -right-1 h-3 w-3 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* HSL Sliders */}
        <div className="space-y-2 mt-2">
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>Hue</span><span>{h}°</span></div>
            <Slider value={[h]} max={360} step={1} onValueChange={(v) => setTarget(fmtHsl(v[0], s, l))} />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>Saturation</span><span>{s}%</span></div>
            <Slider value={[s]} max={100} step={1} onValueChange={(v) => setTarget(fmtHsl(h, v[0], l))} />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>Lightness</span><span>{l}%</span></div>
            <Slider value={[l]} max={100} step={1} onValueChange={(v) => setTarget(fmtHsl(h, s, v[0]))} />
          </div>
          {onOpacityChange && (
            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground"><span>Opacity</span><span>{Math.round(opacity * 100)}%</span></div>
              <Slider value={[opacity * 100]} max={100} step={1} onValueChange={(v) => onOpacityChange(v[0] / 100)} />
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-3">
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-8 text-xs font-mono"
            placeholder="220 50% 50%"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 shrink-0"
            onClick={() => addPaletteColor(target)}
            title="Save to palette"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
