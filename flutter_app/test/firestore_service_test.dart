// Exercises FirestoreService.search/browse/getById against a fake Firestore
// backend (fake_cloud_firestore) instead of a real project -- this sandbox
// has no real Firebase credentials to test against, but the identifier-
// first search logic itself (the actual behavior that matters) doesn't
// need one; only auth-gated writes (createTag, favorites) do, since those
// read FirebaseAuth.instance.currentUser directly and aren't covered here.
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tagusheep_mobile/services/firestore_service.dart';

void main() {
  late FakeFirebaseFirestore fakeFirestore;
  late FirestoreService service;

  setUp(() async {
    fakeFirestore = FakeFirebaseFirestore();
    service = FirestoreService(firestore: fakeFirestore);

    await fakeFirestore.collection('tags').add({
      'brand': 'Old Navy',
      'productName': 'Fleece Jacket',
      'styleNumber': 'ON-238592',
      'rn': '66170',
      'imageUrl': 'https://example.com/a.jpg',
      'verificationStatus': 'verified',
      'searchText': 'old navy fleece jacket on-238592 66170',
      'createdAt': FieldValue.serverTimestamp(),
    });
    await fakeFirestore.collection('tags').add({
      'brand': 'Gap',
      'productName': 'Denim Shirt',
      'styleNumber': 'GAP-1000',
      'rn': '12345',
      'imageUrl': 'https://example.com/b.jpg',
      'verificationStatus': 'pending',
      'searchText': 'gap denim shirt gap-1000 12345',
      'createdAt': FieldValue.serverTimestamp(),
    });
  });

  group('search', () {
    test('exact style number lookup returns only the matching record', () async {
      final results = await service.search('ON-238592');
      expect(results, hasLength(1));
      expect(results.single.brand, 'Old Navy');
    });

    test('exact RN lookup returns only the matching record', () async {
      final results = await service.search('12345');
      expect(results, hasLength(1));
      expect(results.single.brand, 'Gap');
    });

    test('free-text brand search falls back to searchText matching', () async {
      final results = await service.search('old navy');
      expect(results, hasLength(1));
      expect(results.single.styleNumber, 'ON-238592');
    });

    test('empty query behaves like browse (returns everything)', () async {
      final results = await service.search('');
      expect(results, hasLength(2));
    });

    test('no matches returns an empty list, not an error', () async {
      final results = await service.search('nonexistent brand xyz');
      expect(results, isEmpty);
    });
  });

  group('browse', () {
    test('returns all records when no category filter is given', () async {
      final results = await service.browse();
      expect(results, hasLength(2));
    });

    test('category filter narrows results', () async {
      await fakeFirestore.collection('tags').add({
        'brand': 'Levi\'s',
        'category': 'Bottoms',
        'imageUrl': 'https://example.com/c.jpg',
        'createdAt': FieldValue.serverTimestamp(),
      });
      final results = await service.browse(category: 'Bottoms');
      expect(results, hasLength(1));
      expect(results.single.brand, "Levi's");
    });
  });

  group('getById', () {
    test('returns null for a nonexistent id instead of throwing', () async {
      final result = await service.getById('does-not-exist');
      expect(result, isNull);
    });

    test('returns the record for a real id', () async {
      final doc = await fakeFirestore.collection('tags').add({
        'brand': 'Uniqlo',
        'imageUrl': 'https://example.com/d.jpg',
        'createdAt': FieldValue.serverTimestamp(),
      });
      final result = await service.getById(doc.id);
      expect(result?.brand, 'Uniqlo');
    });
  });
}
