import { useRef, useState } from "react";
import { Toolbar } from "@/components/Toolbar";
import { Canvas, type CanvasHandle } from "@/components/canvas/Canvas";
import { Inspector } from "@/components/Inspector";
import { FloorList, ZoneList } from "@/components/SidePanels";

const Index = () => {
  const [search, setSearch] = useState("");
  const canvasRef = useRef<CanvasHandle>(null);

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <Toolbar
        search={search}
        onSearchChange={setSearch}
        getStageEl={() => canvasRef.current?.getStageEl() ?? null}
      />
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0 print:hidden">
          <FloorList />
          <ZoneList />
        </aside>

        <Canvas ref={canvasRef} searchQuery={search} />

        <aside className="w-80 border-l border-border bg-card flex flex-col shrink-0 print:hidden">
          <Inspector />
        </aside>
      </div>
    </div>
  );
};

export default Index;
