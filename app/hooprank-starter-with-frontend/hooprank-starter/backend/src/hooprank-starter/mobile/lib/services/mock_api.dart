import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../models/court.dart';
import '../models/match.dart';
import '../models/run.dart';
import '../models/dispute.dart';
import '../models/leaderboard_row.dart';

class MockApi {
  static const String _sessionKey = 'hr:session';
  static String _friendsKey(String uid) => 'hr:friends:$uid';



  Future<List<T>> _getList<T>(String path, T Function(Map<String, dynamic>) fromJson) async {
    final String response = await rootBundle.loadString('assets/mockdata/$path');
    final List<dynamic> data = json.decode(response);
    return data.map((e) => fromJson(e as Map<String, dynamic>)).toList();
  }

  // Session
  Future<User> login(String provider) async {
    final users = await getUsers();
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString(_sessionKey);
    
    if (existing != null) {
      return User.fromJson(json.decode(existing) as Map<String, dynamic>);
    }

    // Demo: pick first user
    final me = users.first;
    await prefs.setString(_sessionKey, json.encode(me.toJson()));

    // Bootstrap friends
    final frKey = _friendsKey(me.id);
    if (!prefs.containsKey(frKey)) {
      final seed = users.length > 1 ? [users[1].id] : <String>[];
      await prefs.setStringList(frKey, seed);
    }

    return me;
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessionKey);
  }

  Future<User?> getSession() async {
    final prefs = await SharedPreferences.getInstance();
    final s = prefs.getString(_sessionKey);
    return s != null ? User.fromJson(json.decode(s) as Map<String, dynamic>) : null;
  }

  // Data Fetchers
  Future<List<User>> getUsers() => _getList('users.json', User.fromJson);
  Future<List<Court>> getCourts() => _getList('courts.json', Court.fromJson);
  Future<List<Match>> getMatches() => _getList('matches.json', Match.fromJson);
  Future<List<Run>> getRuns() => _getList('runs.json', Run.fromJson);
  Future<List<Dispute>> getDisputes() => _getList('disputes.json', Dispute.fromJson);
  
  Future<Map<String, List<LeaderboardRow>>> getLeaderboards() async {
    final String response = await rootBundle.loadString('assets/mockdata/leaderboards.json');
    final Map<String, dynamic> data = json.decode(response);
    return data.map((key, value) => MapEntry(
      key, 
      (value as List).map((e) => LeaderboardRow.fromJson(e as Map<String, dynamic>)).toList()
    ));
  }

  // Friends
  Future<List<String>> getFriends() async {
    final me = await getSession();
    if (me == null) return [];
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(_friendsKey(me.id)) ?? [];
  }

  Future<void> addFriend(String id) async {
    final me = await getSession();
    if (me == null) return;
    final prefs = await SharedPreferences.getInstance();
    final key = _friendsKey(me.id);
    final list = (prefs.getStringList(key) ?? []).toSet();
    list.add(id);
    await prefs.setStringList(key, list.toList());
  }

  Future<void> removeFriend(String id) async {
    final me = await getSession();
    if (me == null) return;
    final prefs = await SharedPreferences.getInstance();
    final key = _friendsKey(me.id);
    final list = (prefs.getStringList(key) ?? []).where((x) => x != id).toList();
    await prefs.setStringList(key, list);
  }
}
