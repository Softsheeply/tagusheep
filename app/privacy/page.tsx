import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · Tagsheep",
  description: "How Tagsheep collects, uses, and shares information.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-white/55">Last updated: August 6, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/75">
        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">What Tagsheep is</h2>
          <p>
            Tagsheep is a community-built clothing tag database. People sign in, upload photos of
            garment care and brand tags, and look up brands, RN numbers, and style numbers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">Information we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="text-white/90">Account data</span> — when you sign in with Google we
              receive your Firebase Auth user id, display name, and email address from that provider.
            </li>
            <li>
              <span className="text-white/90">Contributions</span> — tag photos you upload, the
              fields you fill in (brand, RN, style number, materials, notes, and similar), and who
              created each record.
            </li>
            <li>
              <span className="text-white/90">Usage signals</span> — optional product analytics and
              error monitoring (for example Vercel Analytics / Speed Insights and Sentry) when those
              services are enabled in the deployed environment. These help us understand load and
              fix crashes; they are not used to sell ads.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">How we use it</h2>
          <p>
            We use this information to operate the database, show records in browse and search,
            attribute contributions, moderate spam or abusive content, and keep the service reliable.
            Tag photos and public record fields are intended to be visible to other users of the site.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">Where data is stored</h2>
          <p>
            Authentication and database records are stored with Firebase (Google). Uploaded photos
            are stored in Cloudflare Images when configured, otherwise in Firebase Storage. Hosting
            may run on Vercel or a similar provider.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">Sharing</h2>
          <p>
            We do not sell your personal information. We share data with the infrastructure
            providers listed above as needed to run the product, and if required by law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">Your choices</h2>
          <p>
            You can sign out at any time. If you want a contribution removed or an account deleted,
            contact the operator using the email associated with your Tagsheep admin account / invite,
            or through the channel you received this invite from. Public tag records may remain if
            they are useful to the archive, with identifying account details removed where practical.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">Children</h2>
          <p>
            Tagsheep is not directed at children under 13, and we do not knowingly collect personal
            information from them.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">Changes</h2>
          <p>
            We may update this policy as the product grows. The date at the top will change when we do.
            Continued use after an update means you accept the revised policy.
          </p>
        </section>

        <p className="pt-2">
          See also our <Link href="/terms" className="underline hover:text-white">Terms of Use</Link>.
        </p>
      </div>
    </main>
  );
}
