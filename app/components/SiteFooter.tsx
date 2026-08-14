import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-white/10 bg-black/20">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {year} Tagsheep. A community clothing tag database.
        </p>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Legal">
          <Link href="/privacy" className="transition hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-white">
            Terms
          </Link>
          <Link href="/upload-guide" className="transition hover:text-white">
            Upload guide
          </Link>
        </nav>
      </div>
    </footer>
  );
}
