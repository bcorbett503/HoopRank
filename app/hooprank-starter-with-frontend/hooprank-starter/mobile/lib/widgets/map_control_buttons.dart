import 'package:flutter/material.dart';

/// Shared styling for the floating map controls: a frosted-white circle
/// family plus the orange Quick Play hero orb. Keeping them in one place
/// keeps every button on the map visually coherent.
const Color kMapControlInk = Color(0xFF0F172A);
const Color _frost = Color(0xF2FFFFFF); // white @ ~95%
const Color _hairline = Color(0x0F000000); // black @ 6%

List<BoxShadow> _floatingShadow({double alpha = 0.24}) => [
      BoxShadow(
        color: Colors.black.withValues(alpha: alpha),
        blurRadius: 14,
        offset: const Offset(0, 5),
      ),
    ];

/// Frosted-white circular control (share, locate, ...).
class FrostedCircleButton extends StatelessWidget {
  final double size;
  final Widget child;
  final String? tooltip;
  final VoidCallback onTap;

  const FrostedCircleButton({
    super.key,
    required this.child,
    required this.onTap,
    this.size = 54,
    this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    final button = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: _frost,
        shape: BoxShape.circle,
        border: Border.all(color: _hairline, width: 0.5),
        boxShadow: _floatingShadow(),
      ),
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: Center(child: child),
        ),
      ),
    );
    if (tooltip == null) return button;
    return Tooltip(message: tooltip!, child: button);
  }
}

/// Vertical frosted +/- pill that replaces the two stock zoom FABs.
class MapZoomPill extends StatelessWidget {
  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;

  const MapZoomPill({
    super.key,
    required this.onZoomIn,
    required this.onZoomOut,
  });

  Widget _half(IconData icon, VoidCallback onTap) {
    return SizedBox(
      width: 48,
      height: 46,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Icon(icon, size: 22, color: kMapControlInk),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: _frost,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _hairline, width: 0.5),
        boxShadow: _floatingShadow(alpha: 0.2),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _half(Icons.add_rounded, onZoomIn),
            Container(height: 1, width: 30, color: const Color(0x14000000)),
            _half(Icons.remove_rounded, onZoomOut),
          ],
        ),
      ),
    );
  }
}

/// The Quick Play hero: an orange orb with a hand-drawn basketball.
class QuickPlayOrb extends StatelessWidget {
  final double size;
  final VoidCallback onTap;

  const QuickPlayOrb({super.key, required this.onTap, this.size = 66});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Start a match',
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: const RadialGradient(
            center: Alignment(-0.35, -0.55),
            radius: 1.25,
            colors: [Color(0xFFFF8A50), Color(0xFFF0490F)],
          ),
          border: Border.all(color: Colors.white, width: 2.5),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFF0490F).withValues(alpha: 0.5),
              blurRadius: 20,
              offset: const Offset(0, 7),
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.25),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          shape: const CircleBorder(),
          child: InkWell(
            onTap: onTap,
            customBorder: const CircleBorder(),
            // Ball + explicit label so the hero clearly reads "start a match".
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  width: 34,
                  height: 34,
                  child: CustomPaint(
                    key: const ValueKey('quick_play_ball'),
                    painter: _BasketballPainter(),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'PLAY',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: size * 0.135,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.1,
                    height: 1,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Basketball line art: outline, cross seams and the two curved side seams.
class _BasketballPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide * 0.27;
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.shortestSide * 0.052
      ..strokeCap = StrokeCap.round
      ..color = Colors.white;

    // Seams are clipped to the ball so nothing pokes outside the outline.
    final ball = Path()..addOval(Rect.fromCircle(center: c, radius: r));
    canvas.save();
    canvas.clipPath(ball);
    canvas.drawLine(c - Offset(0, r), c + Offset(0, r), stroke);
    canvas.drawLine(c - Offset(r, 0), c + Offset(r, 0), stroke);
    final left = Path()
      ..moveTo(c.dx - r * 0.71, c.dy - r * 0.77)
      ..quadraticBezierTo(c.dx, c.dy, c.dx - r * 0.71, c.dy + r * 0.77);
    final right = Path()
      ..moveTo(c.dx + r * 0.71, c.dy - r * 0.77)
      ..quadraticBezierTo(c.dx, c.dy, c.dx + r * 0.71, c.dy + r * 0.77);
    canvas.drawPath(left, stroke);
    canvas.drawPath(right, stroke);
    canvas.restore();

    canvas.drawCircle(c, r, stroke..strokeWidth = size.shortestSide * 0.056);

    // Small gloss arc, top-left — sells the "orb" read.
    final gloss = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.shortestSide * 0.055
      ..strokeCap = StrokeCap.round
      ..color = Colors.white.withValues(alpha: 0.35);
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r + size.shortestSide * 0.14),
      -2.5,
      0.75,
      false,
      gloss,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// iOS-style share glyph (arrow rising out of a tray), stroked by hand so it
/// stays crisp at any size and matches the basketball's line weight.
class ShareIconPainter extends CustomPainter {
  final Color color;

  const ShareIconPainter({this.color = kMapControlInk});

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide / 24;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.1 * s
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = color;

    canvas.drawLine(Offset(12 * s, 3.6 * s), Offset(12 * s, 14.6 * s), paint);
    final head = Path()
      ..moveTo(8.2 * s, 7.0 * s)
      ..lineTo(12 * s, 3.3 * s)
      ..lineTo(15.8 * s, 7.0 * s);
    canvas.drawPath(head, paint);

    final tray = Path()
      ..moveTo(8.6 * s, 10.6 * s)
      ..lineTo(6.4 * s, 10.6 * s)
      ..quadraticBezierTo(4.6 * s, 10.6 * s, 4.6 * s, 12.4 * s)
      ..lineTo(4.6 * s, 18.4 * s)
      ..quadraticBezierTo(4.6 * s, 20.2 * s, 6.4 * s, 20.2 * s)
      ..lineTo(17.6 * s, 20.2 * s)
      ..quadraticBezierTo(19.4 * s, 20.2 * s, 19.4 * s, 18.4 * s)
      ..lineTo(19.4 * s, 12.4 * s)
      ..quadraticBezierTo(19.4 * s, 10.6 * s, 17.6 * s, 10.6 * s)
      ..lineTo(15.4 * s, 10.6 * s);
    canvas.drawPath(tray, paint);
  }

  @override
  bool shouldRepaint(covariant ShareIconPainter oldDelegate) =>
      oldDelegate.color != color;
}
