// =============================================================================
// Models Tests
// =============================================================================
// Unit tests for data model parsing and conversion
// Run with: flutter test test/models_test.dart
// =============================================================================

import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/models.dart';

void main() {
  group('User', () {
    group('fromJson', () {
      test('parses valid JSON correctly', () {
        final user = User.fromJson({
          'id': 'user123',
          'name': 'Test Player',
          'photoUrl': 'https://example.com/photo.jpg',
          'rating': 4.5,
          'matchesPlayed': 10,
          'wins': 7,
          'losses': 3,
          'city': 'San Francisco',
        });

        expect(user.id, 'user123');
        expect(user.name, 'Test Player');
        expect(user.photoUrl, 'https://example.com/photo.jpg');
        expect(user.rating, 4.5);
        expect(user.matchesPlayed, 10);
        expect(user.wins, 7);
        expect(user.losses, 3);
        expect(user.city, 'San Francisco');
      });

      test('handles String rating values', () {
        final user = User.fromJson({
          'id': 'user123',
          'name': 'Test',
          'rating': '3.75',
        });

        expect(user.rating, 3.75);
      });

      test('handles missing optional fields', () {
        final user = User.fromJson({
          'id': 'user123',
          'name': 'Test',
        });

        expect(user.rating, 3.0); // default
        expect(user.matchesPlayed, 0);
        expect(user.wins, 0);
        expect(user.losses, 0);
        expect(user.photoUrl, isNull);
      });

      test('throws for missing id', () {
        expect(
          () => User.fromJson({'name': 'Test'}),
          throwsFormatException,
        );
      });

      test('throws for empty id', () {
        expect(
          () => User.fromJson({'id': '', 'name': 'Test'}),
          throwsFormatException,
        );
      });
    });

    test('toPlayer creates valid Player', () {
      final user = User(
        id: 'user123',
        name: 'Test Player',
        rating: 4.0,
        position: 'G',
        height: '6\'2"',
      );

      final player = user.toPlayer();

      expect(player.id, 'user123');
      expect(player.name, 'Test Player');
      expect(player.rating, 4.0);
      expect(player.position, 'G');
      expect(player.height, '6\'2"');
      expect(player.offense, 75); // default
    });
  });

  group('Player', () {
    group('fromJson', () {
      test('parses complete JSON', () {
        final player = Player.fromJson({
          'id': 'player123',
          'slug': 'test-player',
          'name': 'Test Player',
          'team': 'SF Warriors',
          'position': 'F',
          'age': 28,
          'height': '6\'5"',
          'weight': '200 lbs',
          'rating': 4.2,
          'offense': 85,
          'defense': 80,
          'shooting': 90,
          'passing': 75,
          'rebounding': 70,
        });

        expect(player.id, 'player123');
        expect(player.slug, 'test-player');
        expect(player.name, 'Test Player');
        expect(player.team, 'SF Warriors');
        expect(player.position, 'F');
        expect(player.age, 28);
        expect(player.offense, 85);
        expect(player.shooting, 90);
      });

      test('applies defaults for missing fields', () {
        final player = Player.fromJson({
          'id': 'player123',
          'name': 'Test',
        });

        expect(player.slug, 'player123'); // falls back to id
        expect(player.team, 'Free Agent');
        expect(player.position, 'G');
        expect(player.age, 25);
        expect(player.rating, 3.0);
        expect(player.offense, 75);
      });
    });

    test('toUser creates valid User', () {
      final player = Player(
        id: 'player123',
        slug: 'test',
        name: 'Test Player',
        team: 'Warriors',
        position: 'C',
        age: 30,
        height: '6\'10"',
        weight: '250 lbs',
        rating: 4.5,
        offense: 90,
        defense: 85,
        shooting: 80,
        passing: 75,
        rebounding: 95,
      );

      final user = player.toUser();

      expect(user.id, 'player123');
      expect(user.name, 'Test Player');
      expect(user.position, 'C');
      expect(user.rating, 4.5);
    });
  });

  group('Court', () {
    test('fromJson parses correctly', () {
      final court = Court.fromJson({
        'id': 'court123',
        'name': 'Golden Gate Park Courts',
        'lat': 37.7749,
        'lng': -122.4194,
        'address': '123 Park Ave',
        'king': 'TopPlayer',
      });

      expect(court.id, 'court123');
      expect(court.name, 'Golden Gate Park Courts');
      expect(court.lat, 37.7749);
      expect(court.lng, -122.4194);
      expect(court.address, '123 Park Ave');
      expect(court.king, 'TopPlayer');
    });

    test('handles String coordinate values', () {
      final court = Court.fromJson({
        'id': 'court123',
        'name': 'Test Court',
        'lat': '37.7749',
        'lng': '-122.4194',
      });

      expect(court.lat, 37.7749);
      expect(court.lng, -122.4194);
    });
  });
}
