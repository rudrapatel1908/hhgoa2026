// lib/canvas.ts
// Core render engine for the HH Goa 2026 Builder ID Card.
// Two export sizes are produced from the same draw routine:
//  - CARD size (portrait, for download)
//  - OG size  (1200x630, for Twitter/link preview)

export type CardData = {
  name: string;
  title: string; // e.g. "Async Rust Wizard"
  photo: HTMLImageElement;
  frame?: HTMLImageElement; // optional transparent frame/badge overlay
  stack?: string; // e.g. "Vercel • Supabase • Docker • Hugging Face"
  origin?: string; // e.g. "Gujarat" — used in the boarding-pass journey line
};

export const CARD_SIZE = { width: 1080, height: 1350 }; // 4:5 portrait
export const OG_SIZE = { width: 1200, height: 630 }; // Twitter summary_large_image

/**
 * Loads a File/Blob into an HTMLImageElement.
 * Assumes any HEIC conversion has already happened upstream (see lib/heic.ts) —
 * this function only ever receives browser-renderable image bytes (jpg/png/webp).
 */
export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
      // revoke after the browser has decoded pixels into the Image
      URL.revokeObjectURL(url);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image — file may be corrupt or unsupported."));
    };
    img.src = url;
  });
}

/**
 * object-fit: cover math.
 * Given a source image and a destination box, returns the source rect (sx, sy, sw, sh)
 * that should be drawn to exactly fill the destination box, centered, cropping overflow.
 */
function getCoverSourceRect(
  imgW: number,
  imgH: number,
  destW: number,
  destH: number
) {
  const imgRatio = imgW / imgH;
  const destRatio = destW / destH;

  let sw = imgW;
  let sh = imgH;

  if (imgRatio > destRatio) {
    // image is wider than destination -> crop left/right
    sh = imgH;
    sw = sh * destRatio;
  } else {
    // image is taller than destination -> crop top/bottom
    sw = imgW;
    sh = sw / destRatio;
  }

  const sx = (imgW - sw) / 2;
  const sy = (imgH - sh) / 2;

  return { sx, sy, sw, sh };
}

/**
 * Draws a photo into a destination box using cover-fit math, centered.
 */
function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  destX: number,
  destY: number,
  destW: number,
  destH: number
) {
  const { sx, sy, sw, sh } = getCoverSourceRect(
    img.naturalWidth,
    img.naturalHeight,
    destW,
    destH
  );
  ctx.drawImage(img, sx, sy, sw, sh, destX, destY, destW, destH);
}

/**
 * Creates a high-DPI-safe canvas.
 * Caps the effective device pixel ratio so we never blow iOS Safari's
 * ~16 megapixel canvas ceiling on large source photos.
 */
function createCanvas(cssWidth: number, cssHeight: number) {
  const canvas = document.createElement("canvas");
  const rawDpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  // Cap DPR so cssWidth*dpr * cssHeight*dpr stays well under 16MP
  const maxPixels = 14_000_000;
  const dprCap = Math.sqrt(maxPixels / (cssWidth * cssHeight));
  const dpr = Math.max(1, Math.min(rawDpr, dprCap, 3));

  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  return { canvas, ctx };
}

/**
 * Draws crisp, wrapped text with a given font, tracking baseline manually.
 */
function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: {
    font: string;
    color: string;
    align?: CanvasTextAlign;
    letterSpacing?: number;
  }
) {
  ctx.font = opts.font;
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "alphabetic";

  if (!opts.letterSpacing) {
    ctx.fillText(text, x, y);
    return;
  }

  // manual letter-spacing (canvas has no native letter-spacing support pre-2023 Safari)
  let cursorX = x;
  if (opts.align === "center") {
    const totalWidth =
      [...text].reduce((acc, ch) => acc + ctx.measureText(ch).width, 0) +
      opts.letterSpacing * (text.length - 1);
    cursorX = x - totalWidth / 2;
    ctx.textAlign = "left";
  }
  for (const ch of text) {
    ctx.fillText(ch, cursorX, y);
    cursorX += ctx.measureText(ch).width + opts.letterSpacing;
  }
}

/**
 * Renders the full builder ID card at the given target size.
 * Used for both the CARD (download) and OG (share preview) exports —
 * layout adapts based on aspect ratio (portrait vs landscape).
 *
 * Visual direction: tropical Goan base (deep forest green) fused with
 * cyberpunk accents (neon magenta/gold gradient, glow effects) — distinct
 * from the cyan/violet AI×Crypto PFP templates below, by design.
 */
