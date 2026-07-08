import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../utils/generated_avatar.dart';

class AvatarFigurePainter extends CustomPainter {
  final HoopRankAvatarConfig config;
  final AvatarBasePersonPreset basePreset;
  final Color skinTone;
  final Color hairColor;
  final Color primary;
  final Color secondary;
  final bool compact;

  const AvatarFigurePainter({
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
    final figureHeight = size.height * (compact ? .96 : .9);
    final figureWidth = math.min(
      size.width * (compact ? .9 : .62),
      figureHeight * (compact ? .62 : .48),
    );
    final figure = Rect.fromLTWH(
      (size.width - figureWidth) / 2,
      size.height * (compact ? .015 : .055),
      figureWidth,
      figureHeight,
    );
    final paint = Paint()..isAntiAlias = true;
    final outline = Paint()
      ..isAntiAlias = true
      ..style = PaintingStyle.stroke
      ..strokeWidth = figure.height * (compact ? .011 : .008)
      ..strokeJoin = StrokeJoin.round
      ..strokeCap = StrokeCap.round
      ..color = const Color(0xFF020617).withValues(alpha: .58);

    Offset p(double x, double y) => Offset(
          figure.left + figure.width * x,
          figure.top + figure.height * y,
        );

    _paintGroundShadow(canvas, p, figure, paint);
    _paintBackArm(canvas, p, figure, paint, outline);
    _paintLegs(canvas, p, figure, paint, outline);
    _paintTorso(canvas, p, figure, paint, outline);
    _paintFrontArmAndBall(canvas, p, figure, paint, outline);
    _paintHead(canvas, p, figure, paint, outline);
  }

  void _paintGroundShadow(
    Canvas canvas,
    Offset Function(double x, double y) p,
    Rect figure,
    Paint paint,
  ) {
    paint
      ..style = PaintingStyle.fill
      ..color = Colors.white
      ..shader = RadialGradient(
        colors: [
          Colors.black.withValues(alpha: compact ? .28 : .24),
          Colors.black.withValues(alpha: .06),
          Colors.transparent,
        ],
      ).createShader(
        Rect.fromCenter(
          center: p(.5, .965),
          width: figure.width * .92,
          height: figure.height * .07,
        ),
      );
    canvas.drawOval(
      Rect.fromCenter(
        center: p(.5, .965),
        width: figure.width * .92,
        height: figure.height * .07,
      ),
      paint,
    );
    paint.shader = null;
  }

  void _paintLegs(
    Canvas canvas,
    Offset Function(double x, double y) p,
    Rect figure,
    Paint paint,
    Paint outline,
  ) {
    final longPants = config.outfit == 'hoodie' || config.outfit == 'warmups';
    final legColor = longPants ? secondary : skinTone;
    final stroke = figure.height * (longPants ? .056 : .048);
    final sockStroke = figure.height * .028;

    final left = switch (config.stance) {
      'dribble' => (hip: p(.42, .56), knee: p(.33, .72), foot: p(.23, .91)),
      'jumper' => (hip: p(.45, .56), knee: p(.42, .72), foot: p(.37, .91)),
      'crossedArms' => (hip: p(.43, .56), knee: p(.41, .72), foot: p(.34, .91)),
      _ => (hip: p(.42, .56), knee: p(.35, .72), foot: p(.24, .91)),
    };
    final right = switch (config.stance) {
      'dribble' => (hip: p(.58, .56), knee: p(.67, .73), foot: p(.78, .91)),
      'jumper' => (hip: p(.55, .56), knee: p(.58, .72), foot: p(.63, .91)),
      'crossedArms' => (hip: p(.57, .56), knee: p(.59, .72), foot: p(.66, .91)),
      _ => (hip: p(.58, .56), knee: p(.65, .73), foot: p(.76, .91)),
    };

    _paintLimb(canvas, [left.hip, left.knee, left.foot], legColor, stroke,
        figure, paint, outline);
    _paintLimb(canvas, [right.hip, right.knee, right.foot], legColor, stroke,
        figure, paint, outline);

    if (!longPants) {
      _paintLimb(canvas, [p(.30, .80), p(.25, .875)], Colors.white, sockStroke,
          figure, paint, outline,
          outlineAlpha: .16);
      _paintLimb(canvas, [p(.70, .80), p(.75, .875)], Colors.white, sockStroke,
          figure, paint, outline,
          outlineAlpha: .16);
    }

    _paintShoe(canvas, left.foot, figure, paint, outline, isLeft: true);
    _paintShoe(canvas, right.foot, figure, paint, outline, isLeft: false);
  }

  void _paintBackArm(
    Canvas canvas,
    Offset Function(double x, double y) p,
    Rect figure,
    Paint paint,
    Paint outline,
  ) {
    final sleeve = config.outfit == 'hoodie' || config.outfit == 'warmups';
    final color = sleeve ? _adjust(primary, -.03) : skinTone;
    final stroke = figure.height * .038;
    switch (config.stance) {
      case 'jumper':
        _paintLimb(canvas, [p(.63, .31), p(.59, .16), p(.54, .085)], color,
            stroke, figure, paint, outline);
      case 'dribble':
        _paintLimb(canvas, [p(.66, .35), p(.75, .46), p(.80, .56)], color,
            stroke, figure, paint, outline);
      case 'crossedArms':
        _paintLimb(canvas, [p(.68, .36), p(.50, .46), p(.32, .39)], color,
            stroke, figure, paint, outline);
      default:
        _paintLimb(canvas, [p(.68, .34), p(.58, .45), p(.42, .48)], color,
            stroke, figure, paint, outline);
    }
  }

  void _paintFrontArmAndBall(
    Canvas canvas,
    Offset Function(double x, double y) p,
    Rect figure,
    Paint paint,
    Paint outline,
  ) {
    final sleeve = config.outfit == 'hoodie' || config.outfit == 'warmups';
    final color = sleeve ? primary : skinTone;
    final stroke = figure.height * .039;
    switch (config.stance) {
      case 'jumper':
        _paintLimb(canvas, [p(.37, .31), p(.42, .16), p(.47, .085)], color,
            stroke, figure, paint, outline);
        _paintBall(canvas, p(.5, .065), figure, paint);
      case 'dribble':
        _paintLimb(canvas, [p(.34, .35), p(.25, .50), p(.22, .67)], color,
            stroke, figure, paint, outline);
        _paintBall(canvas, p(.20, .72), figure, paint);
      case 'crossedArms':
        _paintLimb(canvas, [p(.32, .36), p(.50, .47), p(.68, .37)], color,
            stroke, figure, paint, outline);
      default:
        _paintLimb(canvas, [p(.32, .34), p(.25, .45), p(.35, .48)], color,
            stroke, figure, paint, outline);
        _paintBall(canvas, p(.39, .47), figure, paint);
    }

    if (config.accessory == 'sleeve') {
      _paintLimb(
        canvas,
        [p(.65, .37), p(.57, .45)],
        Colors.white.withValues(alpha: .88),
        figure.height * .023,
        figure,
        paint,
        outline,
        outlineAlpha: .12,
      );
    }
  }

  void _paintLimb(
    Canvas canvas,
    List<Offset> points,
    Color color,
    double width,
    Rect figure,
    Paint paint,
    Paint outline, {
    double outlineAlpha = .26,
  }) {
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (var i = 1; i < points.length; i++) {
      final prev = points[i - 1];
      final point = points[i];
      final mid = Offset((prev.dx + point.dx) / 2, (prev.dy + point.dy) / 2);
      path.quadraticBezierTo(prev.dx, prev.dy, mid.dx, mid.dy);
    }
    path.lineTo(points.last.dx, points.last.dy);

    final isSkin = color == skinTone;
    final effectiveOutlineAlpha = isSkin ? outlineAlpha * .38 : outlineAlpha;
    canvas.drawPath(
      path,
      outline
        ..strokeWidth = width + figure.height * .011
        ..color =
            const Color(0xFF020617).withValues(alpha: effectiveOutlineAlpha),
    );
    paint
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..strokeWidth = width
      ..color = Colors.white
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: isSkin
            ? [_adjust(color, .3), _adjust(color, .18), _adjust(color, .06)]
            : [_adjust(color, .12), color, _adjust(color, -.12)],
      ).createShader(Rect.fromPoints(points.first, points.last));
    canvas.drawPath(path, paint);
    paint.shader = null;

    if (width > figure.height * .032) {
      paint
        ..strokeWidth = width * .18
        ..color = Colors.white.withValues(alpha: isSkin ? .12 : .2);
      canvas.drawPath(path, paint);
      paint
        ..strokeWidth = width * .12
        ..color = Colors.black.withValues(alpha: isSkin ? .08 : .14);
      final shadowPath = path.shift(Offset(width * .18, width * .16));
      canvas.drawPath(shadowPath, paint);
    }
  }

