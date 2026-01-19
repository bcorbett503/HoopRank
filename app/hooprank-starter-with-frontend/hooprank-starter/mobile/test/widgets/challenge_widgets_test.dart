// =============================================================================
// Challenge Widgets Tests
// =============================================================================
// Widget tests for challenge display components
// Run with: flutter test test/widgets/challenge_widgets_test.dart
// =============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/widgets/challenge_widgets.dart';

void main() {
  group('ChallengeBadge', () {
    testWidgets('shows pending icon for sent pending challenge', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChallengeBadge(isSent: true, status: 'pending'),
          ),
        ),
      );

      expect(find.byIcon(Icons.hourglass_empty), findsOneWidget);
    });

    testWidgets('shows check icon for accepted challenge', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChallengeBadge(isSent: true, status: 'accepted'),
          ),
        ),
      );

      expect(find.byIcon(Icons.check_circle), findsOneWidget);
    });

    testWidgets('shows cancel icon for declined challenge', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChallengeBadge(isSent: true, status: 'declined'),
          ),
        ),
      );

      expect(find.byIcon(Icons.cancel), findsOneWidget);
    });

    testWidgets('shows timer_off icon for expired challenge', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChallengeBadge(isSent: true, status: 'expired'),
          ),
        ),
      );

      expect(find.byIcon(Icons.timer_off), findsOneWidget);
    });

    testWidgets('shows CHALLENGE label for received challenge', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChallengeBadge(isSent: false, status: 'pending'),
          ),
        ),
      );

      expect(find.text('CHALLENGE'), findsOneWidget);
    });
  });

  group('ChallengeStatusIndicator', () {
    testWidgets('shows NEW badge for received challenge', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChallengeStatusIndicator(isSent: false, status: 'pending'),
          ),
        ),
      );

      expect(find.text('NEW'), findsOneWidget);
      expect(find.byIcon(Icons.sports_basketball), findsOneWidget);
    });

    testWidgets('shows schedule icon for sent pending', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChallengeStatusIndicator(isSent: true, status: 'pending'),
          ),
        ),
      );

      expect(find.byIcon(Icons.schedule), findsOneWidget);
    });

    testWidgets('shows check icon for sent accepted', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChallengeStatusIndicator(isSent: true, status: 'accepted'),
          ),
        ),
      );

      expect(find.byIcon(Icons.check_circle_outline), findsOneWidget);
    });
  });

  group('ChallengeDialog', () {
    testWidgets('displays player name in title', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChallengeDialog(
              playerId: '123',
              playerName: 'Test Player',
              playerRating: 4.0,
            ),
          ),
        ),
      );

      expect(find.text('Challenge Test Player?'), findsOneWidget);
    });

    testWidgets('displays player rating', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChallengeDialog(
              playerId: '123',
              playerName: 'Test',
              playerRating: 4.5,
            ),
          ),
        ),
      );

      expect(find.text('⭐ 4.5'), findsOneWidget);
    });

    testWidgets('displays city when provided', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChallengeDialog(
              playerId: '123',
              playerName: 'Test',
              playerRating: 3.0,
              city: 'San Francisco',
            ),
          ),
        ),
      );

      expect(find.text('📍 San Francisco'), findsOneWidget);
    });

    testWidgets('shows action buttons', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChallengeDialog(
              playerId: '123',
              playerName: 'Test',
              playerRating: 3.0,
            ),
          ),
        ),
      );

      expect(find.text('Cancel'), findsOneWidget);
      expect(find.text('Challenge'), findsOneWidget);
    });
  });
}
