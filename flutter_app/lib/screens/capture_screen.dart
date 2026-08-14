import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../main.dart';
import '../models/tag_record.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../services/normalize.dart';
import '../services/storage_service.dart';
import 'tag_detail_screen.dart';

/// The mobile-only value prop: thrifting happens in the aisle, not at a
/// desk. This is a camera-first "scan the tag right now" flow — snap the
/// label photo, fill in whatever's legible, submit as pending. Same
/// verificationStatus/rules contract as the web app's /upload flow.
class CaptureScreen extends StatefulWidget {
  const CaptureScreen({super.key});

  @override
  State<CaptureScreen> createState() => _CaptureScreenState();
}

class _CaptureScreenState extends State<CaptureScreen> {
  File? _photo;
  bool _uploading = false;
  String? _error;

  final _brand = TextEditingController();
  final _productName = TextEditingController();
  final _styleNumber = TextEditingController();
  final _rn = TextEditingController();
  final _garmentType = TextEditingController();
  final _size = TextEditingController();
  final _color = TextEditingController();
  final _materials = TextEditingController();
  final _madeIn = TextEditingController();
  final _notes = TextEditingController();

  @override
  void dispose() {
    for (final c in [
      _brand, _productName, _styleNumber, _rn, _garmentType, _size, _color, _materials, _madeIn, _notes,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final xfile = await picker.pickImage(source: source, imageQuality: 92);
    if (xfile == null) return;
    setState(() => _photo = File(xfile.path));
  }

  bool get _hasAnyIdentifier =>
      _brand.text.trim().isNotEmpty ||
      _styleNumber.text.trim().isNotEmpty ||
      _rn.text.trim().isNotEmpty ||
      _garmentType.text.trim().isNotEmpty;

  Future<void> _submit() async {
    final auth = context.read<AuthService>();
    if (!auth.isSignedIn) {
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const SignInRequired(message: 'Sign in to submit a tag.')),
      );
      if (!mounted || !context.read<AuthService>().isSignedIn) return;
    }
    if (_photo == null) {
      setState(() => _error = 'Add a photo of the tag or garment first.');
      return;
    }
    if (!_hasAnyIdentifier) {
      setState(() => _error = 'Fill in at least a brand, style number, RN, or garment type.');
      return;
    }

    setState(() {
      _uploading = true;
      _error = null;
    });

    try {
      final uploaded = await StorageService().uploadGarmentPhoto(_photo!);
      final record = TagRecord(
        imageUrl: uploaded.url,
        thumbnailUrl: uploaded.thumbnailUrl,
        storagePath: uploaded.storagePath,
        brand: normalizeBrand(_valueOrNull(_brand)),
        productName: _valueOrNull(_productName),
        styleNumber: normalizeStyleNumber(_valueOrNull(_styleNumber)),
        rn: normalizeRn(_valueOrNull(_rn)),
        garmentType: _valueOrNull(_garmentType),
        size: _valueOrNull(_size),
        color: _valueOrNull(_color),
        materials: _valueOrNull(_materials),
        madeIn: _valueOrNull(_madeIn),
        notes: _valueOrNull(_notes),
        sourceType: 'manual',
        verificationStatus: 'pending',
      );
      final id = await FirestoreService().createTag(record);
      if (!mounted) return;
      _resetForm();
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => TagDetailScreen(tagId: id)));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tag submitted — thanks for growing the archive!')),
      );
    } catch (e) {
      setState(() => _error = 'Upload failed. Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  String? _valueOrNull(TextEditingController c) {
    final v = c.text.trim();
    return v.isEmpty ? null : v;
  }

  void _resetForm() {
    for (final c in [
      _brand, _productName, _styleNumber, _rn, _garmentType, _size, _color, _materials, _madeIn, _notes,
    ]) {
      c.clear();
    }
    setState(() => _photo = null);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan a tag')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _PhotoPicker(photo: _photo, onCamera: () => _pickImage(ImageSource.camera), onGallery: () => _pickImage(ImageSource.gallery)),
          const SizedBox(height: 20),
          const Text('What does the label say?', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          const Text('Fill in whatever is legible — partial info still helps.', style: TextStyle(color: Color(0xFF8A8378), fontSize: 12)),
          const SizedBox(height: 12),
          _field(_brand, 'Brand'),
          _field(_productName, 'Product name (optional)'),
          Row(children: [
            Expanded(child: _field(_styleNumber, 'Style number')),
            const SizedBox(width: 12),
            Expanded(child: _field(_rn, 'RN number')),
          ]),
          Row(children: [
            Expanded(child: _field(_garmentType, 'Garment type')),
            const SizedBox(width: 12),
            Expanded(child: _field(_size, 'Size')),
          ]),
          _field(_color, 'Color'),
          _field(_materials, 'Materials'),
          _field(_madeIn, 'Made in'),
          _field(_notes, 'Notes', maxLines: 3),
          const SizedBox(height: 12),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _uploading ? null : _submit,
              child: _uploading
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Submit tag'),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _field(TextEditingController c, String label, {int maxLines = 1}) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: c,
          maxLines: maxLines,
          decoration: InputDecoration(labelText: label),
        ),
      );
}

class _PhotoPicker extends StatelessWidget {
  final File? photo;
  final VoidCallback onCamera;
  final VoidCallback onGallery;

  const _PhotoPicker({required this.photo, required this.onCamera, required this.onGallery});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AspectRatio(
          aspectRatio: 1.3,
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF1EDE4),
              borderRadius: BorderRadius.circular(16),
              image: photo != null ? DecorationImage(image: FileImage(photo!), fit: BoxFit.cover) : null,
            ),
            child: photo == null
                ? const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.photo_camera_outlined, size: 36, color: Color(0xFFB9B2A3)),
                        SizedBox(height: 8),
                        Text('Photo of the care tag / label', style: TextStyle(color: Color(0xFF8A8378))),
                      ],
                    ),
                  )
                : null,
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: onCamera,
                icon: const Icon(Icons.camera_alt_outlined),
                label: const Text('Camera'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: onGallery,
                icon: const Icon(Icons.photo_library_outlined),
                label: const Text('Gallery'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
