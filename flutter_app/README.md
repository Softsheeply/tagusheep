# Tagsheep Mobile (Flutter)

A camera-first Android/iOS companion to the [Tagsheep web app](../README.md) —
the searchable garment identity database ("IMDb for clothes"). Same
Firebase backend, same `tags` collection, same rules. This app exists
because thrifting happens in the aisle, not at a desk: point the camera at
a care tag, fill in whatever's legible, submit — the record shows up on the
website too.

## Why this app, not something unrelated

Tagsheep already has real, differentiated traction potential: it's a
genuine niche (style-number/RN identification) with essentially no direct
competitor, real utility for resellers (Poshmark/Depop/eBay/Vinted sellers
who need to identify garments fast to list them), and built-in virality
(every scan grows a shared public archive other thrifters search). Rather
than starting a disconnected app from zero, this mobile app is the
highest-leverage "unique, helpful, viral, monetizable" build available
right now: it turns an existing web product into a pocket tool for the
exact moment its users need it — standing in a thrift store.

Monetization path (scaffolded in `lib/screens/pro_screen.dart`, not yet
wired to real billing — see "Turning on Pro" below): a Pro tier for power
resellers (unlimited scans, bulk export, no ads, verified badge).

## What's built

- Google sign-in (Firebase Auth), shared with the web app's user records
- Search: identifier-first (exact style number / RN lookup) then free-text,
  matching the web app's search model (`../README.md#search-model`)
- Browse grid with thumbnails
- Tag detail view (all fields, share sheet, favorite toggle)
- **Capture**: camera or gallery photo → compress → upload to
  `tagusheep/uploads/{uid}/...` (same Storage path/rules as web) → quick
  entry form → submit as a `pending` tag, same as `/upload` on web
- Favorites (`users/{uid}/favorites/{tagId}`, same as web's Save button)
- Profile screen + Pro upsell screen (UI only; billing not wired, see below)

All Firestore/Storage reads and writes go through the **same rules** as
the web app (`../firestore.rules`, `../storage.rules`) — nothing here
needs new backend code or new rules.

## Setup (do this before running)

### 1. Point the app at your Firebase project

This app is coded to read Firebase config from `lib/firebase_options.dart`,
which currently contains **placeholder values**. Generate the real file:

```bash
dart pub global activate flutterfire_cli
cd flutter_app
flutterfire configure --project=tagusheep-72229
```

Select Android (and iOS if you want it too) when prompted. This registers
new Android/iOS apps in the *existing* `tagusheep-72229` Firebase project
(see `../.firebaserc`) and overwrites `lib/firebase_options.dart` with real
values — no new project, no new backend.

### 2. Enable Google Sign-In for the new Android app

In the Firebase Console → Authentication → Sign-in method, Google should
already be enabled (the web app uses it). Under Project settings → your
new Android app, add the app's SHA-1 (debug: `cd android && ./gradlew
signingReport`) so Google Sign-In works on Android — this is the one
manual step `flutterfire configure` doesn't do for you.

### 3. Install Flutter + get packages

```bash
# If you don't have Flutter yet:
git clone -b stable https://github.com/flutter/flutter.git
export PATH="$PATH:$(pwd)/flutter/bin"

cd flutter_app
flutter pub get
flutter analyze   # should report "No issues found!"
```

### 4. Run it

```bash
flutter run   # picks whatever device/emulator is connected
```

## Building the Android release (the "put in Android" step)

This step needs the Android SDK, which wasn't available in the sandbox
this app was built in — so it's untested end-to-end and is exactly the
part you do next:

```bash
flutter build appbundle --release
```

Before your first real release:

1. **App signing**: generate an upload keystore and configure
   `android/key.properties` + `android/app/build.gradle.kts` per
   [Flutter's signing guide](https://docs.flutter.dev/deployment/android).
   The scaffold currently builds unsigned/debug-signed only.
2. **App icon**: replace the default Flutter icon in
   `android/app/src/main/res/mipmap-*/ic_launcher.png` (e.g. via the
   `flutter_launcher_icons` package) with a real Tagsheep mark.
3. **Play Console listing**: create the app, fill in the store listing,
   upload the `.aab` from step above, set up a closed testing track first.
4. Confirm `applicationId` in `android/app/build.gradle.kts`
   (`com.tagusheep.tagusheep_mobile`) is the identifier you want published
   — it cannot be changed after your first Play Store upload.

## Turning on Pro (monetization)

The purchase code is real and wired end-to-end — `lib/services/purchase_service.dart`
queries the store, drives `InAppPurchase.buyNonConsumable`, listens to the
purchase stream, and writes the entitlement to Firestore
(`users/{uid}.isPro`/`proUntil`/`proProductId`); `lib/screens/pro_screen.dart`
calls it and shows live store prices when products exist. `firestore.rules`
already has a `users/{uid}` match block that allows this write.

What's still missing is the two products themselves, which only exist once
someone with Play Console access creates them — that's the actual blocker,
not missing code:

1. In Play Console → Monetize → Products → Subscriptions, create
   `tagsheep_pro_monthly` and `tagsheep_pro_yearly` (see the exact IDs in
   `PurchaseService.monthlyId` / `.yearlyId`) with prices matching
   `pro_screen.dart`'s copy. Until these exist, `queryProducts()` returns
   `[]` and the screen shows a "not yet available" card instead of a
   purchase button — it fails safe rather than pretending to work.
2. Gate the free-tier limits mentioned in `pro_screen.dart`'s feature list
   (scan cap, export, ads) by reading `users/{uid}.isPro`.
3. **Before real launch**, add a Cloud Function that verifies
   `purchase.verificationData.serverVerificationData` against the Play
   Developer API and is the *only* writer of `isPro`/`proUntil` — the
   current client-side write (see the doc comment on
   `PurchaseService._grantEntitlement` and the `validProFields` comment in
   `../firestore.rules`) is explicitly a client-trusted placeholder: a
   modified client could grant itself Pro for free as it stands. Tighten
   the `users/{uid}` rule to `allow write: if false` once that function
   exists.

This wasn't built out further because it requires a live Play Console
developer account (yours) — that's a real external dependency, not
unfinished code.

## Project layout

```
lib/
  main.dart                 — app entry, Firebase init, theme
  firebase_options.dart     — PLACEHOLDER, replace via flutterfire configure
  models/tag_record.dart    — mirrors ../lib/records.ts
  services/
    auth_service.dart       — Google sign-in
    firestore_service.dart  — search/browse/favorites/create, same rules as web
    storage_service.dart    — photo upload, same path convention as web
    normalize.dart          — style/RN normalization, mirrors ../lib/records.ts
  screens/                  — sign_in, root_shell (nav), search, tag_detail,
                               capture, favorites, profile, pro
  theme/app_theme.dart
  widgets/tag_card.dart
```
