import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/utils/default_avatar_variants.dart';
import 'package:hooprank/widgets/permission_prompt_sheet.dart';

void main() {
  testWidgets('PermissionPromptSheet renders title, message and actions '
      'without overflow', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        backgroundColor: const Color(0xFF0B0F14),
        body: Align(
          alignment: Alignment.bottomCenter,
          child: PermissionPromptSheet(
            title: 'Accept Challenges',
            message: 'Let players near you challenge you to a game. You get a '
                'heads-up for each one and can always accept or decline.',
            avatarSvg: defaultAvatarSvgForId('demo-player-7'),
            accentIcon: Icons.flash_on_rounded,
            accent: const Color(0xFFFF6B35),
            primaryLabel: 'Accept Challenges',
          ),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Accept Challenges'), findsWidgets);
    expect(find.textContaining('challenge you to a game'), findsOneWidget);
    expect(find.text('Not now'), findsOneWidget);
    expect(find.byIcon(Icons.flash_on_rounded), findsOneWidget);
    expect(tester.takeException(), isNull); // no RenderFlex overflow
  });
}
