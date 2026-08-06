import Link from "next/link";

const goodPhotos = [
  "Clear and in focus",
  "Bright and well lit",
  "Close enough to read the tag",
  "Straight, not tilted",
  "Shows full tag or item clearly",
  "Shows brand label",
  "Shows style number / inner tag",
  "Shows size tag",
  "Shows care/content tag",
  "Shows full item if helpful",
];

const badPhotos = [
  "Blurry",
  "Dark",
  "Far away",
  "Cropped too much",
  "Blocked by fingers",
  "Wrinkled or folded so info is hidden",
  "Low-quality screenshots",
  "Too many items in one photo",
  "Unreadable tag text",
];

export default function UploadGuidePage() {
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Upload guide</p>
        <h1 className="text-3xl font-semibold">How to upload to Tagsheep</h1>
        <p className="mt-2 max-w-3xl text-white/70">
          Add what you know now. The best records start simple and get better over time.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">How to upload</h2>
        <ol className="mt-4 space-y-3 list-decimal list-inside text-white/80">
          <li>Take clear photos of the clothing tag and item.</li>
          <li>Add the brand.</li>
          <li>Add the style number if available.</li>
          <li>Choose the clothing type.</li>
          <li>Add size, color, material, and tags if known.</li>
          <li>Submit — it goes live as a pending tag.</li>
        </ol>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/8 p-6">
          <h2 className="text-xl font-semibold text-white">Good photos</h2>
          <ul className="mt-4 space-y-2 text-white/80">
            {goodPhotos.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>

        <div className="rounded-2xl border border-rose-300/20 bg-rose-400/8 p-6">
          <h2 className="text-xl font-semibold text-white">Bad photos</h2>
          <ul className="mt-4 space-y-2 text-white/80">
            {badPhotos.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
        Upload clear, well-lit photos of the brand tag, style number, and item. Avoid blurry, dark, cropped, or unreadable photos. The better the photo, the easier it is to verify and identify the item.
      </div>

      <div className="flex gap-3">
        <Link href="/upload" className="rounded-xl bg-emerald-400/90 px-4 py-2 font-semibold text-black">Go to upload</Link>
        <Link href="/tags" className="rounded-xl border border-white/15 px-4 py-2 text-white">Browse database</Link>
      </div>
    </main>
  );
}
