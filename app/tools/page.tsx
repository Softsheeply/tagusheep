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
        <a href="/imports-review" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">Import review queue</div>
          <p className="text-sm text-white/70 mt-2">Approve partial imports, discard junk, and promote good candidates into the main database.</p>
        </a>
        <a href="/tools/rn-audit" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">RN audit</div>
          <p className="text-sm text-white/70 mt-2">Review RN coverage and clean up missing or inconsistent records.</p>
        </a>
        <a href="/trash" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">Trash & recovery</div>
          <p className="text-sm text-white/70 mt-2">Restore soft-deleted records or permanently purge bad entries.</p>
        </a>
      </div>
      </main>
    </AdminGate>
  );
}
