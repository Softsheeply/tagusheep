import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../models/tag_record.dart';

/// Bulk CSV export — one of the Pro features `pro_screen.dart` advertises.
/// Callers are responsible for the Pro check (see profile_screen.dart);
/// this service just turns records into a file and hands it to the share
/// sheet so the user can save/email/AirDrop it.
class ExportService {
  Future<void> exportAndShare(List<TagRecord> tags, {String filename = 'tagsheep-export.csv'}) async {
    final csv = _toCsv(tags);
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$filename');
    await file.writeAsString(csv);
    await SharePlus.instance.share(ShareParams(
      files: [XFile(file.path, mimeType: 'text/csv')],
      subject: 'Tagsheep export',
    ));
  }

  String _toCsv(List<TagRecord> tags) {
    const headers = [
      'brand', 'productName', 'rn', 'styleNumber', 'garmentType', 'size',
      'color', 'category', 'materials', 'madeIn', 'year', 'verificationStatus', 'imageUrl',
    ];
    final buffer = StringBuffer()..writeln(headers.join(','));
    for (final tag in tags) {
      final row = [
        tag.brand, tag.productName, tag.rn, tag.styleNumber, tag.garmentType, tag.size,
        tag.color, tag.category, tag.materials, tag.madeIn, tag.year, tag.verificationStatus, tag.imageUrl,
      ].map(_csvField);
      buffer.writeln(row.join(','));
    }
    return buffer.toString();
  }

  String _csvField(String? value) {
    if (value == null || value.isEmpty) return '';
    final escaped = value.replaceAll('"', '""');
    return '"$escaped"';
  }
}
