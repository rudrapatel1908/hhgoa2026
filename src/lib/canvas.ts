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
// HH Goa 2026 palette — "AI × Crypto. Multichain. Goa." theme:
// electric cyan reads as AI/neural, violet reads as crypto/chain,
// dark base matches the hacker aesthetic of hhgoa.com.
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

/** Draws a circuit-trace border: nodes connected by short lines, reading as a PCB/neural trace. */
function drawCircuitBorder(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const inset = W * 0.035;
  const nodeSpacing = W * 0.05;
  const nodeRadius = W * 0.0035;

  ctx.strokeStyle = PALETTE.cyanDim;
  ctx.lineWidth = Math.max(1, W * 0.0012);

  // top and bottom trace lines with nodes
  for (let x = inset; x <= W - inset; x += nodeSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, inset);
    ctx.lineTo(Math.min(x + nodeSpacing * 0.55, W - inset), inset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, H - inset);
    ctx.lineTo(Math.min(x + nodeSpacing * 0.55, W - inset), H - inset);
    ctx.stroke();

    ctx.fillStyle = PALETTE.cyan;
    ctx.beginPath();
    ctx.arc(x, inset, nodeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, H - inset, nodeRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // left and right trace lines with nodes
  for (let y = inset; y <= H - inset; y += nodeSpacing) {
    ctx.beginPath();
    ctx.moveTo(inset, y);
    ctx.lineTo(inset, Math.min(y + nodeSpacing * 0.55, H - inset));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W - inset, y);
    ctx.lineTo(W - inset, Math.min(y + nodeSpacing * 0.55, H - inset));
    ctx.stroke();

    ctx.fillStyle = PALETTE.violet;
    ctx.beginPath();
    ctx.arc(inset, y, nodeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W - inset, y, nodeRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draws a rounded gradient pill (cyan-to-violet) behind the generated title text. */
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

  const gradient = ctx.createLinearGradient(x, topY, x + pillW, topY);
  gradient.addColorStop(0, PALETTE.cyan);
  gradient.addColorStop(1, PALETTE.violet);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x + r, topY);
  ctx.arcTo(x + pillW, topY, x + pillW, topY + pillH, r);
  ctx.arcTo(x + pillW, topY + pillH, x, topY + pillH, r);
  ctx.arcTo(x, topY + pillH, x, topY, r);
  ctx.arcTo(x, topY, x + pillW, topY, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#0A0D14";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, cx, y);
}

/** Clips a rounded-rect canvas region and punches a semicircular notch in the top edge, like a lanyard card. */
function clipTicketShape(ctx: CanvasRenderingContext2D, W: number, H: number, radius: number) {
  const notchR = W * 0.032;
  const notchY = H * 0.018;

  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(W / 2 - notchR - 4, 0);
  // notch cut (arc drawn "into" the card, counter-clockwise so it subtracts)
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

  // --- background: near-black gradient, matching hhgoa.com's dark base ---
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, PALETTE.bgTop);
  bg.addColorStop(1, PALETTE.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  drawCircuitBorder(ctx, W, H);

  // --- photo area ---
  const pad = W * 0.1;
  const photoSize = isPortrait ? W - pad * 2 : H - pad * 2;
  const photoX = isPortrait ? pad : pad;
  const photoY = pad;
  const photoW = photoSize;
  const photoH = photoSize;

  // cyan ring behind the photo
  ctx.save();
  ctx.strokeStyle = PALETTE.cyan;
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

  drawText(ctx, "AI × CRYPTO · MULTICHAIN", W / 2, H - H * 0.075, {
    font: `600 ${Math.round(W * 0.02)}px "Inter", sans-serif`,
    color: PALETTE.violet,
    align: "center",
    letterSpacing: 2,
  });

  drawText(ctx, "HACKER HOUSE · GOA, INDIA", W / 2, H - H * 0.05, {
    font: `600 ${Math.round(W * 0.022)}px "Inter", sans-serif`,
    color: PALETTE.cyan,
    align: "center",
    letterSpacing: 2.5,
  });

  drawText(ctx, "28–31 OCT 2026", W / 2, H - H * 0.028, {
    font: `500 ${Math.round(W * 0.018)}px "Inter", sans-serif`,
    color: PALETTE.muted,
    align: "center",
    letterSpacing: 1.5,
  });

  ctx.restore();

  // outer edge stroke (drawn after restore, unclipped, so it traces the notch silhouette cleanly)
  if (isPortrait) {
    ctx.save();
    clipTicketShape(ctx, W, H, W * 0.03);
    ctx.strokeStyle = PALETTE.cyan;
    ctx.lineWidth = W * 0.004;
    ctx.stroke();
    ctx.restore();
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