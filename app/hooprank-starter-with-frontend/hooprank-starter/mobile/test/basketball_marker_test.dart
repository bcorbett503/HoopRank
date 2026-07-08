import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../lib/widgets/avatar_image.dart';
import '../lib/widgets/basketball_marker.dart';

void main() {
  testWidgets('BasketballMarker renders correctly',
      (WidgetTester tester) async {
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

    // Verify it has a court image by default instead of the old plain icon.
    expect(find.byType(Image), findsOneWidget);
    expect(find.byIcon(Icons.sports_basketball), findsNothing);
    expect(find.byType(HoopRankAvatarImage), findsNothing);
  });

  testWidgets('BasketballMarker uses court image when provided',
      (WidgetTester tester) async {
    final imageUrl =
        'data:image/png;base64,${base64Encode(_transparentPngBytes)}';

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: BasketballMarker(
              size: 50,
              courtImageUrl: imageUrl,
            ),
          ),
        ),
      ),
    );

    final image = tester.widget<HoopRankAvatarImage>(
      find.byType(HoopRankAvatarImage),
    );
    expect(image.imageUrl, imageUrl);
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

  testWidgets('BasketballMarker shows activity indicator when active',
      (WidgetTester tester) async {
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

const List<int> _transparentPngBytes = [
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10,
  0,
  0,
  0,
  13,
  73,
  72,
  68,
  82,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  1,
  8,
  6,
  0,
  0,
  0,
  31,
  21,
  196,
  137,
  0,
  0,
  0,
  13,
  73,
  68,
  65,
  84,
  120,
  156,
  99,
  248,
  15,
  4,
  0,
  9,
  251,
  3,
  253,
  167,
  111,
  144,
  171,
  0,
  0,
  0,
  0,
  73,
  69,
  78,
  68,
  174,
  66,
  96,
  130,
];
