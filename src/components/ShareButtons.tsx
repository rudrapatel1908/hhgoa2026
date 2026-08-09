"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Loader2, Check, Send } from "lucide-react";
import { renderCardCanvas, renderOgCanvas, canvasToBlob } from "@/lib/canvas";
import type { CardData } from "@/lib/canvas";

type Props = {
  photo: HTMLImageElement;
  name: string;
  title: string;
};

type Status = "idle" | "uploading" | "ready" | "error";

export default function ShareButtons({ photo, name, title }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async () => {
    setStatus("uploading");
    setError(null);

    try {
      const data: CardData = { photo, name: name.trim(), title: title.trim() };
      const [cardCanvas, ogCanvas] = await Promise.all([
        renderCardCanvas(data),
        renderOgCanvas(data),
      ]);

      const [cardBlob, ogBlob] = await Promise.all([
        canvasToBlob(cardCanvas),
        canvasToBlob(ogCanvas),
      ]);

      const form = new FormData();
      form.append("card", cardBlob, "card.png");
      form.append("og", ogBlob, "og.png");

      const res = await fetch("/api/upload-card", { method: "POST", body: form });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error ?? "Upload failed");
      }

      setShareUrl(result.shareUrl);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Couldn't create share link");
    }
  };

  const tweetUrl = (link: string) => {
    const text = `I'm building at Hacker House Goa 2026 🇮🇳 #FrameInGoa`;
    const params = new URLSearchParams({ text, url: link });
    return `https://twitter.com/intent/tweet?${params.toString()}`;
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <AnimatePresence mode="wait">
        {status !== "ready" ? (
          <motion.button
            key="share"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            type="button"
            onClick={handleShare}
            disabled={status === "uploading"}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1B5A66]/50 bg-transparent px-6 py-3 font-semibold text-[#E8EDF5] transition-opacity disabled:opacity-60"
          >
            {status === "uploading" ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Creating share link…
              </>
            ) : (
              <>
                <Share2 size={18} /> Get Share Link
              </>
            )}
          </motion.button>
        ) : (
          <motion.a
            key="tweet"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            href={tweetUrl(shareUrl!)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#000000] px-6 py-3 font-semibold text-white"
          >
            <Send size={18} /> Share to X
          </motion.a>
        )}
      </AnimatePresence>

      {status === "ready" && shareUrl && (
        <div className="flex items-center gap-1.5 text-xs text-[#E8EDF5]/50">
          <Check size={14} className="text-[#39FF88]" />
          Link ready — the X card preview will show your badge
        </div>
      )}

      {status === "error" && (
        <p className="text-center text-xs text-[#8B5CF6]">{error}</p>
      )}
    </div>
  );
}