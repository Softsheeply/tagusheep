import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import 'pro_screen.dart';
import 'sign_in_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final user = auth.currentUser;

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
          Card(
            child: ListTile(
              leading: const Icon(Icons.workspace_premium_outlined, color: Color(0xFFE8590C)),
              title: const Text('Tagsheep Pro'),
              subtitle: const Text('Unlimited scans, bulk export, no ads'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ProScreen())),
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