const TROPICAL = {
  bg: "#0F291E",
  bgDeep: "#0A1D15",
  magenta: "#FF007F",
  gold: "#FFD700",
  neonPink: "#FF3DA6",
  neonGreen: "#39FF88",
  white: "#FFFFFF",
  lightGreen: "#C9FFD4",
};

// Kept for the PFP templates further below, which stay in the AI×Crypto
// visual language on purpose — the two modes are meant to look distinct.
const PALETTE = {
  bgTop: "#0A0D14",
  bgBottom: "#12111C",
  cyan: "#00E5FF",
  cyanDim: "#1B5A66",
  violet: "#8B5CF6",
  lime: "#39FF88",
  white: "#E8EDF5",
  muted: "#5B6472",
};

/** Scatters faint code-bracket glyphs across the background for texture. */
function drawBracketPattern(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const glyphs = ["{ }", "< >", "{ }", "</>"];
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = TROPICAL.white;
  ctx.textAlign = "center";
  const cols = 6;
  const rows = 9;
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (W / cols) * (c + 0.5);
      const y = (H / rows) * (r + 0.5);
      ctx.font = `${Math.round(W * 0.035)}px "Courier New", monospace`;
      ctx.fillText(glyphs[i % glyphs.length], x, y);
      i++;
    }
  }
  ctx.restore();
}

/** 12px-equivalent linear gradient border, magenta (top-left) to gold (bottom-right). */
function drawGradientBorder(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const lineWidth = (12 / 1080) * W;
  const gradient = ctx.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, TROPICAL.magenta);
  gradient.addColorStop(1, TROPICAL.gold);
  ctx.save();
  ctx.strokeStyle = gradient;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(lineWidth / 2, lineWidth / 2, W - lineWidth, H - lineWidth);
  ctx.restore();
}

/** Dark glassy pill with a glowing magenta border, holding the AI-generated builder title. */
function drawGlowPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  fontSize: number
) {
  ctx.font = `700 ${fontSize}px "Inter", sans-serif`;
  const textW = ctx.measureText(text).width;
  const padX = fontSize * 0.9;
  const padY = fontSize * 0.55;
  const pillW = textW + padX * 2;
  const pillH = fontSize + padY * 2;
  const x = cx - pillW / 2;
  const topY = y - fontSize * 0.78 - padY;
  const r = pillH / 2;

  const path = new Path2D();
  path.moveTo(x + r, topY);
  path.arcTo(x + pillW, topY, x + pillW, topY + pillH, r);
  path.arcTo(x + pillW, topY + pillH, x, topY + pillH, r);
  path.arcTo(x, topY + pillH, x, topY, r);
  path.arcTo(x, topY, x + pillW, topY, r);
  path.closePath();

  ctx.save();
  ctx.fillStyle = "rgba(10, 20, 15, 0.55)";
  ctx.shadowColor = TROPICAL.magenta;
  ctx.shadowBlur = fontSize * 0.6;
  ctx.fill(path);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = TROPICAL.magenta;
  ctx.lineWidth = Math.max(1.5, fontSize * 0.05);
  ctx.stroke(path);
  ctx.restore();

  ctx.fillStyle = TROPICAL.gold;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, cx, y);
}

/** Stark white barcode of pseudo-random bar widths, stretching the full card width. */
function drawBarcode(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = TROPICAL.white;
  let cursor = x;
  // deterministic pseudo-random pattern (not a real scannable code, purely visual)
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  while (cursor < x + w) {
    const barW = 1 + rand() * 4;
    if (rand() > 0.45) {
      ctx.fillRect(cursor, y, barW, h);
    }
    cursor += barW + 1;
  }
  ctx.restore();
}

function clipTicketShape(ctx: CanvasRenderingContext2D, W: number, H: number, radius: number) {
  const notchR = W * 0.032;
  const notchY = H * 0.018;

  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(W / 2 - notchR - 4, 0);
  ctx.arc(W / 2, notchY, notchR, Math.PI, 0, true);
  ctx.lineTo(W - radius, 0);
  ctx.arcTo(W, 0, W, radius, radius);
  ctx.lineTo(W, H - radius);
  ctx.arcTo(W, H, W - radius, H, radius);
  ctx.lineTo(radius, H);
  ctx.arcTo(0, H, 0, H - radius, radius);
  ctx.lineTo(0, radius);
  ctx.arcTo(0, 0, radius, 0, radius);
  ctx.closePath();
  ctx.clip();
}

