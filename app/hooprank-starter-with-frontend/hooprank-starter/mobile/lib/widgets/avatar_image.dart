import 'package:flutter/material.dart';

import '../utils/image_utils.dart';

class HoopRankAvatarImage extends StatelessWidget {
  final String? imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Widget? fallback;

  const HoopRankAvatarImage({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.fallback,
  });

  @override
  Widget build(BuildContext context) {
    final url = imageUrl?.trim();
    if (url == null || url.isEmpty || isPlaceholderImage(url)) {
      return _sized(fallback ?? const SizedBox.shrink());
    }

    if (_looksLikeSvgAvatarSource(url)) {
      return _sized(fallback ?? const SizedBox.shrink());
    }

    return Image(
      image: safeImageProvider(url),
      width: width,
      height: height,
      fit: fit,
      errorBuilder: (_, __, ___) => _sized(fallback ?? const SizedBox.shrink()),
    );
  }

  Widget _sized(Widget child) {
    return SizedBox(
      width: width,
      height: height,
      child: child,
    );
  }
}

bool _looksLikeSvgAvatarSource(String url) {
  final normalized = url.trim().toLowerCase();
  if (normalized.startsWith('data:image/svg+xml')) return true;
  final uri = Uri.tryParse(url);
  if (uri == null || !uri.hasScheme) return false;
  return uri.path.toLowerCase().endsWith('.svg');
}
