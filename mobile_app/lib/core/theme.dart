import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color primaryGold = Color(0xFFFFD700);
  static const Color accentRed = Color(0xFFFF4D4D);
  static const Color backgroundBlack = Color(0xFF0F0F0F);
  static const Color surfaceGrey = Color(0xFF1E1E1E);
  static const Color textWhite = Colors.white;
  static const Color textGrey = Color(0xFFB0B0B0);

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: backgroundBlack,
      colorScheme: ColorScheme.dark(
        primary: primaryGold,
        secondary: accentRed,
        surface: surfaceGrey,
        onPrimary: Colors.black,
        onSurface: textWhite,
      ),
      textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme).apply(
        bodyColor: textWhite,
        displayColor: textWhite,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: backgroundBlack,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.outfit(
          fontSize: 20,
          fontWeight: FontWeight.bold,
          color: primaryGold,
        ),
      ),
      cardTheme: CardThemeData(
        color: surfaceGrey,
        elevation: 4,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryGold,
          foregroundColor: Colors.black,
          textStyle: const TextStyle(fontWeight: FontWeight.bold),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
    );
  }
}
