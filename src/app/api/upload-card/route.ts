// app/api/upload-card/route.ts
// No login, no DB. Client sends the two already-rendered PNGs (full card +
// OG crop) as multipart form data; we push both to Vercel Blob under a
// predictable path (cards/{id}.png, cards/{id}-og.png) with addRandomSuffix
// disabled so /card/[id] can reconstruct the URL later without a lookup.

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB per image — a rendered PNG should be well under this
const ALLOWED_TYPE = "image/png";

// Extremely lightweight in-memory rate limit. Resets on cold start/deploy —
// this is a speed bump against casual abuse, not a real rate limiter.
const recentUploads = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (recentUploads.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  recentUploads.set(ip, timestamps);
  return timestamps.length > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many uploads, try again in a minute" }, { status: 429 });
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch (parseErr) {
      console.error("upload-card: formData parse failed", parseErr);
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const card = form.get("card");
    const og = form.get("og");

    if (!(card instanceof Blob) || !(og instanceof Blob)) {
      console.error("upload-card: missing card/og in form", {
        cardType: typeof card,
        ogType: typeof og,
      });
      return NextResponse.json({ error: "Missing card or og image" }, { status: 400 });
    }
    if (card.type !== ALLOWED_TYPE || og.type !== ALLOWED_TYPE) {
      console.error("upload-card: wrong mime type", { cardType: card.type, ogType: og.type });
      return NextResponse.json({ error: "Images must be PNG" }, { status: 400 });
    }
    if (card.size > MAX_BYTES || og.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 400 });
    }

    const id = nanoid(8);

    const [cardBlob, ogBlob] = await Promise.all([
      put(`cards/${id}.png`, card, {
        access: "public",
        addRandomSuffix: false,
        contentType: "image/png",
      }),
      put(`cards/${id}-og.png`, og, {
        access: "public",
        addRandomSuffix: false,
        contentType: "image/png",
      }),
    ]);

    return NextResponse.json({
      id,
      cardUrl: cardBlob.url,
      ogUrl: ogBlob.url,
      shareUrl: `${req.nextUrl.origin}/card/${id}`,
    });
  } catch (err) {
    // Logging the real error + stack so it's visible in Vercel's runtime logs
    // instead of just a bare 500 with no context.
    console.error("upload-card: unhandled error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}