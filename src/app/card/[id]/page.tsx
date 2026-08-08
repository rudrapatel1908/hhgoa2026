// app/card/[id]/page.tsx
// This route exists purely so a shared link has a real page with correct
// og:image / twitter:image meta tags — Twitter's crawler reads THIS page,
// not the raw image URL. No DB: the blob URLs are deterministic from the id
// because upload-card used addRandomSuffix: false.

import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";

// Set this once, right after your first successful upload — copy the host
// from the `cardUrl` the upload API returns, e.g.
// https://abc123xyz.public.blob.vercel-storage.com
const BLOB_BASE_URL = process.env.NEXT_PUBLIC_BLOB_BASE_URL ?? "";

function cardImageUrl(id: string) {
  return `${BLOB_BASE_URL}/cards/${id}.png`;
}
function ogImageUrl(id: string) {
  return `${BLOB_BASE_URL}/cards/${id}-og.png`;
}

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = params;
  const og = ogImageUrl(id);
  const title = "I'm building at Hacker House Goa 2026";
  const description = "Generate your own builder ID card — #FrameInGoa";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: og, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [og],
    },
  };
}

export default function CardSharePage({ params }: Props) {
  const { id } = params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center gap-6 px-5 py-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B923]">
        Hacker House · Goa, India
      </p>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cardImageUrl(id)}
        alt="Hacker House Goa 2026 builder ID card"
        className="w-full max-w-sm rounded-2xl border border-[#8A6E1F]/30"
      />

      <a
        href={cardImageUrl(id)}
        download={`hhgoa2026-${id}.png`}
        className="flex w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-[#E8B923] px-6 py-3 font-semibold text-[#07090C]"
      >
        <Download size={18} />
        Download this card
      </a>

      <Link
        href="/"
        className="text-sm font-medium text-[#F5F2E8]/60 underline underline-offset-4"
      >
        Build your own badge →
      </Link>
    </main>
  );
}