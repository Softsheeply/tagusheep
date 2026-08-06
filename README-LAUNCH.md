# TaguSheep Launch Notes

## What is configured in the repo

- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- `firebase.json`
- `.firebaserc`

Project id:
- `tagusheep-72229`

## Before launch

### 1. Install Firebase CLI if needed

```powershell
npm install -g firebase-tools
```

### 2. Log in

```powershell
firebase login
```

### 3. Deploy rules and indexes

From the project root:

```powershell
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

### 4. Configure Storage CORS for browser uploads

If uploads from localhost or your live website stall at 0% and the browser console mentions CORS or preflight failure, apply the bucket CORS config.

**Before deploying**, edit `storage.cors.json` and make sure the `origin` list includes every domain the site is actually served from -- your final production domain, `www` variant if used, and any Vercel preview/production `*.vercel.app` URL you rely on.

Then apply it:

```powershell
gsutil cors set storage.cors.json gs://tagusheep-72229.firebasestorage.app
```

Note: newer Firebase projects get a default bucket named `<project-id>.firebasestorage.app`, not the older `<project-id>.appspot.com` convention. Run `gcloud storage buckets list` (after `gcloud config set project tagusheep-72229`) if you're ever unsure which bucket name is real -- using the wrong one fails with "404 The specified bucket does not exist."

If `gsutil` is unavailable, install Google Cloud SDK first. Re-run this command every time the origin list changes -- it does not auto-deploy with the rest of the app.

## Firebase Console checks

### Authentication
Enable:
- Google sign-in

Authorized domains should include:
- `localhost`
- your production website domain
- your Vercel domain if using Vercel

### Firestore
Confirm database is enabled.

### Storage
Confirm the storage bucket exists and matches:
- `tagusheep-72229.firebasestorage.app`

## Website deployment

Recommended stack:
- Vercel for the Next.js website
- Firebase for Auth / Firestore / Storage

### Required production env vars

Add these in your host dashboard:

- `NEXT_PUBLIC_FB_API_KEY`
- `NEXT_PUBLIC_FB_AUTH_DOMAIN`
- `NEXT_PUBLIC_FB_PROJECT_ID`
- `NEXT_PUBLIC_FB_STORAGE_BUCKET`
- `NEXT_PUBLIC_FB_APP_ID`

### Cloudflare Images (recommended for invite testing)

Community uploads prefer Cloudflare Images, then fall back to Firebase Storage
if Cloudflare is unset or briefly unavailable. Set these on the host:

- `CF_ACCOUNT_ID` — Cloudflare account id
- `CF_IMAGES_API_TOKEN` — API token with Images edit permission
- `CF_IMAGES_ACCOUNT_HASH` — from Images → Developer Resources
- `NEXT_PUBLIC_CF_IMAGES_HASH` — same hash (optional; used for docs/clients)

Create at least a `public` variant in the Cloudflare Images dashboard. Uploads
use the storage path as a custom image id so deletes stay path-based.

Without these vars the app still works: photos land in Firebase Storage.

### Optional env vars (each feature is a no-op until its var is set)

- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` — enables the Firebase App Check scaffold
  (`lib/firebase.ts`). Create a reCAPTCHA v3 site key in the Firebase Console
  under App Check, register the web app, set this var, confirm real traffic
  is sending valid tokens, then turn on enforcement for Firestore/Storage in
  the App Check console.
- `NEXT_PUBLIC_SENTRY_DSN` — enables client-side Sentry error capture
  (`instrumentation-client.ts`).
