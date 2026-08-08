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
 */
// HH Goa 2026 palette — dark hacker base (matches hhgoa.com) with
// gold/magenta accents pulled from the event's Goan motif artwork.
const PALETTE = {
  bgTop: "#12150F",
  bgBottom: "#1A1D14",
  gold: "#E8B923",
  goldDim: "#8A6E1F",
  magenta: "#D6247C",
  sage: "#7C9A6E",
  white: "#F5F2E8",
  muted: "#6B6F63",
};

/** Draws the gold dotted-trim border in the style of the event's poster art. */
function drawGoldBorder(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const inset = W * 0.035;
  const dotSpacing = W * 0.018;
  const dotRadius = W * 0.0028;

  ctx.fillStyle = PALETTE.gold;
  // top & bottom rows of dots
  for (let x = inset; x <= W - inset; x += dotSpacing) {
    ctx.beginPath();
    ctx.arc(x, inset, dotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, H - inset, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  // left & right columns of dots
  for (let y = inset; y <= H - inset; y += dotSpacing) {
    ctx.beginPath();
    ctx.arc(inset, y, dotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W - inset, y, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // thin gold rule just inside the dots
  ctx.strokeStyle = PALETTE.goldDim;
  ctx.lineWidth = Math.max(1, W * 0.0015);
  const ruleInset = inset + dotSpacing * 0.9;
  ctx.strokeRect(
    ruleInset,
    ruleInset,
    W - ruleInset * 2,
    H - ruleInset * 2
  );
}

/** Draws a rounded magenta pill behind the generated title text. */
function drawTitlePill(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  fontSize: number
) {
  ctx.font = `600 ${fontSize}px "Inter", sans-serif`;
  const textW = ctx.measureText(text).width;
  const padX = fontSize * 0.9;
  const padY = fontSize * 0.55;
  const pillW = textW + padX * 2;
  const pillH = fontSize + padY * 2;
  const x = cx - pillW / 2;
  const topY = y - fontSize * 0.78 - padY;
  const r = pillH / 2;

  ctx.fillStyle = PALETTE.magenta;
  ctx.beginPath();
  ctx.moveTo(x + r, topY);
  ctx.arcTo(x + pillW, topY, x + pillW, topY + pillH, r);
  ctx.arcTo(x + pillW, topY + pillH, x, topY + pillH, r);
  ctx.arcTo(x, topY + pillH, x, topY, r);
  ctx.arcTo(x, topY, x + pillW, topY, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = PALETTE.white;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, cx, y);
}

function renderToCanvas(
  data: CardData,
  size: { width: number; height: number }
) {
  const { canvas, ctx } = createCanvas(size.width, size.height);
  const { width: W, height: H } = size;
  const isPortrait = W < H;

  // --- background: near-black gradient, matching hhgoa.com's dark base ---
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, PALETTE.bgTop);
  bg.addColorStop(1, PALETTE.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  drawGoldBorder(ctx, W, H);

  // --- photo area ---
  const pad = W * 0.1;
  const photoSize = isPortrait ? W - pad * 2 : H - pad * 2;
  const photoX = isPortrait ? pad : pad;
  const photoY = pad;
  const photoW = photoSize;
  const photoH = photoSize;

  // gold ring behind the photo
  ctx.save();
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = W * 0.006;
  const radius = 20;
  const ringPad = W * 0.006;
  ctx.beginPath();
  ctx.moveTo(photoX - ringPad + radius, photoY - ringPad);
  ctx.arcTo(photoX + photoW + ringPad, photoY - ringPad, photoX + photoW + ringPad, photoY + photoH + ringPad, radius);
  ctx.arcTo(photoX + photoW + ringPad, photoY + photoH + ringPad, photoX - ringPad, photoY + photoH + ringPad, radius);
  ctx.arcTo(photoX - ringPad, photoY + photoH + ringPad, photoX - ringPad, photoY - ringPad, radius);
  ctx.arcTo(photoX - ringPad, photoY - ringPad, photoX + photoW + ringPad, photoY - ringPad, radius);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(photoX + radius, photoY);
  ctx.arcTo(photoX + photoW, photoY, photoX + photoW, photoY + photoH, radius);
  ctx.arcTo(photoX + photoW, photoY + photoH, photoX, photoY + photoH, radius);
  ctx.arcTo(photoX, photoY + photoH, photoX, photoY, radius);
  ctx.arcTo(photoX, photoY, photoX + photoW, photoY, radius);
  ctx.closePath();
  ctx.clip();
  drawCoverImage(ctx, data.photo, photoX, photoY, photoW, photoH);
  ctx.restore();

  // --- optional extra overlay art (transparent PNG, drawn full-bleed) ---
  if (data.frame) {
    ctx.drawImage(data.frame, 0, 0, W, H);
  }

  // --- text block ---
  const textTop = photoY + photoH + H * 0.075;
  drawText(ctx, data.name.toUpperCase(), W / 2, textTop, {
    font: `700 ${Math.round(W * 0.055)}px "Inter", sans-serif`,
    color: PALETTE.white,
    align: "center",
    letterSpacing: 1,
  });

  drawTitlePill(ctx, data.title, W / 2, textTop + W * 0.095, Math.round(W * 0.03));

  drawText(ctx, "HACKER HOUSE · GOA, INDIA", W / 2, H - H * 0.05, {
    font: `600 ${Math.round(W * 0.022)}px "Inter", sans-serif`,
    color: PALETTE.gold,
    align: "center",
    letterSpacing: 2.5,
  });

  drawText(ctx, "28–31 OCT 2026", W / 2, H - H * 0.028, {
    font: `500 ${Math.round(W * 0.018)}px "Inter", sans-serif`,
    color: PALETTE.muted,
    align: "center",
    letterSpacing: 1.5,
  });

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