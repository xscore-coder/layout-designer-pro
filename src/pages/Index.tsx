import { useState } from "react";
import { Toolbar } from "@/components/Toolbar";
import { Canvas } from "@/components/canvas/Canvas";
import { Inspector } from "@/components/Inspector";
import { FloorList, ZoneList } from "@/components/SidePanels";

const Index = () => {
  const [search, setSearch] = useState("");

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <Toolbar search={search} onSearchChange={setSearch} />
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar: floors + zones */}
        <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0">
          <FloorList />
          <ZoneList />
        </aside>

        {/* Canvas */}
        <Canvas searchQuery={search} />

        {/* Right inspector */}
        <aside className="w-80 border-l border-border bg-card flex flex-col shrink-0">
          <Inspector />
        </aside>
      </div>
    </div>
  );
};

export default Index;
