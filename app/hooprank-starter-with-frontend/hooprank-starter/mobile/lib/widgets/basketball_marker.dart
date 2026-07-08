import 'package:flutter/material.dart';

import 'avatar_image.dart';

class BasketballMarker extends StatelessWidget {
  final bool isLegendary;
  final bool hasKing;
  final bool isIndoor;
  final bool hasActivity;
  final String? courtImageUrl;
  final String? avatarUrl;
  final String? avatarLabel;
  final Color? activityColor;
  final double size;
  final VoidCallback? onTap;

  const BasketballMarker({
    super.key,
    this.isLegendary = false,
    this.hasKing = false,
    this.isIndoor = false,
    this.hasActivity = false,
    this.courtImageUrl,
    this.avatarUrl,
    this.avatarLabel,
    this.activityColor,
    this.size = 40.0,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveCourtImageUrl = courtImageUrl?.trim().isNotEmpty == true
        ? courtImageUrl!.trim()
        : 'assets/court_marker.png';
    final hasAvatar = avatarUrl?.trim().isNotEmpty == true;
    final avatarInitial = avatarLabel?.trim().isNotEmpty == true
        ? avatarLabel!.trim()[0].toUpperCase()
        : null;

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
            // Court identity stays primary; top-follower identity renders as
            // a badge so player initials never replace the court landmark.
            Align(
              alignment: const Alignment(0, -0.24),
              child: _MarkerCourtImage(
                imageUrl: effectiveCourtImageUrl,
                size: size,
              ),
            ),
            if (hasAvatar || avatarInitial != null)
              Positioned(
                left: size * 0.11,
                top: size * 0.48,
                child: _MiniAvatarBadge(
                  imageUrl: avatarUrl,
                  initial: avatarInitial,
                  size: size,
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
                    color: activityColor ?? const Color(0xFF00C853),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.2),
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
    if (hasKing) {
      return const Color(0xFFB45309); // Burnt orange for ranked courts
    }
    if (isIndoor) return const Color(0xFF7E57C2); // Deep Purple for indoor
    return const Color(0xFF424242); // Asphalt Grey for outdoor
  }

  Color _getBorderColor() {
    if (isLegendary) return const Color(0xFFB8860B); // Dark Gold
    if (hasKing) return const Color(0xFFFFD166);
    return Colors.white;
  }
}

class _MarkerCourtImage extends StatelessWidget {
  final String imageUrl;
  final double size;

  const _MarkerCourtImage({
    required this.imageUrl,
    required this.size,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size * 0.72,
      height: size * 0.72,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.95),
          width: 1.7,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.22),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipOval(
        child: imageUrl.startsWith('assets/')
            ? Image.asset(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _CourtImageFallback(size: size),
              )
            : HoopRankAvatarImage(
                imageUrl: imageUrl,
                fit: BoxFit.cover,
                fallback: _CourtImageFallback(size: size),
              ),
      ),
    );
  }
}

class _CourtImageFallback extends StatelessWidget {
  final double size;

  const _CourtImageFallback({required this.size});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _CourtThumbnailFallbackPainter(),
      child: SizedBox.expand(
        child: Icon(
          Icons.sports_basketball,
          color: Colors.white.withValues(alpha: 0.32),
          size: size * 0.3,
        ),
      ),
    );
  }
}

class _CourtThumbnailFallbackPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final paint = Paint()
      ..shader = const LinearGradient(
        colors: [Color(0xFFFF7A18), Color(0xFFB45309)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ).createShader(rect);
    canvas.drawRect(rect, paint);

    final line = Paint()
      ..color = Colors.white.withValues(alpha: 0.86)
      ..style = PaintingStyle.stroke
      ..strokeWidth = (size.shortestSide * 0.055).clamp(1.2, 3.0);

    final court = rect.deflate(size.shortestSide * 0.13);
    canvas.drawRect(court, line);
    canvas.drawLine(
      Offset(court.center.dx, court.top),
      Offset(court.center.dx, court.bottom),
      line,
    );
    canvas.drawCircle(court.center, court.width * 0.12, line);
    canvas.drawArc(
      Rect.fromCenter(
        center: Offset(court.left, court.center.dy),
        width: court.width * 0.44,
        height: court.height * 0.62,
      ),
      -1.2,
      2.4,
      false,
      line,
    );
    canvas.drawArc(
      Rect.fromCenter(
        center: Offset(court.right, court.center.dy),
        width: court.width * 0.44,
        height: court.height * 0.62,
      ),
      1.94,
      2.4,
      false,
      line,
    );
  }

  @override
  bool shouldRepaint(covariant _CourtThumbnailFallbackPainter oldDelegate) {
    return false;
  }
}

class _MiniAvatarBadge extends StatelessWidget {
  final String? imageUrl;
  final String? initial;
  final double size;

  const _MiniAvatarBadge({
    required this.imageUrl,
    required this.initial,
    required this.size,
  });

  @override
  Widget build(BuildContext context) {
    final hasImage = imageUrl?.trim().isNotEmpty == true;
    final badgeSize = size * 0.31;
    return Container(
      width: badgeSize,
      height: badgeSize,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.28),
            blurRadius: 3,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: ClipOval(
        child: hasImage
            ? HoopRankAvatarImage(
                imageUrl: imageUrl,
                fit: BoxFit.cover,
                fallback: _MiniInitial(initial: initial, size: size),
              )
            : _MiniInitial(initial: initial, size: size),
      ),
    );
  }
}

class _MiniInitial extends StatelessWidget {
  final String? initial;
  final double size;

  const _MiniInitial({
    required this.initial,
    required this.size,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.center,
      color: const Color(0xFF102A43),
      child: Text(
        initial ?? '',
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.14,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
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
      crownPath.lineTo(
          crownLeft + crownW * 0.5, crownBaseY - h * 0.2); // Mid point
      crownPath.lineTo(crownLeft + crownW * 0.75, crownBaseY - h * 0.1);
      crownPath.lineTo(
          crownLeft + crownW, crownBaseY - h * 0.15); // Right point
      crownPath.lineTo(crownLeft + crownW, crownBaseY);
      crownPath.close();

      final crownPaint = Paint()
        ..color = const Color(0xFFFFD700)
        ..style = PaintingStyle.fill;

      // Add shadow/border to crown for visibility
      canvas.drawPath(
          crownPath,
          Paint()
            ..color = Colors.black.withValues(alpha: 0.5)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 0.5);
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
