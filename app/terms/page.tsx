import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use · Tagsheep",
  description: "Terms for using Tagsheep and contributing tag records.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold">Terms of Use</h1>
      <p className="mt-2 text-sm text-white/55">Last updated: August 6, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/75">
        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">Acceptance</h2>
          <p>
            By using Tagsheep you agree to these terms and our{" "}
            <Link href="/privacy" className="underline hover:text-white">
              Privacy Policy
            </Link>
            . If you do not agree, do not use the service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">What the service is</h2>
          <p>
            Tagsheep is an early community archive for clothing tag identifiers (brand, RN, style
            number, materials, and related photos). It is provided as-is during invite testing and
            may change, break, or lose data without notice.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">Accounts</h2>
          <p>
            You must sign in with a supported provider (currently Google) to contribute. You are
            responsible for activity under your account. Do not share credentials or try to access
            another person&apos;s account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">Your contributions</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Only upload photos and text you have the right to share. Prefer photos you took of tags
              you physically have.
            </li>
            <li>
              Do not upload illegal content, personal data about other people, or material that
              infringes someone else&apos;s rights.
            </li>
            <li>
              By submitting a record you grant Tagsheep a non-exclusive, worldwide, royalty-free
              license to host, display, reproduce, and adapt that contribution so the database can
              operate and improve (including generating thumbnails and search text).
            </li>
            <li>
              Community uploads appear publicly as <span className="text-white/90">pending</span>{" "}
              records. Operators may edit, verify, reject, or remove submissions.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">Acceptable use</h2>
          <p>
            Do not scrape the site abusively, attempt to bypass access controls, spam fake records,
            or use Tagsheep to harm others. We may suspend accounts that violate these terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">No warranties</h2>
          <p>
            Identifier lookups and verification badges are best-effort community data, not legal or
            commercial guarantees about a garment. The service is provided without warranties of any
            kind, express or implied.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, Tagsheep and its operators are not liable for
            indirect, incidental, or consequential damages arising from your use of the service or
            reliance on any record.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">Changes</h2>
          <p>
            We may update these terms as the product evolves. Continued use after an update means you
            accept the revised terms.
          </p>
        </section>
      </div>
    </main>
  );
}