function renderToCanvas(
  data: CardData,
  size: { width: number; height: number }
) {
  const { canvas, ctx } = createCanvas(size.width, size.height);
  const { width: W, height: H } = size;
  const isPortrait = W < H;

  ctx.save();
  if (isPortrait) {
    clipTicketShape(ctx, W, H, W * 0.03);
  }

  // --- background: deep tropical forest green ---
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, TROPICAL.bg);
  bg.addColorStop(1, TROPICAL.bgDeep);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  drawBracketPattern(ctx, W, H);

  // --- header: HACKER HOUSE + गोवा overlay + dates ---
  const headerY = H * 0.075;
  drawText(ctx, "HACKER HOUSE", W / 2, headerY, {
    font: `700 ${Math.round(W * 0.075)}px Georgia, "Times New Roman", serif`,
    color: TROPICAL.gold,
    align: "center",
  });
  ctx.save();
  ctx.globalAlpha = 0.9;
  drawText(ctx, "गोवा", W / 2 + W * 0.01, headerY - W * 0.006, {
    font: `700 ${Math.round(W * 0.06)}px "Noto Sans Devanagari", Georgia, serif`,
    color: TROPICAL.neonPink,
    align: "center",
  });
  ctx.restore();
  drawText(ctx, "28 – 31 OCTOBER 2026", W / 2, headerY + W * 0.045, {
    font: `500 ${Math.round(W * 0.016)}px "Courier New", monospace`,
    color: TROPICAL.white,
    align: "center",
    letterSpacing: 3,
  });

  // --- photo area ---
  const pad = W * 0.1;
  const photoTop = headerY + W * 0.075;
  const photoSize = isPortrait ? W - pad * 2 : H - pad * 2;
  const photoX = pad;
  const photoY = isPortrait ? photoTop : pad;
  const photoW = photoSize;
  const photoH = photoSize;
  const photoRadius = (24 / 1080) * W;

  ctx.save();
  ctx.strokeStyle = TROPICAL.gold;
  ctx.lineWidth = (6 / 1080) * W;
  ctx.beginPath();
  ctx.moveTo(photoX + photoRadius, photoY);
  ctx.arcTo(photoX + photoW, photoY, photoX + photoW, photoY + photoH, photoRadius);
  ctx.arcTo(photoX + photoW, photoY + photoH, photoX, photoY + photoH, photoRadius);
  ctx.arcTo(photoX, photoY + photoH, photoX, photoY, photoRadius);
  ctx.arcTo(photoX, photoY, photoX + photoW, photoY, photoRadius);
  ctx.closePath();
  ctx.stroke();
  ctx.clip();
  drawCoverImage(ctx, data.photo, photoX, photoY, photoW, photoH);
  ctx.restore();

  if (data.frame) {
    ctx.drawImage(data.frame, 0, 0, W, H);
  }

  // --- name ---
  let cursorY = photoY + photoH + W * 0.075;
  drawText(ctx, data.name.toUpperCase(), W / 2, cursorY, {
    font: `800 ${Math.round(W * 0.065)}px "Inter", sans-serif`,
    color: TROPICAL.white,
    align: "center",
  });

  // --- boarding-pass style journey line ---
  cursorY += W * 0.05;
  const origin = (data.origin ?? "REMOTE").toUpperCase();
  drawText(ctx, `FROM: ${origin}  ✈  TO: GOA`, W / 2, cursorY, {
    font: `600 ${Math.round(W * 0.024)}px "Courier New", monospace`,
    color: TROPICAL.gold,
    align: "center",
    letterSpacing: 1,
  });

  // --- stack line ---
  cursorY += W * 0.04;
  drawText(ctx, data.stack ?? data.title, W / 2, cursorY, {
    font: `500 ${Math.round(W * 0.022)}px "Inter", sans-serif`,
    color: TROPICAL.lightGreen,
    align: "center",
  });

  // --- dynamic AI title pill ---
  drawGlowPill(ctx, data.title, W / 2, cursorY + W * 0.09, Math.round(W * 0.03));

  // --- footer: barcode + tagline ---
  const barcodeW = W * 0.7;
  const barcodeH = H * 0.03;
  drawBarcode(ctx, (W - barcodeW) / 2, H - H * 0.09, barcodeW, barcodeH);

  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `600 ${Math.round(W * 0.02)}px "Inter", sans-serif`;
  const footerY = H - H * 0.045;
  const part1 = "🌴 #FrameInGoa ";
  const part2 = "⚡ @HackerHouseGoa";
  const w1 = ctx.measureText(part1).width;
  const w2 = ctx.measureText(part2).width;
  const startX = W / 2 - (w1 + w2) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = TROPICAL.white;
  ctx.fillText(part1, startX, footerY);
  ctx.fillStyle = TROPICAL.neonGreen;
  ctx.fillText(part2, startX + w1, footerY);
  ctx.restore();

  ctx.restore();

  if (isPortrait) {
    ctx.save();
    clipTicketShape(ctx, W, H, W * 0.03);
    drawGradientBorder(ctx, W, H);
    ctx.restore();
  } else {
    drawGradientBorder(ctx, W, H);
  }

  return canvas;
}

