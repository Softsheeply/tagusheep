import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

class AuthService extends ChangeNotifier {
  AuthService() {
    FirebaseAuth.instance.authStateChanges().listen((user) {
      notifyListeners();
    });
  }

  User? get currentUser => FirebaseAuth.instance.currentUser;
  bool get isSignedIn => currentUser != null;

  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email'],
  );

  Future<UserCredential?> signInWithGoogle() async {
    try {
      final account = await _googleSignIn.signIn();
      if (account == null) return null; // user cancelled
      final auth = await account.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: auth.accessToken,
        idToken: auth.idToken,
      );
      return await FirebaseAuth.instance.signInWithCredential(credential);
    } catch (e) {
      debugPrint('Google sign-in failed: $e');
      rethrow;
    }
  }

  Future<void> signOut() async {
    await _googleSignIn.signOut();
    await FirebaseAuth.instance.signOut();
  }
}
