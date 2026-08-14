import 'dart:async';

import 'package:flutter/material.dart';

import '../models/tag_record.dart';
import '../services/firestore_service.dart';
import '../widgets/tag_card.dart';
import 'tag_detail_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _service = FirestoreService();
  final _controller = TextEditingController();
  Timer? _debounce;
  List<TagRecord> _results = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _runSearch('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => _runSearch(value));
  }

  Future<void> _runSearch(String query) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await _service.search(query);
      if (!mounted) return;
      setState(() {
        _results = results;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load results. Check your connection.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tagsheep'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: TextField(
              controller: _controller,
              onChanged: _onChanged,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Style number, RN, or brand…',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _controller.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () {
                          _controller.clear();
                          _runSearch('');
                        },
                      )
                    : null,
              ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _results.isEmpty
                    ? _EmptyState(hasQuery: _controller.text.trim().isNotEmpty)
                    : RefreshIndicator(
                        onRefresh: () => _runSearch(_controller.text),
                        child: GridView.builder(
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 10,
                            mainAxisSpacing: 10,
                            childAspectRatio: 0.72,
                          ),
                          itemCount: _results.length,
                          itemBuilder: (context, i) {
                            final tag = _results[i];
                            return TagCard(
                              tag: tag,
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => TagDetailScreen(tagId: tag.id!)),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final bool hasQuery;
  const _EmptyState({required this.hasQuery});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(hasQuery ? Icons.search_off : Icons.checkroom_outlined, size: 40, color: const Color(0xFFB9B2A3)),
            const SizedBox(height: 12),
            Text(
              hasQuery
                  ? 'No matches yet. Be the first to tag it — scan it in.'
                  : 'No records yet. Tap "Scan tag" to add the first one.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF8A8378)),
            ),
          ],
        ),
      ),
    );
  }
}
