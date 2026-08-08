// lib/heic.ts
// Client-only HEIC/HEIF -> JPEG conversion.
// heic2any touches browser globals, so it must NEVER be statically imported —
// that would break SSR/build. Always dynamic-import inside this function.

const HEIC_SIGNATURES = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];

/** True if a file is (or looks like) an iPhone HEIC/HEIF photo. */
export function isHeic(file: File): boolean {
  if (HEIC_SIGNATURES.includes(file.type)) return true;
  // Safari/iOS sometimes reports an empty MIME type for HEIC — fall back to extension.
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

/**
 * Converts a HEIC/HEIF File to a JPEG Blob.
 * Safe to call on non-HEIC files too — it will just no-op and return the original.
 */
export async function convertHeicIfNeeded(file: File): Promise<Blob> {
  if (!isHeic(file)) return file;

  // Dynamic import: keeps heic2any out of the server bundle entirely.
  const heic2any = (await import("heic2any")).default;

  try {
    const result = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });
    // heic2any can return an array for multi-image HEIC containers — take the first frame.
    return Array.isArray(result) ? result[0] : result;
  } catch (err) {
    throw new Error(
      "Couldn't convert this HEIC photo. Try exporting it as JPG from your Photos app and upload again."
    );
  }
}