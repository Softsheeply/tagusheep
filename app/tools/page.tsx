import Link from "next/link";
import AdminGate from "@/app/components/AdminGate";

export default function ToolsHome() {
  return (
    <AdminGate
      title="Tagsheep tools"
      description="Use these live tools to grow and maintain the database: import real products, audit RN coverage, and work toward cleaner searchable records."
    >
      <main className="max-w-4xl mx-auto p-6 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Admin tools</p>
        <h1 className="text-2xl font-semibold">Tagsheep tools</h1>
        <p className="text-white/70 mt-2 max-w-2xl">
          Use these live tools to grow and maintain the database: import real products, audit RN coverage, and work toward cleaner searchable records.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Link href="/import" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">Import from URL</div>
          <p className="text-sm text-white/70 mt-2">Fetch one product page and save a live record with source metadata.</p>
        </Link>
        <Link href="/import/bulk" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">Bulk URL import</div>
          <p className="text-sm text-white/70 mt-2">Paste many product URLs and save all successful imports as pending.</p>
        </Link>
        <Link href="/import/csv" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">CSV import</div>
          <p className="text-sm text-white/70 mt-2">Upload a Google Sheets CSV export and send rows into the review queue.</p>
        </Link>
        <Link href="/import/paste" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">Paste scrape cleaner</div>
          <p className="text-sm text-white/70 mt-2">Paste raw scrape output and turn it into review-ready product rows.</p>
        </Link>
        <Link href="/imports-review" className="rounded-2xl border border-amber-300/40 bg-amber-400/15 p-4 shadow-[0_12px_40px_rgba(251,191,36,0.14)] transition hover:border-amber-200/70 hover:bg-amber-300/20">
          <div className="font-semibold text-amber-100">Import review queue</div>
          <p className="mt-2 text-sm text-amber-50/85">Approve partial imports, discard junk, and promote good candidates into the main database.</p>
        </Link>
        <Link href="/tools/rn-audit" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">RN audit</div>
          <p className="text-sm text-white/70 mt-2">Review RN coverage and clean up missing or inconsistent records.</p>
        </Link>
        <Link href="/tools/category-audit" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">Category audit</div>
          <p className="text-sm text-white/70 mt-2">Find every record missing a category and assign one from the fixed list.</p>
        </Link>
        <Link href="/tools/duplicate-scanner" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">Duplicate scanner</div>
          <p className="text-sm text-white/70 mt-2">Find live records that share a brand + style number or an RN.</p>
        </Link>
        <Link href="/submissions-review" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">Corrections & reports</div>
          <p className="text-sm text-white/70 mt-2">Review community-submitted corrections and problem reports.</p>
        </Link>
        <Link href="/tools/wanted" className="rounded-2xl border border-sky-300/40 bg-sky-400/10 p-4 transition hover:border-sky-200/70 hover:bg-sky-300/15">
          <div className="font-semibold text-sky-100">Most wanted</div>
          <p className="mt-2 text-sm text-sky-50/85">See what people search for that turns up nothing, ranked by frequency.</p>
        </Link>
      </div>
      </main>
    </AdminGate>
  );
}