- `SENTRY_DSN` — enables server/edge-side Sentry error capture
  (`sentry.server.config.ts`, `sentry.edge.config.ts`, wired through
  `instrumentation.ts`).
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` — enables sourcemap
  upload during build (`next.config.ts`'s `withSentryConfig`); without
  `SENTRY_AUTH_TOKEN` this step is skipped and the build is unaffected.
- Vercel Analytics and Speed Insights (`app/layout.tsx`) ship in code but
  also need to be toggled on in the Vercel project dashboard before they
  start collecting data.

Create a Sentry project at sentry.io, grab its DSN from Project Settings,
and its org/project slugs and an auth token (Settings → Auth Tokens) if you
want sourcemap upload too.

## Seeding the database from an open dataset

`scripts/import-secondhand-dataset.mjs` imports the [Clothing Dataset for
Second-Hand Fashion](https://zenodo.org/records/13788681) (CC-BY 4.0, commercial use
permitted with attribution) — ~31,600 garments, each with a front photo, back photo,
and a close-up of the brand label, annotated by professional second-hand sorters.

The dataset carries **brand, material, colour, pattern, size and condition, but no RN
or style number** (it was built for sorting garments, not identifying them). The script
therefore runs OCR over each brand-label photo — the same extraction the `/upload` form
uses — to recover RN, style number, made-in and composition from what's actually printed
on the label. Dataset annotations win over OCR where both exist, since the dataset's
material readings come from an NIR scanner.

```bash
# 1. Inspect first -- touches nothing, reports the real folder layout and JSON keys
node scripts/import-secondhand-dataset.mjs --inspect --dataset ./clothing-dataset

# 2. Dry run -- full pipeline including OCR, no writes
node --env-file=.env.local scripts/import-secondhand-dataset.mjs \
  --dataset ./clothing-dataset --limit 20 --dry-run

# 3. Real import
TAGSHEEP_IMPORT_EMAIL=you@example.com TAGSHEEP_IMPORT_PASSWORD=... \
node --env-file=.env.local scripts/import-secondhand-dataset.mjs \
  --dataset ./clothing-dataset --limit 2000
```

Run from the repo root — OCR loads its language data from `public/tesseract/`.

Notes:
- **Start with `--inspect`.** The field mapping is written against the dataset's published
  documentation, not a copy that was opened and verified. Inspect prints the actual JSON
  keys and how they map, so a mismatch is a one-line fix in `FIELD_ALIASES` rather than a
  bad import.
- Only the brand-label photo is uploaded by default. `--with-garment-photos` also uploads
  the front/back shots — roughly triples storage use, and Firebase's free tier is 5 GB.
- Imported records are written with `sourceType: "archive"` plus attribution in
  `sourceName`/`sourceUrl`/`notes`. They're **excluded from the contributor leaderboard**,
  which ranks people who actually photographed tags.
- Progress is checkpointed to `<dataset>/.tagsheep-import-progress.json`, so the run is
  resumable and safe to interrupt.
- Writes go through the normal client SDK and the same Firestore/Storage rules a browser
  would hit — no service account, no rule bypass.

## Production smoke test checklist

After deploy, test:
- homepage loads
- Google sign-in works
- upload works (record appears in `/tags` as **pending**, not stuck in review)
- batch upload works
- import from URL works
- saving imported record works
- `/tags` search works
- `/style/[value]` works
- `/rn/[value]` works
- `/privacy` and `/terms` load; footer links work
- `/admin-test` and `/storage-test` return 404
- export page works

## Invite-test readiness (~50 users / ~100 tags)

Before sending invites:
1. Deploy this build to production.
2. Confirm Firebase Auth Google sign-in + authorized domains.
3. Prefer configuring Cloudflare Images (above); Firebase fallback is fine for a small invite.
4. Confirm a non-admin signed-in user can submit via `/upload` and the tag shows on `/tags` as pending.
5. Skim Privacy + Terms once so invitees have somewhere to land.

Community submissions write straight to the `tags` collection with
`verificationStatus: "pending"`. URL-import review queues are unchanged for
partial/duplicate imports.

## Important notes

### Admins
The app expects admin users to exist in Firestore:
- collection: `admins`
- document id: the Firebase Auth user uid

Example:
- create document `admins/<your-uid>`

### Current security model
- public read on `tags`
- authenticated create on `tags`
- owner/admin update and delete on `tags`
- authenticated read on `trash`
- admin restore/purge on `trash`
- public read on uploaded images

If you want stricter moderation later, change create rights on `tags` to admin-only or import-only workflow.
