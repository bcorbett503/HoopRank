import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../utils/generated_avatar.dart';

class AvatarGameMeshPainter extends CustomPainter {
  final HoopRankAvatarConfig config;
  final AvatarBasePersonPreset basePreset;
  final Color skinTone;
  final Color hairColor;
  final Color primary;
  final Color secondary;
  final bool compact;

  const AvatarGameMeshPainter({
    required this.config,
    required this.basePreset,
    required this.skinTone,
    required this.hairColor,
    required this.primary,
    required this.secondary,
    this.compact = false,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final rig = _ToonRig(config: config, basePreset: basePreset);
    final pose = _ToonPose.forConfig(config, rig);
    final scale = math.min(
      size.width * (compact ? .9 : .72) / rig.sceneWidth,
      size.height * (compact ? .95 : .88) / rig.sceneHeight,
    );
    final projection = _Projection(
      scale: scale,
      origin: Offset(size.width / 2, size.height * .965),
    );
    final palette = _ToonPalette(
      skin: skinTone,
      skinLight: _tone(skinTone, .14),
      skinDark: _tone(skinTone, -.18),
      hair: hairColor,
      hairLight: _tone(hairColor, .14),
      hairDark: _tone(hairColor, -.18),
      primary: _outfitPrimary(primary, config.outfit),
      primaryLight: _tone(_outfitPrimary(primary, config.outfit), .1),
      primaryDark: _tone(_outfitPrimary(primary, config.outfit), -.16),
      secondary: secondary,
      secondaryLight: _tone(secondary, .08),
      secondaryDark: _tone(secondary, -.16),
      trim: Colors.white,
      shoe: const Color(0xFFF4F8FF),
      shoeDark: const Color(0xFF9FB3CC),
      sole: const Color(0xFF111827),
      ball: const Color(0xFFD97706),
      ballDark: const Color(0xFF7C2D12),
    );

    _drawGroundShadow(canvas, projection, rig);
    _drawBackLimbs(canvas, projection, rig, pose, palette);
    _drawTorso(canvas, projection, rig, palette);
    _drawFrontLimbs(canvas, projection, rig, pose, palette);
    if (pose.hasBall) {
      _drawBall(canvas, projection, pose.ballCenter, rig.ballRadius, palette);
    }
    _drawNeckAndHead(canvas, projection, rig, palette);
  }

  void _drawGroundShadow(
    Canvas canvas,
    _Projection projection,
    _ToonRig rig,
  ) {
    final center = projection.project(const _V3(0, .035, .18));
    final rect = Rect.fromCenter(
      center: center,
      width: projection.scale * rig.shadowWidth,
      height: projection.scale * .2,
    );
    canvas.drawOval(
      rect,
      Paint()
        ..isAntiAlias = true
        ..shader = RadialGradient(
          colors: [
            Colors.black.withValues(alpha: compact ? .28 : .25),
            Colors.black.withValues(alpha: .08),
            Colors.transparent,
          ],
        ).createShader(rect),
    );
  }

  void _drawBackLimbs(
    Canvas canvas,
    _Projection projection,
    _ToonRig rig,
    _ToonPose pose,
    _ToonPalette palette,
  ) {
    final longPants = _longPants;
    final sleeve = _hasSleeves;
    final legColor = longPants ? palette.secondary : palette.skin;
    final armColor = longPants ? palette.primary : palette.skin;

    _drawLeg(canvas, projection, rig, pose.rightHip, pose.rightKnee,
        pose.rightAnkle, legColor, palette,
        back: true);
    _drawArm(
      canvas,
      projection,
      rig,
      pose.backShoulder,
      pose.backElbow,
      pose.backHand,
      sleeve ? palette.primary : armColor,
      config.outfit == 'hoodie' || config.outfit == 'warmups'
          ? palette.primary
          : palette.skin,
      palette,
      back: true,
    );
  }

  void _drawFrontLimbs(
    Canvas canvas,
    _Projection projection,
    _ToonRig rig,
    _ToonPose pose,
    _ToonPalette palette,
  ) {
    final longPants = _longPants;
    final sleeve = _hasSleeves;
    final legColor = longPants ? palette.secondary : palette.skin;
    final forearm = config.accessory == 'sleeve'
        ? palette.trim
        : (config.outfit == 'hoodie' || config.outfit == 'warmups'
            ? palette.primary
            : palette.skin);

    _drawLeg(canvas, projection, rig, pose.leftHip, pose.leftKnee,
        pose.leftAnkle, legColor, palette);
    _drawShortsHem(canvas, projection, rig, palette);
    _drawArm(
      canvas,
      projection,
      rig,
      pose.frontShoulder,
      pose.frontElbow,
      pose.frontHand,
      sleeve ? palette.primary : palette.skin,
      forearm,
      palette,
    );
  }

  void _drawLeg(
    Canvas canvas,
    _Projection projection,
    _ToonRig rig,
    _V3 hip,
    _V3 knee,
    _V3 ankle,
    Color color,
    _ToonPalette palette, {
    bool back = false,
  }) {
    _drawTaperedCapsule(
      canvas,
      projection.project(hip),
      projection.project(knee),
      projection.scale * rig.thighWidth,
      projection.scale * rig.kneeWidth,
      color,
      light: _tone(color, .12),
      dark: _tone(color, -.12),
      alpha: back ? .92 : 1,
    );
    _drawTaperedCapsule(
      canvas,
      projection.project(knee),
      projection.project(ankle),
      projection.scale * rig.kneeWidth * .9,
      projection.scale * rig.calfWidth,
      color,
      light: _tone(color, .1),
      dark: _tone(color, -.14),
      alpha: back ? .92 : 1,
    );
    _drawJoint(
      canvas,
      projection.project(knee),
      projection.scale * rig.kneeWidth * .32,
      color,
      back ? .42 : .56,
    );

    if (!_longPants) {
      final sockTop = _V3(
        ankle.x * .82 + knee.x * .18,
        ankle.y * .56 + knee.y * .44,
        ankle.z * .82 + knee.z * .18,
      );
      _drawTaperedCapsule(
        canvas,
        projection.project(sockTop),
        projection.project(ankle),
        projection.scale * rig.calfWidth * .74,
        projection.scale * rig.calfWidth * .68,
        palette.trim,
        light: Colors.white,
        dark: const Color(0xFFDDE7F5),
        alpha: back ? .94 : 1,
      );
    }

    _drawShoe(canvas, projection, rig, ankle, palette,
        toeDirection: ankle.x < 0 ? -1 : 1, back: back);
  }

  void _drawArm(
    Canvas canvas,
    _Projection projection,
    _ToonRig rig,
    _V3 shoulder,
    _V3 elbow,
    _V3 hand,
    Color upperColor,
    Color lowerColor,
    _ToonPalette palette, {
    bool back = false,
  }) {
    _drawShoulderCap(canvas, projection, rig, shoulder, upperColor,
        alpha: back ? .9 : 1);
    _drawTaperedCapsule(
      canvas,
      projection.project(shoulder),
      projection.project(elbow),
      projection.scale * rig.upperArmWidth,
      projection.scale * rig.elbowWidth,
      upperColor,
      light: _tone(upperColor, .12),
      dark: _tone(upperColor, -.12),
      alpha: back ? .9 : 1,
    );
    _drawTaperedCapsule(
      canvas,
      projection.project(elbow),
      projection.project(hand),
      projection.scale * rig.elbowWidth * .92,
      projection.scale * rig.wristWidth,
      lowerColor,
      light: _tone(lowerColor, .1),
      dark: _tone(lowerColor, -.14),
      alpha: back ? .9 : 1,
    );
    _drawJoint(
      canvas,
      projection.project(elbow),
      projection.scale * rig.elbowWidth * .3,
      upperColor,
      back ? .38 : .5,
    );
    _drawHand(canvas, projection.project(hand), projection.scale, rig, palette,
        back: back);
  }

  void _drawTorso(
    Canvas canvas,
    _Projection projection,
    _ToonRig rig,
    _ToonPalette palette,
  ) {
    final shoulderLeft =
        projection.project(_V3(-rig.shoulderWidth / 2, rig.shoulderY, .14));
    final shoulderRight =
        projection.project(_V3(rig.shoulderWidth / 2, rig.shoulderY, .14));
    final waistLeft =
        projection.project(_V3(-rig.waistWidth / 2, rig.waistY, .2));
    final waistRight =
        projection.project(_V3(rig.waistWidth / 2, rig.waistY, .2));
    final hipLeft = projection.project(_V3(-rig.hipWidth / 2, rig.hipY, .18));
    final hipRight = projection.project(_V3(rig.hipWidth / 2, rig.hipY, .18));
    final chest = projection.project(_V3(0, rig.chestY, .22));

    final torso = Path()
      ..moveTo(shoulderLeft.dx, shoulderLeft.dy)
      ..cubicTo(
        shoulderLeft.dx - projection.scale * .018,
        chest.dy,
        waistLeft.dx - projection.scale * .012,
        waistLeft.dy,
        hipLeft.dx,
        hipLeft.dy,
      )
      ..quadraticBezierTo(
        chest.dx,
        hipLeft.dy + projection.scale * .045,
        hipRight.dx,
        hipRight.dy,
      )
      ..cubicTo(
        waistRight.dx + projection.scale * .012,
        waistRight.dy,
        shoulderRight.dx + projection.scale * .018,
        chest.dy,
        shoulderRight.dx,
        shoulderRight.dy,
      )
      ..quadraticBezierTo(
        chest.dx,
        shoulderLeft.dy - projection.scale * .045,
        shoulderLeft.dx,
        shoulderLeft.dy,
      )
      ..close();
    canvas.drawShadow(torso, Colors.black.withValues(alpha: .22), 2, true);
    _drawGradientPath(
      canvas,
      torso,
      [palette.primaryLight, palette.primary, palette.primaryDark],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
    canvas.drawPath(
      torso,
      Paint()
        ..isAntiAlias = true
        ..style = PaintingStyle.stroke
        ..strokeJoin = StrokeJoin.round
        ..strokeWidth = math.max(.8, projection.scale * .004)
        ..color = palette.primaryDark.withValues(alpha: .28),
    );
    final sideShade = Paint()
      ..isAntiAlias = true
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = math.max(.8, projection.scale * .018)
      ..color = palette.primaryDark.withValues(alpha: .12);
    canvas.drawLine(
      Offset(shoulderLeft.dx + projection.scale * .025,
          shoulderLeft.dy + projection.scale * .045),
      Offset(hipLeft.dx + projection.scale * .025,
          hipLeft.dy - projection.scale * .025),
      sideShade,
    );
    canvas.drawLine(
      Offset(shoulderRight.dx - projection.scale * .025,
          shoulderRight.dy + projection.scale * .045),
      Offset(hipRight.dx - projection.scale * .025,
          hipRight.dy - projection.scale * .025),
      sideShade,
    );

    final shortsTop = projection.project(_V3(0, rig.hipY + .035, .24));
    final shortsBottom = projection.project(_V3(0, rig.shortsBottomY, .23));
    final shorts = Path()
      ..moveTo(hipLeft.dx - projection.scale * .015, shortsTop.dy)
      ..lineTo(hipRight.dx + projection.scale * .015, shortsTop.dy)
      ..lineTo(hipRight.dx - projection.scale * .025, shortsBottom.dy)
      ..quadraticBezierTo(
        shortsTop.dx + projection.scale * .035,
        shortsBottom.dy - projection.scale * .008,
        shortsTop.dx,
        shortsBottom.dy + projection.scale * .02,
      )
      ..quadraticBezierTo(
        shortsTop.dx - projection.scale * .035,
        shortsBottom.dy - projection.scale * .008,
        hipLeft.dx + projection.scale * .025,
        shortsBottom.dy,
      )
      ..close();
    _drawGradientPath(
      canvas,
      shorts,
      [palette.secondaryLight, palette.secondary, palette.secondaryDark],
      begin: Alignment.topCenter,
      end: Alignment.bottomRight,
    );
    canvas.drawPath(
      shorts,
      Paint()
        ..isAntiAlias = true
        ..style = PaintingStyle.stroke
        ..strokeJoin = StrokeJoin.round
        ..strokeWidth = math.max(.8, projection.scale * .004)
        ..color = palette.secondaryDark.withValues(alpha: .36),
    );

    _drawJerseyTrim(canvas, projection, rig, palette);
    _drawJerseyNumber(canvas, projection, rig, palette);

    if (config.outfit == 'hoodie') {
      _drawHoodieDetails(canvas, projection, rig, palette);
    }
  }

  void _drawShortsHem(
    Canvas canvas,
    _Projection projection,
    _ToonRig rig,
    _ToonPalette palette,
  ) {
    final y = projection.project(_V3(0, rig.shortsBottomY, .3)).dy;
    final left =
        projection.project(_V3(-rig.hipWidth * .35, rig.shortsBottomY, .3));
    final right =
        projection.project(_V3(rig.hipWidth * .35, rig.shortsBottomY, .3));
    final paint = Paint()
      ..isAntiAlias = true
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = math.max(1, projection.scale * .006)
      ..color = palette.trim.withValues(alpha: .46);
    canvas.drawLine(Offset(left.dx, y), Offset(right.dx, y), paint);
  }

  void _drawShoulderCap(
    Canvas canvas,
    _Projection projection,
    _ToonRig rig,
    _V3 shoulder,
    Color color, {
    required double alpha,
  }) {
    final center = projection.project(shoulder + const _V3(0, -.015, .08));
    final rect = Rect.fromCenter(
      center: center,
      width: projection.scale * rig.upperArmWidth * 1.22,
      height: projection.scale * rig.upperArmWidth * 1.1,
    );
    canvas.drawOval(
      rect,
      Paint()
        ..isAntiAlias = true
        ..shader = RadialGradient(
          center: const Alignment(-.35, -.35),
          colors: [
            _tone(color, .16).withValues(alpha: alpha),
            color.withValues(alpha: alpha),
            _tone(color, -.14).withValues(alpha: alpha),
          ],
        ).createShader(rect),
    );
  }

  void _drawJerseyTrim(
    Canvas canvas,
    _Projection projection,
    _ToonRig rig,
    _ToonPalette palette,
  ) {
    final top = projection.project(_V3(0, rig.shoulderY - .015, .34));
    final chest = projection.project(_V3(0, rig.chestY - .03, .34));
    final leftTop = projection
        .project(_V3(-rig.shoulderWidth * .34, rig.shoulderY - .01, .34));
    final rightTop = projection
        .project(_V3(rig.shoulderWidth * .34, rig.shoulderY - .01, .34));
    final leftBottom =
        projection.project(_V3(-rig.waistWidth * .42, rig.waistY, .34));
    final rightBottom =
        projection.project(_V3(rig.waistWidth * .42, rig.waistY, .34));
    final trim = Paint()
      ..isAntiAlias = true
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..strokeWidth = math.max(1, projection.scale * .008)
      ..color = palette.trim.withValues(alpha: .82);
    canvas.drawLine(leftTop, leftBottom, trim);
    canvas.drawLine(rightTop, rightBottom, trim);
    canvas.drawArc(
      Rect.fromCenter(
        center: Offset(top.dx, top.dy + projection.scale * .048),
        width: projection.scale * rig.neckWidth * 2.8,
        height: projection.scale * .11,
      ),
      .1,
      math.pi - .2,
      false,
      trim..color = palette.trim.withValues(alpha: .52),
    );
    if (config.outfit == 'tee') {
      canvas.drawLine(
        Offset(leftBottom.dx + projection.scale * .02,
            chest.dy + projection.scale * .14),
        Offset(rightBottom.dx - projection.scale * .02,
            chest.dy + projection.scale * .14),
        trim..color = palette.trim.withValues(alpha: .24),
      );
    }
  }

  void _drawJerseyNumber(
    Canvas canvas,
    _Projection projection,
    _ToonRig rig,
    _ToonPalette palette,
  ) {
    final number = TextPainter(
      text: TextSpan(
        text: config.jerseyNumber,
        style: TextStyle(
          color:
              (config.outfit == 'warmups' ? palette.primaryDark : palette.trim)
                  .withValues(alpha: .98),
          fontSize: projection.scale * (compact ? .105 : .13),
          fontWeight: FontWeight.w900,
          height: 1,
          letterSpacing: 0,
          shadows: [
            Shadow(
              color: Colors.black.withValues(alpha: .24),
              blurRadius: projection.scale * .01,
              offset: Offset(0, projection.scale * .005),
            ),
          ],
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: projection.scale * .38);
    final center = projection.project(_V3(.035, rig.waistY + .085, .4));
    number.paint(
        canvas, center.translate(-number.width / 2, -number.height / 2));
  }

  void _drawHoodieDetails(
    Canvas canvas,
    _Projection projection,
    _ToonRig rig,
    _ToonPalette palette,
  ) {
    final drawstring = Paint()
      ..isAntiAlias = true
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = math.max(1, projection.scale * .006)
      ..color = palette.trim.withValues(alpha: .54);
    canvas.drawLine(
      projection.project(_V3(-.035, rig.shoulderY - .02, .42)),
      projection.project(_V3(-.09, rig.waistY + .1, .42)),
      drawstring,
    );
    canvas.drawLine(
      projection.project(_V3(.035, rig.shoulderY - .02, .42)),
      projection.project(_V3(.09, rig.waistY + .1, .42)),
      drawstring,
    );
  }

  void _drawNeckAndHead(
    Canvas canvas,
    _Projection projection,
    _ToonRig rig,
    _ToonPalette palette,
  ) {
    final neck = Rect.fromCenter(
      center: projection.project(_V3(0, rig.neckY, .2)),
      width: projection.scale * rig.neckWidth,
      height: projection.scale * .16,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(neck, Radius.circular(neck.width * .35)),
      Paint()
        ..isAntiAlias = true
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [palette.skinLight, palette.skin, palette.skinDark],
        ).createShader(neck),
    );

    final head = _headRect(projection, rig);
    canvas.drawShadow(
      Path()..addOval(head),
      Colors.black.withValues(alpha: .16),
      1.5,
      true,
    );
    canvas.drawOval(
      head,
      Paint()
        ..isAntiAlias = true
        ..shader = RadialGradient(
          center: const Alignment(-.28, -.36),
          radius: .95,
          colors: [palette.skinLight, palette.skin, palette.skinDark],
          stops: const [0, .58, 1],
        ).createShader(head),
    );

    _drawEars(canvas, projection, rig, palette);
    _drawHair(canvas, head, palette);
    _drawFace(canvas, head, palette);
    _drawHeadAccessories(canvas, head, projection, rig, palette);
  }

  void _drawEars(
    Canvas canvas,
    _Projection projection,
    _ToonRig rig,
    _ToonPalette palette,
  ) {
    final head = _headRect(projection, rig);
    final earPaint = Paint()
      ..isAntiAlias = true
      ..shader = RadialGradient(
        colors: [palette.skinLight, palette.skinDark],
      ).createShader(head);
    final left = Rect.fromCenter(
      center: Offset(
          head.left + head.width * .055, head.center.dy - head.height * .02),
      width: head.width * .13,
      height: head.height * .18,
    );
    final right = Rect.fromCenter(
      center: Offset(
          head.right - head.width * .055, head.center.dy - head.height * .02),
      width: head.width * .13,
      height: head.height * .18,
    );
    canvas.drawOval(left, earPaint);
    canvas.drawOval(right, earPaint);
  }

  Rect _headRect(_Projection projection, _ToonRig rig) {
    final center = projection.project(rig.headCenter + const _V3(0, 0, .22));
    return Rect.fromCenter(
      center: center,
      width: projection.scale * rig.headWidth,
      height: projection.scale * rig.headHeight,
    );
  }

  void _drawHair(Canvas canvas, Rect head, _ToonPalette palette) {
    if (config.hairStyle == 'bald') return;
    final hairPaint = Paint()
      ..isAntiAlias = true
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [palette.hairLight, palette.hair, palette.hairDark],
      ).createShader(head);
    final path = Path();
    switch (config.hairStyle) {
      case 'curls':
        path
          ..moveTo(
              head.left + head.width * .07, head.center.dy - head.height * .08)
          ..cubicTo(
              head.left + head.width * .08,
              head.top + head.height * .02,
              head.right - head.width * .1,
              head.top - head.height * .02,
              head.right - head.width * .06,
              head.center.dy - head.height * .08)
          ..quadraticBezierTo(head.center.dx, head.top + head.height * .25,
              head.left + head.width * .09, head.center.dy - head.height * .04)
          ..close();
        canvas.drawPath(path, hairPaint);
        for (var i = 0; i < 10; i++) {
          final x = head.left + head.width * (.1 + i * .087);
          final y = head.top + head.height * (.22 + (i.isEven ? -.035 : .02));
          canvas.drawOval(
            Rect.fromCenter(
              center: Offset(x, y),
              width: head.width * .16,
              height: head.height * .13,
            ),
            hairPaint,
          );
        }
      case 'locs':
      case 'braids':
        path
          ..moveTo(
              head.left + head.width * .07, head.center.dy - head.height * .09)
          ..cubicTo(
              head.left + head.width * .12,
              head.top - head.height * .04,
              head.right - head.width * .12,
              head.top - head.height * .05,
              head.right - head.width * .06,
              head.center.dy - head.height * .08)
          ..lineTo(
              head.right - head.width * .1, head.center.dy + head.height * .02)
          ..quadraticBezierTo(head.center.dx, head.top + head.height * .21,
              head.left + head.width * .12, head.center.dy + head.height * .02)
          ..close();
        canvas.drawPath(path, hairPaint);
        final braidPaint = Paint()
          ..isAntiAlias = true
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeWidth = head.width * .035
          ..color = palette.hairDark;
        for (final x in <double>[.2, .31, .42, .53, .64, .75, .84]) {
          canvas.drawLine(
            Offset(head.left + head.width * x, head.top + head.height * .24),
            Offset(
                head.left + head.width * x, head.center.dy + head.height * .16),
            braidPaint,
          );
        }
      case 'straight':
        path
          ..moveTo(
              head.left + head.width * .06, head.center.dy - head.height * .1)
          ..cubicTo(
              head.left + head.width * .14,
              head.top - head.height * .02,
              head.center.dx + head.width * .12,
              head.top - head.height * .06,
              head.right - head.width * .07,
              head.center.dy - head.height * .08)
          ..quadraticBezierTo(
              head.center.dx + head.width * .08,
              head.top + head.height * .24,
              head.left + head.width * .1,
              head.center.dy + head.height * .02)
          ..close();
        canvas.drawPath(path, hairPaint);
      case 'buzz':
        final buzzRect = Rect.fromCenter(
          center: Offset(head.center.dx, head.top + head.height * .45),
          width: head.width * .9,
          height: head.height * .7,
        );
        canvas.drawArc(
          buzzRect,
          math.pi * 1.04,
          math.pi * .92,
          false,
          Paint()
            ..isAntiAlias = true
            ..style = PaintingStyle.stroke
            ..strokeCap = StrokeCap.round
            ..strokeWidth = head.height * .13
            ..color = palette.hair.withValues(alpha: .82),
        );
      default:
        path
          ..moveTo(
              head.left + head.width * .08, head.center.dy - head.height * .12)
          ..cubicTo(
              head.left + head.width * .14,
              head.top,
              head.center.dx + head.width * .16,
              head.top - head.height * .055,
              head.right - head.width * .06,
              head.center.dy - head.height * .1)
          ..lineTo(
              head.right - head.width * .13, head.center.dy - head.height * .04)
          ..quadraticBezierTo(
              head.center.dx + head.width * .03,
              head.top + head.height * .18,
              head.left + head.width * .14,
              head.center.dy - head.height * .04)
          ..close();
        canvas.drawPath(path, hairPaint);
    }

    final shine = Paint()
      ..isAntiAlias = true
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = math.max(1, head.width * .014)
      ..color = palette.hairLight.withValues(alpha: .22);
    canvas.drawArc(
      Rect.fromCenter(
        center: Offset(
            head.center.dx + head.width * .03, head.top + head.height * .35),
        width: head.width * .48,
        height: head.height * .25,
      ),
      math.pi * 1.05,
      math.pi * .44,
      false,
      shine,
    );
  }

  void _drawFace(Canvas canvas, Rect head, _ToonPalette palette) {
    final eyeY = head.center.dy - head.height * .04;
    final eyeDx = head.width * basePreset.eyeSpacing;
    final eyeW = head.width * .122 * basePreset.eyeWidthScale;
    final eyeH = head.height * .068 * basePreset.eyeHeightScale;
    _drawEye(canvas, Offset(head.center.dx - eyeDx, eyeY), eyeW, eyeH, palette);
    _drawEye(canvas, Offset(head.center.dx + eyeDx, eyeY), eyeW, eyeH, palette);
    _drawBrow(
        canvas, Offset(head.center.dx - eyeDx, eyeY), eyeW, eyeH, palette);
    _drawBrow(canvas, Offset(head.center.dx + eyeDx, eyeY), eyeW, eyeH, palette,
        flip: true);
    _drawNose(canvas, head, palette);
    _drawSmile(canvas, head);
  }

  void _drawEye(
    Canvas canvas,
    Offset center,
    double width,
    double height,
    _ToonPalette palette,
  ) {
    final eye = Rect.fromCenter(center: center, width: width, height: height);
    canvas.drawOval(
      eye,
      Paint()
        ..isAntiAlias = true
        ..color = Colors.white.withValues(alpha: .96),
    );
    final irisCenter = center.translate(width * .035, height * .02);
    canvas.drawCircle(
      irisCenter,
      height * .34,
      Paint()
        ..isAntiAlias = true
        ..color = const Color(0xFF2563EB).withValues(alpha: .92),
    );
    canvas.drawCircle(
      irisCenter,
      height * .18,
      Paint()
        ..isAntiAlias = true
        ..color = const Color(0xFF0F172A),
    );
    canvas.drawCircle(
      irisCenter.translate(-height * .08, -height * .1),
      math.max(.75, height * .07),
      Paint()
        ..isAntiAlias = true
        ..color = Colors.white,
    );
  }

  void _drawBrow(
    Canvas canvas,
    Offset center,
    double width,
    double height,
    _ToonPalette palette, {
    bool flip = false,
  }) {
    final path = Path();
    final y = center.dy - height * 1.72;
    path.moveTo(
        center.dx - width * .58, y + (flip ? height * .1 : height * .2));
    path.quadraticBezierTo(
      center.dx,
      y - height * .3,
      center.dx + width * .58,
      y + (flip ? height * .2 : height * .1),
    );
    canvas.drawPath(
      path,
      Paint()
        ..isAntiAlias = true
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = math.max(1, height * .24)
        ..color = palette.hairDark.withValues(alpha: .85),
    );
  }

  void _drawNose(Canvas canvas, Rect head, _ToonPalette palette) {
    final path = Path()
      ..moveTo(head.center.dx + head.width * .015,
          head.center.dy + head.height * .025)
      ..quadraticBezierTo(
          head.center.dx - head.width * .025,
          head.center.dy + head.height * .14,
          head.center.dx - head.width * .002,
          head.center.dy + head.height * .18)
      ..quadraticBezierTo(
        head.center.dx + head.width * .052 * basePreset.noseWidthScale,
        head.center.dy + head.height * .198,
        head.center.dx + head.width * .08 * basePreset.noseWidthScale,
        head.center.dy + head.height * .165,
      );
    canvas.drawPath(
      path,
      Paint()
        ..isAntiAlias = true
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = math.max(.8, head.width * .01)
        ..color = palette.skinDark.withValues(alpha: .34),
    );
  }

  void _drawSmile(Canvas canvas, Rect head) {
    final mouthRect = Rect.fromCenter(
      center: Offset(head.center.dx, head.center.dy + head.height * .285),
      width: head.width * .3 * basePreset.mouthWidthScale,
      height: head.height * .115,
    );
    canvas.drawArc(
      mouthRect,
      .18,
      2.78,
      false,
      Paint()
        ..isAntiAlias = true
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = math.max(1, head.width * .016)
        ..color = const Color(0xFF7F1D1D).withValues(alpha: .8),
    );
    final teeth = Rect.fromCenter(
      center: Offset(head.center.dx, head.center.dy + head.height * .305),
      width: mouthRect.width * .68,
      height: mouthRect.height * .3,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(teeth, Radius.circular(teeth.height)),
      Paint()
        ..isAntiAlias = true
        ..color = Colors.white.withValues(alpha: .9),
    );
  }

  void _drawHeadAccessories(
    Canvas canvas,
    Rect head,
    _Projection projection,
    _ToonRig rig,
    _ToonPalette palette,
  ) {
    if (config.accessory == 'headband') {
      final band = Rect.fromCenter(
        center: Offset(head.center.dx, head.top + head.height * .38),
        width: head.width * .78,
        height: math.max(3, head.height * .09),
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(band, Radius.circular(band.height * .45)),
        Paint()
          ..isAntiAlias = true
          ..shader = LinearGradient(
            colors: [palette.primaryLight, palette.primaryDark],
          ).createShader(band),
      );
    }
    if (config.accessory == 'goggles') {
      final y = head.center.dy - head.height * .035;
      final left = Rect.fromCenter(
        center: Offset(head.center.dx - head.width * .17, y),
        width: head.width * .22,
        height: head.height * .105,
      );
      final right = Rect.fromCenter(
        center: Offset(head.center.dx + head.width * .17, y),
        width: head.width * .22,
        height: head.height * .105,
      );
      final paint = Paint()
        ..isAntiAlias = true
        ..style = PaintingStyle.stroke
        ..strokeWidth = math.max(1, projection.scale * .007)
        ..color = const Color(0xFFE0F2FE).withValues(alpha: .9);
      canvas.drawOval(left, paint);
      canvas.drawOval(right, paint);
      canvas.drawLine(left.centerRight, right.centerLeft, paint);
    }
  }

  void _drawBall(
    Canvas canvas,
    _Projection projection,
    _V3 center3,
    double radius,
    _ToonPalette palette,
  ) {
    final center = projection.project(center3);
    final r = projection.scale * radius;
    final ball = Rect.fromCircle(center: center, radius: r);
    canvas.drawShadow(
        Path()..addOval(ball), Colors.black.withValues(alpha: .24), 2, true);
    canvas.drawOval(
      ball,
      Paint()
        ..isAntiAlias = true
        ..shader = RadialGradient(
          center: const Alignment(-.35, -.35),
          colors: [
            _tone(palette.ball, .16),
            palette.ball,
            _tone(palette.ball, -.18)
          ],
        ).createShader(ball),
    );
    final seams = Paint()
      ..isAntiAlias = true
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = math.max(1, projection.scale * .008)
      ..color = palette.ballDark.withValues(alpha: .72);
    canvas.drawCircle(center, r * .9, seams);
    canvas.drawLine(
        center.translate(-r * .82, 0), center.translate(r * .82, 0), seams);
    canvas.drawLine(
        center.translate(0, -r * .82), center.translate(0, r * .82), seams);
    canvas.drawArc(
      Rect.fromCircle(center: center.translate(-r * .42, 0), radius: r * .58),
      -1.25,
      2.5,
      false,
      seams,
    );
    canvas.drawArc(
      Rect.fromCircle(center: center.translate(r * .42, 0), radius: r * .58),
      math.pi - 1.25,
      2.5,
      false,
      seams,
    );
  }

  void _drawShoe(
    Canvas canvas,
    _Projection projection,
    _ToonRig rig,
    _V3 ankle,
    _ToonPalette palette, {
    required int toeDirection,
    required bool back,
  }) {
    final anchor =
        projection.project(ankle + _V3(toeDirection * .045, -.06, .18));
    final w = projection.scale * rig.shoeWidth;
    final h = projection.scale * .085;
    final toe = toeDirection.toDouble();
    final path = Path()
      ..moveTo(anchor.dx - toe * w * .46, anchor.dy + h * .12)
      ..quadraticBezierTo(anchor.dx - toe * w * .3, anchor.dy - h * .44,
          anchor.dx + toe * w * .18, anchor.dy - h * .42)
      ..quadraticBezierTo(anchor.dx + toe * w * .58, anchor.dy - h * .28,
          anchor.dx + toe * w * .58, anchor.dy + h * .08)
      ..quadraticBezierTo(anchor.dx + toe * w * .34, anchor.dy + h * .36,
          anchor.dx - toe * w * .42, anchor.dy + h * .28)
      ..quadraticBezierTo(anchor.dx - toe * w * .55, anchor.dy + h * .2,
          anchor.dx - toe * w * .46, anchor.dy + h * .12)
      ..close();
    canvas.drawShadow(
        path, Colors.black.withValues(alpha: back ? .12 : .22), 1.4, true);
    _drawGradientPath(
      canvas,
      path,
      [Colors.white, palette.shoe, palette.shoeDark],
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      alpha: back ? .9 : 1,
    );
    final sole = Paint()
      ..isAntiAlias = true
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = math.max(1, projection.scale * .007)
      ..color = palette.sole.withValues(alpha: back ? .55 : .82);
    canvas.drawLine(
      anchor.translate(-toe * w * .42, h * .22),
      anchor.translate(toe * w * .5, h * .16),
      sole,
    );
    canvas.drawLine(
      anchor.translate(-toe * w * .11, -h * .08),
      anchor.translate(toe * w * .18, -h * .12),
      Paint()
        ..isAntiAlias = true
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = math.max(.8, projection.scale * .004)
        ..color = palette.primary.withValues(alpha: back ? .72 : .92),
    );
  }

  void _drawHand(
    Canvas canvas,
    Offset center,
    double scale,
    _ToonRig rig,
    _ToonPalette palette, {
    required bool back,
  }) {
    final rect = Rect.fromCenter(
      center: center,
      width: scale * rig.handWidth,
      height: scale * rig.handHeight,
    );
    canvas.drawOval(
      rect,
      Paint()
        ..isAntiAlias = true
        ..shader = RadialGradient(
          center: const Alignment(-.35, -.35),
          colors: [
            palette.skinLight.withValues(alpha: back ? .9 : 1),
            palette.skin.withValues(alpha: back ? .9 : 1),
            palette.skinDark.withValues(alpha: back ? .9 : 1),
          ],
        ).createShader(rect),
    );
  }

  void _drawJoint(
    Canvas canvas,
    Offset center,
    double radius,
    Color color,
    double alpha,
  ) {
    final rect = Rect.fromCircle(center: center, radius: radius);
    canvas.drawOval(
      rect,
      Paint()
        ..isAntiAlias = true
        ..shader = RadialGradient(
          center: const Alignment(-.35, -.35),
          colors: [
            _tone(color, .1).withValues(alpha: alpha),
            color.withValues(alpha: alpha),
            _tone(color, -.12).withValues(alpha: alpha),
          ],
        ).createShader(rect),
    );
  }

  void _drawTaperedCapsule(
    Canvas canvas,
    Offset start,
    Offset end,
    double startWidth,
    double endWidth,
    Color color, {
    required Color light,
    required Color dark,
    double alpha = 1,
  }) {
    final delta = end - start;
    final len = delta.distance;
    if (len < .1) return;
    final n = Offset(-delta.dy / len, delta.dx / len);
    final p1 = start + n * (startWidth / 2);
    final p2 = end + n * (endWidth / 2);
    final p3 = end - n * (endWidth / 2);
    final p4 = start - n * (startWidth / 2);
    final path = Path()
      ..moveTo(p1.dx, p1.dy)
      ..lineTo(p2.dx, p2.dy)
      ..quadraticBezierTo(
        end.dx + delta.dx.sign * endWidth * .05,
        end.dy + delta.dy.sign * endWidth * .05,
        p3.dx,
        p3.dy,
      )
      ..lineTo(p4.dx, p4.dy)
      ..quadraticBezierTo(
        start.dx - delta.dx.sign * startWidth * .05,
        start.dy - delta.dy.sign * startWidth * .05,
        p1.dx,
        p1.dy,
      )
      ..close();
    _drawGradientPath(
      canvas,
      path,
      [
        light.withValues(alpha: alpha),
        color.withValues(alpha: alpha),
        dark.withValues(alpha: alpha),
      ],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
    final highlight = Path()
      ..moveTo((p1.dx + start.dx) / 2, (p1.dy + start.dy) / 2)
      ..lineTo((p2.dx + end.dx) / 2, (p2.dy + end.dy) / 2);
    canvas.drawPath(
      highlight,
      Paint()
        ..isAntiAlias = true
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = math.max(.6, math.min(startWidth, endWidth) * .13)
        ..color = Colors.white.withValues(alpha: .12 * alpha),
    );
  }

  void _drawGradientPath(
    Canvas canvas,
    Path path,
    List<Color> colors, {
    Alignment begin = Alignment.topLeft,
    Alignment end = Alignment.bottomRight,
    double alpha = 1,
  }) {
    final bounds = path.getBounds().inflate(1);
    canvas.drawPath(
      path,
      Paint()
        ..isAntiAlias = true
        ..shader = LinearGradient(
          begin: begin,
          end: end,
          colors:
              colors.map((color) => color.withValues(alpha: alpha)).toList(),
        ).createShader(bounds),
    );
  }

  bool get _longPants =>
      config.outfit == 'hoodie' || config.outfit == 'warmups';

  bool get _hasSleeves =>
      config.outfit == 'tee' ||
      config.outfit == 'hoodie' ||
      config.outfit == 'warmups';

  @override
  bool shouldRepaint(covariant AvatarGameMeshPainter oldDelegate) {
    return oldDelegate.config.skinTone != config.skinTone ||
        oldDelegate.config.baseAppearance != config.baseAppearance ||
        oldDelegate.config.gender != config.gender ||
        oldDelegate.config.bodyType != config.bodyType ||
        oldDelegate.config.height != config.height ||
        oldDelegate.config.hairStyle != config.hairStyle ||
        oldDelegate.config.hairColor != config.hairColor ||
        oldDelegate.config.outfit != config.outfit ||
        oldDelegate.config.stance != config.stance ||
        oldDelegate.config.jerseyNumber != config.jerseyNumber ||
        oldDelegate.config.accessory != config.accessory ||
        oldDelegate.config.primaryColor != config.primaryColor ||
        oldDelegate.config.secondaryColor != config.secondaryColor ||
        oldDelegate.basePreset != basePreset ||
        oldDelegate.skinTone != skinTone ||
        oldDelegate.hairColor != hairColor ||
        oldDelegate.primary != primary ||
        oldDelegate.secondary != secondary ||
        oldDelegate.compact != compact;
  }
}

class _ToonPalette {
  final Color skin;
  final Color skinLight;
  final Color skinDark;
  final Color hair;
  final Color hairLight;
  final Color hairDark;
  final Color primary;
  final Color primaryLight;
  final Color primaryDark;
  final Color secondary;
  final Color secondaryLight;
  final Color secondaryDark;
  final Color trim;
  final Color shoe;
  final Color shoeDark;
  final Color sole;
  final Color ball;
  final Color ballDark;

  const _ToonPalette({
    required this.skin,
    required this.skinLight,
    required this.skinDark,
    required this.hair,
    required this.hairLight,
    required this.hairDark,
    required this.primary,
    required this.primaryLight,
    required this.primaryDark,
    required this.secondary,
    required this.secondaryLight,
    required this.secondaryDark,
    required this.trim,
    required this.shoe,
    required this.shoeDark,
    required this.sole,
    required this.ball,
    required this.ballDark,
  });
}

class _ToonRig {
  final HoopRankAvatarConfig config;
  final AvatarBasePersonPreset basePreset;

  late final double mass = switch (normalizeAvatarBodyType(config.bodyType)) {
    'skinny' => .92,
    'big' => 1.14,
    _ => 1.0,
  };
  late final double genderShoulder = config.gender == 'female' ? .9 : 1.0;
  late final double genderHip = config.gender == 'female' ? 1.07 : 1.0;
  late final double shoulderWidth = .48 * mass * genderShoulder;
  late final double chestWidth = .43 * mass * genderShoulder;
  late final double waistWidth =
      .34 * mass * (config.gender == 'female' ? .9 : 1);
  late final double hipWidth = .4 * mass * genderHip;
  late final double shoulderY = 1.42;
  late final double chestY = 1.29;
  late final double waistY = 1.1;
  late final double hipY = .98;
  late final double shortsBottomY = .82;
  late final double neckY = 1.49;
  late final double neckWidth = .14 * mass;
  late final _V3 headCenter = const _V3(0, 1.66, .08);
  late final double headWidth =
      .34 * basePreset.headWidthScale * (config.gender == 'female' ? .96 : 1);
  late final double headHeight =
      .39 * basePreset.headHeightScale * (config.gender == 'female' ? .97 : 1);
  late final double upperArmWidth = .082 * mass;
  late final double elbowWidth = .068 * mass;
  late final double wristWidth = .058 * mass;
  late final double thighWidth = .108 * mass;
  late final double kneeWidth = .086 * mass;
  late final double calfWidth = .08 * mass;
  late final double handWidth = .095 * mass;
  late final double handHeight = .074;
  late final double shoeWidth = .22 * mass;
  late final double ballRadius = .122;
  late final double sceneWidth = switch (config.stance) {
    'crossedArms' => 1.06,
    'jumper' => .96,
    _ => 1.24,
  };
  late final double sceneHeight = 2.08;
  late final double shadowWidth = switch (config.stance) {
    'crossedArms' => .9,
    'jumper' => .88,
    _ => 1.14,
  };

  _ToonRig({required this.config, required this.basePreset});
}

class _ToonPose {
  final _V3 leftHip;
  final _V3 leftKnee;
  final _V3 leftAnkle;
  final _V3 rightHip;
  final _V3 rightKnee;
  final _V3 rightAnkle;
  final _V3 frontShoulder;
  final _V3 frontElbow;
  final _V3 frontHand;
  final _V3 backShoulder;
  final _V3 backElbow;
  final _V3 backHand;
  final _V3 ballCenter;
  final bool hasBall;

  const _ToonPose({
    required this.leftHip,
    required this.leftKnee,
    required this.leftAnkle,
    required this.rightHip,
    required this.rightKnee,
    required this.rightAnkle,
    required this.frontShoulder,
    required this.frontElbow,
    required this.frontHand,
    required this.backShoulder,
    required this.backElbow,
    required this.backHand,
    required this.ballCenter,
    required this.hasBall,
  });

  factory _ToonPose.forConfig(HoopRankAvatarConfig config, _ToonRig rig) {
    final hipHalf = rig.hipWidth * .36;
    final shoulderHalf = rig.shoulderWidth * .52;
    final leftHip = _V3(-hipHalf, rig.hipY, .08);
    final rightHip = _V3(hipHalf, rig.hipY, .02);
    final frontShoulder = _V3(-shoulderHalf, rig.shoulderY - .015, .14);
    final backShoulder = _V3(shoulderHalf, rig.shoulderY - .015, .03);
    switch (config.stance) {
      case 'jumper':
        return _ToonPose(
          leftHip: leftHip,
          leftKnee: const _V3(-.13, .58, .05),
          leftAnkle: const _V3(-.2, .18, .1),
          rightHip: rightHip,
          rightKnee: const _V3(.13, .58, 0),
          rightAnkle: const _V3(.21, .18, .07),
          frontShoulder: frontShoulder,
          frontElbow: const _V3(-.22, 1.76, .25),
          frontHand: const _V3(-.055, 1.9, .34),
          backShoulder: backShoulder,
          backElbow: const _V3(.22, 1.76, .2),
          backHand: const _V3(.06, 1.9, .32),
          ballCenter: const _V3(0, 1.98, .38),
          hasBall: true,
        );
      case 'dribble':
        return _ToonPose(
          leftHip: leftHip,
          leftKnee: const _V3(-.28, .58, .08),
          leftAnkle: const _V3(-.4, .18, .1),
          rightHip: rightHip,
          rightKnee: const _V3(.24, .56, 0),
          rightAnkle: const _V3(.41, .18, .06),
          frontShoulder: frontShoulder,
          frontElbow: const _V3(-.33, 1.1, .28),
          frontHand: const _V3(-.43, .69, .38),
          backShoulder: backShoulder,
          backElbow: const _V3(.26, 1.19, .14),
          backHand: const _V3(.17, .99, .22),
          ballCenter: const _V3(-.47, .49, .42),
          hasBall: true,
        );
      case 'crossedArms':
        return _ToonPose(
          leftHip: leftHip,
          leftKnee: const _V3(-.14, .58, .06),
          leftAnkle: const _V3(-.24, .18, .09),
          rightHip: rightHip,
          rightKnee: const _V3(.14, .58, .03),
          rightAnkle: const _V3(.24, .18, .08),
          frontShoulder: frontShoulder,
          frontElbow: const _V3(-.1, 1.3, .32),
          frontHand: const _V3(.24, 1.36, .36),
          backShoulder: backShoulder,
          backElbow: const _V3(.1, 1.29, .25),
          backHand: const _V3(-.24, 1.36, .34),
          ballCenter: const _V3(0, 0, 0),
          hasBall: false,
        );
      default:
        return _ToonPose(
          leftHip: leftHip,
          leftKnee: const _V3(-.24, .58, .06),
          leftAnkle: const _V3(-.38, .18, .09),
          rightHip: rightHip,
          rightKnee: const _V3(.24, .58, 0),
          rightAnkle: const _V3(.38, .18, .06),
          frontShoulder: frontShoulder,
          frontElbow: const _V3(-.33, 1.18, .3),
          frontHand: const _V3(-.28, .98, .42),
          backShoulder: backShoulder,
          backElbow: const _V3(.25, 1.16, .23),
          backHand: const _V3(-.015, .96, .39),
          ballCenter: const _V3(-.235, .965, .47),
          hasBall: true,
        );
    }
  }
}

class _Projection {
  final double scale;
  final Offset origin;

  const _Projection({required this.scale, required this.origin});

  Offset project(_V3 value) {
    return Offset(
      origin.dx + (value.x + value.z * .16) * scale,
      origin.dy - (value.y - value.z * .06) * scale,
    );
  }
}

class _V3 {
  final double x;
  final double y;
  final double z;

  const _V3(this.x, this.y, this.z);

  _V3 operator +(_V3 other) => _V3(x + other.x, y + other.y, z + other.z);
}

Color _outfitPrimary(Color primary, String outfit) {
  return switch (outfit) {
    'warmups' => const Color(0xFFF8FAFC),
    _ => primary,
  };
}

Color _tone(Color color, double amount) {
  final hsl = HSLColor.fromColor(color);
  return hsl
      .withLightness((hsl.lightness + amount).clamp(0.0, 1.0).toDouble())
      .toColor();
}
