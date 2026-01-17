import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

/// Minimal test screen to diagnose player loading issue
class NetworkTestScreen extends StatefulWidget {
  const NetworkTestScreen({super.key});

  @override
  State<NetworkTestScreen> createState() => _NetworkTestScreenState();
}

class _NetworkTestScreenState extends State<NetworkTestScreen> {
  String _status = 'Not started';
  String _response = '';
  int _userCount = 0;
  List<String> _userNames = [];

  Future<void> _testApiCall() async {
    setState(() {
      _status = 'Testing...';
      _response = '';
      _userCount = 0;
      _userNames = [];
    });

    try {
      // Step 1: Make HTTP request
      final url = 'http://10.0.2.2:4000/users';
      debugPrint('>>> Testing URL: $url');
      
      final response = await http.get(
        Uri.parse(url),
        headers: {'x-user-id': '4ODZUrySRUhFDC5wVW6dCySBprD2'},
      ).timeout(const Duration(seconds: 10));

      debugPrint('>>> Status: ${response.statusCode}');
      debugPrint('>>> Body length: ${response.body.length}');

      if (response.statusCode != 200) {
        setState(() {
          _status = 'Failed: ${response.statusCode}';
          _response = response.body.substring(0, 200);
        });
        return;
      }

      // Step 2: Parse JSON
      final List<dynamic> jsonList = jsonDecode(response.body);
      debugPrint('>>> Parsed ${jsonList.length} items');

      // Step 3: Extract names
      final names = <String>[];
      for (var item in jsonList) {
        final name = item['name']?.toString() ?? 'Unknown';
        final id = item['id']?.toString() ?? 'no-id';
        names.add('$name ($id)');
      }

      setState(() {
        _status = 'SUCCESS!';
        _response = 'Response: ${response.body.length} bytes';
        _userCount = jsonList.length;
        _userNames = names;
      });
    } catch (e) {
      debugPrint('>>> Error: $e');
      setState(() {
        _status = 'ERROR: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Network Test')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ElevatedButton(
              onPressed: _testApiCall,
              child: const Text('Test API Call'),
            ),
            const SizedBox(height: 16),
            Text('Status: $_status', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text('User Count: $_userCount'),
            Text(_response),
            const SizedBox(height: 16),
            const Text('Users:', style: TextStyle(fontWeight: FontWeight.bold)),
            Expanded(
              child: ListView.builder(
                itemCount: _userNames.length,
                itemBuilder: (ctx, i) => Text(_userNames[i]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
