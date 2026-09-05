import Link from "next/link";
import AdminGate from "@/app/components/AdminGate";

export default function ToolsHome() {
  return (
    <AdminGate
      title="Tagsheep tools"
      description="Capture garments and maintain the TagSheep database."
    >
      <main className="max-w-4xl mx-auto p-6 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Admin tools</p>
        <h1 className="text-2xl font-semibold">Tagsheep tools</h1>
        <p className="text-white/70 mt-2 max-w-2xl">
          Capture garments, add records from official product pages, and clean up the database.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/capture" className="rounded-2xl border border-emerald-300/50 bg-emerald-400/15 p-4 shadow-[0_12px_40px_rgba(52,211,153,0.14)] transition hover:border-emerald-200/80 hover:bg-emerald-300/20">
          <div className="font-semibold text-emerald-100">Capture a garment</div>
          <p className="mt-2 text-sm text-emerald-50/85">Take several photos, analyze them together, and upload one finished TagSheep record.</p>
        </Link>
        <Link href="/import" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-emerald-300/40 transition">
          <div className="font-semibold">Import from URL</div>
          <p className="text-sm text-white/70 mt-2">Fetch one product page and save a live record with source metadata.</p>
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
      </div>
      </main>
    </AdminGate>
  );
}
