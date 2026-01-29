import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:visibility_detector/visibility_detector.dart';

/// Reel-style video player for the feed
/// Features:
/// - Auto-plays when visible (muted by default)
/// - Pauses when scrolled out of view
/// - Tap to toggle mute/unmute
/// - Shows duration badge
/// - Loop playback
class FeedVideoPlayer extends StatefulWidget {
  final String videoUrl;
  final String? thumbnailUrl;
  final bool autoPlay;
  final bool startMuted;
  final int? durationMs;
  
  const FeedVideoPlayer({
    super.key,
    required this.videoUrl,
    this.thumbnailUrl,
    this.autoPlay = true,
    this.startMuted = true,
    this.durationMs,
  });
  
  @override
  State<FeedVideoPlayer> createState() => _FeedVideoPlayerState();
}

class _FeedVideoPlayerState extends State<FeedVideoPlayer> {
  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _isMuted = true;
  bool _hasError = false;
  bool _isVisible = false;
  
  @override
  void initState() {
    super.initState();
    _isMuted = widget.startMuted;
    _initializePlayer();
  }
  
  Future<void> _initializePlayer() async {
    try {
      _controller = VideoPlayerController.networkUrl(
        Uri.parse(widget.videoUrl),
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
      );
      
      await _controller!.initialize();
      _controller!.setLooping(true);
      _controller!.setVolume(_isMuted ? 0 : 1);
      
      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
        
        // Auto-play if visible
        if (_isVisible && widget.autoPlay) {
          _controller!.play();
        }
      }
    } catch (e) {
      debugPrint('FeedVideoPlayer: Error initializing: $e');
      if (mounted) {
        setState(() {
          _hasError = true;
        });
      }
    }
  }
  
  void _onVisibilityChanged(VisibilityInfo info) {
    final wasVisible = _isVisible;
    _isVisible = info.visibleFraction > 0.5;
    
    if (_controller == null || !_isInitialized) return;
    
    if (_isVisible && !wasVisible) {
      // Became visible - play
      if (widget.autoPlay) {
        _controller!.play();
      }
    } else if (!_isVisible && wasVisible) {
      // Became hidden - pause
      _controller!.pause();
    }
  }
  
  void _toggleMute() {
    if (_controller == null) return;
    
    setState(() {
      _isMuted = !_isMuted;
      _controller!.setVolume(_isMuted ? 0 : 1);
    });
  }
  
  String _formatDuration(int? ms) {
    if (ms == null) return '';
    final seconds = (ms / 1000).round();
    if (seconds < 60) {
      return '${seconds}s';
    }
    final minutes = seconds ~/ 60;
    final remainingSeconds = seconds % 60;
    return '$minutes:${remainingSeconds.toString().padLeft(2, '0')}';
  }
  
  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return VisibilityDetector(
      key: Key('video-${widget.videoUrl.hashCode}'),
      onVisibilityChanged: _onVisibilityChanged,
      child: GestureDetector(
        onTap: _toggleMute,
        child: Container(
          constraints: const BoxConstraints(
            maxHeight: 400,
          ),
          decoration: BoxDecoration(
            color: Colors.black,
            borderRadius: BorderRadius.circular(12),
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Thumbnail or video
              if (_hasError)
                _buildErrorState()
              else if (!_isInitialized)
                _buildLoadingState()
              else
                _buildVideoPlayer(),
              
              // Duration badge
              if (widget.durationMs != null)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.7),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      _formatDuration(widget.durationMs),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              
              // Mute indicator
              if (_isInitialized)
                Positioned(
                  bottom: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.5),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _isMuted ? Icons.volume_off : Icons.volume_up,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
  
  Widget _buildLoadingState() {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Thumbnail if available
          if (widget.thumbnailUrl != null)
            Image.network(
              widget.thumbnailUrl!,
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
              errorBuilder: (_, __, ___) => Container(color: Colors.grey[900]),
            )
          else
            Container(color: Colors.grey[900]),
          
          // Loading spinner
          const CircularProgressIndicator(
            color: Colors.white,
            strokeWidth: 2,
          ),
        ],
      ),
    );
  }
  
  Widget _buildErrorState() {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: Container(
        color: Colors.grey[900],
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, color: Colors.white54, size: 48),
            SizedBox(height: 8),
            Text(
              'Video unavailable',
              style: TextStyle(color: Colors.white54),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildVideoPlayer() {
    final controller = _controller!;
    return AspectRatio(
      aspectRatio: controller.value.aspectRatio,
      child: VideoPlayer(controller),
    );
  }
}
