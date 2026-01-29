import 'dart:io';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:video_thumbnail/video_thumbnail.dart';
import 'package:path_provider/path_provider.dart';
import 'package:flutter/foundation.dart';

/// Service for uploading videos to Firebase Storage with 15-second limit
class VideoUploadService {
  static const int maxDurationSeconds = 15;
  static const int maxFileSizeMB = 50;
  
  static final FirebaseStorage _storage = FirebaseStorage.instance;
  
  /// Get video duration in milliseconds
  static Future<int> getVideoDurationMs(String videoPath) async {
    try {
      // Use video_thumbnail to get duration by extracting a frame
      // This is a workaround since video_thumbnail doesn't directly expose duration
      // We'll use the video_player package in the caller to get actual duration
      return 0; // Placeholder - caller should validate
    } catch (e) {
      debugPrint('VideoUploadService: Error getting duration: $e');
      return 0;
    }
  }
  
  /// Upload video to Firebase Storage
  /// Returns the download URL on success, throws on failure
  static Future<String> uploadVideo(File videoFile, String userId) async {
    try {
      // Check file size
      final fileSize = await videoFile.length();
      final fileSizeMB = fileSize / (1024 * 1024);
      
      if (fileSizeMB > maxFileSizeMB) {
        throw Exception('Video too large. Maximum size is ${maxFileSizeMB}MB.');
      }
      
      debugPrint('VideoUploadService: Uploading video ${fileSizeMB.toStringAsFixed(1)}MB');
      
      // Generate unique filename
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final extension = videoFile.path.split('.').last.toLowerCase();
      final filename = 'videos/$userId/${timestamp}.$extension';
      
      // Create storage reference
      final ref = _storage.ref().child(filename);
      
      // Upload with metadata
      final metadata = SettableMetadata(
        contentType: 'video/$extension',
        customMetadata: {
          'userId': userId,
          'uploadedAt': DateTime.now().toIso8601String(),
        },
      );
      
      // Start upload
      final uploadTask = ref.putFile(videoFile, metadata);
      
      // Monitor progress
      uploadTask.snapshotEvents.listen((TaskSnapshot snapshot) {
        final progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        debugPrint('VideoUploadService: Upload progress: ${progress.toStringAsFixed(0)}%');
      });
      
      // Wait for completion
      await uploadTask;
      
      // Get download URL
      final downloadUrl = await ref.getDownloadURL();
      debugPrint('VideoUploadService: Upload complete: $downloadUrl');
      
      return downloadUrl;
    } catch (e) {
      debugPrint('VideoUploadService: Upload failed: $e');
      rethrow;
    }
  }
  
  /// Generate and upload thumbnail from video
  /// Returns the thumbnail download URL
  static Future<String?> generateAndUploadThumbnail(String videoPath, String userId) async {
    try {
      // Generate thumbnail at 1 second mark
      final tempDir = await getTemporaryDirectory();
      final thumbnailPath = await VideoThumbnail.thumbnailFile(
        video: videoPath,
        thumbnailPath: tempDir.path,
        imageFormat: ImageFormat.JPEG,
        maxWidth: 512,
        quality: 75,
        timeMs: 1000, // 1 second into video
      );
      
      if (thumbnailPath == null) {
        debugPrint('VideoUploadService: Failed to generate thumbnail');
        return null;
      }
      
      debugPrint('VideoUploadService: Generated thumbnail at $thumbnailPath');
      
      // Upload thumbnail
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final filename = 'thumbnails/$userId/$timestamp.jpg';
      final ref = _storage.ref().child(filename);
      
      final metadata = SettableMetadata(
        contentType: 'image/jpeg',
        customMetadata: {
          'userId': userId,
          'type': 'video_thumbnail',
        },
      );
      
      await ref.putFile(File(thumbnailPath), metadata);
      final downloadUrl = await ref.getDownloadURL();
      
      // Clean up temp file
      try {
        await File(thumbnailPath).delete();
      } catch (_) {}
      
      debugPrint('VideoUploadService: Thumbnail uploaded: $downloadUrl');
      return downloadUrl;
    } catch (e) {
      debugPrint('VideoUploadService: Thumbnail generation failed: $e');
      return null;
    }
  }
  
  /// Validate video duration is within limit
  /// This should be called with actual duration from video_player
  static bool isValidDuration(int durationMs) {
    final durationSeconds = durationMs / 1000;
    return durationSeconds <= maxDurationSeconds;
  }
  
  /// Get user-friendly duration string
  static String formatDuration(int durationMs) {
    final seconds = (durationMs / 1000).round();
    if (seconds < 60) {
      return '${seconds}s';
    }
    final minutes = seconds ~/ 60;
    final remainingSeconds = seconds % 60;
    return '$minutes:${remainingSeconds.toString().padLeft(2, '0')}';
  }
}
