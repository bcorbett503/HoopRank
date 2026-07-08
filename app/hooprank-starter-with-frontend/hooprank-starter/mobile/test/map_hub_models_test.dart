import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/models/map_hub_models.dart';

void main() {
  test('MapHubPlayer parses challenge and new-player map fields', () {
    final player = MapHubPlayer.fromJson({
      'id': 'player-1',
      'name': 'Maya Buckets',
      'avatar_config': {'type': 'generatedHoopRankAvatar'},
      'accepting_challenges': 1,
      'is_new_player': true,
      'is_current_user': true,
      'status_label': 'New to HoopRank',
      'lat': '37.78',
      'lng': '-122.42',
    });

    expect(player.acceptingChallenges, isTrue);
    expect(player.isNewPlayer, isTrue);
    expect(player.isCurrentUser, isTrue);
    expect(player.statusLabel, 'New to HoopRank');
    expect(
        player.avatarConfig, containsPair('type', 'generatedHoopRankAvatar'));
    expect(player.lat, 37.78);
    expect(player.lng, -122.42);
  });

  test('MapHubCourt parses active and scheduled run status', () {
    final court = MapHubCourt.fromJson({
      'id': 'court-1',
      'name': 'Blacktop Park',
      'lat': 37.78,
      'lng': -122.42,
      'image_url': 'https://cdn.example.com/blacktop.jpg',
      'image_source_url': 'https://example.com/blacktop',
      'image_source_label': 'Example court photo',
      'active_check_in_count': 3,
      'follower_count': 9,
      'has_upcoming_run': true,
      'has_upcoming_activity': true,
      'status_label': '3 players here',
      'next_run': {
        'id': 'run-1',
        'gameMode': '5v5',
        'scheduledAt': '2026-07-05T18:00:00Z',
      },
    });

    expect(court.activeCheckInCount, 3);
    expect(court.followerCount, 9);
    expect(court.court.hasUpcomingRun, isTrue);
    expect(court.court.hasUpcomingActivity, isTrue);
    expect(court.court.imageUrl, 'https://cdn.example.com/blacktop.jpg');
    expect(court.court.imageSourceUrl, 'https://example.com/blacktop');
    expect(court.court.imageSourceLabel, 'Example court photo');
    expect(court.statusLabel, '3 players here');
    expect(court.nextRun?.gameMode, '5v5');
  });
}
