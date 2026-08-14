import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/tag_record.dart';
import 'normalize.dart';

/// Talks to the same `tags` / `users/{uid}/favorites` collections the
/// Next.js web app uses (see ../../lib/records.ts and
/// ../../firestore.rules), so mobile and web share one live dataset.
class FirestoreService {
  FirestoreService({FirebaseFirestore? firestore}) : _db = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _db;
  CollectionReference<Map<String, dynamic>> get _tags => _db.collection('tags');

  /// Identifier-first search: tries exact style-number / RN matches first
  /// (indexed, cheap, precise), then falls back to a client-side filter
  /// over a recent slice of records for free-text queries.
  Future<List<TagRecord>> search(String rawQuery, {int limit = 40}) async {
    final query = rawQuery.trim();
    if (query.isEmpty) return browse(limit: limit);

    final results = <TagRecord>[];
    final seen = <String>{};

    if (looksLikeIdentifier(query)) {
      final styleUpper = normalizeStyleNumber(query);
      final rnDigits = normalizeRn(query);

      final futures = <Future<QuerySnapshot<Map<String, dynamic>>>>[];
      if (styleUpper != null) {
        futures.add(_tags.where('styleNumber', isEqualTo: styleUpper).limit(20).get());
      }
      if (rnDigits != null && rnDigits.length >= 3) {
        futures.add(_tags.where('rn', isEqualTo: rnDigits).limit(20).get());
      }
      final snaps = await Future.wait(futures);
      for (final snap in snaps) {
        for (final doc in snap.docs) {
          if (seen.add(doc.id)) results.add(TagRecord.fromFirestore(doc));
        }
      }
      if (results.isNotEmpty) return results;
    }

    // Free-text fallback: filter a recent slice client-side. Fine at this
    // dataset scale; see README.md "Search model" for the long-term plan
    // (same tradeoff the web app documents).
    final recent = await _tags.orderBy('createdAt', descending: true).limit(500).get();
    final lower = query.toLowerCase();
    for (final doc in recent.docs) {
      final record = TagRecord.fromFirestore(doc);
      final haystack = record.searchText ?? buildSearchText(
        brand: record.brand,
        productName: record.productName,
        rn: record.rn,
        styleNumber: record.styleNumber,
        garmentType: record.garmentType,
        category: record.category,
        color: record.color,
      );
      if (haystack.toLowerCase().contains(lower)) {
        if (seen.add(doc.id)) results.add(record);
      }
      if (results.length >= limit) break;
    }
    return results;
  }

  Future<List<TagRecord>> browse({int limit = 40, String? category}) async {
    Query<Map<String, dynamic>> q = _tags.orderBy('createdAt', descending: true);
    if (category != null) {
      q = q.where('category', isEqualTo: category);
    }
    final snap = await q.limit(limit).get();
    return snap.docs.map(TagRecord.fromFirestore).toList();
  }

  Future<TagRecord?> getById(String id) async {
    final doc = await _tags.doc(id).get();
    if (!doc.exists) return null;
    return TagRecord.fromFirestore(doc);
  }

  Future<String> createTag(TagRecord record) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw StateError('Must be signed in to add a tag.');
    final data = record.toFirestore();
    data['createdBy'] = user.uid;
    data['verificationStatus'] = data['verificationStatus'] ?? 'pending';
    data['searchText'] = buildSearchText(
      brand: record.brand,
      productName: record.productName,
      rn: record.rn,
      styleNumber: record.styleNumber,
      garmentType: record.garmentType,
      size: record.size,
      availableSizes: record.availableSizes,
      tags: record.tags,
      category: record.category,
      subCategory: record.subCategory,
      gender: record.gender,
      year: record.year,
      season: record.season,
      madeIn: record.madeIn,
      materials: record.materials,
      careText: record.careText,
      color: record.color,
      notes: record.notes,
    );
    final ref = await _tags.add(data);
    return ref.id;
  }

  // --- Favorites: users/{uid}/favorites/{tagId} ---

  Future<List<String>> favoriteIds() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return [];
    final snap = await _db.collection('users').doc(user.uid).collection('favorites').get();
    return snap.docs.map((d) => d.id).toList();
  }

  Future<void> toggleFavorite(String tagId, bool isFavorite) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw StateError('Must be signed in to save favorites.');
    final ref = _db.collection('users').doc(user.uid).collection('favorites').doc(tagId);
    if (isFavorite) {
      // Field set must match validFavoriteData in ../../../firestore.rules
      // exactly (hasOnly-restricted) — 'createdAt', not 'savedAt'.
      await ref.set({'tagId': tagId, 'createdAt': FieldValue.serverTimestamp()});
    } else {
      await ref.delete();
    }
  }

  Future<List<TagRecord>> favoriteTags() async {
    final ids = await favoriteIds();
    if (ids.isEmpty) return [];
    final results = <TagRecord>[];
    // Firestore whereIn caps at 30 ids per query.
    for (var i = 0; i < ids.length; i += 30) {
      final chunk = ids.sublist(i, i + 30 > ids.length ? ids.length : i + 30);
      final snap = await _tags.where(FieldPath.documentId, whereIn: chunk).get();
      results.addAll(snap.docs.map(TagRecord.fromFirestore));
    }
    return results;
  }
}
