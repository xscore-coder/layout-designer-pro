import { useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer, Copy, ExternalLink } from "lucide-react";
import type { Seat, Zone } from "@/types/floorplan";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  zone: Zone;
  seat: Seat;
}

export function QRCodeDialog({ open, onOpenChange, zone, seat }: Props) {
  const url = useMemo(
    () => `${window.location.origin}/pc/${zone.id}/${seat.id}`,
    [zone.id, seat.id]
  );
  const wrapRef = useRef<HTMLDivElement>(null);

  const download = () => {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `PC-${seat.pcNumber}-QR.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Downloaded");
  };

  const print = () => {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const w = window.open("", "_blank", "width=500,height=600");
    if (!w) return;
    w.document.write(`
      <html><head><title>PC ${seat.pcNumber}</title>
      <style>
        body{font-family:system-ui,sans-serif;text-align:center;padding:32px;margin:0}
        h1{margin:0 0 4px;font-size:24px}
        p{margin:2px 0;color:#555;font-size:13px}
        img{margin-top:20px;border:2px solid #eee;padding:12px;border-radius:8px}
        .meta{margin-top:14px;font-family:monospace;font-size:12px;color:#888}
      </style></head><body>
        <h1>PC ${seat.pcNumber}</h1>
        <p>${zone.name}</p>
        <img src="${dataUrl}" width="280" height="280" />
        <div class="meta">${url}</div>
        <script>setTimeout(()=>window.print(),300)</script>
      </body></html>
    `);
    w.document.close();
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code — PC {seat.pcNumber}</DialogTitle>
          <DialogDescription className="text-xs">
            امسح بالموبايل لفتح صفحة الـ PC والـ history مباشرة.
          </DialogDescription>
        </DialogHeader>

        <div ref={wrapRef} className="flex flex-col items-center gap-3 py-2">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <QRCodeCanvas
              value={url}
              size={220}
              level="M"
              includeMargin={false}
            />
          </div>
          <div className="text-center">
            <p className="font-mono font-bold text-lg">{seat.pcNumber}</p>
            <p className="text-xs text-muted-foreground">{zone.name}</p>
          </div>
          <code className="text-[10px] bg-muted px-2 py-1 rounded max-w-full truncate w-full text-center">
            {url}
          </code>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={copy}><Copy className="h-3.5 w-3.5 mr-1" /> Copy link</Button>
          <Button variant="outline" size="sm" onClick={() => window.open(url, "_blank")}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
          </Button>
          <Button variant="outline" size="sm" onClick={print}><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
          <Button size="sm" onClick={download}><Download className="h-3.5 w-3.5 mr-1" /> PNG</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
