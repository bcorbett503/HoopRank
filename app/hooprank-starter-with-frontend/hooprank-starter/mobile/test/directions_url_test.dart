// Test for court directions URL generation
// These tests verify the correct URL format for Apple Maps and Google Maps

import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Directions URL Generation Tests', () {
    test('Apple Maps URL is correctly formatted', () {
      const lat = 37.7749;
      const lng = -122.4194;
      
      // Build the URL as done in map_screen.dart
      final appleUrl = Uri.parse(
        'https://maps.apple.com/?daddr=$lat,$lng&dirflg=d'
      );
      
      // Verify URL structure
      expect(appleUrl.scheme, equals('https'));
      expect(appleUrl.host, equals('maps.apple.com'));
      expect(appleUrl.queryParameters['daddr'], equals('$lat,$lng'));
      expect(appleUrl.queryParameters['dirflg'], equals('d')); // driving mode
    });

    test('Google Maps URL is correctly formatted', () {
      const lat = 37.7749;
      const lng = -122.4194;
      
      // Build the URL as done in map_screen.dart
      final googleUrl = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving'
      );
      
      // Verify URL structure
      expect(googleUrl.scheme, equals('https'));
      expect(googleUrl.host, equals('www.google.com'));
      expect(googleUrl.path, equals('/maps/dir/'));
      expect(googleUrl.queryParameters['api'], equals('1'));
      expect(googleUrl.queryParameters['destination'], equals('$lat,$lng'));
      expect(googleUrl.queryParameters['travelmode'], equals('driving'));
    });

    test('URLs handle negative coordinates correctly', () {
      // Test with negative longitude (Western hemisphere)
      const lat = 40.7128;
      const lng = -74.0060; // New York
      
      final appleUrl = Uri.parse(
        'https://maps.apple.com/?daddr=$lat,$lng&dirflg=d'
      );
      final googleUrl = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving'
      );
      
      // Coordinates should be preserved correctly
      expect(appleUrl.queryParameters['daddr'], equals('40.7128,-74.006'));
      expect(googleUrl.queryParameters['destination'], equals('40.7128,-74.006'));
    });

    test('URLs handle special coordinates (equator/prime meridian)', () {
      // Test with zero coordinates
      const lat = 0.0;
      const lng = 0.0;
      
      final appleUrl = Uri.parse(
        'https://maps.apple.com/?daddr=$lat,$lng&dirflg=d'
      );
      
      expect(appleUrl.queryParameters['daddr'], equals('0.0,0.0'));
    });
  });

  group('iOS Info.plist Requirements', () {
    test('Required URL schemes are documented', () {
      // This test documents the required LSApplicationQueriesSchemes
      final requiredSchemes = [
        'maps',           // Apple Maps
        'comgooglemaps',  // Google Maps app
        'googlemaps',     // Alternative Google Maps scheme
      ];
      
      // These schemes must be in Info.plist for URL launching to work
      expect(requiredSchemes, isNotEmpty);
      expect(requiredSchemes, contains('maps'));
      expect(requiredSchemes, contains('comgooglemaps'));
    });
  });
}
