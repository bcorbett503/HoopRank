import 'dart:convert';
import 'dart:io';

void main() {
  final jsonFile = File('assets/data/courts-us-popular.json');
  final dartFile = File('lib/services/mock_courts_data.dart');

  if (!jsonFile.existsSync()) {
    print('Error: JSON file not found at ${jsonFile.path}');
    return;
  }

  try {
    final jsonString = jsonFile.readAsStringSync();
    // Validate JSON
    final jsonData = jsonDecode(jsonString);
    
    // Re-encode with indentation for readability (optional, but nice)
    final encoder = JsonEncoder.withIndent('  ');
    final formattedJson = encoder.convert(jsonData);

    final dartContent = '''
// This file is auto-generated. Do not edit directly.
final List<Map<String, dynamic>> mockCourtsData = $formattedJson;
''';

    dartFile.writeAsStringSync(dartContent);
    print('Successfully wrote ${jsonData.length} courts to ${dartFile.path}');
  } catch (e) {
    print('Error processing data: $e');
  }
}
