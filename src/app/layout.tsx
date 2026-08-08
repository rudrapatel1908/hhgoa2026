import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Build Your Badge — Hacker House Goa 2026",
  description: "Generate your Hacker House Goa 2026 builder ID card.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#07090C] text-[#F5F2E8] antialiased">
        {children}
      </body>
    </html>
  );
}