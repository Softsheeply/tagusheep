import 'dart:io';
import 'dart:typed_data';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:uuid/uuid.dart';

class UploadedImage {
  final String url;
  final String thumbnailUrl;
  final String storagePath;
  UploadedImage({required this.url, required this.thumbnailUrl, required this.storagePath});
}

/// Uploads to `tagusheep/uploads/{uid}/...`, the same Storage path prefix
/// the web app writes to (see ../../storage.rules and
/// ../../lib/object-storage.ts) — same rules, same bucket, no extra backend.
class StorageService {
  final _storage = FirebaseStorage.instance;

  Future<UploadedImage> uploadGarmentPhoto(File file) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw StateError('Must be signed in to upload photos.');

    final id = const Uuid().v4();
    final baseName = 'capture-$id.jpg';
    final mainBytes = await _compress(file, maxDimension: 1600, quality: 84);
    final thumbBytes = await _compress(file, maxDimension: 480, quality: 76);

    final mainPath = 'tagusheep/uploads/${user.uid}/$baseName';
    final thumbPath = 'tagusheep/uploads/${user.uid}/thumb_$baseName';

    final mainRef = _storage.ref(mainPath);
    final thumbRef = _storage.ref(thumbPath);

    await mainRef.putData(mainBytes, SettableMetadata(contentType: 'image/jpeg'));
    await thumbRef.putData(thumbBytes, SettableMetadata(contentType: 'image/jpeg'));

    final url = await mainRef.getDownloadURL();
    final thumbUrl = await thumbRef.getDownloadURL();

    return UploadedImage(url: url, thumbnailUrl: thumbUrl, storagePath: mainPath);
  }

  Future<Uint8List> _compress(File file, {required int maxDimension, required int quality}) async {
    final result = await FlutterImageCompress.compressWithFile(
      file.absolute.path,
      minWidth: maxDimension,
      minHeight: maxDimension,
      quality: quality,
      format: CompressFormat.jpeg,
    );
    if (result != null) return result;
    // Compression can return null for already-tiny/unsupported inputs;
    // fall back to the original bytes rather than failing the upload.
    return file.readAsBytesSync();
  }
}
