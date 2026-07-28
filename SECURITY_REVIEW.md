# Tagsheep Security Review

Date: 2026-07-28 (updated; original review 2026-05-08)

## Overall read

Tagsheep is in better shape than a lot of early Firebase apps.

The repo has:
- `firestore.rules` — with a real schema validator (`validTagData`) enforced on `tags` creates
- `storage.rules` — writes scoped to the authenticated owner's own uid path
- `firebase.json`
- A CI-run rules test suite (`npm run test:rules`, 26 cases against the real emulator)

Public UI hiding is **not** the only protection here. The Firebase rules do real work, and they're
now verified by an automated test suite rather than by inspection alone.

## Current state by collection

### `tags`
- public reads are allowed intentionally
- writes require sign-in
- `createdBy` must match `request.auth.uid` on create
- owner/admin update gating; update rules prevent changing `createdBy`
- owner/admin delete gating
- create payload is validated against an explicit key allowlist and per-field type/length checks
  (`validTagData` in `firestore.rules`)
- **not yet enforced on update** — pre-validation documents aren't guaranteed to conform;
  `scripts/audit-tags-schema.mjs` exists to check live data before flipping that on

### `trash`
- read/create/update/delete: admin-only
- (previously: any signed-in user could read all trashed records, and create only checked
  `trashedBy == uid` with no ownership check on the source record — both fixed)

### `search_misses`
- create/update: any signed-in user, payload-validated
- read/delete: admin-only

### `imports_review`
- read: owner or admin
- create: signed-in, `createdBy` must match caller
- update/delete: owner or admin

### `admins`
- read: any signed-in user
- write: never allowed from a client (`allow write: if false`)

### `submissions`
- create: any signed-in user (previously `if true` — public/unauthenticated create was closed)
- read/update/delete: admin-only

### Storage
- uploads are namespaced by uid; only the matching signed-in uid can create/update inside their
  own path
- delete allows owner or admin
- default deny fallback
- reads are fully public (intentional — this is a public tag image archive)

## Known residual risks

### 1. No rate limiting on public-create endpoints (`tags`, `submissions`, `search_misses`)
Sign-in is required, but there's nothing stopping a single account from writing at high volume.
Firebase App Check is scaffolded (`lib/firebase.ts`, gated behind
`NEXT_PUBLIC_RECAPTCHA_SITE_KEY`) but not yet enforced — see the App Check section of PR #2's
description for the remaining activation steps (register the web app, create a reCAPTCHA v3 site
key, verify real traffic sends valid tokens, then flip enforcement on in the Firebase console).

### 2. `tags` update isn't schema-validated
An owner or admin can currently write any shape of update to an existing `tags` document, not just
one that passes `validTagData`. Run `scripts/audit-tags-schema.mjs` against production data before
enabling the same check on `update` — if any live document doesn't conform, enabling it first would
lock out edits to that record until it's cleaned up.

### 3. Client-side admin checks still exist in UI
The UI uses `canEdit` / `admin` checks in several places for UX (hiding buttons a user can't use).
This is fine because the Firebase rules backstop the real permissions — but future features should
keep following that pattern: hide in UI for UX, enforce in rules for real security.

## Good next security moves

1. Decide on App Check enforcement timeline once real traffic is confirmed sending valid tokens
2. Run the tags-schema audit script and consider enabling `validTagData` on `update`
3. Consider error monitoring (e.g. Sentry) for visibility into rule-rejection patterns that might
   indicate abuse attempts, not just bugs

## Quick verdict

Current state is **not wide open**. The three issues flagged in the original review (trash
readability, trash create strictness, submission spam exposure) are resolved and covered by the
automated rules test suite. Remaining work is about defense-in-depth (rate limiting, update-time
validation) rather than open holes.