  void _paintTorso(
    Canvas canvas,
    Offset Function(double x, double y) p,
    Rect figure,
    Paint paint,
    Paint outline,
  ) {
    final isHoodie = config.outfit == 'hoodie';
    final isWarmups = config.outfit == 'warmups';
    final top = switch (config.stance) {
      'jumper' => .27,
      'dribble' => .31,
      _ => .29,
    };
    final shoulder = config.gender == 'female' ? .265 : .225;
    final waist = config.gender == 'female' ? .375 : .36;
    final bottom = isHoodie ? .595 : .56;
    final torso = Path()
      ..moveTo(p(shoulder, top).dx, p(shoulder, top).dy)
      ..cubicTo(
        p(.36, top - .045).dx,
        p(.36, top - .045).dy,
        p(.64, top - .045).dx,
        p(.64, top - .045).dy,
        p(1 - shoulder, top).dx,
        p(1 - shoulder, top).dy,
      )
      ..lineTo(p(1 - waist, bottom).dx, p(1 - waist, bottom).dy)
      ..cubicTo(
        p(.62, bottom + .045).dx,
        p(.62, bottom + .045).dy,
        p(.38, bottom + .045).dx,
        p(.38, bottom + .045).dy,
        p(waist, bottom).dx,
        p(waist, bottom).dy,
      )
      ..close();

    final topColor = isWarmups ? const Color(0xFFF8FAFC) : primary;
    paint
      ..style = PaintingStyle.fill
      ..color = Colors.white
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [_adjust(topColor, .16), topColor, _adjust(topColor, -.18)],
        stops: const [0, .54, 1],
      ).createShader(torso.getBounds());
    canvas.drawPath(torso, paint);
    paint.shader = null;
    canvas.drawPath(torso, outline);

