import 'package:cloud_firestore/cloud_firestore.dart';

/// Mirrors the web app's TagRecord shape (see ../../lib/records.ts) so
/// records created on mobile are indistinguishable from web-created ones.
class TagRecord {
  final String? id;
  final String? brand;
  final String? productName;
  final String? rn;
  final String? styleNumber;
  final String? garmentType;
  final String? size;
  final List<String> availableSizes;
  final List<String> tags;
  final String? category;
  final String? subCategory;
  final String? gender;
  final String? year;
  final String? season;
  final String? madeIn;
  final String? materials;
  final String? careText;
  final String? color;
  final String? notes;
  final String imageUrl;
  final String? thumbnailUrl;
  final List<String> extraImageUrls;
  final String? sourceUrl;
  final String? sourceName;
  final String? sourceType;
  final double? confidence;
  final String? verificationStatus;
  final String? searchText;
  final String? storagePath;
  final String? createdBy;
  final dynamic createdAt;

  const TagRecord({
    this.id,
    this.brand,
    this.productName,
    this.rn,
    this.styleNumber,
    this.garmentType,
    this.size,
    this.availableSizes = const [],
    this.tags = const [],
    this.category,
    this.subCategory,
    this.gender,
    this.year,
    this.season,
    this.madeIn,
    this.materials,
    this.careText,
    this.color,
    this.notes,
    required this.imageUrl,
    this.thumbnailUrl,
    this.extraImageUrls = const [],
    this.sourceUrl,
    this.sourceName,
    this.sourceType,
    this.confidence,
    this.verificationStatus,
    this.searchText,
    this.storagePath,
    this.createdBy,
    this.createdAt,
  });

  String get displayImage => (thumbnailUrl != null && thumbnailUrl!.isNotEmpty)
      ? thumbnailUrl!
      : imageUrl;

  String get title {
    final parts = [brand, productName].where((p) => p != null && p.isNotEmpty);
    if (parts.isNotEmpty) return parts.join(' — ');
    if (styleNumber != null && styleNumber!.isNotEmpty) return 'Style $styleNumber';
    if (rn != null && rn!.isNotEmpty) return 'RN $rn';
    return 'Untitled garment';
  }

  factory TagRecord.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return TagRecord(
      id: doc.id,
      brand: data['brand'] as String?,
      productName: data['productName'] as String?,
      rn: data['rn'] as String?,
      styleNumber: data['styleNumber'] as String?,
      garmentType: data['garmentType'] as String?,
      size: data['size'] as String?,
      availableSizes: List<String>.from(data['availableSizes'] ?? const []),
      tags: List<String>.from(data['tags'] ?? const []),
      category: data['category'] as String?,
      subCategory: data['subCategory'] as String?,
      gender: data['gender'] as String?,
      year: data['year'] as String?,
      season: data['season'] as String?,
      madeIn: data['madeIn'] as String?,
      materials: data['materials'] as String?,
      careText: data['careText'] as String?,
      color: data['color'] as String?,
      notes: data['notes'] as String?,
      imageUrl: (data['imageUrl'] as String?) ?? '',
      thumbnailUrl: data['thumbnailUrl'] as String?,
      extraImageUrls: List<String>.from(data['extraImageUrls'] ?? const []),
      sourceUrl: data['sourceUrl'] as String?,
      sourceName: data['sourceName'] as String?,
      sourceType: data['sourceType'] as String?,
      confidence: (data['confidence'] as num?)?.toDouble(),
      verificationStatus: data['verificationStatus'] as String?,
      searchText: data['searchText'] as String?,
      storagePath: data['storagePath'] as String?,
      createdBy: data['createdBy'] as String?,
      createdAt: data['createdAt'],
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      if (brand != null) 'brand': brand,
      if (productName != null) 'productName': productName,
      if (rn != null) 'rn': rn,
      if (styleNumber != null) 'styleNumber': styleNumber,
      if (garmentType != null) 'garmentType': garmentType,
      if (size != null) 'size': size,
      if (availableSizes.isNotEmpty) 'availableSizes': availableSizes,
      if (tags.isNotEmpty) 'tags': tags,
      if (category != null) 'category': category,
      if (subCategory != null) 'subCategory': subCategory,
      if (gender != null) 'gender': gender,
      if (year != null) 'year': year,
      if (season != null) 'season': season,
      if (madeIn != null) 'madeIn': madeIn,
      if (materials != null) 'materials': materials,
      if (careText != null) 'careText': careText,
      if (color != null) 'color': color,
      if (notes != null) 'notes': notes,
      'imageUrl': imageUrl,
      if (thumbnailUrl != null) 'thumbnailUrl': thumbnailUrl,
      if (extraImageUrls.isNotEmpty) 'extraImageUrls': extraImageUrls,
      if (sourceUrl != null) 'sourceUrl': sourceUrl,
      if (sourceName != null) 'sourceName': sourceName,
      if (sourceType != null) 'sourceType': sourceType,
      if (confidence != null) 'confidence': confidence,
      if (verificationStatus != null) 'verificationStatus': verificationStatus,
      if (searchText != null) 'searchText': searchText,
      if (storagePath != null) 'storagePath': storagePath,
      if (createdBy != null) 'createdBy': createdBy,
      'createdAt': FieldValue.serverTimestamp(),
    };
  }
}
