import 'dart:typed_data';
import 'package:flutter/painting.dart';

/// The known 1×1 transparent-pixel base64 payload used as a placeholder.
const _placeholderBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/// Returns true when [url] is the known 1×1 transparent-pixel placeholder
/// so callers can skip showing a [CircleAvatar.backgroundImage] entirely
/// and fall through to the initial-letter child widget.
bool isPlaceholderImage(String? url) {
  if (url == null || url.isEmpty) return true;
  if (url.startsWith('data:')) {
    // Check for the exact known placeholder
    if (url.contains(_placeholderBase64)) return true;
    // Also reject any data: URI whose decoded payload is tiny (≤ 100 bytes)
    try {
      final data = UriData.parse(url);
      if (data.contentAsBytes().length <= 100) return true;
    } catch (_) {
      return true; // unparseable data: URIs are treated as placeholders
    }
  }
  return false;
}

/// Returns the correct [ImageProvider] for a given URL string.
///
/// If the URL is a `data:` URI (e.g. base64-encoded image from Firebase),
/// it decodes it into a [MemoryImage]. Otherwise it returns a [NetworkImage].
///
/// This prevents the crash:
///   `Invalid argument(s): No host specified in URI data:image/...`
/// which occurs when [NetworkImage] (backed by dart:_http) tries to resolve
/// a `data:` URI as a network host.
ImageProvider safeImageProvider(String url) {
  if (url.startsWith('data:')) {
    try {
      final uriData = UriData.parse(url);
      return MemoryImage(Uint8List.fromList(uriData.contentAsBytes()));
    } catch (_) {
      // If parsing fails, fall through to NetworkImage
    }
  }
  return NetworkImage(url);
}
