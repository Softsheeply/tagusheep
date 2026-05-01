# Tagsheep

Tagsheep is an **IMDb for clothes**.

The point is simple:
- people thrift something
- they find a **style number**, **RN**, care tag, or label photo
- Google gives garbage or nothing useful
- Tagsheep becomes the place where that identifier resolves to a real garment record

It is a searchable clothing reference database built around:
- style-number lookup
- RN lookup
- brand archives
- image-backed garment records
- source provenance
- verification state

---

## What Tagsheep is trying to do

Tagsheep is not just a gallery of clothing images.

It is a **garment identity database**.

A strong record tries to answer:
- what is this item?
- what brand is it from?
- what style number is attached to it?
- what RN/company is behind it?
- what materials / country / era clues exist?
- where did this information come from?
- how verified is this record?

Long-term, the goal is to make searches like:
- `old navy 238592`
- `238592`
- `RN 66170`
- `gap jacket style 123456`

return something actually useful.

---

## Current stack

- **Next.js 16**
- **React 19**
- **Firebase Auth**
- **Firestore**
- **Firebase Storage**
- **TypeScript**

---

## Main product surfaces

### Browse / search
- `/tags` — main search and browse page
- `/style/[value]` — style number index
- `/rn/[value]` — RN index
- `/brand/[name]` — brand archive view
- `/tag/[id]` — single record detail/edit page

### Record creation
- `/upload` — manual record + image upload
- `/import` — import from product/listing URL
- `/import/bulk` — bulk import workflow
- `/imports-review` — review imported records
- `/submit-info` — contribution path for extra info

### Data/admin utilities
- `/trash`
- `/export`
- `/tools`
- `/tools/rn-audit`

---

## Search model

### Current behavior
The project currently uses a hybrid approach:

#### 1. Identifier-first exact lookup
If a query looks like a style number or RN, `/tags` now:
- detects identifier-like intent
- queries Firestore directly for exact matches
- surfaces exact style number and RN hits first
- then shows broader matches underneath

This is important because Tagsheep is meant to work as a real identifier resolver, not just a fuzzy gallery filter.

#### 2. Broader browse filtering
General text filtering still happens largely on the loaded result set in the browser.

That is acceptable for the current stage, but not the final search architecture if the dataset becomes very large.

### Current search strengths
- exact style number lookup
- exact RN lookup
- brand pages
- browseable records
- identifier-aware ranking on `/tags`

### Future search work
Likely next evolutions:
- stronger brand + style query understanding
- broader database-backed search beyond exact identifier hits
- improved result ranking for mixed queries
- maybe external full-text search later if scale demands it

---

## Record model

Each clothing record can include fields like:
- `brand`
- `productName`
- `rn`
- `styleNumber`
- `garmentType`
- `tags`
- `category`
- `subCategory`
- `gender`
- `year`
- `season`
- `madeIn`
- `materials`
- `careText`
- `color`
- `notes`
- `imageUrl`
- `thumbnailUrl`
- `extraImageUrls`
- `sourceUrl`
- `sourceName`
- `sourceType`
- `verificationStatus`
- `confidence`
- `searchText`
- `storagePath`

### Verification statuses
Current statuses:
- `draft`
- `needs_info`
- `pending`
- `reviewed`
- `verified`
- `rejected`

### Source types
Current source types:
- `manual`
- `official`
- `marketplace`
- `archive`
- `resale`
- `unknown`

---

## Image pipeline

Tagsheep now has a more deliberate image policy.

### Image policy
Defined in `lib/images.ts`.

Current defaults:
- main format: **WebP**
- main max dimension: **1600px**
- main quality: **0.84**
- thumbnail max dimension: **480px**
- thumbnail quality: **0.76**

### What happens now
#### Manual uploads
- normalized to WebP
- resized to the shared max dimension
- thumbnail generated
- both stored in Firebase Storage

#### Image replacement on existing records
- same normalization pipeline
- same thumbnail generation

#### Imported primary images
- can be re-hosted into Tagsheep storage
- go through the same normalization pipeline
- thumbnail generated as well

### Browse rendering
Browse surfaces now prefer:
- `thumbnailUrl` for cards/grids
- `imageUrl` for full/detail views

This reduces bandwidth and improves scalability.

### Import image fetching
Imported image fetching now goes through a server-side proxy route:
- `/api/import-image`

That is more reliable than raw browser-side cross-origin fetches.

---

## Import pipeline

### `/api/import`
The URL import route:
- validates the URL
- blocks obvious local/private hostnames
- enforces timeouts
- enforces HTML-only responses
- enforces response size limits
- extracts structured garment/product data from remote pages

### `/api/import-image`
The image proxy route:
- validates the image URL
- blocks obvious local/private hostnames
- enforces timeouts
- requires an image response
- enforces image size limits
- returns image bytes so the client can normalize/upload them

---

## Security / data integrity

### Firestore rules
The repo includes stricter Firestore validation than the original scaffold.

Current protections include:
- allowed field checks
- string length caps
- enum validation
- `createdBy == auth.uid` on create
- immutable `createdBy` on update
- confidence range checks
- validation for image fields including `thumbnailUrl`

### Storage rules
Storage currently allows authenticated users to write inside their own paths for:
- uploads
- imports

Public image reads are allowed for stored images.

### Important reality
This is still an evolving app, not a finished enterprise moderation system.

As public usage grows, moderation and submission controls will matter more.

---

## Local development

### Install
```bash
npm install
```

### Run dev server
```bash
npm run dev
```

### Production build check
```bash
npm run build
```

### Lint
```bash
npm run lint
```

Note: lint is currently noisy from pre-existing `any` usage in parts of the app.

---

## Environment variables

Required public env vars:
- `NEXT_PUBLIC_FB_API_KEY`
- `NEXT_PUBLIC_FB_AUTH_DOMAIN`
- `NEXT_PUBLIC_FB_PROJECT_ID`
- `NEXT_PUBLIC_FB_STORAGE_BUCKET`
- `NEXT_PUBLIC_FB_APP_ID`

---

## Firebase setup / launch

See:
- `README-LAUNCH.md`

That file covers:
- Firebase CLI setup
- rule/index deployment
- storage CORS setup
- auth/storage/firestore checks
- production smoke testing

---

## Current architecture direction

Tagsheep is currently in the stage between:
- promising prototype
- real archive/database system

The project already has:
- identifier-aware search behavior
- upload/import flows
- thumbnail strategy
- image normalization policy
- source provenance fields
- verification model
- storage-aware media handling

The next big areas are likely:
- moderation and review workflow
- stronger database-backed search beyond exact identifiers
- better import coverage for extra images
- clearer admin/editor workflows
- improved repo/docs polish

---

## Deployment notes

Recommended shape:
- **Vercel** for the web app
- **Firebase** for auth, database, storage

Before launch, make sure you deploy:
- Firestore rules
- Firestore indexes
- Storage rules

See `README-LAUNCH.md` for commands.

---

## Mental model

If Discogs helps identify records and IMDb helps identify films, Tagsheep should help identify clothes.

That means the system should get better at:
- exact identifiers
- provenance
- verification
- durable images
- browseable archives

That’s the whole game.
