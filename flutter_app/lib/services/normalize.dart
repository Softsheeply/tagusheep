/// Mirrors normalizeStyleNumber / normalizeRn / buildSearchText in the web
/// app's lib/records.ts, so identifier lookups behave identically on mobile.
String? normalizeStyleNumber(String? value) {
  if (value == null) return null;
  final cleaned = value.trim().replaceAll(RegExp(r'\s+'), ' ').toUpperCase();
  return cleaned.isEmpty ? null : cleaned;
}

String? normalizeBrand(String? value) {
  if (value == null) return null;
  final cleaned = value.trim().replaceAll(RegExp(r'\s+'), ' ');
  return cleaned.isEmpty ? null : cleaned;
}

String? normalizeRn(String? value) {
  if (value == null) return null;
  final digits = value.replaceAll(RegExp(r'\D+'), '');
  if (digits.isEmpty) return null;
  return digits.substring(0, digits.length > 7 ? 7 : digits.length);
}

/// Returns true if [query] looks like an identifier (a style number or an
/// RN) rather than a free-text/brand search, so callers can try an exact
/// Firestore lookup first.
bool looksLikeIdentifier(String query) {
  final trimmed = query.trim();
  if (trimmed.isEmpty) return false;
  final rnMatch = RegExp(r'^(rn\s*)?\d{3,7}$', caseSensitive: false);
  final styleMatch = RegExp(r'^[A-Za-z0-9][A-Za-z0-9\-_. ]{1,30}$');
  return rnMatch.hasMatch(trimmed) ||
      (trimmed.length <= 40 && styleMatch.hasMatch(trimmed) && RegExp(r'\d').hasMatch(trimmed));
}

String buildSearchText({
  String? brand,
  String? productName,
  String? rn,
  String? styleNumber,
  String? garmentType,
  String? size,
  List<String> availableSizes = const [],
  List<String> tags = const [],
  String? category,
  String? subCategory,
  String? gender,
  String? year,
  String? season,
  String? madeIn,
  String? materials,
  String? careText,
  String? color,
  String? notes,
}) {
  final parts = [
    brand,
    productName,
    rn,
    styleNumber,
    garmentType,
    size,
    ...availableSizes,
    ...tags,
    category,
    subCategory,
    gender,
    year,
    season,
    madeIn,
    materials,
    careText,
    color,
    notes,
  ].where((p) => p != null && p.trim().isNotEmpty).cast<String>();
  return parts.join(' ').toLowerCase();
}
