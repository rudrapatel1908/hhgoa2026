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
  role?: string; // e.g. "HACKER" — small pill badge above the name
  teamName?: string; // e.g. "SIGMASTACK" — shown in the ID-card details row
  connectUrl?: string; // URL encoded into the QR code; defaults to the event site
};

export const CARD_SIZE = { width: 1080, height: 1350 }; // 4:5 portrait
export const OG_SIZE = { width: 1200, height: 630 }; // Twitter summary_large_image

/**
 * Generates a QR code as a loaded HTMLImageElement, or null if generation
 * fails for any reason — callers must handle the null case by simply
 * skipping the QR (drawing a placeholder), never by crashing the card render.
 */
async function generateQrImage(text: string): Promise<HTMLImageElement | null> {
  try {
    const QRCode = (await import("qrcode")).default;
    const dataUrl: string = await QRCode.toDataURL(text, {
      margin: 0,
      width: 256,
      color: { dark: "#14251C", light: "#00000000" },
    });
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("QR image failed to load"));
      img.src = dataUrl;
    });
  } catch {
    return null;
  }
}

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
/**
 * Visual direction: official cream/green Goan-badge ID card. An earlier
 * tropical/cyberpunk direction was explored and superseded — see git
 * history if that palette is ever needed again.
 */

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

