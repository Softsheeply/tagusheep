export const IMAGE_POLICY = {
  format: "webp",
  maxDimension: 1600,
  quality: 0.84,
  maxImportedImageUrlCount: 8,
} as const;

async function readExifOrientation(file: File): Promise<number | null> {
  const buf = await file.slice(0, 64 * 1024).arrayBuffer();
  const view = new DataView(buf);
  let offset = 2;
  const length = view.byteLength;
  if (view.getUint16(0, false) !== 0xffd8) return null;

  while (offset < length) {
    const marker = view.getUint16(offset, false);
    offset += 2;
    if (marker === 0xffe1) {
      const size = view.getUint16(offset, false);
      offset += 2;
      if (view.getUint32(offset, false) === 0x45786966 && view.getUint16(offset + 4, false) === 0x0000) {
        const tiffOffset = offset + 6;
        const little = view.getUint16(tiffOffset, false) === 0x4949;
        const get16 = (o: number) => view.getUint16(o, little);
        const get32 = (o: number) => view.getUint32(o, little);
        if (get16(tiffOffset + 2) !== 0x002a) return null;
        const firstIFDOffset = get32(tiffOffset + 4);
        if (!firstIFDOffset) return null;

        const dirStart = tiffOffset + firstIFDOffset;
        const entries = get16(dirStart);
        for (let i = 0; i < entries; i++) {
          const entryOffset = dirStart + 2 + i * 12;
          const tag = get16(entryOffset);
          if (tag === 0x0112) return get16(entryOffset + 8) || 1;
        }
        return null;
      } else {
        offset += size - 2;
      }
    } else if ((marker & 0xff00) !== 0xff00) {
      break;
    } else {
      offset += view.getUint16(offset, false);
    }
  }
  return null;
}

function applyCanvasOrientation(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  orientation: number
): { dw: number; dh: number } {
  switch (orientation) {
    case 2:
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      return { dw: w, dh: h };
    case 3:
      ctx.translate(w, h);
      ctx.rotate(Math.PI);
      return { dw: w, dh: h };
    case 4:
      ctx.translate(0, h);
      ctx.scale(1, -1);
      return { dw: w, dh: h };
    case 5:
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      return { dw: h, dh: w };
    case 6:
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(0, -h);
      return { dw: h, dh: w };
    case 7:
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(w, -h);
      ctx.scale(-1, 1);
      return { dw: h, dh: w };
    case 8:
      ctx.rotate(-0.5 * Math.PI);
      ctx.translate(-w, 0);
      return { dw: h, dh: w };
    default:
      return { dw: w, dh: h };
  }
}

export async function normalizeUploadedImage(file: File): Promise<File> {
  try {
    const orientation = await readExifOrientation(file);
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, IMAGE_POLICY.maxDimension / Math.max(bmp.width, bmp.height));
    const srcW = Math.round(bmp.width * scale);
    const srcH = Math.round(bmp.height * scale);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    if (orientation && orientation >= 5 && orientation <= 8) {
      canvas.width = srcH;
      canvas.height = srcW;
    } else {
      canvas.width = srcW;
      canvas.height = srcH;
    }

    const { dw, dh } = applyCanvasOrientation(ctx, srcW, srcH, orientation || 1);
    ctx.drawImage(bmp, 0, 0, dw, dh);

    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/webp", IMAGE_POLICY.quality));
    if (!blob) return file;

    const name = file.name.replace(/\.(png|jpe?g|gif|webp)$/i, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file;
  }
}
