import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../main.dart';
import '../models/tag_record.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';

class TagDetailScreen extends StatefulWidget {
  final String tagId;
  const TagDetailScreen({super.key, required this.tagId});

  @override
  State<TagDetailScreen> createState() => _TagDetailScreenState();
}

class _TagDetailScreenState extends State<TagDetailScreen> {
  final _service = FirestoreService();
  TagRecord? _tag;
  bool _loading = true;
  bool _isFavorite = false;
  bool _favoriteBusy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final auth = context.read<AuthService>();
    final tag = await _service.getById(widget.tagId);
    List<String> favoriteIds = [];
    if (auth.isSignedIn) {
      favoriteIds = await _service.favoriteIds();
    }
    if (!mounted) return;
    setState(() {
      _tag = tag;
      _isFavorite = favoriteIds.contains(widget.tagId);
      _loading = false;
    });
  }

  Future<void> _toggleFavorite() async {
    final auth = context.read<AuthService>();
    if (!auth.isSignedIn) {
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SignInRequired()));
      if (!mounted || !context.read<AuthService>().isSignedIn) return;
    }
    setState(() => _favoriteBusy = true);
    try {
      await _service.toggleFavorite(widget.tagId, !_isFavorite);
      if (!mounted) return;
      setState(() {
        _isFavorite = !_isFavorite;
        _favoriteBusy = false;
      });
    } catch (_) {
      if (mounted) setState(() => _favoriteBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final tag = _tag;
    if (tag == null) {
      return const Scaffold(body: Center(child: Text('This record was not found.')));
    }

    final rows = <MapEntry<String, String>>[
      if (tag.brand != null) MapEntry('Brand', tag.brand!),
      if (tag.styleNumber != null) MapEntry('Style number', tag.styleNumber!),
      if (tag.rn != null) MapEntry('RN', tag.rn!),
      if (tag.garmentType != null) MapEntry('Garment type', tag.garmentType!),
      if (tag.category != null) MapEntry('Category', tag.category!),
      if (tag.size != null) MapEntry('Size', tag.size!),
      if (tag.color != null) MapEntry('Color', tag.color!),
      if (tag.materials != null) MapEntry('Materials', tag.materials!),
      if (tag.madeIn != null) MapEntry('Made in', tag.madeIn!),
      if (tag.year != null) MapEntry('Year', tag.year!),
      if (tag.careText != null) MapEntry('Care', tag.careText!),
      if (tag.verificationStatus != null) MapEntry('Verification', tag.verificationStatus!),
    ];

    return Scaffold(
      appBar: AppBar(
        actions: [
          IconButton(
            icon: const Icon(Icons.share_outlined),
            onPressed: () => SharePlus.instance.share(ShareParams(
              text: '${tag.title} on Tagsheep — https://tagsheep.com/tag/${tag.id}',
            )),
          ),
          IconButton(
            icon: _favoriteBusy
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : Icon(_isFavorite ? Icons.favorite : Icons.favorite_border, color: _isFavorite ? const Color(0xFFE8590C) : null),
            onPressed: _favoriteBusy ? null : _toggleFavorite,
          ),
        ],
      ),
      body: ListView(
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: tag.imageUrl.isNotEmpty
                ? CachedNetworkImage(imageUrl: tag.imageUrl, fit: BoxFit.cover)
                : Container(color: const Color(0xFFF1EDE4)),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tag.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                const SizedBox(height: 16),
                ...rows.map((row) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 120,
                            child: Text(row.key, style: const TextStyle(color: Color(0xFF8A8378), fontWeight: FontWeight.w600)),
                          ),
                          Expanded(child: Text(row.value)),
                        ],
                      ),
                    )),
                if (tag.notes != null) ...[
                  const Divider(height: 32),
                  const Text('Notes', style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  Text(tag.notes!),
                ],
                if (tag.sourceName != null) ...[
                  const SizedBox(height: 20),
                  Text('Source: ${tag.sourceName}', style: const TextStyle(fontSize: 12, color: Color(0xFF8A8378))),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
