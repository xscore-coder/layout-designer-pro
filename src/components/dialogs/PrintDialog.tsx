import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { useFloorPlan, useActiveFloor } from "@/store/floorPlanStore";
import { Loader2, FileDown, ImageDown, Printer } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  getStageEl: () => HTMLDivElement | null;
}

type Paper = "a4l" | "a3l" | "a4p";
const PAPER_MM: Record<Paper, { w: number; h: number; label: string }> = {
  a4l: { w: 297, h: 210, label: "A4 Landscape" },
  a3l: { w: 420, h: 297, label: "A3 Landscape" },
  a4p: { w: 210, h: 297, label: "A4 Portrait" },
};

export function PrintDialog({ open, onOpenChange, getStageEl }: Props) {
  const floor = useActiveFloor();
  const heatmap = useFloorPlan((s) => s.heatmap);
  const [paper, setPaper] = useState<Paper>("a4l");
  const [title, setTitle] = useState("Floor Plan");
  const [subtitle, setSubtitle] = useState(floor.name);
  const [author, setAuthor] = useState("");
  const [watermark, setWatermark] = useState("");
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [busy, setBusy] = useState(false);

  const captureStage = async (scale: number) => {
    const stage = getStageEl();
    if (!stage) throw new Error("Canvas not ready");

    // Compute bounding box of zones
    const zones = floor.zones;
    if (zones.length === 0) throw new Error("Nothing to export — add zones first.");
    const minX = Math.max(0, Math.min(...zones.map((z) => z.x)) - 40);
    const minY = Math.max(0, Math.min(...zones.map((z) => z.y)) - 40);
    const maxX = Math.max(...zones.map((z) => z.x + z.width)) + 40;
    const maxY = Math.max(...zones.map((z) => z.y + z.height)) + 40;
    const width = Math.ceil(maxX - minX);
    const height = Math.ceil(maxY - minY);

    // Temporarily reset transform for clean capture
    const prevTransform = stage.style.transform;
    stage.style.transform = "none";

    const dataUrl = await toPng(stage, {
      backgroundColor: "#ffffff",
      width,
      height,
      pixelRatio: scale,
      style: {
        transform: `translate(${-minX}px, ${-minY}px)`,
        width: `${width}px`,
        height: `${height}px`,
      },
    });

    stage.style.transform = prevTransform;
    return { dataUrl, width, height };
  };

  const exportPNG = async () => {
    setBusy(true);
    try {
      const { dataUrl } = await captureStage(3); // ~4K-ish
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${title.replace(/\s+/g, "_")}_${Date.now()}.png`;
      a.click();
      toast.success("PNG exported (high-resolution)");
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const exportPDF = async () => {
    setBusy(true);
    try {
      const { dataUrl, width, height } = await captureStage(2.5);
      const { w: pageWmm, h: pageHmm } = PAPER_MM[paper];
      const orientation = pageWmm > pageHmm ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
      // override format for A3
      if (paper === "a3l") (pdf as any).internal.pageSize = { ...(pdf as any).internal.pageSize, width: pageWmm, height: pageHmm };

      // margins
      const margin = 10;
      const headerH = showHeader ? 14 : 0;
      const footerH = showFooter ? 10 : 0;
      const availW = pageWmm - margin * 2;
      const availH = pageHmm - margin * 2 - headerH - footerH;

      const ratio = width / height;
      let drawW = availW;
      let drawH = drawW / ratio;
      if (drawH > availH) {
        drawH = availH;
        drawW = drawH * ratio;
      }
      const drawX = (pageWmm - drawW) / 2;
      const drawY = margin + headerH + (availH - drawH) / 2;

      // Header
      if (showHeader) {
        pdf.setFillColor(245, 247, 250);
        pdf.rect(margin, margin, pageWmm - margin * 2, headerH, "F");
        pdf.setFontSize(14);
        pdf.setTextColor(20, 30, 50);
        pdf.text(title, margin + 4, margin + 6);
        pdf.setFontSize(9);
        pdf.setTextColor(100, 110, 130);
        pdf.text(subtitle, margin + 4, margin + 11);
        pdf.setFontSize(8);
        const right = `${new Date().toLocaleDateString()}${author ? ` • ${author}` : ""}`;
        pdf.text(right, pageWmm - margin - 4, margin + 6, { align: "right" });
        pdf.text(`Floor: ${floor.name} • ${floor.zones.length} zone(s)`, pageWmm - margin - 4, margin + 11, { align: "right" });
      }

      // Image
      pdf.addImage(dataUrl, "PNG", drawX, drawY, drawW, drawH, undefined, "FAST");

      // Watermark
      if (watermark.trim()) {
        pdf.saveGraphicsState();
        // @ts-ignore
        pdf.setGState(new (pdf as any).GState({ opacity: 0.08 }));
        pdf.setFontSize(80);
        pdf.setTextColor(0, 0, 0);
        pdf.text(watermark, pageWmm / 2, pageHmm / 2, {
          align: "center",
          angle: 30,
        });
        pdf.restoreGraphicsState();
      }

      // Footer
      if (showFooter) {
        pdf.setDrawColor(220, 225, 232);
        pdf.line(margin, pageHmm - margin - footerH + 2, pageWmm - margin, pageHmm - margin - footerH + 2);
        pdf.setFontSize(8);
        pdf.setTextColor(120, 130, 150);
        pdf.text("Generated with FloorForge", margin, pageHmm - margin - 2);
        pdf.text(`Page 1 / 1`, pageWmm - margin, pageHmm - margin - 2, { align: "right" });
        if (heatmap) pdf.text("Heatmap mode", pageWmm / 2, pageHmm - margin - 2, { align: "center" });
      }

      pdf.save(`${title.replace(/\s+/g, "_")}_${Date.now()}.pdf`);
      toast.success(`PDF exported (${PAPER_MM[paper].label})`);
    } catch (e: any) {
      toast.error(e.message ?? "PDF export failed");
    } finally {
      setBusy(false);
    }
  };

  const printPreview = () => window.print();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Print & Export</DialogTitle>
          <DialogDescription>High-resolution PDF/PNG with header, footer & watermark.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Paper size</Label>
              <Select value={paper} onValueChange={(v) => setPaper(v as Paper)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAPER_MM).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Author</Label>
              <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Subtitle</Label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div>
            <Label>Watermark (optional)</Label>
            <Input value={watermark} onChange={(e) => setWatermark(e.target.value)} placeholder="e.g. CONFIDENTIAL" />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={showHeader} onCheckedChange={setShowHeader} id="hdr" />
              <Label htmlFor="hdr" className="cursor-pointer">Header</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={showFooter} onCheckedChange={setShowFooter} id="ftr" />
              <Label htmlFor="ftr" className="cursor-pointer">Footer</Label>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <Button onClick={exportPDF} disabled={busy} className="bg-gradient-primary">
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
              PDF
            </Button>
            <Button onClick={exportPNG} disabled={busy} variant="outline">
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ImageDown className="h-4 w-4 mr-1" />}
              PNG 4K
            </Button>
            <Button onClick={printPreview} disabled={busy} variant="outline">
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
