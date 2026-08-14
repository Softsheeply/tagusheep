// Unit tests for the pure identifier-normalization/search logic that backs
// FirestoreService.search's identifier-first lookup. These mirror the
// behavior ../../lib/records.ts tests (implicitly) against on the web side
// -- keeping mobile and web agreeing on what counts as "the same style
// number" is what makes cross-platform lookups actually work.
import 'package:flutter_test/flutter_test.dart';
import 'package:tagusheep_mobile/services/normalize.dart';

void main() {
  group('normalizeStyleNumber', () {
    test('uppercases and collapses whitespace', () {
      expect(normalizeStyleNumber('  ab  12-cd '), 'AB 12-CD');
    });

    test('null and empty input return null', () {
      expect(normalizeStyleNumber(null), null);
      expect(normalizeStyleNumber('   '), null);
    });
  });

  group('normalizeBrand', () {
    test('trims and collapses whitespace without changing case', () {
      expect(normalizeBrand('  Old   Navy '), 'Old Navy');
    });

    test('null and empty input return null', () {
      expect(normalizeBrand(null), null);
      expect(normalizeBrand(''), null);
    });
  });

  group('normalizeRn', () {
    test('strips non-digits and caps at 7 digits', () {
      expect(normalizeRn('RN 66170'), '66170');
      expect(normalizeRn('RN#12345678'), '1234567');
    });

    test('non-digit-only input returns null', () {
      expect(normalizeRn('no digits here'), null);
      expect(normalizeRn(null), null);
    });
  });

  group('looksLikeIdentifier', () {
    test('bare numbers and "RN <digits>" match the RN pattern', () {
      expect(looksLikeIdentifier('66170'), true);
      expect(looksLikeIdentifier('RN 66170'), true);
      expect(looksLikeIdentifier('rn66170'), true);
    });

    test('alphanumeric style numbers with a digit match', () {
      expect(looksLikeIdentifier('238592'), true);
      expect(looksLikeIdentifier('ABC-123'), true);
    });

    test('plain brand/text search does not match', () {
      expect(looksLikeIdentifier('old navy jacket'), false);
      expect(looksLikeIdentifier(''), false);
      expect(looksLikeIdentifier('gap'), false); // no digit at all
    });
  });

  group('buildSearchText', () {
    test('joins non-empty fields, lowercased, space-separated', () {
      final text = buildSearchText(
        brand: 'Old Navy',
        styleNumber: 'AB123',
        tags: ['thrifted', 'Y2K'],
        notes: null,
      );
      expect(text, 'old navy ab123 thrifted y2k');
    });

    test('empty/blank fields are dropped, not left as blank tokens', () {
      final text = buildSearchText(brand: '  ', productName: 'Tee');
      expect(text, 'tee');
    });
  });
}
