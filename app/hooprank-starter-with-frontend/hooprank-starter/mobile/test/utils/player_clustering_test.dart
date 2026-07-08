import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/models/map_hub_models.dart';
import 'package:hooprank/utils/player_clustering.dart';

MapHubPlayer _player(
  String id, {
  double lat = 0,
  double lng = 0,
  double rating = 3.0,
  bool accepting = false,
}) {
  return MapHubPlayer.fromJson({
    'id': id,
    'name': 'Player $id',
    'lat': lat,
    'lng': lng,
    'rating': rating,
    'acceptingChallenges': accepting,
  });
}

void main() {
  // Screen projection stub: 100px per degree on both axes.
  Point<double> project(MapHubPlayer p) => Point(p.lng * 100, p.lat * -100);

  group('clusterMapPlayers', () {
    test('merges players within the radius into one cluster', () {
      final players = [
        _player('a', lat: 0, lng: 0),
        _player('b', lat: 0, lng: 0.5), // 50px away
        _player('c', lat: 0, lng: 5), // 500px away
      ];
      final clusters =
          clusterMapPlayers(players, project: project, radius: 110);
      expect(clusters, hasLength(2));
      final grouped = clusters.firstWhere((c) => !c.isSingle);
      expect(grouped.count, 2);
      expect(grouped.members.map((p) => p.id), containsAll(['a', 'b']));
      expect(clusters.firstWhere((c) => c.isSingle).single.id, 'c');
    });

    test('far-apart players all stand alone', () {
      final players = [
        _player('a', lng: 0),
        _player('b', lng: 3),
        _player('c', lng: 6),
      ];
      final clusters =
          clusterMapPlayers(players, project: project, radius: 110);
      expect(clusters, hasLength(3));
      expect(clusters.every((c) => c.isSingle), isTrue);
    });

    test('challenge-ready players seed clusters and set the accent', () {
      final players = [
        _player('low', lng: 0, rating: 2.0),
        _player('hot', lng: 0.2, rating: 3.0, accepting: true),
      ];
      final clusters =
          clusterMapPlayers(players, project: project, radius: 110);
      expect(clusters, hasLength(1));
      expect(clusters.first.members.first.id, 'hot');
      expect(clusters.first.anyAcceptingChallenges, isTrue);
    });

    test('cluster centroid averages member coordinates', () {
      final players = [
        _player('a', lat: 10, lng: 20),
        _player('b', lat: 12, lng: 22),
      ];
      final clusters = clusterMapPlayers(players,
          project: (_) => const Point(0, 0), radius: 110);
      expect(clusters.single.lat, closeTo(11, 1e-9));
      expect(clusters.single.lng, closeTo(21, 1e-9));
    });

    test('projection failure degrades to singles instead of throwing', () {
      final players = [_player('a'), _player('b')];
      final clusters = clusterMapPlayers(
        players,
        project: (_) => throw StateError('camera gone'),
        radius: 110,
      );
      expect(clusters, hasLength(2));
      expect(clusters.every((c) => c.isSingle), isTrue);
    });
  });

  test('clusterRadiusForZoom widens as the map zooms out', () {
    expect(clusterRadiusForZoom(16), lessThan(clusterRadiusForZoom(12)));
    expect(clusterRadiusForZoom(12), lessThan(clusterRadiusForZoom(9)));
  });
}
