import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

/// Enforces the free-tier scan cap the Pro screen advertises ("Free tier
/// caps at 10 scans/month; Pro removes the cap") — without this, that copy
/// was a promise with no mechanism behind it, so Pro had nothing real to
/// sell. Monthly counters live at users/{uid}/usage/{yyyy-MM}; see the
/// matching rule in ../../../firestore.rules, which only allows the owner
/// to increment their own counter by exactly 1 per write (soft protection
/// against a modified client resetting its own count downward).
class UsageService {
  static const int freeMonthlyScanLimit = 10;

  final _db = FirebaseFirestore.instance;

  String _periodId([DateTime? now]) {
    final d = now ?? DateTime.now();
    return '${d.year}-${d.month.toString().padLeft(2, '0')}';
  }

  DocumentReference<Map<String, dynamic>> _usageRef(String uid) =>
      _db.collection('users').doc(uid).collection('usage').doc(_periodId());

  DocumentReference<Map<String, dynamic>> _userRef(String uid) => _db.collection('users').doc(uid);

  Future<bool> isPro() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return false;
    final doc = await _userRef(user.uid).get();
    final data = doc.data();
    if (data == null) return false;
    if (data['isPro'] != true) return false;
    final until = data['proUntil'];
    if (until is Timestamp && until.toDate().isBefore(DateTime.now())) return false;
    return true;
  }

  Future<int> currentMonthScanCount() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return 0;
    final doc = await _usageRef(user.uid).get();
    return (doc.data()?['scanCount'] as num?)?.toInt() ?? 0;
  }

  /// Returns true if the user is under their scan cap (Pro users always
  /// pass). Call before letting the capture form submit.
  Future<bool> canScan() async {
    if (await isPro()) return true;
    final count = await currentMonthScanCount();
    return count < freeMonthlyScanLimit;
  }

  /// Call after a successful tag submission.
  Future<void> recordScan() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    final ref = _usageRef(user.uid);
    await _db.runTransaction((tx) async {
      final snap = await tx.get(ref);
      final current = (snap.data()?['scanCount'] as num?)?.toInt() ?? 0;
      tx.set(ref, {
        'scanCount': current + 1,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    });
  }
}
