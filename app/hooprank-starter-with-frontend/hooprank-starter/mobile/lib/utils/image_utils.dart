import 'dart:io';
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
  if (url.startsWith('/') || url.startsWith('file://')) return true;
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
  // Handle empty strings — return a tiny transparent pixel
  if (url.isEmpty) {
    return MemoryImage(Uint8List.fromList(const [
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
      0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
      0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
      0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ]));
  }

  // Handle local file paths
  if (url.startsWith('/') || url.startsWith('file://')) {
    final path = url.startsWith('file://') ? Uri.parse(url).toFilePath() : url;
    return FileImage(File(path));
  }

  // Handle data: URIs
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
