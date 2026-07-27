import Image from "next/image";

// next/image throws at runtime for any hostname not in next.config.ts's
// images.remotePatterns. Imported/legacy records can reference arbitrary
// retailer image URLs we don't control, so only Firebase-hosted images
// (the ones we uploaded ourselves) get the optimized path -- everything
// else falls back to a plain img tag.
const OPTIMIZABLE_HOSTS = new Set(["firebasestorage.googleapis.com"]);

function isOptimizable(src: string) {
  // A same-origin local asset (e.g. /badges/foo.png) is always safe.
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    return OPTIMIZABLE_HOSTS.has(new URL(src).hostname);
  } catch {
    // Blob/data URLs (e.g. a freshly-picked file preview before upload)
    // aren't fetchable by next/image's optimizer -- plain img is correct.
    return false;
  }
}

type SmartImageProps = {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
} & (
  | { fill: true; sizes?: string; width?: never; height?: never }
  | { fill?: false; sizes?: never; width: number; height: number }
);

export default function SmartImage({ src, alt, className, loading, ...rest }: SmartImageProps) {
  if (!isOptimizable(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={className} loading={loading ?? "lazy"} />
    );
  }

  if (rest.fill) {
    return <Image src={src} alt={alt} fill sizes={rest.sizes} className={className} loading={loading ?? "lazy"} />;
  }

  return <Image src={src} alt={alt} width={rest.width} height={rest.height} className={className} loading={loading ?? "lazy"} />;
}