function clipTicketShape(ctx: CanvasRenderingContext2D, W: number, H: number, radius: number) {
  const notchR = W * 0.032;
  // Notch center sits exactly ON the top edge (y=0), not offset above it —
  // keeping the path flush with y=0 everywhere except the bite itself is
  // what avoids the stray diagonal seam near the top-right corner.
  const notchY = 0;

  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(W / 2 - notchR, 0);
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

async function renderToCanvas(
  data: CardData,
  size: { width: number; height: number }
) {
  const { canvas, ctx } = createCanvas(size.width, size.height);
  const { width: W, height: H } = size;
  const isPortrait = W < H;

  if (isPortrait) {
    await drawCardPortrait(ctx, data, W, H);
  } else {
    await drawCardLandscapeOG(ctx, data, W, H);
  }

  return canvas;
}

/**
 * Strict hardcoded-coordinate layout for the 1080x1350 card. Every Y-position
 * and font size below is fixed, not proportional — this is intentional, to
 * guarantee the photo, text, pill, and footer never overlap or squish
 * regardless of name/title length.
 */
// Official-badge palette: cream body, deep Goan green bands, gold accents.
const BADGE = {
  cream: "#F4EEDD",
  green: "#1B4332",
  greenDark: "#0F291E",
  gold: "#FFD700",
  pillPink: "#D6247C",
  textDark: "#14251C",
  textMuted: "#5B6B5F",
};

/** Simple flat palm-tree silhouette, hand-coded as basic shapes (not illustrated line art). */
function drawPalmSilhouette(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(244, 238, 221, 0.35)";
  // trunk
  ctx.fillRect(-4, 0, 8, 60);
  // fronds
  for (let i = 0; i < 5; i++) {
    const angle = (i / 4) * Math.PI * 0.8 - Math.PI * 0.9;
    ctx.save();
    ctx.translate(0, 0);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(30, 0, 32, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** Simple flat scooter silhouette. */
function drawScooterSilhouette(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(244, 238, 221, 0.5)";
  ctx.beginPath();
  ctx.arc(-20, 15, 9, 0, Math.PI * 2);
  ctx.arc(20, 15, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-20, -5, 40, 10);
  ctx.fillRect(15, -20, 6, 20);
  ctx.restore();
}

/** Simple flat sailboat silhouette. */
function drawSailboatSilhouette(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(244, 238, 221, 0.5)";
  ctx.beginPath();
  ctx.moveTo(-25, 15);
  ctx.lineTo(25, 15);
  ctx.lineTo(15, 22);
  ctx.lineTo(-15, 22);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 15);
  ctx.lineTo(0, -25);
  ctx.lineTo(18, 15);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Official-badge layout for the 1080x1350 card: cream body, green header
 * and footer bands, circular photo overlapping the boundary, role pill,
 * name/role hierarchy, dashed divider, QR code, and team name field.
 */
async function drawCardPortrait(ctx: CanvasRenderingContext2D, data: CardData, W: number, H: number) {
  ctx.save();
  clipTicketShape(ctx, W, H, 30);

  // --- cream body base ---
  ctx.fillStyle = BADGE.cream;
  ctx.fillRect(0, 0, W, H);

  // --- header band (green) ---
  const headerH = 300;
  ctx.fillStyle = BADGE.green;
  ctx.fillRect(0, 0, W, headerH);
  drawPalmSilhouette(ctx, 90, headerH - 60, 1.1);
  drawPalmSilhouette(ctx, W - 90, headerH - 60, 1.1);

  drawText(ctx, "HACKER", 380, 90, {
    font: "bold 56px serif",
    color: BADGE.gold,
    align: "center",
  });
  drawText(ctx, "गोवा", 540, 90, {
    font: "bold 40px sans-serif",
    color: "#FF3DA6",
    align: "center",
  });
  drawText(ctx, "HOUSE", 700, 90, {
    font: "bold 56px serif",
    color: BADGE.gold,
    align: "center",
  });
  drawText(ctx, "GOA, INDIA", 90, 140, {
    font: "600 20px sans-serif",
    color: BADGE.gold,
    align: "left",
  });
  drawText(ctx, "28 - 31 OCT 2026", W - 90, 140, {
    font: "600 20px sans-serif",
    color: BADGE.cream,
    align: "right",
  });

  // --- footer band (green) ---
  const footerH = 190;
  ctx.fillStyle = BADGE.green;
  ctx.fillRect(0, H - footerH, W, footerH);
  drawScooterSilhouette(ctx, 160, H - 70, 1.4);
  drawSailboatSilhouette(ctx, W - 160, H - 90, 1.3);

  // logo badge circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(90, H - footerH + 40, 26, 0, Math.PI * 2);
  ctx.fillStyle = BADGE.pillPink;
  ctx.fill();
  ctx.restore();
  drawText(ctx, "HH", 90, H - footerH + 47, {
    font: "bold 20px sans-serif",
    color: BADGE.cream,
    align: "center",
  });
  drawText(ctx, "BUILDING · LEARNING · CONNECTING", 540, H - footerH + 48, {
    font: "600 17px sans-serif",
    color: BADGE.cream,
    align: "center",
    letterSpacing: 1,
  });
  drawText(ctx, "#FrameInGoa", W - 90, H - footerH + 48, {
    font: "bold 20px sans-serif",
    color: BADGE.gold,
    align: "right",
  });

  // --- photo: circular, overlapping the header/body boundary ---
  const photoR = 150;
  const photoCx = W / 2;
  const photoCy = headerH;

  ctx.save();
  ctx.beginPath();
  ctx.arc(photoCx, photoCy, photoR, 0, Math.PI * 2);
  ctx.clip();
  drawCoverImage(ctx, data.photo, photoCx - photoR, photoCy - photoR, photoR * 2, photoR * 2);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(photoCx, photoCy, photoR, 0, Math.PI * 2);
  ctx.strokeStyle = BADGE.gold;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();

  if (data.frame) {
    ctx.drawImage(data.frame, 0, 0, W, H);
  }

  // --- role pill, above the name ---
  const role = (data.role ?? "HACKER").toUpperCase();
  ctx.font = "bold 20px sans-serif";
  const roleW = ctx.measureText(role).width + 50;
  const roleX = photoCx - roleW / 2;
  const roleY = photoCy + photoR + 40;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(roleX, roleY, roleW, 40, 20);
  ctx.fillStyle = BADGE.pillPink;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.font = "bold 20px sans-serif";
  ctx.fillStyle = BADGE.cream;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(role, photoCx, roleY + 20);
  ctx.textBaseline = "alphabetic";
  ctx.restore();

  // --- name ---
  const nameY = roleY + 90;
  drawText(ctx, data.name, photoCx, nameY, {
    font: "bold 46px sans-serif",
    color: BADGE.textDark,
    align: "center",
  });

  // --- role/title line, with a small bracket-badge icon ---
  const titleY = nameY + 55;
  const titleText = data.title;
  ctx.font = "500 26px sans-serif";
  const titleW = ctx.measureText(titleText).width;
  const iconR = 16;
  const groupW = iconR * 2 + 12 + titleW;
  const groupStartX = photoCx - groupW / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(groupStartX + iconR, titleY - 9, iconR, 0, Math.PI * 2);
  ctx.fillStyle = "#2D6A4F";
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.font = "bold 14px monospace";
  ctx.fillStyle = BADGE.cream;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("</>", groupStartX + iconR, titleY - 8);
  ctx.textBaseline = "alphabetic";
  ctx.restore();

  drawText(ctx, titleText, groupStartX + iconR * 2 + 12, titleY, {
    font: "500 26px sans-serif",
    color: BADGE.textMuted,
    align: "left",
  });

  // --- dashed divider ---
  const dividerY = titleY + 50;
  ctx.save();
  ctx.strokeStyle = "#C9C2AA";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(90, dividerY);
  ctx.lineTo(W - 90, dividerY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // --- QR code (left) + team name (right) ---
  const rowY = dividerY + 50;
  const qrSize = 110;
  const qrImg = await generateQrImage(data.connectUrl ?? "https://hhgoa.com");
  if (qrImg) {
    ctx.drawImage(qrImg, 90, rowY, qrSize, qrSize);
  } else {
    // graceful fallback if QR generation fails — a dashed placeholder box
    ctx.save();
    ctx.strokeStyle = "#C9C2AA";
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(90, rowY, qrSize, qrSize);
    ctx.setLineDash([]);
    ctx.restore();
  }
  drawText(ctx, "CONNECT", 90 + qrSize + 20, rowY + 45, {
    font: "600 20px sans-serif",
    color: BADGE.textDark,
    align: "left",
  });
  drawText(ctx, "WITH US", 90 + qrSize + 20, rowY + 70, {
    font: "600 20px sans-serif",
    color: BADGE.textDark,
    align: "left",
  });

  const teamX = W - 90;
  drawText(ctx, "TEAM NAME", teamX, rowY + 30, {
    font: "600 18px sans-serif",
    color: BADGE.textMuted,
    align: "right",
    letterSpacing: 1,
  });
  drawText(ctx, (data.teamName ?? "SOLO BUILDER").toUpperCase(), teamX, rowY + 65, {
    font: "bold 26px sans-serif",
    color: BADGE.green,
    align: "right",
  });

  ctx.restore();

  // border, drawn last and unclipped so it traces the notch cleanly
  ctx.save();
  clipTicketShape(ctx, W, H, 30);
  ctx.strokeStyle = BADGE.gold;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

/**
 * Compact layout for the 1200x630 landscape OG/Twitter-card image — the
 * hardcoded portrait coordinates above don't fit this aspect ratio, so this
 * is a deliberately simpler side-by-side layout: photo left, text right.
 */
async function drawCardLandscapeOG(ctx: CanvasRenderingContext2D, data: CardData, W: number, H: number) {
  ctx.fillStyle = BADGE.cream;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = BADGE.green;
  ctx.fillRect(0, 0, W, 70);
  ctx.fillRect(0, H - 50, W, 50);

  const photoSize = 380;
  const photoX = 90;
  const photoY = (H - photoSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(photoX + photoSize / 2, H / 2, photoSize / 2, 0, Math.PI * 2);
  ctx.clip();
  drawCoverImage(ctx, data.photo, photoX, photoY, photoSize, photoSize);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(photoX + photoSize / 2, H / 2, photoSize / 2, 0, Math.PI * 2);
  ctx.strokeStyle = BADGE.gold;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();

  const textX = photoX + photoSize + 60;
  const textCenterX = textX + (W - textX - 60) / 2;

  drawText(ctx, "HACKER HOUSE GOA 2026", textCenterX, 150, {
    font: "bold 32px serif",
    color: BADGE.green,
    align: "center",
  });

  drawText(ctx, data.name, textCenterX, 330, {
    font: "bold 46px sans-serif",
    color: BADGE.textDark,
    align: "center",
  });

  drawText(ctx, data.title, textCenterX, 390, {
    font: "500 24px sans-serif",
    color: BADGE.textMuted,
    align: "center",
  });

  drawText(ctx, "#FrameInGoa", textCenterX, 480, {
    font: "bold 24px sans-serif",
    color: BADGE.pillPink,
    align: "center",
  });
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

export async function renderCardCanvas(data: CardData) {
  return renderToCanvas(data, CARD_SIZE);
}

export async function renderOgCanvas(data: CardData) {
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