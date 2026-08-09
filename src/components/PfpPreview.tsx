"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Loader2, Check } from "lucide-react";
import { renderPfpCanvas, downloadCanvas, PFP_TEMPLATES, PfpTemplateId } from "@/lib/canvas";

type Props = {
  photo: HTMLImageElement | null;
};

export default function PfpPreview({ photo }: Props) {
  const [templateId, setTemplateId] = useState<PfpTemplateId>("circuit");
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!photo || !containerRef.current) return;
    const canvas = renderPfpCanvas(photo, templateId);
    canvasElRef.current = canvas;
    canvas.className = "h-full w-full rounded-full object-contain";
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(canvas);
  }, [photo, templateId]);

  const handleDownload = async () => {
    if (!canvasElRef.current) return;
    setDownloading(true);
    try {
      await downloadCanvas(canvasElRef.current, `hhgoa2026-pfp-${templateId}.png`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <span className="mb-3 block text-xs font-medium uppercase tracking-wider text-[#E8EDF5]/60">
          Choose a frame style
        </span>
        <div className="grid grid-cols-3 gap-3">
          {PFP_TEMPLATES.map((t: (typeof PFP_TEMPLATES)[number]) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={`relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${
                templateId === t.id
                  ? "border-[#00E5FF] bg-[#00E5FF]/10"
                  : "border-[#1B5A66]/40 bg-[#0E1018] hover:border-[#1B5A66]"
              }`}
            >
              {templateId === t.id && (
                <span className="absolute right-2 top-2 rounded-full bg-[#00E5FF] p-0.5 text-[#0A0D14]">
                  <Check size={10} />
                </span>
              )}
              <span
                className="h-10 w-10 rounded-full border-2"
                style={{
                  borderColor: t.accent === "gradient" ? "#00E5FF" : t.accent,
                  background:
                    t.accent === "gradient"
                      ? "linear-gradient(135deg, #00E5FF, #8B5CF6)"
                      : "transparent",
                }}
              />
              <span className="text-[11px] font-medium text-[#E8EDF5]/80">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div
          ref={containerRef}
          className="flex aspect-square w-full max-w-xs items-center justify-center overflow-hidden rounded-full border border-[#1B5A66]/30 bg-[#0E1018]"
        >
          {!photo && (
            <p className="px-8 text-center text-sm text-[#E8EDF5]/40">
              Upload a photo to preview your frame
            </p>
          )}
        </div>

        {photo && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-[#00E5FF] px-6 py-3 font-semibold text-[#0A0D14] transition-opacity disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Download size={18} />
            )}
            Download PFP
          </motion.button>
        )}
      </div>
    </div>
  );
}