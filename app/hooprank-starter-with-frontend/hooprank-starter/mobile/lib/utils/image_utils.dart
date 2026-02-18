import 'dart:typed_data';
import 'package:flutter/painting.dart';

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
