import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  bool _loading = false;
  String? _error;

  Future<void> _signIn() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final auth = context.read<AuthService>();
      final result = await auth.signInWithGoogle();
      if (result != null && mounted) Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = 'Sign-in failed. Please try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.checkroom, size: 56, color: Color(0xFFE8590C)),
              const SizedBox(height: 16),
              const Text(
                'Tagsheep',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              const Text(
                'The IMDb for clothes. Scan a tag, resolve the garment.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF8A8378)),
              ),
              const SizedBox(height: 32),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(_error!, style: const TextStyle(color: Colors.red)),
                ),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _loading ? null : _signIn,
                  icon: _loading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.login),
                  label: Text(_loading ? 'Signing in...' : 'Continue with Google'),
                ),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Keep browsing without an account'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
