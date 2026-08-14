import 'package:flutter/material.dart';

/// Matches the web app's brand mark ("Tagsheep") — warm, editorial, a bit
/// archival, since the product is a garment reference archive.
class AppTheme {
  static const Color primary = Color(0xFF2D2A26); // near-black ink
  static const Color accent = Color(0xFFE8590C); // tag-orange
  static const Color surface = Color(0xFFFAF7F2); // paper
  static const Color muted = Color(0xFF8A8378);

  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: accent,
        brightness: Brightness.light,
        surface: surface,
      ),
      scaffoldBackgroundColor: surface,
      fontFamily: 'Roboto',
    );
    return base.copyWith(
      appBarTheme: const AppBarTheme(
        backgroundColor: surface,
        foregroundColor: primary,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: primary,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFE6E0D6)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFE6E0D6)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: accent, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFFEFEAE0)),
        ),
      ),
    );
  }
}
