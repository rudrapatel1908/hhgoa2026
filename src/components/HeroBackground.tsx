"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export default function HeroBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  // Background drifts slower than the page scrolls — classic parallax feel.
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);

  return (
    <div ref={ref} className="fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        style={{ y }}
        className="absolute inset-0 scale-110 bg-cover bg-center"
        // Slightly oversized + parallax-shifted so edges never show while scrolling.
      >
        <img
          src="/hero-bg.png"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
      </motion.div>

      {/* Scrim: dark gradient so text stays sharp over the busy illustration */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0D14]/85 via-[#0A0D14]/75 to-[#0A0D14]/95" />
      {/* Extra vignette toward the edges for focus */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0A0D14_90%)] opacity-60" />
    </div>
  );
}