    _paintTorsoVolume(canvas, torso, figure, paint);
    _paintClothesDetails(
        canvas, p, figure, paint, top, bottom, isHoodie, isWarmups, topColor);
    _paintShorts(canvas, p, figure, paint, outline);
  }

  void _paintTorsoVolume(
    Canvas canvas,
    Path torso,
    Rect figure,
    Paint paint,
  ) {
    final bounds = torso.getBounds();
    canvas.save();
    canvas.clipPath(torso);

    paint
      ..style = PaintingStyle.fill
      ..color = Colors.white
      ..shader = LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [
          Colors.black.withValues(alpha: .18),
          Colors.transparent,
          Colors.white.withValues(alpha: .18),
          Colors.transparent,
          Colors.black.withValues(alpha: .2),
        ],
        stops: const [0, .22, .43, .64, 1],
      ).createShader(bounds);
    canvas.drawRect(bounds, paint);
    paint.shader = null;

    paint
      ..style = PaintingStyle.stroke
      ..strokeWidth = figure.height * .0048
      ..strokeCap = StrokeCap.round
      ..color = Colors.white.withValues(alpha: .18);
    canvas.drawLine(
      Offset(bounds.left + bounds.width * .34, bounds.top + bounds.height * .2),
      Offset(bounds.left + bounds.width * .28,
          bounds.bottom - bounds.height * .18),
      paint,
    );
    canvas.drawLine(
      Offset(
          bounds.right - bounds.width * .34, bounds.top + bounds.height * .2),
      Offset(bounds.right - bounds.width * .28,
          bounds.bottom - bounds.height * .18),
      paint,
    );
    canvas.restore();
  }

  void _paintClothesDetails(
    Canvas canvas,
    Offset Function(double x, double y) p,
    Rect figure,
    Paint paint,
    double top,
    double bottom,
    bool isHoodie,
    bool isWarmups,
    Color topColor,
  ) {
    if (isHoodie) {
      paint
        ..style = PaintingStyle.fill
        ..color = Colors.white
        ..shader = RadialGradient(
          colors: [_adjust(primary, .12), _adjust(primary, -.16)],
        ).createShader(Rect.fromCenter(
          center: p(.5, top + .025),
          width: figure.width * .44,
          height: figure.height * .12,
        ));
      canvas.drawOval(
        Rect.fromCenter(
          center: p(.5, top + .025),
          width: figure.width * .44,
          height: figure.height * .12,
        ),
        paint,
      );
      paint.shader = null;
      paint
        ..style = PaintingStyle.stroke
        ..strokeWidth = figure.height * .0055
        ..strokeCap = StrokeCap.round
        ..color = Colors.white.withValues(alpha: .5);
      canvas.drawLine(p(.46, top + .03), p(.42, top + .12), paint);
      canvas.drawLine(p(.54, top + .03), p(.58, top + .12), paint);
    } else if (config.outfit == 'jersey') {
      paint
        ..style = PaintingStyle.stroke
        ..strokeWidth = figure.height * .014
        ..strokeCap = StrokeCap.round
        ..color = Colors.white.withValues(alpha: .88);
      canvas.drawLine(p(.32, top + .02), p(.37, bottom - .055), paint);
      canvas.drawLine(p(.68, top + .02), p(.63, bottom - .055), paint);
      canvas.drawLine(p(.29, top + .012), p(.71, top + .012), paint);
    } else if (isWarmups) {
      paint
        ..style = PaintingStyle.stroke
        ..strokeWidth = figure.height * .011
        ..strokeCap = StrokeCap.round
        ..color = primary;
      canvas.drawLine(p(.5, top + .015), p(.5, bottom - .02), paint);
      canvas.drawLine(p(.35, top + .085), p(.65, top + .085), paint);
    } else {
      paint
        ..style = PaintingStyle.stroke
        ..strokeWidth = figure.height * .007
        ..strokeCap = StrokeCap.round
        ..color = Colors.white.withValues(alpha: .24);
      canvas.drawLine(p(.34, top + .06), p(.66, top + .06), paint);
    }

    final numberPainter = TextPainter(
      text: TextSpan(
        text: config.jerseyNumber,
        style: TextStyle(
          color: (isWarmups ? primary : Colors.white).withValues(alpha: .95),
          fontSize: figure.height * (compact ? .058 : .068),
          fontWeight: FontWeight.w900,
          shadows: [
            Shadow(
              color: Colors.black.withValues(alpha: .25),
              offset: const Offset(0, 1),
              blurRadius: 2,
            ),
          ],
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: figure.width * .34);
    numberPainter.paint(
      canvas,
      p(.5, top + .155).translate(-numberPainter.width / 2, 0),
    );
  }

  void _paintShorts(
    Canvas canvas,
    Offset Function(double x, double y) p,
    Rect figure,
    Paint paint,
    Paint outline,
  ) {
    final shorts = RRect.fromRectAndRadius(
      Rect.fromPoints(p(.30, .525), p(.70, .635)),
      Radius.circular(figure.height * .028),
    );
    paint
      ..style = PaintingStyle.fill
      ..color = Colors.white
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [_adjust(secondary, .08), secondary, _adjust(secondary, -.18)],
      ).createShader(shorts.outerRect);
    canvas.drawRRect(shorts, paint);
    paint.shader = null;
    canvas.drawRRect(shorts, outline);

    paint
      ..style = PaintingStyle.stroke
      ..strokeWidth = figure.height * .005
      ..strokeCap = StrokeCap.round
      ..color = Colors.white.withValues(alpha: .2);
    canvas.drawLine(p(.5, .535), p(.5, .625), paint);
    paint
      ..strokeWidth = figure.height * .004
      ..color = Colors.white.withValues(alpha: .16);
    canvas.drawLine(p(.33, .555), p(.42, .62), paint);
    canvas.drawLine(p(.67, .555), p(.58, .62), paint);
  }

  void _paintHead(
    Canvas canvas,
    Offset Function(double x, double y) p,
    Rect figure,
    Paint paint,
    Paint outline,
  ) {
    final neck = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: p(.5, .263),
        width: figure.width * .13,
        height: figure.height * .064,
      ),
      Radius.circular(figure.height * .022),
    );
    paint
      ..style = PaintingStyle.fill
      ..color = Colors.white
      ..shader = _skinGradient(neck.outerRect);
    canvas.drawRRect(neck, paint);
    paint.shader = null;

    final head = Rect.fromCenter(
      center: p(.5, .176),
      width: figure.width *
          (config.gender == 'female' ? .32 : .33) *
          basePreset.headWidthScale,
      height: figure.height * .128 * basePreset.headHeightScale,
    );
    _paintEars(canvas, head, figure, paint, outline);
    _paintFace(canvas, head, figure, paint, outline);
    _paintHair(canvas, head, figure, paint, outline);
    _paintFacialFeatures(canvas, head, figure, paint);
  }

  void _paintEars(
    Canvas canvas,
    Rect head,
    Rect figure,
    Paint paint,
    Paint outline,
  ) {
    final earSize = Size(head.width * .12, head.height * .22);
    for (final side in [-1.0, 1.0]) {
      final ear = Rect.fromCenter(
        center: Offset(
          head.center.dx + side * head.width * .53,
          head.center.dy + head.height * .04,
        ),
        width: earSize.width,
        height: earSize.height,
      );
      paint
        ..style = PaintingStyle.fill
        ..color = Colors.white
        ..shader = _skinGradient(ear);
      canvas.drawOval(ear, paint);
      paint.shader = null;
      canvas.drawOval(
        ear,
        outline
          ..strokeWidth = figure.height * .0045
          ..color = const Color(0xFF020617).withValues(alpha: .28),
      );
      paint
        ..style = PaintingStyle.stroke
        ..strokeWidth = figure.height * .0028
        ..strokeCap = StrokeCap.round
        ..color = _adjust(skinTone, -.18).withValues(alpha: .24);
      canvas.drawArc(ear.deflate(ear.width * .24), -1.1, 2.2, false, paint);
    }
  }

  void _paintFace(
    Canvas canvas,
    Rect head,
    Rect figure,
    Paint paint,
    Paint outline,
  ) {
    paint
      ..style = PaintingStyle.fill
      ..color = Colors.white
      ..shader = _skinGradient(head);

    final path = _facePath(head);
    if (path != null) {
      canvas.drawPath(path, paint);
      paint.shader = null;
      canvas.drawPath(path, outline);
      _paintFaceHighlight(canvas, path.getBounds(), paint);
      return;
    }

    if (basePreset.faceShape == 'softSquare') {
      final face = RRect.fromRectAndRadius(
        head,
        Radius.circular(head.width * .34),
      );
      canvas.drawRRect(face, paint);
      paint.shader = null;
      canvas.drawRRect(face, outline);
      _paintFaceHighlight(canvas, face.outerRect, paint);
    } else {
      canvas.drawOval(head, paint);
      paint.shader = null;
      canvas.drawOval(head, outline);
      _paintFaceHighlight(canvas, head, paint);
    }
  }

  Path? _facePath(Rect head) {
    if (basePreset.faceShape != 'angular' &&
        basePreset.faceShape != 'broadOval') {
      return null;
    }
    final jaw = basePreset.faceShape == 'broadOval' ? .24 : .18;
    return Path()
      ..moveTo(head.center.dx, head.top)
      ..cubicTo(
          head.right - head.width * .06,
          head.top + head.height * .08,
          head.right,
          head.top + head.height * .28,
          head.right - head.width * .06,
          head.center.dy)
      ..lineTo(head.right - head.width * jaw, head.bottom - head.height * .11)
      ..quadraticBezierTo(head.center.dx, head.bottom,
          head.left + head.width * jaw, head.bottom - head.height * .11)
      ..lineTo(head.left + head.width * .06, head.center.dy)
      ..cubicTo(
          head.left,
          head.top + head.height * .28,
          head.left + head.width * .06,
          head.top + head.height * .08,
          head.center.dx,
          head.top)
      ..close();
  }

  void _paintFaceHighlight(Canvas canvas, Rect head, Paint paint) {
    paint
      ..style = PaintingStyle.fill
      ..color = Colors.white
      ..shader = RadialGradient(
        center: const Alignment(-.3, -.35),
        colors: [
          Colors.white.withValues(alpha: .23),
          Colors.white.withValues(alpha: .04),
          Colors.transparent,
        ],
      ).createShader(head);
    canvas.drawOval(
      Rect.fromCenter(
        center:
            Offset(head.left + head.width * .42, head.top + head.height * .37),
        width: head.width * .68,
        height: head.height * .58,
      ),
      paint,
    );
    paint.shader = null;
  }

  void _paintFacialFeatures(
    Canvas canvas,
    Rect head,
    Rect figure,
    Paint paint,
  ) {
    final eyeY = head.center.dy + head.height * .035;
    final eyeDx = head.width * basePreset.eyeSpacing;
    final eyeWidth = figure.height * .019 * basePreset.eyeWidthScale;
    final eyeHeight = figure.height * .0145 * basePreset.eyeHeightScale;

    _paintEye(canvas, Offset(head.center.dx - eyeDx, eyeY), eyeWidth, eyeHeight,
        figure, paint,
        flip: false);
    _paintEye(canvas, Offset(head.center.dx + eyeDx, eyeY), eyeWidth, eyeHeight,
        figure, paint,
        flip: true);

    paint
      ..style = PaintingStyle.stroke
      ..strokeWidth = figure.height * .0042
      ..strokeCap = StrokeCap.round
      ..color = _adjust(hairColor, -.12).withValues(alpha: .82);
    canvas.drawArc(
      Rect.fromCenter(
        center: Offset(head.center.dx - eyeDx, eyeY - head.height * .1),
        width: eyeWidth * 1.42,
        height: eyeHeight * .92,
      ),
      math.pi * 1.1,
      math.pi * .62,
      false,
      paint,
    );
    canvas.drawArc(
      Rect.fromCenter(
        center: Offset(head.center.dx + eyeDx, eyeY - head.height * .1),
        width: eyeWidth * 1.42,
        height: eyeHeight * .92,
      ),
      math.pi * 1.28,
      math.pi * .62,
      false,
      paint,
    );

    _paintNose(canvas, head, figure, paint);
    _paintMouth(canvas, head, figure, paint);
    _paintCheeks(canvas, head, paint);
  }

  void _paintEye(
    Canvas canvas,
    Offset center,
    double width,
    double height,
    Rect figure,
    Paint paint, {
    required bool flip,
  }) {
    final eyeRect = Rect.fromCenter(
      center: center,
      width: width * (basePreset.eyeStyle == 'almond' ? 1.55 : 1.35),
      height: height * (basePreset.eyeStyle == 'almond' ? 1.05 : 1.3),
    );
    final eyePath = Path();
    if (basePreset.eyeStyle == 'almond') {
      eyePath
        ..moveTo(eyeRect.left, eyeRect.center.dy)
        ..quadraticBezierTo(
            eyeRect.center.dx, eyeRect.top, eyeRect.right, eyeRect.center.dy)
        ..quadraticBezierTo(
            eyeRect.center.dx, eyeRect.bottom, eyeRect.left, eyeRect.center.dy)
        ..close();
    } else {
      eyePath.addOval(eyeRect);
    }

    paint
      ..style = PaintingStyle.fill
      ..color = Colors.white.withValues(alpha: .96);
    canvas.drawPath(eyePath, paint);
    paint
      ..style = PaintingStyle.stroke
      ..strokeWidth = figure.height * .0038
      ..color = const Color(0xFF0F172A).withValues(alpha: .65);
    canvas.drawPath(eyePath, paint);

    paint
      ..style = PaintingStyle.fill
      ..color = const Color(0xFF1D4ED8).withValues(alpha: .84);
    canvas.drawCircle(
        center.translate(flip ? -.8 : .8, .2), height * .42, paint);
    paint.color = const Color(0xFF0F172A);
    canvas.drawCircle(
        center.translate(flip ? -.8 : .8, .2), height * .24, paint);
    paint.color = Colors.white.withValues(alpha: .9);
    canvas.drawCircle(
      center.translate((flip ? -.8 : .8) - height * .1, -height * .1),
      height * .08,
      paint,
    );
  }

  void _paintNose(Canvas canvas, Rect head, Rect figure, Paint paint) {
    final noseWidth = head.width * .12 * basePreset.noseWidthScale;
    final bridgeTop =
        Offset(head.center.dx, head.center.dy + head.height * .06);
    final tip = Offset(
        head.center.dx - noseWidth * .12, head.center.dy + head.height * .2);
    paint
      ..style = PaintingStyle.stroke
      ..strokeWidth = figure.height * .0048
      ..strokeCap = StrokeCap.round
      ..color = _adjust(skinTone, -.22).withValues(alpha: .32);
    canvas.drawLine(bridgeTop, tip, paint);
    canvas.drawLine(tip, tip.translate(noseWidth, 0), paint);

    paint
      ..style = PaintingStyle.fill
      ..color = _adjust(skinTone, -.2).withValues(alpha: .22);
    canvas.drawCircle(
        tip.translate(noseWidth * .1, .6), figure.height * .0045, paint);
    canvas.drawCircle(
        tip.translate(noseWidth * .72, .5), figure.height * .004, paint);
  }

  void _paintMouth(Canvas canvas, Rect head, Rect figure, Paint paint) {
    final mouthRect = Rect.fromCenter(
      center: Offset(head.center.dx, head.center.dy + head.height * .25),
      width: head.width * .36 * basePreset.mouthWidthScale,
      height: head.height * .14,
    );
    paint
      ..style = PaintingStyle.stroke
      ..strokeWidth = figure.height * .0048
      ..strokeCap = StrokeCap.round
      ..color = const Color(0xFF7F1D1D).withValues(alpha: .78);
    canvas.drawArc(mouthRect, .15, 2.85, false, paint);

    paint
      ..strokeWidth = figure.height * .0024
      ..color = Colors.white.withValues(alpha: .56);
    canvas.drawArc(
        mouthRect.deflate(mouthRect.height * .16), .45, 2.25, false, paint);
  }

  void _paintCheeks(Canvas canvas, Rect head, Paint paint) {
    paint
      ..style = PaintingStyle.fill
      ..color = Colors.white
      ..shader = RadialGradient(
        colors: [
          const Color(0xFFFB7185).withValues(alpha: .18),
          Colors.transparent,
        ],
      ).createShader(head);
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(
            head.left + head.width * .27, head.center.dy + head.height * .17),
        width: head.width * .16,
        height: head.height * .09,
      ),
      paint,
    );
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(
            head.right - head.width * .27, head.center.dy + head.height * .17),
        width: head.width * .16,
        height: head.height * .09,
      ),
      paint,
    );
    paint.shader = null;
  }

  void _paintHair(
    Canvas canvas,
    Rect head,
    Rect figure,
    Paint paint,
    Paint outline,
  ) {
    if (config.hairStyle == 'bald') {
      paint
        ..style = PaintingStyle.stroke
        ..strokeWidth = figure.height * .004
        ..strokeCap = StrokeCap.round
        ..color = _adjust(skinTone, -.16).withValues(alpha: .28);
      canvas.drawArc(
        Rect.fromCenter(
          center: Offset(head.center.dx, head.top + head.height * .33),
          width: head.width * .76,
          height: head.height * .4,
        ),
        math.pi * 1.04,
        math.pi * .92,
        false,
        paint,
      );
      return;
    }

    final hair = Path();
    switch (config.hairStyle) {
      case 'buzz':
        hair.addOval(
          Rect.fromCenter(
            center: Offset(head.center.dx, head.top + head.height * .28),
            width: head.width * .94,
            height: head.height * .46,
          ),
        );
      case 'straight':
        hair
          ..moveTo(
              head.left + head.width * .03, head.center.dy - head.height * .13)
          ..cubicTo(
              head.left + head.width * .12,
              head.top - head.height * .03,
              head.center.dx + head.width * .02,
              head.top - head.height * .06,
              head.right - head.width * .06,
              head.center.dy - head.height * .08)
          ..lineTo(
              head.right - head.width * .11, head.center.dy + head.height * .05)
          ..quadraticBezierTo(
              head.center.dx + head.width * .12,
              head.top + head.height * .18,
              head.left + head.width * .14,
              head.center.dy - head.height * .02)
          ..close();
      case 'locs':
      case 'braids':
        hair
          ..moveTo(
              head.left + head.width * .02, head.center.dy - head.height * .08)
          ..cubicTo(
              head.left + head.width * .12,
              head.top - head.height * .04,
              head.right - head.width * .12,
              head.top - head.height * .04,
              head.right - head.width * .02,
              head.center.dy - head.height * .06)
          ..lineTo(
              head.right - head.width * .12, head.center.dy + head.height * .04)
          ..quadraticBezierTo(head.center.dx, head.top + head.height * .18,
              head.left + head.width * .12, head.center.dy + head.height * .03)
          ..close();
      case 'curls':
        for (var i = 0; i < 9; i++) {
          final x = head.left + head.width * (i + .5) / 9;
          final y = head.top + head.height * (.18 + (i.isEven ? -.05 : .04));
          hair.addOval(
              Rect.fromCircle(center: Offset(x, y), radius: head.width * .105));
        }
      case 'fade':
        hair
          ..moveTo(
              head.left + head.width * .09, head.center.dy - head.height * .11)
          ..cubicTo(
              head.left + head.width * .16,
              head.top - head.height * .02,
              head.center.dx + head.width * .12,
              head.top - head.height * .055,
              head.right - head.width * .08,
              head.center.dy - head.height * .09)
          ..lineTo(
              head.right - head.width * .11, head.center.dy - head.height * .02)
          ..quadraticBezierTo(
              head.center.dx + head.width * .02,
              head.top + head.height * .19,
              head.left + head.width * .14,
              head.center.dy - head.height * .025)
          ..close();
      default:
        hair
          ..moveTo(
              head.left + head.width * .02, head.center.dy - head.height * .08)
          ..cubicTo(
              head.left + head.width * .13,
              head.top - head.height * .04,
              head.center.dx + head.width * .12,
              head.top - head.height * .06,
              head.right - head.width * .04,
              head.center.dy - head.height * .06)
          ..lineTo(
              head.right - head.width * .14, head.center.dy + head.height * .02)
          ..quadraticBezierTo(head.center.dx, head.top + head.height * .17,
              head.left + head.width * .14, head.center.dy - head.height * .02)
          ..close();
    }

    paint
      ..style = PaintingStyle.fill
      ..color = Colors.white
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [_adjust(hairColor, .12), hairColor, _adjust(hairColor, -.18)],
      ).createShader(hair.getBounds());
    canvas.drawPath(hair, paint);
    paint.shader = null;
    canvas.drawPath(hair, outline..strokeWidth = figure.height * .005);

    if (config.hairStyle == 'locs' || config.hairStyle == 'braids') {
      paint
        ..style = PaintingStyle.stroke
        ..strokeWidth = figure.height * .009
        ..strokeCap = StrokeCap.round
        ..color = _adjust(hairColor, -.08);
      for (final x in [.2, .32, .44, .56, .68, .8]) {
        canvas.drawLine(
          Offset(head.left + head.width * x, head.top + head.height * .18),
          Offset(head.left + head.width * x, head.center.dy + head.height * .2),
          paint,
        );
      }
    }

    paint
      ..style = PaintingStyle.stroke
      ..strokeWidth = figure.height * .004
      ..strokeCap = StrokeCap.round
      ..color = Colors.white.withValues(alpha: .18);
    canvas.drawArc(
      Rect.fromCenter(
        center: Offset(
            head.center.dx - head.width * .05, head.top + head.height * .22),
        width: head.width * .56,
        height: head.height * .24,
      ),
      math.pi * 1.05,
      math.pi * .55,
      false,
      paint,
    );
  }

  void _paintBall(Canvas canvas, Offset center, Rect figure, Paint paint) {
    final radius = figure.height * (compact ? .062 : .058);
    paint
      ..style = PaintingStyle.fill
      ..color = Colors.white
      ..shader = const RadialGradient(
        center: Alignment(-.35, -.4),
        colors: [
          Color(0xFFF59E0B),
          Color(0xFFD97706),
          Color(0xFF9A3412),
        ],
      ).createShader(Rect.fromCircle(center: center, radius: radius));
    canvas.drawCircle(center, radius, paint);
    paint.shader = null;
    paint
      ..style = PaintingStyle.stroke
      ..strokeWidth = figure.height * .0065
      ..strokeCap = StrokeCap.round
      ..color = const Color(0xFF7C2D12).withValues(alpha: .82);
    canvas.drawCircle(center, radius, paint);
    canvas.drawLine(center.translate(-radius * .9, 0),
        center.translate(radius * .9, 0), paint);
    canvas.drawLine(center.translate(0, -radius * .9),
        center.translate(0, radius * .9), paint);
    canvas.drawArc(
      Rect.fromCircle(
        center: center.translate(-radius * .52, 0),
        radius: radius * .68,
      ),
      -1.35,
      2.7,
      false,
      paint,
    );
    canvas.drawArc(
      Rect.fromCircle(
        center: center.translate(radius * .52, 0),
        radius: radius * .68,
      ),
      math.pi - 1.35,
      2.7,
      false,
      paint,
    );
    paint.style = PaintingStyle.fill;
  }

  void _paintShoe(
    Canvas canvas,
    Offset foot,
    Rect figure,
    Paint paint,
    Paint outline, {
    required bool isLeft,
  }) {
    final center = foot.translate(
      isLeft ? -figure.width * .04 : figure.width * .04,
      0,
    );
    final shoeRect = Rect.fromCenter(
      center: center,
      width: figure.width * .29,
      height: figure.height * .056,
    );
    final direction = isLeft ? -1.0 : 1.0;
    final toeX = isLeft ? shoeRect.left : shoeRect.right;
    final heelX = isLeft ? shoeRect.right : shoeRect.left;
    final shoe = Path()
      ..moveTo(heelX, shoeRect.top + shoeRect.height * .38)
      ..quadraticBezierTo(
        center.dx,
        shoeRect.top - shoeRect.height * .08,
        toeX,
        shoeRect.top + shoeRect.height * .3,
      )
      ..quadraticBezierTo(
        toeX + direction * shoeRect.width * .06,
        shoeRect.center.dy,
        toeX - direction * shoeRect.width * .02,
        shoeRect.bottom - shoeRect.height * .22,
      )
      ..lineTo(heelX - direction * shoeRect.width * .08,
          shoeRect.bottom - shoeRect.height * .08)
      ..quadraticBezierTo(
        center.dx,
        shoeRect.bottom + shoeRect.height * .08,
        heelX,
        shoeRect.top + shoeRect.height * .38,
      )
      ..close();
    paint
      ..style = PaintingStyle.fill
      ..color = Colors.white
      ..shader = const LinearGradient(
        colors: [
          Colors.white,
          Color(0xFFE5E7EB),
          Color(0xFFCBD5E1),
        ],
      ).createShader(shoeRect);
    canvas.drawPath(shoe, paint);
    paint.shader = null;
    canvas.drawPath(
      shoe,
      outline
        ..strokeWidth = figure.height * .006
        ..color = const Color(0xFF020617).withValues(alpha: .36),
    );

    final sole = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        shoeRect.left + shoeRect.width * .08,
        shoeRect.top + shoeRect.height * .62,
        shoeRect.width * .84,
        shoeRect.height * .24,
      ),
      Radius.circular(shoeRect.height * .12),
    );
    paint
      ..style = PaintingStyle.fill
      ..color = const Color(0xFF111827);
    canvas.drawRRect(sole, paint);

    paint
      ..style = PaintingStyle.stroke
      ..strokeWidth = figure.height * .0045
      ..strokeCap = StrokeCap.round
      ..color = primary;
    canvas.drawLine(
      Offset(shoeRect.left + shoeRect.width * .2, shoeRect.center.dy),
      Offset(shoeRect.right - shoeRect.width * .14, shoeRect.center.dy),
      paint,
    );
    paint
      ..strokeWidth = figure.height * .0025
      ..color = const Color(0xFF0F172A).withValues(alpha: .42);
    canvas.drawLine(
      Offset(shoeRect.left + shoeRect.width * .34,
          shoeRect.top + shoeRect.height * .34),
      Offset(shoeRect.left + shoeRect.width * .5,
          shoeRect.top + shoeRect.height * .48),
      paint,
    );
    canvas.drawLine(
      Offset(shoeRect.left + shoeRect.width * .5,
          shoeRect.top + shoeRect.height * .34),
      Offset(shoeRect.left + shoeRect.width * .66,
          shoeRect.top + shoeRect.height * .48),
      paint,
    );
  }

  Shader _skinGradient(Rect rect) {
    return LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        _adjust(skinTone, .3),
        _adjust(skinTone, .16),
        _adjust(skinTone, .03),
      ],
      stops: const [0, .56, 1],
    ).createShader(rect);
  }

  Color _adjust(Color color, double amount) {
    final hsl = HSLColor.fromColor(color);
    return hsl
        .withLightness((hsl.lightness + amount).clamp(0.0, 1.0))
        .toColor();
  }

  @override
  bool shouldRepaint(covariant AvatarFigurePainter oldDelegate) {
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
