import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:hooprank/state/app_state.dart';
import 'package:hooprank/widgets/map_quick_actions.dart';

Widget _harness() {
  final router = GoRouter(
    initialLocation: '/play',
    routes: [
      GoRoute(
        path: '/play',
        builder: (_, __) => Scaffold(
          backgroundColor: const Color(0xFF9DBBD6),
          body: SafeArea(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 88, 14),
                child: RepaintBoundary(
                  key: const ValueKey('qa_capture'),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    child: const MapQuickActions(),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      GoRoute(path: '/profile/setup', builder: (_, __) => const SizedBox()),
      GoRoute(path: '/profile', builder: (_, __) => const SizedBox()),
      GoRoute(path: '/quick-play', builder: (_, __) => const SizedBox()),
    ],
  );
  return ChangeNotifierProvider<AuthState>(
    create: (_) => AuthState(initialize: false),
    child: MaterialApp.router(routerConfig: router),
  );
}

void main() {
  testWidgets('MapQuickActions shows profile, Quick Play and share',
      (tester) async {
    await tester.pumpWidget(_harness());
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('quick_action_profile')), findsOneWidget);
    expect(find.byKey(const ValueKey('quick_action_play')), findsOneWidget);
    expect(find.byKey(const ValueKey('quick_action_share')), findsOneWidget);
    expect(find.text('Quick Play'), findsOneWidget);
    expect(find.byIcon(Icons.sports_basketball), findsOneWidget);
    expect(find.byIcon(Icons.ios_share_rounded), findsOneWidget);

    // Dump a real PNG so the bar can be eyeballed without a device.
    final dump = Platform.environment['QA_DUMP'];
    if (dump != null) {
      final boundary = tester
              .renderObject(find.byKey(const ValueKey('qa_capture')))
          as RenderRepaintBoundary;
      await tester.runAsync(() async {
        final image = await boundary.toImage(pixelRatio: 3);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        if (bytes != null) {
          await File(dump).writeAsBytes(bytes.buffer.asUint8List());
        }
      });
    }
  });
}
