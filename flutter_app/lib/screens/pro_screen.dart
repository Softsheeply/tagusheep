import 'package:flutter/material.dart';

/// Monetization surface. Real purchases need the `in_app_purchase` package
/// wired to Play Console / App Store Connect product IDs — that requires a
/// registered developer account and signed release build, so it can't be
/// completed inside this session. See flutter_app/README.md "Turning on
/// Pro" for the exact remaining steps. This screen is fully built UI so
/// wiring purchases later is a service swap, not a redesign.
class ProScreen extends StatelessWidget {
  const ProScreen({super.key});

  static const _features = [
    ('Unlimited tag scans', 'Free tier caps at 10 scans/month; Pro removes the cap.'),
    ('Bulk export', 'Export your scan history and saved garments as CSV.'),
    ('Priority OCR-assisted entry', 'Faster field auto-fill when label text is legible.'),
    ('No ads', 'Free tier will show a small banner on Search; Pro removes it.'),
    ('Reseller badge', 'Signals verified, active contributor status on your public profile.'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tagsheep Pro')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Icon(Icons.workspace_premium, size: 48, color: Color(0xFFE8590C)),
          const SizedBox(height: 12),
          const Text('Built for resellers', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          const Text(
            'Poshmark, Depop, and eBay sellers use Tagsheep to identify garments fast so listings go up faster.',
            style: TextStyle(color: Color(0xFF8A8378)),
          ),
          const SizedBox(height: 20),
          ..._features.map((f) => Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.check_circle, color: Color(0xFFE8590C), size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(f.$1, style: const TextStyle(fontWeight: FontWeight.w700)),
                          Text(f.$2, style: const TextStyle(color: Color(0xFF8A8378), fontSize: 12)),
                        ],
                      ),
                    ),
                  ],
                ),
              )),
          const SizedBox(height: 12),
          Card(
            color: const Color(0xFFFFF3E9),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(r'$4.99/month or $39.99/year', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 4),
                  const Text(
                    'Purchases open once billing is configured in Play Console (see README).',
                    style: TextStyle(color: Color(0xFF8A8378), fontSize: 12),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Billing not yet configured — see README "Turning on Pro".')),
                      ),
                      child: const Text('Upgrade to Pro'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
