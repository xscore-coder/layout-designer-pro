import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFloorPlan } from "@/store/floorPlanStore";
import {
  Plus, Square, Combine, History, FileBarChart, Search, Download,
  Upload, Undo2, Redo2, Moon, Sun, Flame, LayoutGrid, Trash2, FileSpreadsheet, Printer,
} from "lucide-react";
import { AddZoneDialog } from "./dialogs/AddZoneDialog";
import { AddSpaceDialog } from "./dialogs/AddSpaceDialog";
import { MergeZonesDialog } from "./dialogs/MergeZonesDialog";
import { ReportDialog } from "./dialogs/ReportDialog";
import { HistoryDrawer } from "./dialogs/HistoryDrawer";
import { PrintDialog } from "./dialogs/PrintDialog";
import { ThemePicker } from "./ThemePicker";
import { toast } from "sonner";
import Papa from "papaparse";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  getStageEl: () => HTMLDivElement | null;
}

export function Toolbar({ search, onSearchChange, getStageEl }: Props) {
  const [zoneOpen, setZoneOpen] = useState(false);
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const undo = useFloorPlan((s) => s.undo);
  const redo = useFloorPlan((s) => s.redo);
  const darkMode = useFloorPlan((s) => s.darkMode);
  const toggleDark = useFloorPlan((s) => s.toggleDark);
  const heatmap = useFloorPlan((s) => s.heatmap);
  const toggleHeatmap = useFloorPlan((s) => s.toggleHeatmap);
  const importPCs = useFloorPlan((s) => s.importPCs);
  const reset = useFloorPlan((s) => s.reset);
  const floors = useFloorPlan((s) => s.floors);
  const loadJSON = useFloorPlan((s) => s.loadFromJSON);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ floors }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `floorplan-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported JSON");
  };

  const exportExcel = () => {
    const rows = [["Floor", "Zone", "PC", "Type", "Agent", "Shift", "Team", "Problems"]];
    floors.forEach((f) => f.zones.forEach((z) => z.kind === "zone" && z.seats.forEach((s) => {
      rows.push([
        f.name, z.name, s.pcNumber, s.type,
        s.agentName ?? "", s.shift ?? "", s.team ?? "",
        String(s.problemCount),
      ]);
    })));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `seats-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  const onImport = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = (res.data as Record<string, string>[]).map((r) => {
          const pc = r.pc ?? r.PC ?? r.pc_number ?? r["PC Number"] ?? r.computer ?? Object.values(r)[0];
          const problems = parseInt(r.problems ?? r.Problems ?? r.issues ?? "0", 10) || 0;
          const agent = r.agent ?? r.Agent ?? r.name ?? r.Name;
          const shift = (r.shift ?? r.Shift)?.toLowerCase() as any;
          return { pc: String(pc).trim(), problems, agent, shift };
        }).filter((r) => r.pc);
        importPCs(rows);
        toast.success(`Imported ${rows.length} rows`);
      },
      error: () => toast.error("Failed to parse CSV"),
    });
  };

  const onLoadJSON = (file: File) => {
    file.text().then((t) => {
      try {
        const data = JSON.parse(t);
        if (!data.floors) throw new Error();
        loadJSON(data);
        toast.success("Loaded JSON");
      } catch {
        toast.error("Invalid JSON file");
      }
    });
  };

  return (
    <>
      <div className="h-14 border-b border-border bg-card/80 backdrop-blur flex items-center gap-1 px-3 shrink-0 z-10">
        <div className="flex items-center gap-2 mr-3">
          <div className="h-7 w-7 rounded-lg bg-gradient-primary shadow-glow" />
          <h1 className="font-bold text-sm hidden md:block">FloorForge</h1>
        </div>

        <div className="h-6 w-px bg-border mx-1" />

        <Button size="sm" onClick={() => setZoneOpen(true)} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4 mr-1" /> Zone
        </Button>
        <Button size="sm" variant="outline" onClick={() => setSpaceOpen(true)}>
          <Square className="h-4 w-4 mr-1" /> Space
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMergeOpen(true)}>
          <Combine className="h-4 w-4 mr-1" /> Merge
        </Button>

        <div className="h-6 w-px bg-border mx-1" />

        <Tooltip><TooltipTrigger asChild>
          <Button size="icon" variant="ghost" onClick={undo}><Undo2 className="h-4 w-4" /></Button>
        </TooltipTrigger><TooltipContent>Undo (Ctrl+Z)</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild>
          <Button size="icon" variant="ghost" onClick={redo}><Redo2 className="h-4 w-4" /></Button>
        </TooltipTrigger><TooltipContent>Redo (Ctrl+Y)</TooltipContent></Tooltip>

        <div className="h-6 w-px bg-border mx-1" />

        <div className="relative w-44 hidden md:block">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search PC / agent…"
            className="h-8 pl-7 text-xs"
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant={heatmap ? "default" : "ghost"} onClick={toggleHeatmap}>
              <Flame className="h-4 w-4" />
            </Button>
          </TooltipTrigger><TooltipContent>Heatmap</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={() => setHistoryOpen(true)}>
              <History className="h-4 w-4" />
            </Button>
          </TooltipTrigger><TooltipContent>Change history</TooltipContent></Tooltip>

          <Button size="sm" variant="ghost" onClick={() => setReportOpen(true)}>
            <FileBarChart className="h-4 w-4 mr-1" /> Report
          </Button>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" />
            </Button>
          </TooltipTrigger><TooltipContent>Import CSV (PC problems)</TooltipContent></Tooltip>
          <input ref={fileRef} type="file" accept=".csv,.txt" hidden
            onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={exportJSON}>
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger><TooltipContent>Export JSON</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={exportExcel}>
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
          </TooltipTrigger><TooltipContent>Export CSV</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={() => jsonRef.current?.click()}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </TooltipTrigger><TooltipContent>Load JSON</TooltipContent></Tooltip>
          <input ref={jsonRef} type="file" accept=".json" hidden
            onChange={(e) => e.target.files?.[0] && onLoadJSON(e.target.files[0])} />

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={toggleDark}>
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger><TooltipContent>Toggle dark mode</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost"
              onClick={() => { if (confirm("Reset everything?")) reset(); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </TooltipTrigger><TooltipContent>Reset all</TooltipContent></Tooltip>
        </div>
      </div>

      <AddZoneDialog open={zoneOpen} onOpenChange={setZoneOpen} />
      <AddSpaceDialog open={spaceOpen} onOpenChange={setSpaceOpen} />
      <MergeZonesDialog open={mergeOpen} onOpenChange={setMergeOpen} />
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} />
      <HistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} />
    </>
  );
}
