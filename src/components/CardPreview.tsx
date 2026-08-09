"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Loader2 } from "lucide-react";
import { renderCardCanvas, downloadCanvas } from "@/lib/canvas";
import type { CardData } from "@/lib/canvas";

type Props = {
  photo: HTMLImageElement | null;
  name: string;
  title: string;
};

export default function CardPreview({ photo, name, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [rendering, setRendering] = useState(false);

  const isReady = Boolean(photo && name.trim() && title.trim());

  useEffect(() => {
    if (!photo || !name.trim() || !title.trim() || !containerRef.current) {
      if (containerRef.current) containerRef.current.innerHTML = "";
      canvasElRef.current = null;
      return;
    }

    let cancelled = false;
    setRendering(true);

    const data: CardData = { photo, name: name.trim(), title: title.trim() };

    renderCardCanvas(data)
      .then((canvas: HTMLCanvasElement) => {
        // Guards against an earlier, slower render (QR generation is async)
        // overwriting a newer one if photo/name/title changed again mid-render.
        if (cancelled || !containerRef.current) return;
        canvasElRef.current = canvas;
        canvas.className = "h-full w-full rounded-2xl object-contain";
        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(canvas);
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [photo, name, title]);

  const handleDownload = async () => {
    if (!canvasElRef.current) return;
    setDownloading(true);
    try {
      const safeName = name.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "builder";
      await downloadCanvas(canvasElRef.current, `hhgoa2026-${safeName}.png`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative flex aspect-[4/5] w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl border border-[#1B5A66]/30 bg-[#0E1018]">
        {/* Dedicated slot for manual canvas injection — React never renders
            JSX children into this div, so it never fights our appendChild
            calls during reconciliation (that mismatch was the removeChild crash). */}
        <div ref={containerRef} className="h-full w-full" />

        {!isReady && (
          <p className="absolute px-8 text-center text-sm text-[#E8EDF5]/40">
            Add a photo and your details to see your card
          </p>
        )}
        {isReady && rendering && (
          <div className="absolute flex items-center gap-2 text-sm text-[#E8EDF5]/50">
            <Loader2 size={16} className="animate-spin" />
            Rendering…
          </div>
        )}
      </div>

      {isReady && (
        <motion.button
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="flex w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-[#00E5FF] px-6 py-3 font-semibold text-[#0A0D14] transition-opacity disabled:opacity-60"
        >
          {downloading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Download size={18} />
          )}
          Download Card
        </motion.button>
      )}
    </div>
  );
}