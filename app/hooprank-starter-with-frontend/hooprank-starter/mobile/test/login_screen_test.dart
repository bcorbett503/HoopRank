import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'package:hooprank/screens/login_screen.dart';
import 'package:hooprank/state/app_state.dart';

void main() {
  testWidgets('logged out users can join a match by QR from login',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final authState = AuthState(initialize: false);
    final router = GoRouter(
      initialLocation: '/login',
      routes: [
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginScreen(),
        ),
        GoRoute(
          path: '/join',
          builder: (context, state) => const _StubScreen('Join by QR'),
        ),
      ],
    );

    await tester.pumpWidget(
      ChangeNotifierProvider<AuthState>.value(
        value: authState,
        child: MaterialApp.router(
          theme: ThemeData.dark(useMaterial3: true),
          routerConfig: router,
        ),
      ),
    );

    expect(find.text('Continue without an account'), findsOneWidget);

    await tester.tap(find.text('Continue without an account'));
    await tester.pumpAndSettle();

    expect(find.text('Join by QR'), findsOneWidget);
  });
}

class _StubScreen extends StatelessWidget {
  const _StubScreen(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(child: Text(label)),
    );
  }
}
