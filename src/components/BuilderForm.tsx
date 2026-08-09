"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shuffle, Sparkles, Loader2 } from "lucide-react";
import { generateLocalTitle } from "@/lib/titles";

export type BuilderInfo = {
  name: string;
  stack: string;
  title: string;
};

type Props = {
  onChange: (info: BuilderInfo) => void;
};

export default function BuilderForm({ onChange }: Props) {
  const [name, setName] = useState("");
  const [stack, setStack] = useState("");
  const [title, setTitle] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Generate an instant local title the moment there's enough stack text to key off.
  useEffect(() => {
    if (stack.trim().length >= 2 && !title) {
      setTitle(generateLocalTitle(stack));
    }
  }, [stack, title]);

  useEffect(() => {
    onChange({ name, stack, title });
  }, [name, stack, title, onChange]);

  const shuffleLocal = () => {
    setTitle(generateLocalTitle(stack || "builder"));
  };

  const regenerateWithAI = async () => {
    if (!stack.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stack }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.title) setTitle(data.title);
      }
      // On any failure, silently keep the current local title — no error shown,
      // since the local title is already a perfectly good result.
    } catch {
      // network error — same rule, fail silent, local title stands.
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-xs font-medium uppercase tracking-wider text-[#E8EDF5]/60">
          Name
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          placeholder="Rudra Patel"
          className="rounded-xl border border-[#1B5A66]/40 bg-[#0E1018] px-4 py-3 text-[#E8EDF5] placeholder:text-[#E8EDF5]/30 outline-none focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="stack" className="text-xs font-medium uppercase tracking-wider text-[#E8EDF5]/60">
          Stack / Role
        </label>
        <input
          id="stack"
          value={stack}
          onChange={(e) => setStack(e.target.value)}
          maxLength={40}
          placeholder="Full-stack, React + FastAPI"
          className="rounded-xl border border-[#1B5A66]/40 bg-[#0E1018] px-4 py-3 text-[#E8EDF5] placeholder:text-[#E8EDF5]/30 outline-none focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF]"
        />
      </div>

      {title && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-[#E8EDF5]/60">
            Your builder class
          </span>
          <div className="flex items-center justify-between rounded-xl bg-[#8B5CF6] px-4 py-3">
            <span className="font-semibold text-[#E8EDF5]">{title}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={shuffleLocal}
                title="Shuffle title"
                className="rounded-lg p-1.5 text-[#E8EDF5]/80 hover:bg-black/15"
              >
                <Shuffle size={16} />
              </button>
              <button
                type="button"
                onClick={regenerateWithAI}
                disabled={aiLoading}
                title="Regenerate with AI"
                className="rounded-lg p-1.5 text-[#E8EDF5]/80 hover:bg-black/15 disabled:opacity-50"
              >
                {aiLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}