import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/models.dart';
import 'package:hooprank/models/map_hub_models.dart';
import 'package:hooprank/services/recommended_matchup_engine.dart';

User _user({
  required String id,
  required double rating,
  double? distanceMi,
  double contestRate = 0.0,
  int gamesPlayed = 0,
  String? position,
}) {
  return User(
    id: id,
    name: 'User $id',
    rating: rating,
    distanceMi: distanceMi,
    contestRate: contestRate,
    gamesPlayed: gamesPlayed,
    position: position,
  );
}

void main() {
  group('RecommendedMatchupEngine', () {
    test('picks reliable player over unreliable player', () {
      final me = _user(id: 'me', rating: 3.2, position: 'G');
      final reliable = _user(
        id: 'r1',
        rating: 3.15,
        distanceMi: 4,
        contestRate: 0.04,
        gamesPlayed: 12,
        position: 'G',
      );
      final unreliable = _user(
        id: 'u1',
        rating: 3.15,
        distanceMi: 4,
        contestRate: 0.35,
        gamesPlayed: 12,
        position: 'G',
      );

      final result = RecommendedMatchupEngine.pickBest(
        currentUser: me,
        candidates: [unreliable, reliable],
        discoverMode: 'open',
        searchRadiusMiles: 25,
      );

      expect(result, isNotNull);
      expect(result!.player.id, 'r1');
    });

    test('disqualifies large rating gap in similar mode', () {
      final me = _user(id: 'me', rating: 3.0);
      final far = _user(id: 'far', rating: 4.7, distanceMi: 1, gamesPlayed: 20);

      final result = RecommendedMatchupEngine.pickBest(
        currentUser: me,
        candidates: [far],
        discoverMode: 'similar',
        searchRadiusMiles: 25,
      );

      expect(result, isNull);
    });

    test('returns null when top score is below quality gate', () {
      final me = _user(id: 'me', rating: 3.0);
      final lowQuality = _user(
        id: 'low',
        rating: 4.9,
        distanceMi: 25,
        contestRate: 0.6,
        gamesPlayed: 2,
      );

      final result = RecommendedMatchupEngine.pickBest(
        currentUser: me,
        candidates: [lowQuality],
        discoverMode: 'open',
        searchRadiusMiles: 25,
      );

      expect(result, isNull);
    });

    test('handles missing distanceMi and still ranks candidate', () {
      final me = _user(id: 'me', rating: 3.0, position: 'F');
      final c1 = _user(
        id: 'c1',
        rating: 3.05,
        gamesPlayed: 15,
        contestRate: 0.05,
        position: 'F',
      );
      final c2 = _user(
        id: 'c2',
        rating: 3.4,
        gamesPlayed: 3,
        contestRate: 0.2,
        position: 'C',
      );

      final result = RecommendedMatchupEngine.pickBest(
        currentUser: me,
        candidates: [c2, c1],
        discoverMode: 'open',
        searchRadiusMiles: 25,
      );

      expect(result, isNotNull);
      expect(result!.player.id, 'c1');
    });
  });

  group('RecommendedMatchupEngine.pickBestOnMap', () {
    MapHubPlayer mapPlayer(String id, {bool isCurrentUser = false}) {
      return MapHubPlayer(
        id: id,
        name: 'Player $id',
        lat: 37.78,
        lng: -122.42,
        isCurrentUser: isCurrentUser,
      );
    }

    test('only candidates visible on the map can win', () {
      final me = _user(id: 'me', rating: 3.2, position: 'G');
      // Stronger match overall, but not rendered on the map.
      final offMap = _user(
        id: 'off',
        rating: 3.2,
        distanceMi: 1,
        contestRate: 0.02,
        gamesPlayed: 20,
        position: 'G',
      );
      final onMap = _user(
        id: 'on',
        rating: 3.6,
        distanceMi: 8,
        gamesPlayed: 6,
        position: 'F',
      );

      final result = RecommendedMatchupEngine.pickBestOnMap(
        currentUser: me,
        candidates: [offMap, onMap],
        mapPlayers: [mapPlayer('on'), mapPlayer('someone-else')],
        discoverMode: 'open',
        searchRadiusMiles: 25,
      );

      expect(result, isNotNull);
      expect(result!.player.id, 'on');
    });

    test('returns null when no candidate is on the map', () {
      final me = _user(id: 'me', rating: 3.2);
      final candidate = _user(id: 'c1', rating: 3.3, gamesPlayed: 10);

      final result = RecommendedMatchupEngine.pickBestOnMap(
        currentUser: me,
        candidates: [candidate],
        mapPlayers: [mapPlayer('unrelated')],
        discoverMode: 'open',
        searchRadiusMiles: 25,
      );

      expect(result, isNull);
    });

    test('the current user marker does not count as an on-map candidate', () {
      final me = _user(id: 'me', rating: 3.2);
      final candidate = _user(id: 'me', rating: 3.2);

      final result = RecommendedMatchupEngine.pickBestOnMap(
        currentUser: me,
        candidates: [candidate],
        mapPlayers: [mapPlayer('me', isCurrentUser: true)],
        discoverMode: 'open',
        searchRadiusMiles: 25,
      );

      expect(result, isNull);
    });
  });
}
