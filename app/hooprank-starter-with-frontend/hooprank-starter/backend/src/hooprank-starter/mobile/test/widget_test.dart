import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:hooprank/main.dart';
import 'package:hooprank/state/store.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => HoopRankStore(),
        child: const HoopRankApp(),
      ),
    );

    // Verify that the app builds without crashing.
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
