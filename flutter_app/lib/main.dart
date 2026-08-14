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
  Object? initError;
  try {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  } catch (e) {
    // firebase_options.dart still has placeholder values until someone runs
    // `flutterfire configure` (see README.md) -- fail into a clear in-app
    // screen instead of a silent crash, so the app is at least inspectable
    // before that step happens.
    initError = e;
  }
  runApp(TagsheepApp(initError: initError));
}

class TagsheepApp extends StatelessWidget {
  final Object? initError;
  const TagsheepApp({super.key, this.initError});

  @override
  Widget build(BuildContext context) {
    if (initError != null) {
      return MaterialApp(
        title: 'Tagsheep',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        home: const FirebaseNotConfiguredScreen(),
      );
    }
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

/// Shown instead of crashing when Firebase.initializeApp() fails -- almost
/// always because firebase_options.dart still has the placeholder values
/// this repo ships with. See README.md "Setup" for the flutterfire
/// configure step that replaces them.
class FirebaseNotConfiguredScreen extends StatelessWidget {
  const FirebaseNotConfiguredScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off, size: 48, color: Color(0xFF8A8378)),
                const SizedBox(height: 16),
                const Text(
                  'Tagsheep isn\'t connected to Firebase yet',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 12),
                const Text(
                  'lib/firebase_options.dart still has placeholder values. '
                  'Run `flutterfire configure --project=tagusheep-72229` '
                  'from flutter_app/ to connect this build to the real '
                  'project, then rebuild. See README.md "Setup".',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF8A8378)),
                ),
              ],
            ),
          ),
        ),
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
