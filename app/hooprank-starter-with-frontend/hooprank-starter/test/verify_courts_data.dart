import 'dart:convert';
import 'dart:io';

void main() async {
  final file = File('mobile/assets/data/courts.json');
  if (!await file.exists()) {
    print('Error: courts.json not found at ${file.path}');
    return;
  }

  try {
    final content = await file.readAsString();
    final List<dynamic> data = json.decode(content);
    print('Successfully decoded JSON. Found ${data.length} items.');

    if (data.isEmpty) {
      print('Warning: JSON array is empty.');
      return;
    }

    // Check first item structure
    final first = data.first;
    print('First item keys: ${first.keys.toList()}');
    
    // Verify required fields for Court model
    int validCount = 0;
    for (var item in data) {
      final id = item['id'];
      final name = item['name'];
      final lat = item['lat'];
      final lng = item['lng'];
      
      if (id != null && name != null && lat is num && lng is num) {
        validCount++;
      } else {
        print('Invalid item found: $item');
      }
    }
    
    print('Parsed $validCount valid court objects out of ${data.length}.');

  } catch (e) {
    print('Error parsing JSON: $e');
  }
}
