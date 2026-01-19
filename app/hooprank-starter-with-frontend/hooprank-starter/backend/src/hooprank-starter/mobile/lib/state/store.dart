import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../models/court.dart';
import '../models/match.dart';
import '../models/run.dart';
import '../models/dispute.dart';
import '../models/leaderboard_row.dart';
import '../services/mock_api.dart';

class HoopRankStore extends ChangeNotifier {
  final MockApi _api = MockApi();

  User? me;
  Map<String, User> users = {};
  List<Court> courts = [];
  List<Match> matches = [];
  List<Run> runs = [];
  List<Dispute> disputes = [];
  Map<String, List<LeaderboardRow>> leaderboards = {};
  List<String> friends = [];
  bool loading = false;

  Future<void> init() async {
    loading = true;
    notifyListeners();

    try {
      final results = await Future.wait([
        _api.getSession(),
        _api.getUsers(),
        _api.getCourts(),
        _api.getMatches(),
        _api.getRuns(),
        _api.getDisputes(),
        _api.getLeaderboards(),
        _api.getFriends(),
      ]);

      me = results[0] as User?;
      final userList = results[1] as List<User>;
      users = {for (var u in userList) u.id: u};
      courts = results[2] as List<Court>;
      matches = results[3] as List<Match>;
      runs = results[4] as List<Run>;
      disputes = results[5] as List<Dispute>;
      leaderboards = results[6] as Map<String, List<LeaderboardRow>>;
      friends = results[7] as List<String>;
    } catch (e) {
      debugPrint('Error initializing store: $e');
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> loginWithProvider(String provider) async {
    me = await _api.login(provider);
    friends = await _api.getFriends();
    notifyListeners();
  }

  Future<void> logout() async {
    await _api.logout();
    me = null;
    friends = [];
    notifyListeners();
  }

  Future<void> addFriendById(String id) async {
    await _api.addFriend(id);
    friends = [...friends, id];
    notifyListeners();
  }

  Future<void> removeFriendById(String id) async {
    await _api.removeFriend(id);
    friends = friends.where((x) => x != id).toList();
    notifyListeners();
  }

  User? getUser(String id) => users[id];
}
