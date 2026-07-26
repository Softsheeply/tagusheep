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

**Before deploying**, edit `storage.cors.json` and make sure the `origin` list includes every domain the site is actually served from -- your final production domain, `www` variant if used, and any Vercel preview/production `*.vercel.app` URL you rely on. The file currently lists `localhost` plus a `tagsheep.com` placeholder; if that isn't the real domain, uploads will fail with CORS errors in production until this is corrected and re-applied.

Then apply it:

```powershell
gsutil cors set storage.cors.json gs://tagusheep-72229.appspot.com
```

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
- `tagusheep-72229.appspot.com`

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

## Production smoke test checklist

After deploy, test:
- homepage loads
- Google sign-in works
- upload works
- import from URL works
- saving imported record works
- `/tags` search works
- `/style/[value]` works
- `/rn/[value]` works
- export page works

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
