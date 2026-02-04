import 'package:flutter/material.dart';

class BasketballMarker extends StatelessWidget {
  final bool isLegendary;
  final bool hasKing;
  final bool isIndoor;
  final bool hasActivity;
  final double size;
  final VoidCallback? onTap;

  const BasketballMarker({
    super.key,
    this.isLegendary = false,
    this.hasKing = false,
    this.isIndoor = false,
    this.hasActivity = false,
    this.size = 40.0,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          children: [
            // Shadow (drawn by painter)
            CustomPaint(
              size: Size(size, size),
              painter: _MarkerPainter(
                color: _getMarkerColor(),
                borderColor: _getBorderColor(),
                showCrown: isLegendary,
              ),
            ),
            // Basketball Icon
            Align(
              alignment: const Alignment(0, -0.2),
              child: Icon(
                Icons.sports_basketball,
                color: Colors.white.withOpacity(0.9),
                size: size * 0.45,
              ),
            ),
            // Activity Indicator (Green Dot)
            if (hasActivity)
              Positioned(
                right: size * 0.15,
                top: size * 0.15,
                child: Container(
                  width: size * 0.25,
                  height: size * 0.25,
                  decoration: BoxDecoration(
                    color: const Color(0xFF00C853), // Material Green A700
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 2,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Color _getMarkerColor() {
    if (isLegendary) return const Color(0xFFFFD700); // Gold
    if (isIndoor) return const Color(0xFF7E57C2); // Deep Purple
    return const Color(0xFFFF5722); // Deep Orange (HoopRank Brand)
  }

  Color _getBorderColor() {
    if (isLegendary) return const Color(0xFFB8860B); // Dark Gold
    return Colors.white;
  }
}

class _MarkerPainter extends CustomPainter {
  final Color color;
  final Color borderColor;
  final bool showCrown;

  _MarkerPainter({
    required this.color,
    required this.borderColor,
    this.showCrown = false,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    
    // Main Pin Shape (Teardrop)
    final path = Path();
    path.moveTo(w * 0.5, h); // Bottom tip
    path.quadraticBezierTo(w * 0.1, h * 0.6, w * 0.1, h * 0.35); // Left curve
    path.arcToPoint(
      Offset(w * 0.9, h * 0.35),
      radius: Radius.circular(w * 0.4),
    ); // Top circle
    path.quadraticBezierTo(w * 0.9, h * 0.6, w * 0.5, h); // Right curve
    path.close();

    // Shadow
    canvas.drawShadow(path, Colors.black, 4.0, true);

    // Fill
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, paint);

    // Border
    final borderPaint = Paint()
      ..color = borderColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;
    canvas.drawPath(path, borderPaint);

    // Crown for Legendary
    if (showCrown) {
      final crownPath = Path();
      // Draw a small 3-point crown on top
      final crownBaseY = h * 0.05;
      final crownW = w * 0.4;
      final crownLeft = (w - crownW) / 2;
      
      crownPath.moveTo(crownLeft, crownBaseY);
      crownPath.lineTo(crownLeft, crownBaseY - h * 0.15); // Left point
      crownPath.lineTo(crownLeft + crownW * 0.25, crownBaseY - h * 0.1);
      crownPath.lineTo(crownLeft + crownW * 0.5, crownBaseY - h * 0.2); // Mid point
      crownPath.lineTo(crownLeft + crownW * 0.75, crownBaseY - h * 0.1);
      crownPath.lineTo(crownLeft + crownW, crownBaseY - h * 0.15); // Right point
      crownPath.lineTo(crownLeft + crownW, crownBaseY);
      crownPath.close();

      final crownPaint = Paint()
        ..color = const Color(0xFFFFD700)
        ..style = PaintingStyle.fill;
        
      // Add shadow/border to crown for visibility
      canvas.drawPath(
        crownPath, 
        Paint()
          ..color = Colors.black.withOpacity(0.5)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.5
      );
      canvas.drawPath(crownPath, crownPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _MarkerPainter oldDelegate) {
    return color != oldDelegate.color || 
           borderColor != oldDelegate.borderColor ||
           showCrown != oldDelegate.showCrown;
  }
}
