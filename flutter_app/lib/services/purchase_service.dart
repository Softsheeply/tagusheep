import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

/// Real purchase wiring for Tagsheep Pro, gated on product IDs that don't
/// exist yet. Create these two subscriptions in Play Console (Monetize ->
/// Products -> Subscriptions) with matching billing periods before they'll
/// resolve — see flutter_app/README.md "Turning on Pro". Until then,
/// `queryProducts()` returns an empty list and the UI shows fallback
/// pricing copy instead of live store prices.
class PurchaseService {
  static const String monthlyId = 'tagsheep_pro_monthly';
  static const String yearlyId = 'tagsheep_pro_yearly';
  static const Set<String> productIds = {monthlyId, yearlyId};

  final InAppPurchase _iap = InAppPurchase.instance;
  StreamSubscription<List<PurchaseDetails>>? _subscription;

  final _statusController = StreamController<PurchaseStatus>.broadcast();
  Stream<PurchaseStatus> get statusStream => _statusController.stream;

  void start() {
    _subscription = _iap.purchaseStream.listen(
      _onPurchaseUpdate,
      onError: (error) {
        debugPrint('purchaseStream error: $error');
        _statusController.add(PurchaseStatus.error);
      },
    );
  }

  void dispose() {
    _subscription?.cancel();
    _statusController.close();
  }

  Future<List<ProductDetails>> queryProducts() async {
    final available = await _iap.isAvailable();
    if (!available) return [];
    final response = await _iap.queryProductDetails(productIds);
    if (response.error != null) {
      debugPrint('queryProductDetails error: ${response.error}');
    }
    return response.productDetails;
  }

  Future<void> buy(ProductDetails product) async {
    final param = PurchaseParam(productDetails: product);
    // Subscriptions use buyNonConsumable; there is no server-side receipt
    // verification wired up yet (see _grantEntitlement doc comment below).
    await _iap.buyNonConsumable(purchaseParam: param);
  }

  Future<void> restorePurchases() => _iap.restorePurchases();

  Future<void> _onPurchaseUpdate(List<PurchaseDetails> purchases) async {
    for (final purchase in purchases) {
      switch (purchase.status) {
        case PurchaseStatus.pending:
          _statusController.add(PurchaseStatus.pending);
          break;
        case PurchaseStatus.error:
          _statusController.add(PurchaseStatus.error);
          break;
        case PurchaseStatus.canceled:
          _statusController.add(PurchaseStatus.canceled);
          break;
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          await _grantEntitlement(purchase);
          _statusController.add(purchase.status);
          break;
      }
      if (purchase.pendingCompletePurchase) {
        await _iap.completePurchase(purchase);
      }
    }
  }

  /// Writes a client-trusted entitlement flag so the rest of the app can
  /// gate Pro features immediately after purchase.
  ///
  /// This is NOT secure as-is: a modified client could write
  /// `users/{uid}.isPro = true` directly if Firestore rules allow it.
  /// Before shipping, add a Cloud Function that verifies
  /// `purchase.verificationData.serverVerificationData` against the Play
  /// Developer API and only that function should be allowed to set
  /// `isPro`/`proUntil` — restrict the field in firestore.rules the same
  /// way `elevatedVerificationStatus` is restricted for tag records.
  Future<void> _grantEntitlement(PurchaseDetails purchase) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    final isYearly = purchase.productID == yearlyId;
    final proUntil = DateTime.now().add(Duration(days: isYearly ? 365 : 30));
    await FirebaseFirestore.instance.collection('users').doc(user.uid).set({
      'isPro': true,
      'proProductId': purchase.productID,
      'proUntil': Timestamp.fromDate(proUntil),
      'proPurchaseVerified': false, // flip true once server verification exists
    }, SetOptions(merge: true));
  }
}
