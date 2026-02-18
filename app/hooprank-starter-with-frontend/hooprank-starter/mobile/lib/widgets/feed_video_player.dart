import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import 'package:visibility_detector/visibility_detector.dart';

/// Reel-style video player for the feed
/// Features:
/// - Auto-plays when visible (muted by default)
/// - Pauses when scrolled out of view
/// - Tap to play/pause
/// - Shows play/pause button + seek bar controls
/// - Mute/unmute button
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
  bool _hasUserPaused = false;
  bool _wasPlayingBeforeSeek = false;

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
      if (widget.autoPlay && !_hasUserPaused) {
        _controller!.play();
      }
    } else if (!_isVisible && wasVisible) {
      // Became hidden - pause
      _controller!.pause();
    }
  }

  void _togglePlayPause() {
    final controller = _controller;
    if (controller == null || !_isInitialized) return;

    if (controller.value.isPlaying) {
      controller.pause();
      setState(() {
        _hasUserPaused = true;
      });
    } else {
      controller.play();
      setState(() {
        _hasUserPaused = false;
      });
    }
  }

  void _toggleMute() {
    if (_controller == null) return;

    setState(() {
      _isMuted = !_isMuted;
      _controller!.setVolume(_isMuted ? 0 : 1);
    });
  }

  void _openFullscreen() {
    if (_controller == null || !_isInitialized) return;
    final wasPlaying = _controller!.value.isPlaying;
    _controller!.pause();

    Navigator.of(context, rootNavigator: true).push(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black,
        pageBuilder: (_, __, ___) => _FullscreenVideoPage(
          controller: _controller!,
          wasPlaying: wasPlaying,
          isMuted: _isMuted,
          onMuteToggle: () {
            setState(() {
              _isMuted = !_isMuted;
              _controller!.setVolume(_isMuted ? 0 : 1);
            });
          },
        ),
        transitionsBuilder: (_, animation, __, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    ).then((_) {
      // Restore portrait orientation when returning
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.portraitUp,
      ]);
      if (wasPlaying && !_hasUserPaused && _isVisible) {
        _controller!.play();
      }
      if (mounted) setState(() {});
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

            // Tap area for play/pause (controls sit above this and will intercept taps)
            if (_isInitialized)
              Positioned.fill(
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: _togglePlayPause,
                  ),
                ),
              ),

            // Duration badge
            if (widget.durationMs != null)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
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

            // Center play indicator when paused
            if (_isInitialized)
              ValueListenableBuilder<VideoPlayerValue>(
                valueListenable: _controller!,
                builder: (context, value, _) {
                  if (value.isPlaying) return const SizedBox.shrink();
                  return Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.45),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.play_arrow,
                      color: Colors.white,
                      size: 44,
                    ),
                  );
                },
              ),

            // Controls row (play/pause + seek bar + mute)
            if (_isInitialized) _buildControlsBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildControlsBar() {
    final controller = _controller!;

    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: Container(
        padding: const EdgeInsets.only(left: 6, right: 6, top: 6, bottom: 2),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.transparent,
              Colors.black.withOpacity(0.65),
            ],
          ),
        ),
        child: ValueListenableBuilder<VideoPlayerValue>(
          valueListenable: controller,
          builder: (context, value, _) {
            final durationMs = value.duration.inMilliseconds;
            var positionMs = value.position.inMilliseconds;

            final safeDurationMs = durationMs <= 0 ? 1 : durationMs;
            if (positionMs < 0) positionMs = 0;
            if (positionMs > safeDurationMs) positionMs = safeDurationMs;

            return Row(
              children: [
                IconButton(
                  onPressed: _togglePlayPause,
                  icon: Icon(
                    value.isPlaying ? Icons.pause : Icons.play_arrow,
                    color: Colors.white,
                  ),
                  iconSize: 22,
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints:
                      const BoxConstraints.tightFor(width: 36, height: 36),
                ),
                Expanded(
                  child: SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      trackHeight: 3,
                      thumbShape:
                          const RoundSliderThumbShape(enabledThumbRadius: 6),
                      overlayShape:
                          const RoundSliderOverlayShape(overlayRadius: 14),
                      activeTrackColor: Colors.white,
                      inactiveTrackColor: Colors.white.withOpacity(0.25),
                      thumbColor: Colors.white,
                      overlayColor: Colors.white.withOpacity(0.15),
                    ),
                    child: Slider(
                      min: 0,
                      max: safeDurationMs.toDouble(),
                      value: positionMs.toDouble(),
                      onChangeStart: (_) {
                        _wasPlayingBeforeSeek = value.isPlaying;
                        if (_wasPlayingBeforeSeek) {
                          controller.pause();
                        }
                      },
                      onChanged: (newValue) {
                        // Allow scrubbing without waiting for onChangeEnd.
                        final seekToMs = newValue.round();
                        controller.seekTo(Duration(milliseconds: seekToMs));
                      },
                      onChangeEnd: (newValue) {
                        final seekToMs = newValue.round();
                        controller.seekTo(Duration(milliseconds: seekToMs));
                        if (_wasPlayingBeforeSeek && !_hasUserPaused) {
                          controller.play();
                        }
                      },
                    ),
                  ),
                ),
                IconButton(
                  onPressed: _toggleMute,
                  icon: Icon(
                    _isMuted ? Icons.volume_off : Icons.volume_up,
                    color: Colors.white,
                  ),
                  iconSize: 20,
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints:
                      const BoxConstraints.tightFor(width: 34, height: 34),
                ),
                IconButton(
                  onPressed: _openFullscreen,
                  icon: const Icon(
                    Icons.fullscreen,
                    color: Colors.white,
                  ),
                  iconSize: 22,
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints:
                      const BoxConstraints.tightFor(width: 34, height: 34),
                ),
              ],
            );
          },
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

