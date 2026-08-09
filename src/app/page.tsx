"use client";

import { useCallback, useState } from "react";
import UploadDropzone from "@/components/UploadDropzone";
import BuilderForm, { BuilderInfo } from "@/components/BuilderForm";
import CardPreview from "@/components/CardPreview";
import ShareButtons from "@/components/ShareButtons";

export default function HomePage() {
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [info, setInfo] = useState<BuilderInfo>({ name: "", stack: "", title: "" });

  const handleImageReady = useCallback((img: HTMLImageElement) => {
    setPhoto(img);
  }, []);

  const handleFormChange = useCallback((next: BuilderInfo) => {
    setInfo(next);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-1.5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00E5FF]">
          Hacker House · Goa, India
        </p>
        <h1 className="text-2xl font-bold text-[#E8EDF5]">Build Your Badge</h1>
        <p className="text-sm text-[#8B5CF6]">AI × Crypto · Multichain</p>
        <p className="text-sm text-[#E8EDF5]/50">
          Upload a photo, add your details, download your card.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <span className="text-xs font-medium uppercase tracking-wider text-[#E8EDF5]/60">
          1. Your Photo
        </span>
        <UploadDropzone onImageReady={handleImageReady} />
      </section>

      <section className="flex flex-col gap-4">
        <span className="text-xs font-medium uppercase tracking-wider text-[#E8EDF5]/60">
          2. Your Details
        </span>
        <BuilderForm onChange={handleFormChange} />
      </section>

      <section className="flex flex-col items-center gap-4">
        <span className="self-start text-xs font-medium uppercase tracking-wider text-[#E8EDF5]/60">
          3. Your Card
        </span>
        <CardPreview photo={photo} name={info.name} title={info.title} />
        {photo && info.name.trim() && info.title.trim() && (
          <ShareButtons photo={photo} name={info.name} title={info.title} />
        )}
      </section>
    </main>
  );
}