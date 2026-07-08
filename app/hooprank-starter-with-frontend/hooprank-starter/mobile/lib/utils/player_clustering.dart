import 'dart:math';

import '../models/map_hub_models.dart';

/// A group of nearby players collapsed into one map bubble. Single-member
/// clusters render as a normal avatar; multi-member ones render as a count
/// bubble that expands on tap.
class PlayerCluster {
  final List<MapHubPlayer> members;

  const PlayerCluster(this.members);

  bool get isSingle => members.length == 1;
  int get count => members.length;
  MapHubPlayer get single => members.first;

  /// Geographic centroid — where the cluster bubble sits.
  double get lat =>
      members.fold<double>(0, (s, p) => s + p.lat) / members.length;
  double get lng =>
      members.fold<double>(0, (s, p) => s + p.lng) / members.length;

  /// True if anyone in the cluster is challenge-ready (drives the accent).
  bool get anyAcceptingChallenges => members.any((p) => p.acceptingChallenges);
}

/// How close (in screen pixels) two players must be to merge. Avatars are
/// ~140px wide, so anything under that overlaps; when zoomed out we merge
/// more aggressively so a metro view reads as "N hoopers here" instead of
/// a wall of avatars.
double clusterRadiusForZoom(double zoom) {
  if (zoom >= 13.5) return 110;
  if (zoom >= 11.5) return 170;
  return 240;
}

/// Greedy screen-space clustering. Higher-priority players (challenge-ready,
/// then rating) seed clusters first so the bubble sits on the players that
/// matter most. `project` maps a player to screen coordinates; any projection
/// failure falls back to every player standing alone.
List<PlayerCluster> clusterMapPlayers(
  List<MapHubPlayer> players, {
  required Point<double> Function(MapHubPlayer) project,
  required double radius,
}) {
  if (players.length < 2) {
    return [
      for (final p in players) PlayerCluster([p])
    ];
  }
  try {
    final ordered = [...players]..sort((a, b) {
        if (a.acceptingChallenges != b.acceptingChallenges) {
          return a.acceptingChallenges ? -1 : 1;
        }
        return b.rating.compareTo(a.rating);
      });
    final points = {for (final p in ordered) p.id: project(p)};
    final assigned = <String>{};
    final clusters = <PlayerCluster>[];
    for (final seed in ordered) {
      if (assigned.contains(seed.id)) continue;
      assigned.add(seed.id);
      final members = [seed];
      final seedPt = points[seed.id]!;
      for (final other in ordered) {
        if (assigned.contains(other.id)) continue;
        if (seedPt.distanceTo(points[other.id]!) < radius) {
          assigned.add(other.id);
          members.add(other);
        }
      }
      clusters.add(PlayerCluster(members));
    }
    return clusters;
  } catch (_) {
    return [
      for (final p in players) PlayerCluster([p])
    ];
  }
}
