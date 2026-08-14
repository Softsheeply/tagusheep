import 'package:flutter/material.dart';

import 'capture_screen.dart';
import 'favorites_screen.dart';
import 'profile_screen.dart';
import 'search_screen.dart';

class RootShell extends StatefulWidget {
  const RootShell({super.key});

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  int _index = 0;

  static const _screens = [
    SearchScreen(),
    CaptureScreen(),
    FavoritesScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.search_outlined), selectedIcon: Icon(Icons.search), label: 'Search'),
          NavigationDestination(icon: Icon(Icons.camera_alt_outlined), selectedIcon: Icon(Icons.camera_alt), label: 'Scan tag'),
          NavigationDestination(icon: Icon(Icons.favorite_border), selectedIcon: Icon(Icons.favorite), label: 'Saved'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
