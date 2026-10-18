export const IMAGE_POLICY = {
  format: "webp",
  mimeType: "image/webp",
  maxDimension: 1600,
  thumbnailMaxDimension: 480,
  quality: 0.84,
  thumbnailQuality: 0.76,
  maxImportedImageUrlCount: 8,
} as const;

const CAPTURE_IMAGE_POLICY = {
  maxDimension: 900,
  quality: 0.5,
  maxBytes: 180_000,
} as const;

async function decodeBitmap(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, dw: number, dh: number) => void; close: () => void }> {
  try {
    // Modern browsers decode EXIF orientation before exposing bitmap
    // dimensions. Drawing that already-oriented bitmap directly avoids the
    // former double-orientation path that produced black bands and clipped
    // portrait phone photos.
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      width: bmp.width,
      height: bmp.height,
      draw: (ctx, dw, dh) => ctx.drawImage(bmp, 0, 0, dw, dh),
      close: () => bmp.close(),
    };
  } catch {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not decode image"));
      image.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, dw, dh) => ctx.drawImage(img, 0, 0, dw, dh),
      close: () => URL.revokeObjectURL(url),
    };
  }
}

async function imageFileFromUrl(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not download image (${response.status}).`);
  return new File([await response.blob()], "photo-edit-source", {
    type: response.headers.get("content-type") || "image/jpeg",
  });
}

function canvasFile(canvas: HTMLCanvasElement, prefix: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob
        ? resolve(new File([blob], `${prefix}-${Date.now()}.${IMAGE_POLICY.format}`, { type: IMAGE_POLICY.mimeType }))
        : reject(new Error("Could not encode the edited image.")),
      IMAGE_POLICY.mimeType,
      IMAGE_POLICY.quality
    );
  });
}

export async function rotateImageClockwise(url: string): Promise<File> {
  const decoded = await decodeBitmap(await imageFileFromUrl(url));
  const canvas = document.createElement("canvas");
  canvas.width = decoded.height;
  canvas.height = decoded.width;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    decoded.close();
    throw new Error("This browser could not rotate the image.");
  }
  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  decoded.draw(ctx, decoded.width, decoded.height);
  decoded.close();
  return canvasFile(canvas, "rotated");
}

export type ImageCrop = { x: number; y: number; width: number; height: number };

export async function cropImage(url: string, crop: ImageCrop): Promise<File> {
  const decoded = await decodeBitmap(await imageFileFromUrl(url));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = decoded.width;
  sourceCanvas.height = decoded.height;
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) {
    decoded.close();
    throw new Error("This browser could not crop the image.");
  }
  decoded.draw(sourceCtx, decoded.width, decoded.height);
  decoded.close();

  const sx = Math.round((crop.x / 100) * sourceCanvas.width);
  const sy = Math.round((crop.y / 100) * sourceCanvas.height);
  const sw = Math.max(1, Math.round((crop.width / 100) * sourceCanvas.width));
  const sh = Math.max(1, Math.round((crop.height / 100) * sourceCanvas.height));
  const scale = Math.min(1, IMAGE_POLICY.maxDimension / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser could not crop the image.");
  ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvasFile(canvas, "cropped");
}

async function normalizeImage(file: File, maxDimension: number, quality: number): Promise<File> {
  try {
    const decoded = await decodeBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height));
    const srcW = Math.round(decoded.width * scale);
    const srcH = Math.round(decoded.height * scale);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      decoded.close();
      return file;
    }

    canvas.width = srcW;
    canvas.height = srcH;
    decoded.draw(ctx, srcW, srcH);
    decoded.close();

    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, IMAGE_POLICY.mimeType, quality));
    if (!blob) return file;

    const name = file.name.replace(/\.(png|jpe?g|gif|webp|heic|heif)$/i, "") + ".webp";
    return new File([blob], name, { type: IMAGE_POLICY.mimeType });
  } catch {
    return file;
  }
}

export async function normalizeUploadedImage(file: File): Promise<File> {
  return normalizeImage(file, IMAGE_POLICY.maxDimension, IMAGE_POLICY.quality);
}

export async function normalizeCaptureImage(file: File): Promise<File> {
  const steps: Array<[number, number]> = [
    [CAPTURE_IMAGE_POLICY.maxDimension, CAPTURE_IMAGE_POLICY.quality],
    [800, 0.44],
    [720, 0.4],
    [640, 0.36],
    [540, 0.32],
    [480, 0.28],
  ];
  let normalized = file;
  for (const [dimension, quality] of steps) {
    normalized = await normalizeImage(normalized, dimension, quality);
    if (normalized.size <= CAPTURE_IMAGE_POLICY.maxBytes) return normalized;
  }
  return normalized;
}

export async function fitCaptureImages(files: File[], maxTotalBytes: number): Promise<File[]> {
  const prepared: File[] = [];
  for (const file of files) {
    prepared.push(await normalizeCaptureImage(file));
  }

  const extraSteps: Array<[number, number]> = [
    [420, 0.26],
    [360, 0.22],
  ];
  for (const [dimension, quality] of extraSteps) {
    const total = prepared.reduce((sum, file) => sum + file.size, 0);
    if (total <= maxTotalBytes) return prepared;
    for (let index = 0; index < prepared.length; index++) {
      prepared[index] = await normalizeImage(prepared[index], dimension, quality);
    }
  }
  return prepared;
}

export async function normalizeThumbnailImage(file: File): Promise<File> {
  return normalizeImage(file, IMAGE_POLICY.thumbnailMaxDimension, IMAGE_POLICY.thumbnailQuality);
}

export async function fetchRemoteImageAsFile(url: string, baseName: string, idToken: string) {
  const response = await fetch(`/api/import-image?url=${encodeURIComponent(url)}`, {
    cache: "no-store",
    headers: { authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) {
    let errorMessage = `Image fetch failed: ${response.status}`;
    try {
      const payload = await response.json();
      errorMessage = payload?.error || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const sourceType = blob.type || "application/octet-stream";
  const extension = sourceType.includes("png")
    ? ".png"
    : sourceType.includes("gif")
      ? ".gif"
      : sourceType.includes("webp")
        ? ".webp"
        : ".jpg";

  return new File([blob], `${baseName}${extension}`, { type: sourceType });
}
