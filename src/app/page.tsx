"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, CircleUser } from "lucide-react";
import UploadDropzone from "@/components/UploadDropzone";
import BuilderForm, { BuilderInfo } from "@/components/BuilderForm";
import CardPreview from "@/components/CardPreview";
import ShareButtons from "@/components/ShareButtons";
import PfpPreview from "@/components/PfpPreview";

type Mode = "card" | "pfp";

export default function HomePage() {
  const [mode, setMode] = useState<Mode>("card");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [info, setInfo] = useState<BuilderInfo>({ name: "", stack: "", title: "" });

  const handleImageReady = useCallback((img: HTMLImageElement) => {
    setPhoto(img);
  }, []);

  const handleFormChange = useCallback((next: BuilderInfo) => {
    setInfo(next);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-5 py-10 md:px-10">
      {/* Header */}
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00E5FF]/40 bg-[#00E5FF]/10 text-sm font-bold text-[#00E5FF]">
            H
          </span>
          <span className="text-lg font-bold tracking-tight text-[#E8EDF5]">
            HACKER HOUSE
          </span>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8B5CF6]">
          Goa 2026 · AI × Crypto
        </p>
        <h1 className="max-w-xl text-3xl font-bold leading-tight text-[#E8EDF5] md:text-4xl">
          Your Builder Badge is one upload away
        </h1>
        <p className="text-sm text-[#E8EDF5]/50">
          Photo → Details → Download → <span className="text-[#00E5FF]">#FrameInGoa</span>
        </p>

        {/* Mode toggle */}
        <div className="mt-2 flex rounded-full border border-[#1B5A66]/40 bg-[#0E1018] p-1">
          {(
            [
              { id: "card" as Mode, label: "Builder ID Card", icon: CreditCard },
              { id: "pfp" as Mode, label: "PFP Profile Frame", icon: CircleUser },
            ]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                mode === id ? "text-[#0A0D14]" : "text-[#E8EDF5]/60 hover:text-[#E8EDF5]"
              }`}
            >
              {mode === id && (
                <motion.span
                  layoutId="mode-pill"
                  className="absolute inset-0 rounded-full bg-[#00E5FF]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon size={16} />
                {label}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* Two-column layout */}
      <div className="grid gap-8 md:grid-cols-[380px_1fr] md:items-start">
        {/* Left: controls */}
        <div className="flex flex-col gap-6 rounded-2xl border border-[#1B5A66]/30 bg-[#0E1018]/60 p-5">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-medium uppercase tracking-wider text-[#E8EDF5]/60">
              Your Photo
            </span>
            <UploadDropzone onImageReady={handleImageReady} />
          </div>

          <AnimatePresence mode="wait">
            {mode === "card" && (
              <motion.div
                key="card-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                <span className="text-xs font-medium uppercase tracking-wider text-[#E8EDF5]/60">
                  Your Details
                </span>
                <BuilderForm onChange={handleFormChange} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: live preview */}
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#1B5A66]/30 bg-[#0E1018]/30 p-6 md:p-10">
          <AnimatePresence mode="wait">
            {mode === "card" ? (
              <motion.div
                key="card-preview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex w-full flex-col items-center gap-4"
              >
                <CardPreview photo={photo} name={info.name} title={info.title} />
                {photo && info.name.trim() && info.title.trim() && (
                  <ShareButtons photo={photo} name={info.name} title={info.title} />
                )}
              </motion.div>
            ) : (
              <motion.div
                key="pfp-preview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full"
              >
                <PfpPreview photo={photo} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}