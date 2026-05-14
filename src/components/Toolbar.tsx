import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useFloorPlan } from "@/store/floorPlanStore";
import {
  Plus, Square, Combine, History, FileBarChart, Download,
  Upload, Undo2, Redo2, Moon, Sun, Flame, LayoutGrid, Trash2, FileSpreadsheet, Printer, ShieldAlert,
  Group, LayoutTemplate, Save, LayoutDashboard, Eraser,
  MousePointer2, Minus, RectangleHorizontal, DoorOpen, AppWindow, Slash,
} from "lucide-react";
import { AddZoneDialog } from "./dialogs/AddZoneDialog";
import { AddSpaceDialog } from "./dialogs/AddSpaceDialog";
import { MergeZonesDialog } from "./dialogs/MergeZonesDialog";
import { ReportDialog } from "./dialogs/ReportDialog";
import { HistoryDrawer } from "./dialogs/HistoryDrawer";
import { PrintDialog } from "./dialogs/PrintDialog";
import { VersionsDialog } from "./dialogs/VersionsDialog";
import { TemplatesDialog } from "./dialogs/TemplatesDialog";
import { DashboardDialog } from "./dialogs/DashboardDialog";
import { ImportMergeDialog, type IncomingRow } from "./dialogs/ImportMergeDialog";
import { NotificationsBell } from "./NotificationsBell";
import { ThemePicker } from "./ThemePicker";
import { toast } from "sonner";
import Papa from "papaparse";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import vodafoneLogo from "@/assets/vodafone-logo.png";

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
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [mergeImportOpen, setMergeImportOpen] = useState(false);
  const [pendingRows, setPendingRows] = useState<IncomingRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const undo = useFloorPlan((s) => s.undo);
  const redo = useFloorPlan((s) => s.redo);
  const darkMode = useFloorPlan((s) => s.darkMode);
  const toggleDark = useFloorPlan((s) => s.toggleDark);
  const heatmap = useFloorPlan((s) => s.heatmap);
  const toggleHeatmap = useFloorPlan((s) => s.toggleHeatmap);
  const collisionDetection = useFloorPlan((s) => s.collisionDetection);
  const toggleCollision = useFloorPlan((s) => s.toggleCollision);
  // importPCs handled via Smart-Merge dialog (importPCsSelective)
  const reset = useFloorPlan((s) => s.reset);
  const floors = useFloorPlan((s) => s.floors);
  const loadJSON = useFloorPlan((s) => s.loadFromJSON);
  const groupSelected = useFloorPlan((s) => s.groupSelectedAsSpace);
  const selectedZoneIds = useFloorPlan((s) => s.selectedZoneIds);
  const saveVersion = useFloorPlan((s) => s.saveVersion);
  const ensureDailySnapshot = useFloorPlan((s) => s.ensureDailySnapshot);
  const activeFloorId = useFloorPlan((s) => s.activeFloorId);
  const updateFloor = useFloorPlan((s) => s.updateFloor);
  const drawingTool = useFloorPlan((s) => s.drawingTool);
  const setDrawingTool = useFloorPlan((s) => s.setDrawingTool);

  // Daily auto-snapshot on app load (one per calendar day)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (ensureDailySnapshot()) {
          toast.success("Daily snapshot saved", { description: new Date().toLocaleDateString() });
        }
      } catch { /* ignore */ }
    }, 800);
    return () => clearTimeout(t);
  }, [ensureDailySnapshot]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ floors }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `floorplan-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported JSON");
  };

  const exportExcel = () => {
    const rows = [["Floor", "Zone", "PC", "Lock Number", "Type", "Has Problem", "Problems", "Notes", "Wasla SCT Feedback", "Last Update"]];
    floors.forEach((f) => f.zones.forEach((z) => z.kind === "zone" && z.seats.forEach((s) => {
      rows.push([
        f.name, z.name, s.pcNumber, s.lockNumber ?? "", s.type,
        s.hasProblem ? "Yes" : "No",
        String(s.problemCount), s.note ?? "", s.waslaSctFeedback ?? "", s.lastUpdate ?? "",
      ]);
    })));
    const csv = Papa.unparse(rows);
    // UTF-8 BOM so Excel renders Arabic correctly
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url; a.download = `PC Problem - ${today}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  const onImport = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows: IncomingRow[] = (res.data as Record<string, string>[]).map((r) => {
          const pc = r.pc ?? r.PC ?? r.pc_number ?? r["PC Number"] ?? r.computer ?? Object.values(r)[0];
          const problems = parseInt(r.problems ?? r.Problems ?? r.issues ?? "0", 10) || 0;
          const agent = r.agent ?? r.Agent ?? r.name ?? r.Name;
          const shift = (r.shift ?? r.Shift)?.toLowerCase();
          return { pc: String(pc).trim(), problems, agent, shift };
        }).filter((r) => r.pc);
        if (!rows.length) {
          toast.error("No valid rows found in CSV");
          return;
        }
        setPendingRows(rows);
        setMergeImportOpen(true);
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
      <div className="h-14 border-b border-border bg-card/70 backdrop-blur-xl flex items-center gap-1 px-2 sm:px-3 shrink-0 z-10 shadow-sm flex-nowrap min-w-0">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mr-2 sm:mr-3 shrink-0">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-primary opacity-30 blur-md rounded-full" />
            <img src={vodafoneLogo} alt="Vodafone" className="relative h-9 w-9 object-contain" />
          </div>
          <div className="hidden md:flex flex-col leading-tight">
            <h1 className="font-bold text-sm tracking-tight">Vodafone Floor</h1>
            <span className="text-[10px] text-muted-foreground font-medium">Workspace Planner</span>
          </div>
        </div>

        <div className="h-7 w-px bg-border mx-1" />

        {/* Create group */}
        <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-0.5 shrink-0">
          <Button size="sm" onClick={() => setZoneOpen(true)} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-sm h-8">
            <Plus className="h-4 w-4 mr-1" /> Zone
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSpaceOpen(true)} className="h-8">
            <Square className="h-4 w-4 mr-1" /> Space
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMergeOpen(true)} className="h-8">
            <Combine className="h-4 w-4 mr-1" /> Merge
          </Button>
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" disabled={selectedZoneIds.length < 1} className="h-8"
              onClick={() => { groupSelected(); toast.success("Grouped"); }}>
              <Group className="h-4 w-4 mr-1" /> Group
            </Button>
          </TooltipTrigger><TooltipContent>Group selected into a Space</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" onClick={() => setTemplatesOpen(true)} className="h-8">
              <LayoutTemplate className="h-4 w-4 mr-1" /> Templates
            </Button>
          </TooltipTrigger><TooltipContent>Insert pre-built layout</TooltipContent></Tooltip>
        </div>

        <div className="h-7 w-px bg-border mx-1" />

        {/* History group */}
        <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 p-0.5 shrink-0">
          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={undo} className="h-8 w-8"><Undo2 className="h-4 w-4" /></Button>
          </TooltipTrigger><TooltipContent>Undo (Ctrl+Z)</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={redo} className="h-8 w-8"><Redo2 className="h-4 w-4" /></Button>
          </TooltipTrigger><TooltipContent>Redo (Ctrl+Y)</TooltipContent></Tooltip>
        </div>

        <div className="h-7 w-px bg-border mx-1" />

        <Tooltip><TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
            onClick={() => { setClearConfirmText(""); setClearOpen(true); }}
          >
            <Eraser className="h-4 w-4 mr-1" /> Clear Grid
          </Button>
        </TooltipTrigger><TooltipContent>Remove all zones & spaces from the active floor</TooltipContent></Tooltip>


        <div className="ml-auto flex items-center gap-1">
          {/* View toggles */}
          <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 p-0.5 shrink-0">
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant={heatmap ? "default" : "ghost"} onClick={toggleHeatmap} className="h-8 w-8">
                <Flame className="h-4 w-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Heatmap</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant={collisionDetection ? "default" : "ghost"} onClick={toggleCollision} className="h-8 w-8">
                <ShieldAlert className="h-4 w-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Collision detection</TooltipContent></Tooltip>
          </div>

          {/* Save / Versions */}
          <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 p-0.5 shrink-0">
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={() => { saveVersion(); toast.success("Snapshot saved"); }} className="h-8 w-8">
                <Save className="h-4 w-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Save snapshot</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={() => setVersionsOpen(true)} className="h-8 w-8">
                <History className="h-4 w-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Versions</TooltipContent></Tooltip>

            <NotificationsBell />
          </div>

          {/* Reports */}
          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={() => setDashboardOpen(true)} className="h-8 w-8">
              <LayoutDashboard className="h-4 w-4" />
            </Button>
          </TooltipTrigger><TooltipContent>Dashboard</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={() => setReportOpen(true)} className="h-8 w-8">
              <FileBarChart className="h-4 w-4" />
            </Button>
          </TooltipTrigger><TooltipContent>Weekly Report</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="default" className="bg-gradient-primary text-primary-foreground shadow-sm hover:shadow-md transition-shadow h-8 w-8" onClick={() => setPrintOpen(true)}>
              <Printer className="h-4 w-4" />
            </Button>
          </TooltipTrigger><TooltipContent>Print / Export PDF</TooltipContent></Tooltip>

          <ThemePicker />

          {/* IO group */}
          <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 p-0.5 shrink-0">
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={() => fileRef.current?.click()} className="h-8 w-8">
                <Upload className="h-4 w-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Import CSV (PC problems)</TooltipContent></Tooltip>
            <input ref={fileRef} type="file" accept=".csv,.txt" hidden
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />

            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={exportJSON} className="h-8 w-8">
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Export JSON</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={exportExcel} className="h-8 w-8">
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Export CSV</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={() => jsonRef.current?.click()} className="h-8 w-8">
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Load JSON</TooltipContent></Tooltip>
            <input ref={jsonRef} type="file" accept=".json" hidden
              onChange={(e) => e.target.files?.[0] && onLoadJSON(e.target.files[0])} />
          </div>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={toggleDark} className="h-8 w-8">
              {darkMode ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger><TooltipContent>Toggle dark mode</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={() => setResetOpen(true)} className="h-8 w-8 hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </TooltipTrigger><TooltipContent>Reset all (delete every floor)</TooltipContent></Tooltip>
        </div>
      </div>

      <AddZoneDialog open={zoneOpen} onOpenChange={setZoneOpen} />
      <AddSpaceDialog open={spaceOpen} onOpenChange={setSpaceOpen} />
      <MergeZonesDialog open={mergeOpen} onOpenChange={setMergeOpen} />
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} />
      <HistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} />
      <PrintDialog open={printOpen} onOpenChange={setPrintOpen} getStageEl={getStageEl} />
      <VersionsDialog open={versionsOpen} onOpenChange={setVersionsOpen} />
      <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />
      <DashboardDialog open={dashboardOpen} onOpenChange={setDashboardOpen} />
      <ImportMergeDialog
        open={mergeImportOpen}
        onOpenChange={setMergeImportOpen}
        rows={pendingRows}
      />

      {/* Clear Grid confirmation — wipes ALL floors, zones, spaces, seats */}
      {(() => {
        const totalFloors = floors.length;
        const totalZones = floors.reduce((a, f) => a + f.zones.filter((z) => z.kind === "zone").length, 0);
        const totalSpaces = floors.reduce((a, f) => a + f.zones.filter((z) => z.kind === "space").length, 0);
        const totalSeats = floors.reduce(
          (a, f) => a + f.zones.reduce((b, z) => b + (z.kind === "zone" ? z.seats.length : 0), 0),
          0
        );
        const CONFIRM_WORD = "CLEAR";
        const matches = clearConfirmText.trim().toUpperCase() === CONFIRM_WORD;
        return (
          <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-5 w-5" /> Clear Grid — تأكيد نهائي
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>
                      أنت على وشك حذف <span className="font-semibold text-foreground">كل الأدوار والزونات والـ Spaces والمقاعد</span>.
                      هذا الإجراء لا يمكن التراجع عنه إلا عبر Undo.
                    </p>

                    <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Floors</span>
                        <span className="font-mono text-foreground">{totalFloors}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Zones</span>
                        <span className="font-mono text-foreground">{totalZones}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Spaces</span>
                        <span className="font-mono text-foreground">{totalSpaces}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Seats</span>
                        <span className="font-mono text-destructive font-semibold">{totalSeats}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs">
                        لتأكيد الحذف، اكتب{" "}
                        <span className="font-mono font-semibold text-foreground">{CONFIRM_WORD}</span>
                      </p>
                      <Input
                        value={clearConfirmText}
                        onChange={(e) => setClearConfirmText(e.target.value)}
                        placeholder={CONFIRM_WORD}
                        className="font-mono"
                        autoFocus
                      />
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!matches}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  onClick={() => {
                    if (!matches) return;
                    reset();
                    toast.success("Cleared all floors & elements");
                    setClearConfirmText("");
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Clear Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}

      {/* Reset all confirmation */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Reset Everything?
            </AlertDialogTitle>
            <AlertDialogDescription>
              هذا سيحذف <span className="font-semibold text-foreground">كل الأدوار، الزونات، والـ Spaces</span> ويرجّع التطبيق لحالته الافتراضية.
              لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { reset(); toast.success("Reset complete"); }}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Reset All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
