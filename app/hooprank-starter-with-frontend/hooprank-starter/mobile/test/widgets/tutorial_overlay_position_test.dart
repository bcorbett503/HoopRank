import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:hooprank/state/tutorial_state.dart';
import 'package:hooprank/widgets/tutorial_overlay.dart';

void main() {
  Future<void> pumpTutorialSettle(WidgetTester tester) async {
    // TutorialOverlay uses Future.delayed + setState in a loop (120ms). Using one big
    // pump() won't advance the loop because it only builds one frame at the end.
    for (var i = 0; i < 14; i++) {
      await tester.pump(const Duration(milliseconds: 130));
    }
  }

  testWidgets(
      'Tutorial highlight border aligns with target when overlay is offset',
      (tester) async {
    final tutorial = TutorialState()..startTutorial();
    tutorial.advanceToStep('court_follow');

    final followKey = TutorialKeys.getKey(TutorialKeys.courtFollowButton);

    await tester.pumpWidget(
      ChangeNotifierProvider<TutorialState>.value(
        value: tutorial,
        child: MaterialApp(
          home: Padding(
            padding: const EdgeInsets.only(left: 24, top: 48),
            child: TutorialOverlay(
              child: Scaffold(
                body: Align(
                  alignment: Alignment.topRight,
                  child: SizedBox(
                    key: followKey,
                    width: 48,
                    height: 48,
                    child: const Icon(Icons.favorite_border),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    // TutorialOverlay has a repeating pulse animation, so pumpAndSettle never completes.
    await tester.pump();
    await pumpTutorialSettle(tester);

    final targetRect = tester.getRect(find.byKey(followKey));
    final highlightRect =
        tester.getRect(find.byKey(const ValueKey('tutorial_highlight_border')));

    expect(highlightRect, equals(targetRect.inflate(8)));
  });

  testWidgets(
      'Tutorial highlight border aligns with All Upcoming popup menu item',
      (tester) async {
    // Start inactive so the overlay doesn't block opening the popup menu.
    final tutorial = TutorialState();

    final allUpcomingKey =
        TutorialKeys.getKey(TutorialKeys.courtsAllUpcomingMenuItem);

    await tester.pumpWidget(
      ChangeNotifierProvider<TutorialState>.value(
        value: tutorial,
        child: MaterialApp(
          home: TutorialOverlay(
            child: Scaffold(
              body: Center(
                child: PopupMenuButton<String>(
                  itemBuilder: (context) => [
                    PopupMenuItem(
                      value: 'today',
                      child: Row(
                        children: const [
                          Icon(Icons.today, size: 18),
                          SizedBox(width: 8),
                          Text('Today'),
                        ],
                      ),
                    ),
                    PopupMenuItem(
                      value: 'all',
                      child: Container(
                        key: allUpcomingKey,
                        width: double.infinity,
                        child: Row(
                          children: const [
                            Icon(Icons.calendar_month, size: 18),
                            SizedBox(width: 8),
                            Text('All Upcoming'),
                          ],
                        ),
                      ),
                    ),
                  ],
                  child: const Text('Find Runs'),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.pump();

    // Open the menu so the menu items (and their keys) are in the tree.
    await tester.tap(find.text('Find Runs'));
    await tester.pump();

    // Allow the popup menu route animation to finish.
    for (var i = 0;
        i < 20 && find.byKey(allUpcomingKey).evaluate().isEmpty;
        i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    expect(find.byKey(allUpcomingKey), findsOneWidget);

    // Now activate the tutorial at the step that highlights the menu item.
    tutorial.startTutorial();
    tutorial.advanceToStep('courts_select_all_upcoming');
    await tester.pump();

    // Allow the tutorial overlay's delayed re-measure/rebuild + settle loop to complete.
    await pumpTutorialSettle(tester);

    final targetRect = tester.getRect(find.byKey(allUpcomingKey));
    final highlightRect =
        tester.getRect(find.byKey(const ValueKey('tutorial_highlight_border')));

    expect(highlightRect, equals(targetRect.inflate(8)));
  });
}
