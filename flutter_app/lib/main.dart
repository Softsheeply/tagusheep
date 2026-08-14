import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'firebase_options.dart';
import 'screens/root_shell.dart';
import 'screens/sign_in_screen.dart';
import 'services/auth_service.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(const TagsheepApp());
}

class TagsheepApp extends StatelessWidget {
  const TagsheepApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthService(),
      child: MaterialApp(
        title: 'Tagsheep',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        home: const AuthGate(),
      ),
    );
  }
}

/// Browsing/search work signed-out (public read, matches firestore.rules);
/// capture, favorites, and profile require sign-in. RootShell handles that
/// per-tab rather than gating the whole app, so a curious first-time visitor
/// can see real garment records before ever being asked to sign in.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return const RootShell();
  }
}

class SignInRequired extends StatelessWidget {
  final String message;
  const SignInRequired({super.key, this.message = 'Sign in to continue'});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.lock_outline, size: 40, color: Color(0xFF8A8378)),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SignInScreen()),
              ),
              child: const Text('Sign in with Google'),
            ),
          ],
        ),
      ),
    );
  }
}
