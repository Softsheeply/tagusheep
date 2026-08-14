import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../services/usage_service.dart';
import 'pro_screen.dart';
import 'sign_in_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _usage = UsageService();
  int? _scanCount;
  bool? _isPro;
  String? _loadedForUid;

  Future<void> _loadUsage(String uid) async {
    final results = await Future.wait([_usage.currentMonthScanCount(), _usage.isPro()]);
    if (!mounted) return;
    setState(() {
      _scanCount = results[0] as int;
      _isPro = results[1] as bool;
      _loadedForUid = uid;
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final user = auth.currentUser;

    if (user != null && _loadedForUid != user.uid) {
      _loadUsage(user.uid);
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (user == null) ...[
            const Text('Not signed in', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SignInScreen())),
              child: const Text('Sign in with Google'),
            ),
          ] else ...[
            CircleAvatar(
              radius: 32,
              backgroundImage: user.photoURL != null ? NetworkImage(user.photoURL!) : null,
              child: user.photoURL == null
                  ? Text((user.displayName?.isNotEmpty ?? false) ? user.displayName![0] : '?')
                  : null,
            ),
            const SizedBox(height: 12),
            Text(user.displayName ?? 'Contributor', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            Text(user.email ?? '', style: const TextStyle(color: Color(0xFF8A8378))),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: () => auth.signOut(),
              icon: const Icon(Icons.logout),
              label: const Text('Sign out'),
            ),
          ],
          const SizedBox(height: 32),
          if (user != null && _isPro != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                _isPro!
                    ? 'Pro — unlimited scans'
                    : '${_scanCount ?? 0} / ${UsageService.freeMonthlyScanLimit} free scans used this month',
                style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF8A8378)),
              ),
            ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.workspace_premium_outlined, color: Color(0xFFE8590C)),
              title: const Text('Tagsheep Pro'),
              subtitle: const Text('Unlimited scans, bulk export, no ads'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const ProScreen()))
                  .then((_) {
                if (user != null) _loadUsage(user.uid);
              }),
            ),
          ),
          const SizedBox(height: 12),
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Tagsheep is the searchable garment identity database — style numbers, RN, brand archives, all in one place. Every tag you scan helps the archive.',
                style: TextStyle(color: Color(0xFF8A8378), fontSize: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
