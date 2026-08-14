// main() can't be exercised directly (it calls Firebase.initializeApp,
// which needs plugin bindings the test environment doesn't provide), but
// TagsheepApp itself takes the init outcome as a parameter, so the
// fail-gracefully path is directly testable without any Firebase setup.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tagusheep_mobile/main.dart';

void main() {
  testWidgets('shows FirebaseNotConfiguredScreen instead of crashing when init fails', (tester) async {
    await tester.pumpWidget(TagsheepApp(initError: Exception('placeholder Firebase config')));
    await tester.pumpAndSettle();

    expect(find.byType(FirebaseNotConfiguredScreen), findsOneWidget);
    expect(find.textContaining("isn't connected to Firebase yet"), findsOneWidget);
  });
}
