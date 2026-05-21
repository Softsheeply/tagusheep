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
        <a href="/import" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">Import from URL</div>
          <p className="text-sm text-white/70 mt-2">Fetch one product page and save a live record with source metadata.</p>
        </a>
        <a href="/import/bulk" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">Bulk URL import</div>
          <p className="text-sm text-white/70 mt-2">Paste many product URLs and save all successful imports as pending.</p>
        </a>
        <a href="/import/csv" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">CSV import</div>
          <p className="text-sm text-white/70 mt-2">Upload a Google Sheets CSV export and send rows into the review queue.</p>
        </a>
        <a href="/import/paste" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">Paste scrape cleaner</div>
          <p className="text-sm text-white/70 mt-2">Paste raw scrape output and turn it into review-ready product rows.</p>
        </a>
        <a href="/imports-review" className="rounded-2xl border border-amber-300/40 bg-amber-400/15 p-4 shadow-[0_12px_40px_rgba(251,191,36,0.14)] transition hover:border-amber-200/70 hover:bg-amber-300/20">
          <div className="font-semibold text-amber-100">Import review queue</div>
          <p className="mt-2 text-sm text-amber-50/85">Approve partial imports, discard junk, and promote good candidates into the main database.</p>
        </a>
        <a href="/tools/rn-audit" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">RN audit</div>
          <p className="text-sm text-white/70 mt-2">Review RN coverage and clean up missing or inconsistent records.</p>
        </a>
        <a href="/submissions-review" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">Corrections & reports</div>
          <p className="text-sm text-white/70 mt-2">Review community-submitted corrections and problem reports.</p>
        </a>
      </div>
      </main>
    </AdminGate>
  );
}
