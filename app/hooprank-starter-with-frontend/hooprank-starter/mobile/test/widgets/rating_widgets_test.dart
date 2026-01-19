// =============================================================================
// Rating Widgets Tests
// =============================================================================
// Widget tests for rating display components
// Run with: flutter test test/widgets/rating_widgets_test.dart
// =============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/widgets/rating_widgets.dart';

void main() {
  group('getRankLabel', () {
    test('returns Legend for rating >= 5.0', () {
      expect(getRankLabel(5.0), 'Legend');
      expect(getRankLabel(5.5), 'Legend');
    });

    test('returns Elite for rating >= 4.5', () {
      expect(getRankLabel(4.5), 'Elite');
      expect(getRankLabel(4.9), 'Elite');
    });

    test('returns Pro for rating >= 4.0', () {
      expect(getRankLabel(4.0), 'Pro');
      expect(getRankLabel(4.4), 'Pro');
    });

    test('returns All-Star for rating >= 3.5', () {
      expect(getRankLabel(3.5), 'All-Star');
      expect(getRankLabel(3.9), 'All-Star');
    });

    test('returns Starter for rating >= 3.0', () {
      expect(getRankLabel(3.0), 'Starter');
      expect(getRankLabel(3.4), 'Starter');
    });

    test('returns Bench for rating >= 2.5', () {
      expect(getRankLabel(2.5), 'Bench');
    });

    test('returns Rookie for rating >= 2.0', () {
      expect(getRankLabel(2.0), 'Rookie');
    });

    test('returns Newcomer for rating < 2.0', () {
      expect(getRankLabel(1.5), 'Newcomer');
      expect(getRankLabel(0.0), 'Newcomer');
    });
  });

  group('getRankColor', () {
    test('returns appropriate colors for each tier', () {
      expect(getRankColor(5.0), Colors.purple);
      expect(getRankColor(4.5), Colors.amber);
      expect(getRankColor(4.0), Colors.orange);
      expect(getRankColor(3.5), Colors.blue);
      expect(getRankColor(3.0), Colors.green);
    });
  });

  group('RankBadge', () {
    testWidgets('displays rank label with emoji by default', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: RankBadge(rating: 4.0),
          ),
        ),
      );

      expect(find.text('🏀 Pro'), findsOneWidget);
    });

    testWidgets('hides emoji when showEmoji is false', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: RankBadge(rating: 4.0, showEmoji: false),
          ),
        ),
      );

      expect(find.text('Pro'), findsOneWidget);
      expect(find.text('🏀 Pro'), findsNothing);
    });
  });

  group('RatingChip', () {
    testWidgets('displays rating with star icon', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: RatingChip(rating: 3.5),
          ),
        ),
      );

      expect(find.text('3.5'), findsOneWidget);
      expect(find.byIcon(Icons.star), findsOneWidget);
    });
  });

  group('RatingHeroCard', () {
    testWidgets('displays rating and rank label', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: RatingHeroCard(rating: 4.25),
          ),
        ),
      );

      expect(find.text('4.25'), findsOneWidget);
      expect(find.text('Your HoopRank'), findsOneWidget);
      expect(find.text('🏀 Pro'), findsOneWidget);
    });

    testWidgets('shows start match button when onStartMatch provided', (tester) async {
      bool buttonPressed = false;
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: RatingHeroCard(
              rating: 3.0,
              onStartMatch: () => buttonPressed = true,
            ),
          ),
        ),
      );

      expect(find.text('Start a 1v1'), findsOneWidget);
      
      await tester.tap(find.text('Start a 1v1'));
      expect(buttonPressed, isTrue);
    });

    testWidgets('hides button when onStartMatch is null', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: RatingHeroCard(rating: 3.0),
          ),
        ),
      );

      expect(find.text('Start a 1v1'), findsNothing);
    });
  });
}
