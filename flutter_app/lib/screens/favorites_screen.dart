import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../main.dart';
import '../models/tag_record.dart';
import '../services/auth_service.dart';
import '../services/export_service.dart';
import '../services/firestore_service.dart';
import '../services/usage_service.dart';
import '../widgets/tag_card.dart';
import 'pro_screen.dart';
import 'tag_detail_screen.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  List<TagRecord>? _tags;
  String? _error;
  bool _loadedForSignedIn = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final signedIn = context.read<AuthService>().isSignedIn;
    if (signedIn && !_loadedForSignedIn) {
      _loadedForSignedIn = true;
      _load();
    }
  }

  Future<void> _load() async {
    setState(() {
      _tags = null;
      _error = null;
    });
    try {
      final tags = await FirestoreService().favoriteTags();
      if (!mounted) return;
      setState(() => _tags = tags);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not load favorites.');
    }
  }

  Future<void> _exportCsv() async {
    final tags = _tags;
    if (tags == null || tags.isEmpty) return;
    final isPro = await UsageService().isPro();
    if (!mounted) return;
    if (!isPro) {
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ProScreen()));
      return;
    }
    await ExportService().exportAndShare(tags, filename: 'tagsheep-saved.csv');
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Saved'),
        actions: [
          if (auth.isSignedIn && (_tags?.isNotEmpty ?? false))
            IconButton(
              icon: const Icon(Icons.ios_share_outlined),
              tooltip: 'Export as CSV (Pro)',
              onPressed: _exportCsv,
            ),
        ],
      ),
      body: !auth.isSignedIn
          ? const SignInRequired(message: 'Sign in to save garments you want to remember.')
          : Builder(builder: (context) {
              if (_tags == null && _error == null) {
                return const Center(child: CircularProgressIndicator());
              }
              if (_error != null) {
                return Center(child: Text(_error!));
              }
              final tags = _tags!;
              if (tags.isEmpty) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No saved garments yet. Tap the heart on any tag to save it here.', textAlign: TextAlign.center),
                  ),
                );
              }
              return RefreshIndicator(
                onRefresh: _load,
                child: GridView.builder(
                  padding: const EdgeInsets.all(12),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    childAspectRatio: 0.72,
                  ),
                  itemCount: tags.length,
                  itemBuilder: (context, i) {
                    final tag = tags[i];
                    return TagCard(
                      tag: tag,
                      onTap: () => Navigator.of(context)
                          .push(MaterialPageRoute(builder: (_) => TagDetailScreen(tagId: tag.id!)))
                          .then((_) => _load()),
                    );
                  },
                ),
              );
            }),
    );
  }
}