/** Available PFP template styles — id must match what's shown in the picker UI. */
export const PFP_TEMPLATES = [
  { id: "circuit", name: "Circuit Ring", accent: PALETTE.cyan },
  { id: "neural", name: "Neural Violet", accent: PALETTE.violet },
  { id: "pulse", name: "Signal Pulse", accent: "gradient" as const },
] as const;

export type PfpTemplateId = (typeof PFP_TEMPLATES)[number]["id"];

const PFP_SIZE = { width: 1080, height: 1080 };

/** Renders a circular profile-picture frame at the given template style. */
export function renderPfpCanvas(photo: HTMLImageElement, templateId: PfpTemplateId) {
  const { canvas, ctx } = createCanvas(PFP_SIZE.width, PFP_SIZE.height);
  const W = PFP_SIZE.width;
  const H = PFP_SIZE.height;
  const cx = W / 2;
  const cy = H / 2;
  const outerR = W * 0.46;
  const photoR = W * 0.38;

  // background
  const bg = ctx.createRadialGradient(cx, cy, outerR * 0.3, cx, cy, outerR);
  bg.addColorStop(0, PALETTE.bgBottom);
  bg.addColorStop(1, PALETTE.bgTop);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // template-specific ring
  if (templateId === "circuit") {
    // dashed cyan ring with small node ticks
    ctx.strokeStyle = PALETTE.cyan;
    ctx.lineWidth = W * 0.006;
    ctx.setLineDash([W * 0.015, W * 0.012]);
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const nodeCount = 24;
    for (let i = 0; i < nodeCount; i++) {
      const angle = (i / nodeCount) * Math.PI * 2;
      const nx = cx + Math.cos(angle) * outerR;
      const ny = cy + Math.sin(angle) * outerR;
      ctx.fillStyle = i % 3 === 0 ? PALETTE.violet : PALETTE.cyan;
      ctx.beginPath();
      ctx.arc(nx, ny, W * 0.004, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (templateId === "neural") {
    // web of thin violet lines radiating from ring to a few points, like a neural net
    ctx.strokeStyle = `${PALETTE.violet}66`;
    ctx.lineWidth = W * 0.0015;
    const pointCount = 16;
    const points: [number, number][] = [];
    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2;
      points.push([cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR]);
    }
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (Math.random() > 0.85) {
          ctx.beginPath();
          ctx.moveTo(points[i][0], points[i][1]);
          ctx.lineTo(points[j][0], points[j][1]);
          ctx.stroke();
        }
      }
    }
    ctx.strokeStyle = PALETTE.violet;
    ctx.lineWidth = W * 0.007;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.stroke();
    points.forEach(([px, py]) => {
      ctx.fillStyle = PALETTE.violet;
      ctx.beginPath();
      ctx.arc(px, py, W * 0.006, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    // pulse: smooth cyan-to-violet gradient ring, glow-styled
    const ringGrad = ctx.createLinearGradient(cx - outerR, cy, cx + outerR, cy);
    ringGrad.addColorStop(0, PALETTE.cyan);
    ringGrad.addColorStop(1, PALETTE.violet);
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = W * 0.014;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.stroke();
  }

  // photo, clipped to circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, photoR, 0, Math.PI * 2);
  ctx.clip();
  drawCoverImage(ctx, photo, cx - photoR, cy - photoR, photoR * 2, photoR * 2);
  ctx.restore();

  return canvas;
}

export function renderCardCanvas(data: CardData) {
  return renderToCanvas(data, CARD_SIZE);
}

export function renderOgCanvas(data: CardData) {
  return renderToCanvas(data, OG_SIZE);
}

/** Canvas -> PNG Blob, for upload or download. */
export function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png",
      quality
    );
  });
}

/** Triggers a browser download of a canvas as PNG. */
export async function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}