/// Fullscreen landscape video page that reuses the existing controller
class _FullscreenVideoPage extends StatefulWidget {
  final VideoPlayerController controller;
  final bool wasPlaying;
  final bool isMuted;
  final VoidCallback onMuteToggle;

  const _FullscreenVideoPage({
    required this.controller,
    required this.wasPlaying,
    required this.isMuted,
    required this.onMuteToggle,
  });

  @override
  State<_FullscreenVideoPage> createState() => _FullscreenVideoPageState();
}

class _FullscreenVideoPageState extends State<_FullscreenVideoPage> {
  bool _showControls = true;
  bool _isMuted = false;

  @override
  void initState() {
    super.initState();
    _isMuted = widget.isMuted;
    // Force landscape
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    // Hide status bar for immersive experience
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    // Resume playback if it was playing
    if (widget.wasPlaying) {
      widget.controller.play();
    }
    // Auto-hide controls after 3 seconds
    _scheduleHideControls();
  }

  @override
  void dispose() {
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  void _scheduleHideControls() {
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted && widget.controller.value.isPlaying) {
        setState(() => _showControls = false);
      }
    });
  }

  void _toggleControls() {
    setState(() => _showControls = !_showControls);
    if (_showControls) {
      _scheduleHideControls();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTap: _toggleControls,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Video
            Center(
              child: AspectRatio(
                aspectRatio: widget.controller.value.aspectRatio,
                child: VideoPlayer(widget.controller),
              ),
            ),

            // Controls overlay
            if (_showControls) ...[
              // Close button
              Positioned(
                top: 16,
                left: 16,
                child: SafeArea(
                  child: IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close, color: Colors.white, size: 28),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.black45,
                    ),
                  ),
                ),
              ),

              // Center play/pause
              ValueListenableBuilder<VideoPlayerValue>(
                valueListenable: widget.controller,
                builder: (context, value, _) {
                  return GestureDetector(
                    onTap: () {
                      if (value.isPlaying) {
                        widget.controller.pause();
                      } else {
                        widget.controller.play();
                        _scheduleHideControls();
                      }
                      setState(() {});
                    },
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.45),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        value.isPlaying ? Icons.pause : Icons.play_arrow,
                        color: Colors.white,
                        size: 48,
                      ),
                    ),
                  );
                },
              ),

              // Bottom controls bar
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: SafeArea(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          Colors.black.withOpacity(0.7),
                        ],
                      ),
                    ),
                    child: ValueListenableBuilder<VideoPlayerValue>(
                      valueListenable: widget.controller,
                      builder: (context, value, _) {
                        final durationMs = value.duration.inMilliseconds;
                        var positionMs = value.position.inMilliseconds;
                        final safeDurationMs = durationMs <= 0 ? 1 : durationMs;
                        if (positionMs < 0) positionMs = 0;
                        if (positionMs > safeDurationMs) positionMs = safeDurationMs;

                        return Row(
                          children: [
                            Expanded(
                              child: SliderTheme(
                                data: SliderTheme.of(context).copyWith(
                                  trackHeight: 3,
                                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                                  overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
                                  activeTrackColor: Colors.white,
                                  inactiveTrackColor: Colors.white.withOpacity(0.25),
                                  thumbColor: Colors.white,
                                ),
                                child: Slider(
                                  min: 0,
                                  max: safeDurationMs.toDouble(),
                                  value: positionMs.toDouble(),
                                  onChanged: (v) {
                                    widget.controller.seekTo(Duration(milliseconds: v.round()));
                                  },
                                ),
                              ),
                            ),
                            IconButton(
                              onPressed: () {
                                setState(() {
                                  _isMuted = !_isMuted;
                                  widget.controller.setVolume(_isMuted ? 0 : 1);
                                });
                                widget.onMuteToggle();
                              },
                              icon: Icon(
                                _isMuted ? Icons.volume_off : Icons.volume_up,
                                color: Colors.white,
                              ),
                              iconSize: 22,
                            ),
                            IconButton(
                              onPressed: () => Navigator.of(context).pop(),
                              icon: const Icon(
                                Icons.fullscreen_exit,
                                color: Colors.white,
                              ),
                              iconSize: 24,
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
