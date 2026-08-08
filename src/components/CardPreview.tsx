"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Loader2 } from "lucide-react";
import { renderCardCanvas, downloadCanvas, CardData } from "@/lib/canvas";

type Props = {
  photo: HTMLImageElement | null;
  name: string;
  title: string;
};

export default function CardPreview({ photo, name, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  const isReady = Boolean(photo && name.trim() && title.trim());

  useEffect(() => {
    if (!photo || !name.trim() || !title.trim() || !containerRef.current) return;

    const data: CardData = { photo, name: name.trim(), title: title.trim() };
    const canvas = renderCardCanvas(data);

    canvasElRef.current = canvas;

    // Swap in the freshly rendered canvas as the preview element.
    canvas.className = "h-full w-full rounded-2xl object-contain";
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(canvas);
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
      <div
        ref={containerRef}
        className="flex aspect-[4/5] w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl border border-[#8A6E1F]/30 bg-[#0C0F0B]"
      >
        {!isReady && (
          <p className="px-8 text-center text-sm text-[#F5F2E8]/40">
            Add a photo and your details to see your card
          </p>
        )}
      </div>

      {isReady && (
        <motion.button
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="flex w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-[#E8B923] px-6 py-3 font-semibold text-[#07090C] transition-opacity disabled:opacity-60"
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