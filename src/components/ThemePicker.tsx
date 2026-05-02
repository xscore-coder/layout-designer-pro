import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Palette, Check } from "lucide-react";
import { useFloorPlan } from "@/store/floorPlanStore";
import type { ThemePreset } from "@/types/floorplan";

const THEMES: { id: ThemePreset; name: string; desc: string; preview: string }[] = [
  { id: "modern", name: "Modern", desc: "Clean dashboard look", preview: "bg-slate-50 border-slate-300" },
  { id: "blueprint", name: "Blueprint", desc: "Engineering-style canvas", preview: "bg-blue-900 border-blue-300" },
  { id: "corporate", name: "Corporate", desc: "Subtle dotted grid", preview: "bg-stone-100 border-stone-400" },
  { id: "minimal", name: "Minimal", desc: "Pure white, no grid", preview: "bg-white border-gray-300" },
  { id: "darkpro", name: "Dark Pro", desc: "Premium dark mode", preview: "bg-gray-900 border-gray-600" },
];

export function ThemePicker() {
  const theme = useFloorPlan((s) => s.theme);
  const setTheme = useFloorPlan((s) => s.setTheme);
  const snapToGrid = useFloorPlan((s) => s.snapToGrid);
  const toggleSnap = useFloorPlan((s) => s.toggleSnap);
  const smartGuides = useFloorPlan((s) => s.smartGuides);
  const toggleSmartGuides = useFloorPlan((s) => s.toggleSmartGuides);
  const showLegend = useFloorPlan((s) => s.showLegend);
  const showCompass = useFloorPlan((s) => s.showCompass);
  const showScale = useFloorPlan((s) => s.showScale);
  const showGrid = useFloorPlan((s) => s.showGrid);
  const toggleLegend = useFloorPlan((s) => s.toggleLegend);
  const toggleCompass = useFloorPlan((s) => s.toggleCompass);
  const toggleScale = useFloorPlan((s) => s.toggleScale);
  const toggleGrid = useFloorPlan((s) => s.toggleGrid);
  const renumberZones = useFloorPlan((s) => s.renumberZones);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" title="Theme & view options">
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Canvas Theme</DropdownMenuLabel>
        {THEMES.map((t) => (
          <DropdownMenuItem key={t.id} onClick={() => setTheme(t.id)} className="flex items-center gap-2">
            <span className={`h-5 w-5 rounded border ${t.preview}`} />
            <div className="flex-1">
              <div className="text-sm font-medium">{t.name}</div>
              <div className="text-[10px] text-muted-foreground">{t.desc}</div>
            </div>
            {theme === t.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Editing aids</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={showGrid} onCheckedChange={toggleGrid}>
          Show grid dots
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={snapToGrid} onCheckedChange={toggleSnap}>
          Snap to grid (10px)
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={smartGuides} onCheckedChange={toggleSmartGuides}>
          Smart guides
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Map overlays</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={showLegend} onCheckedChange={toggleLegend}>
          Legend
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={showCompass} onCheckedChange={toggleCompass}>
          North arrow
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={showScale} onCheckedChange={toggleScale}>
          Scale bar
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={renumberZones}>Auto-number zones (Z1, Z2…)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
