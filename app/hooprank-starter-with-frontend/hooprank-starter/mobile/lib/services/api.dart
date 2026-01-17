import 'dart:convert';
import 'package:http/http.dart' as http;

class Api {
  final base = const String.fromEnvironment('API_BASE', defaultValue: 'http://localhost:4000');
  Future<Map<String, dynamic>> createMatch(String hostId, String guestId) async {
    final r = await http.post(Uri.parse('$base/api/v1/matches'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'hostId': hostId, 'guestId': guestId}));
    return jsonDecode(r.body);
  }

  Future<Map<String, dynamic>> completeFirst(String winnerId) async {
    final m = await createMatch('u1', 'u2');
    final id = m['id'];
    final r = await http.post(Uri.parse('$base/api/v1/matches/$id/complete'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'winner': winnerId}));
    return jsonDecode(r.body);
  }
}
