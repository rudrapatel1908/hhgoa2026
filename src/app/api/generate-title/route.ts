// app/api/generate-title/route.ts
// OPTIONAL polish layer. The client already has an instant local title
// (see lib/titles.ts) before this route is ever called — this only powers
// a "Regenerate with AI" button. Hard timeout so a slow/dead API can never
// block the builder flow.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const TIMEOUT_MS = 4000;

export async function POST(req: NextRequest) {
  let stack: string;
  try {
    const body = await req.json();
    stack = String(body.stack ?? "").slice(0, 120); // guard against huge payloads
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!stack.trim()) {
    return NextResponse.json({ error: "stack is required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No key configured — client should just use the local generator.
    return NextResponse.json({ error: "AI title generation not configured" }, { status: 503 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 20,
        messages: [
          {
            role: "user",
            content: `Give one short, funny 2-4 word "builder class" title for a hackathon developer whose stack/role is: "${stack}". Style examples: "Full-Stack Chaos Agent", "Async Rust Wizard", "Pixel Perfectionist". Respond with ONLY the title text, nothing else — no quotes, no preamble.`,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }

    const data = await res.json();
    const text = data?.content?.find((b: any) => b.type === "text")?.text?.trim();

    if (!text || text.length > 60) {
      return NextResponse.json({ error: "Bad generation" }, { status: 502 });
    }

    return NextResponse.json({ title: text });
  } catch (err) {
    clearTimeout(timeout);
    const timedOut = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      { error: timedOut ? "Timed out" : "Generation failed" },
      { status: timedOut ? 504 : 500 }
    );
  }
}