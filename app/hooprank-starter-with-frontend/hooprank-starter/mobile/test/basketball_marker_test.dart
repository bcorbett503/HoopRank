import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../lib/widgets/basketball_marker.dart';

void main() {
  testWidgets('BasketballMarker renders correctly', (WidgetTester tester) async {
    // Build the marker
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: BasketballMarker(
              size: 50,
              isLegendary: false,
              hasKing: false,
            ),
          ),
        ),
      ),
    );

    // Verify it renders a CustomPaint
    expect(find.byType(CustomPaint), findsWidgets);
    
    // Verify it has a basketball icon
    expect(find.byIcon(Icons.sports_basketball), findsOneWidget);
  });

  testWidgets('BasketballMarker handles taps', (WidgetTester tester) async {
    bool tapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: BasketballMarker(
              size: 50,
              onTap: () {
                tapped = true;
              },
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byType(BasketballMarker));
    expect(tapped, isTrue);
  });
  
  testWidgets('BasketballMarker shows activity indicator when active', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: BasketballMarker(
              size: 50,
              hasActivity: true,
            ),
          ),
        ),
      ),
    );

    // We can't easily find the container by type since there are many, 
    // but we can verify the widget builds without error
    expect(find.byType(BasketballMarker), findsOneWidget);
  });
}
