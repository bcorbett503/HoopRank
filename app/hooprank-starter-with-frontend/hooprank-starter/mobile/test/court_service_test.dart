import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/services.dart';
import 'dart:convert';

// Simple test to verify court data loading and lookup
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  
  group('Court Data Validation', () {
    late List<Map<String, dynamic>> courtsData;
    
    setUpAll(() async {
      // Load the courts_named.json directly to validate data
      final jsonString = await rootBundle.loadString('assets/data/courts_named.json');
      courtsData = List<Map<String, dynamic>>.from(jsonDecode(jsonString));
    });
    
    test('Courts data loads successfully', () {
      expect(courtsData, isNotEmpty);
      print('Loaded ${courtsData.length} courts from assets');
    });
    
    test('Courts have required fields', () {
      for (final court in courtsData.take(10)) {
        expect(court['id'], isNotNull, reason: 'Court should have id');
        expect(court['name'], isNotNull, reason: 'Court should have name');
        expect(court['lat'], isNotNull, reason: 'Court should have lat');
        expect(court['lng'], isNotNull, reason: 'Court should have lng');
      }
    });
    
    test('Court IDs can be used for lookup', () {
      // Test finding a court by ID
      final firstCourt = courtsData.first;
      final courtId = firstCourt['id'] as String;
      
      final found = courtsData.firstWhere(
        (c) => c['id'] == courtId,
        orElse: () => <String, dynamic>{},
      );
      
      expect(found, isNotEmpty);
      expect(found['id'], equals(courtId));
      print('Court lookup works. Sample ID: $courtId, Name: ${found['name']}');
    });
    
    test('Sample court IDs for deep linking', () {
      // Print first 5 court IDs to understand ID format
      final sampleIds = courtsData.take(5).map((c) => c['id']).toList();
      print('Sample court IDs: $sampleIds');
      
      // Check for IDs with special characters
      final idsWithSlash = courtsData.where((c) => (c['id'] as String).contains('/')).take(3).toList();
      if (idsWithSlash.isNotEmpty) {
        print('IDs with slashes: ${idsWithSlash.map((c) => c['id']).toList()}');
      } else {
        print('No IDs with slashes found');
      }
    });
  });
}
