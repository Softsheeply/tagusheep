# Tagsheep Security Review Starter

Date: 2026-05-08

## Overall read

Tagsheep is in better shape than a lot of early Firebase apps.

The repo already has:
- `firestore.rules`
- `storage.rules`
- `firebase.json`

Public UI hiding is **not** the only protection here. The Firebase rules do real work.

## What looks good

### Firestore: `tags`
- public reads are allowed intentionally
- writes require sign-in
- `createdBy` must match `request.auth.uid` on create
- owner/admin update gating exists
- owner/admin delete gating exists
- update rules prevent changing `createdBy`
- tag payload shape is validated pretty thoroughly

### Firestore: `submissions`
- public create is allowed intentionally
- read/update/delete are admin-only

### Firestore: `admins`
- no writes from client
- read requires sign-in

### Storage
- uploads are namespaced by uid
- only the matching signed-in uid can create/update inside their own path
- delete allows owner or admin
- default deny fallback exists

## Main risks / follow-ups

### 1. Trash collection reads are too broad
Current rule:
- `/trash/{trashId}` read: any signed-in user

That means any signed-in contributor can read all trashed records.

### Recommendation
Change trash reads to admin-only unless there is a product reason not to.

Suggested rule direction:
- `allow read: if isAdmin();`

---

### 2. Trash create validation is weak
Current rule:
- `/trash/{trashId}` create: admin OR signed-in user if `trashedBy == request.auth.uid`

This does **not** validate that the user actually owns the source record they are trashing.
The UI tries to enforce owner/admin, but rules should enforce that too.

### Recommendation
Either:
- make trash writes admin-only
- or require source-record ownership by looking up the original tag document

Safer simple option:
- only admins can create trash docs

If owners should still soft-delete their own records, add stricter checks tying the trash doc to the original tag.

---

### 3. Submission spam risk
Current rule:
- `/submissions` create: `if true`

This is easy to use, but it also means anyone can spam the collection.

### Recommendation
At minimum, consider one of:
- require sign-in for submissions
- add App Check later
- add rate limiting via server/API if abuse appears

If you want low-friction public submissions for now, keep it, but treat it as a known risk.

---

### 4. Storage read is fully public
Current rule:
- uploaded images are publicly readable

This is probably intentional for a public tag archive, but it is worth stating clearly.

### Recommendation
Keep if desired, but know that uploaded source images are public URLs by design.

---

### 5. Client-side admin checks still exist in UI
The UI uses `canEdit` / `admin` checks in several places.

This is fine for user experience, because the Firebase rules backstop the real permissions. But future features should continue following that pattern:
- hide in UI for UX
- enforce in rules for real security

## Good next security moves

1. Restrict `/trash` reads to admins
2. Tighten `/trash` create rules
3. Decide whether `/submissions` should stay public-write
4. Consider App Check later if public abuse becomes a problem
5. Add a quick deploy checklist for rules whenever new collections are introduced

## Quick verdict

Current state is **not wide open**.

Biggest actionable issues right now:
- trash readability
- trash create strictness
- submission spam exposure
