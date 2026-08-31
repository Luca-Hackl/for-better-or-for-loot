/**
 * Client-side image compression. Downscales to a max dimension and re-encodes
 * as WebP (JPEG fallback) so uploaded screenshots/maps stay small — keeping
 * Supabase Storage well within the free tier. Runs in the browser only.
 */

export interface Compressed {
  file: File;
  width: number;
  height: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

export async function compressImage(
  file: File,
  opts?: { maxDim?: number; quality?: number },
): Promise<Compressed> {
  const maxDim = opts?.maxDim ?? 1600;
  const quality = opts?.quality ?? 0.8;

  if (typeof document === "undefined" || !file.type.startsWith("image/")) {
    return { file, width: 0, height: 0 };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return { file, width: 0, height: 0 };
  }

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { file, width: srcW, height: srcH };
  ctx.drawImage(img, 0, 0, w, h);
  if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);

  const blob =
    (await toBlob(canvas, "image/webp", quality)) ??
    (await toBlob(canvas, "image/jpeg", quality));
  if (!blob) return { file, width: srcW, height: srcH };

  // If compression somehow produced a larger file than the original, keep original.
  if (blob.size >= file.size) return { file, width: srcW, height: srcH };

  const ext = blob.type.includes("webp") ? "webp" : "jpg";
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  const out = new File([blob], `${base}.${ext}`, { type: blob.type });
  return { file: out, width: w, height: h };
}
