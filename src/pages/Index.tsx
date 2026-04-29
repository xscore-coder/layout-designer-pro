import { useEffect, useRef, useState } from "react";
import { Toolbar } from "@/components/Toolbar";
import { Canvas, type CanvasHandle } from "@/components/canvas/Canvas";
import { Inspector } from "@/components/Inspector";
import { FloorList, ZoneList } from "@/components/SidePanels";
import { LayersPanel } from "@/components/LayersPanel";
import { useFloorPlan } from "@/store/floorPlanStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PanelLeft, PanelRight } from "lucide-react";

const Index = () => {
  const [search, setSearch] = useState("");
  const canvasRef = useRef<CanvasHandle>(null);
  const saveVersion = useFloorPlan((s) => s.saveVersion);
  const isMobile = useIsMobile();
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const selectedZoneId = useFloorPlan((s) => s.selectedZoneId);
  const selectedSeatId = useFloorPlan((s) => s.selectedSeatId);

  // Auto-save snapshot every 60s
  useEffect(() => {
    const t = setInterval(() => {
      saveVersion(`Auto-save ${new Date().toLocaleTimeString()}`);
    }, 60_000);
    return () => clearInterval(t);
  }, [saveVersion]);

  // On mobile: auto-open inspector when something gets selected
  useEffect(() => {
    if (!isMobile) return;
    if (selectedZoneId || selectedSeatId) setRightOpen(true);
  }, [isMobile, selectedZoneId, selectedSeatId]);

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <Toolbar
        search={search}
        onSearchChange={setSearch}
        getStageEl={() => canvasRef.current?.getStageEl() ?? null}
      />
      <div className="flex-1 flex overflow-hidden relative">
        {/* DESKTOP: persistent sidebars */}
        {!isMobile && (
          <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0 print:hidden">
            <FloorList />
            <ZoneList />
            <LayersPanel />
          </aside>
        )}

        <Canvas ref={canvasRef} searchQuery={search} />

        {!isMobile && (
          <aside className="w-80 border-l border-border bg-card flex flex-col shrink-0 print:hidden overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <Inspector />
            </div>
          </aside>
        )}

        {/* MOBILE: floating buttons + drawer sheets */}
        {isMobile && (
          <>
            <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
              <SheetTrigger asChild>
                <Button
                  size="icon"
                  variant="default"
                  className="fixed bottom-4 left-3 z-30 rounded-full shadow-lg h-12 w-12 print:hidden"
                  aria-label="Open floors and zones panel"
                >
                  <PanelLeft className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0 flex flex-col">
                <SheetHeader className="px-4 py-3 border-b border-border">
                  <SheetTitle>Floors & Zones</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto flex flex-col">
                  <FloorList />
                  <ZoneList />
                  <LayersPanel />
                </div>
              </SheetContent>
            </Sheet>
              <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0 flex flex-col">
                <SheetHeader className="px-4 py-3 border-b border-border">
                  <SheetTitle>Floors & Zones</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto flex flex-col">
                  <FloorList />
                  <ZoneList />
                  <LayersPanel />
                </div>
              </SheetContent>
            </Sheet>

            <Sheet open={rightOpen} onOpenChange={setRightOpen}>
              <SheetTrigger asChild>
                <Button
                  size="icon"
                  variant="default"
                  className="fixed bottom-20 right-3 z-30 rounded-full shadow-lg h-12 w-12 print:hidden"
                  aria-label="Open inspector"
                >
                  <PanelRight className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[90vw] max-w-[360px] p-0 flex flex-col">
                <SheetHeader className="px-4 py-3 border-b border-border">
                  <SheetTitle>Inspector</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto">
                  <Inspector />
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
