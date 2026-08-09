"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, Camera, ImageOff, Loader2, RotateCcw } from "lucide-react";
import { convertHeicIfNeeded } from "@/lib/heic";
import { loadImage } from "@/lib/canvas";

type Props = {
  onImageReady: (img: HTMLImageElement) => void;
};

type Status = "idle" | "processing" | "error";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB — generous for phone camera photos, blocks abuse
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export default function UploadDropzone({ onImageReady }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): string | null => {
    if (file.size > MAX_FILE_BYTES) {
      return "That photo's a bit large — try one under 20MB.";
    }
    const isAcceptedType = ACCEPTED_TYPES.includes(file.type);
    const looksLikeHeic = file.name.toLowerCase().match(/\.(heic|heif)$/);
    if (!isAcceptedType && !looksLikeHeic) {
      return "Use a JPG, PNG, or iPhone photo (HEIC).";
    }
    return null;
  };

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validate(file);
      if (validationError) {
        setStatus("error");
        setError(validationError);
        return;
      }

      setStatus("processing");
      setError(null);

      try {
        const jpegBlob = await convertHeicIfNeeded(file);
        const img = await loadImage(jpegBlob);

        const url = URL.createObjectURL(jpegBlob);
        setPreviewUrl(url);
        setStatus("idle");
        onImageReady(img);
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't read that photo — try another one."
        );
      }
    },
    [onImageReady]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setStatus("idle");
    setError(null);
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        capture="environment"
        onChange={onInputChange}
        className="hidden"
      />

      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !previewUrl && fileInputRef.current?.click()}
        animate={{
          borderColor: isDragging ? "#8B5CF6" : "#1B5A66",
          scale: isDragging ? 1.01 : 1,
        }}
        transition={{ duration: 0.15 }}
        className="relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-[#0E1018] text-center"
      >
        <AnimatePresence mode="wait">
          {previewUrl ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative h-full w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Your uploaded photo"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  reset();
                }}
                className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-[#E8EDF5] backdrop-blur"
              >
                <RotateCcw size={14} /> Change photo
              </button>
            </motion.div>
          ) : status === "processing" ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 px-6"
            >
              <Loader2 className="animate-spin text-[#00E5FF]" size={32} />
              <p className="text-sm text-[#E8EDF5]/70">Processing your photo…</p>
            </motion.div>
          ) : status === "error" ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 px-6"
            >
              <ImageOff className="text-[#8B5CF6]" size={32} />
              <p className="text-sm text-[#E8EDF5]/80">{error}</p>
              <span className="text-xs text-[#E8EDF5]/50">Tap to try again</span>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 px-6"
            >
              <UploadCloud className="text-[#00E5FF]" size={32} />
              <p className="text-sm font-medium text-[#E8EDF5]">
                Drop your photo here
              </p>
              <p className="text-xs text-[#E8EDF5]/50">
                or tap to choose from your gallery
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-[#00E5FF]/80">
                <Camera size={14} /> Camera & iPhone HEIC supported
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}