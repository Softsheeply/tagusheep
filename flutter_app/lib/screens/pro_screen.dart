import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../services/purchase_service.dart';

/// Real purchase wiring lives in services/purchase_service.dart. It queries
/// live Play Console products by ID and drives InAppPurchase.buyNonConsumable
/// — the only thing missing is the products themselves, which don't exist
/// until someone with Play Console access creates them (see README "Turning
/// on Pro"). Until then queryProducts() returns [] and this screen falls
/// back to static pricing copy with a clear "not yet available" message
/// instead of pretending the button works.
class ProScreen extends StatefulWidget {
  const ProScreen({super.key});

  @override
  State<ProScreen> createState() => _ProScreenState();
}

class _ProScreenState extends State<ProScreen> {
  final _purchases = PurchaseService();
  List<ProductDetails> _products = [];
  bool _loadingProducts = true;
  bool _purchasing = false;
  String? _status;

  static const _features = [
    ('Unlimited tag scans', 'Free tier caps at 10 scans/month; Pro removes the cap.'),
    ('Bulk export', 'Export your scan history and saved garments as CSV.'),
    ('Priority OCR-assisted entry', 'Faster field auto-fill when label text is legible.'),
    ('No ads', 'Free tier will show a small banner on Search; Pro removes it.'),
    ('Reseller badge', 'Signals verified, active contributor status on your public profile.'),
  ];

  @override
  void initState() {
    super.initState();
    _purchases.start();
    _purchases.statusStream.listen(_onStatus);
    _loadProducts();
  }

  @override
  void dispose() {
    _purchases.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    final products = await _purchases.queryProducts();
    if (!mounted) return;
    setState(() {
      _products = products;
      _loadingProducts = false;
    });
  }

  void _onStatus(PurchaseStatus status) {
    if (!mounted) return;
    setState(() {
      _purchasing = status == PurchaseStatus.pending;
      _status = switch (status) {
        PurchaseStatus.pending => 'Processing…',
        PurchaseStatus.purchased => 'Welcome to Pro!',
        PurchaseStatus.restored => 'Purchase restored.',
        PurchaseStatus.error => 'Purchase failed. Please try again.',
        PurchaseStatus.canceled => null,
      };
    });
  }

  Future<void> _buy(ProductDetails product) async {
    setState(() {
      _purchasing = true;
      _status = null;
    });
    try {
      await _purchases.buy(product);
    } catch (e) {
      if (mounted) setState(() => _status = 'Could not start purchase.');
    } finally {
      if (mounted) setState(() => _purchasing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tagsheep Pro'),
        actions: [
          TextButton(
            onPressed: _purchasing ? null : () => _purchases.restorePurchases(),
            child: const Text('Restore'),
          ),
        ],
      ),
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
          if (_status != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_status!, style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
          if (_loadingProducts)
            const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
          else if (_products.isEmpty)
            _NotYetAvailableCard()
          else
            ..._products.map((product) => Card(
                  color: const Color(0xFFFFF3E9),
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    title: Text(product.title, style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text(product.description),
                    trailing: ElevatedButton(
                      onPressed: _purchasing ? null : () => _buy(product),
                      child: Text(product.price),
                    ),
                  ),
                )),
        ],
      ),
    );
  }
}

class _NotYetAvailableCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFFFFF3E9),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(r'$4.99/month or $39.99/year', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 4),
            Text(
              'Purchasing opens once the ${PurchaseService.monthlyId} / ${PurchaseService.yearlyId} '
              'subscriptions are created in Play Console — the purchase flow itself is already wired up '
              '(see services/purchase_service.dart). See README "Turning on Pro".',
              style: const TextStyle(color: Color(0xFF8A8378), fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
