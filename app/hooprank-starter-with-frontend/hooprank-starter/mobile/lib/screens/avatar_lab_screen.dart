import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../utils/flat_avatar.dart';

/// Result of a completed Avatar Lab session.
class AvatarLabResult {
  final Map<String, dynamic> config;
  final String svg;

  const AvatarLabResult({required this.config, required this.svg});
}

/// Full-screen avatar creator backed by the bundled Avatar Lab web app
/// (assets/html/avatar_lab.html — the same flat SVG system used on the map).
///
/// The page posts `{type: 'hooprank-avatar', config, svg}` through the
/// `HoopRankBridge` JavaScript channel when the player taps "Save avatar";
/// this screen pops with an [AvatarLabResult].
class AvatarLabScreen extends StatefulWidget {
  /// Previously saved flat config (axes only or full) to restore, if any.
  final Map<String, dynamic>? initialConfig;

  const AvatarLabScreen({super.key, this.initialConfig});

  @override
  State<AvatarLabScreen> createState() => _AvatarLabScreenState();
}

class _AvatarLabScreenState extends State<AvatarLabScreen> {
  static const _bg = Color(0xFF070D13);

  late final WebViewController _controller;
  bool _loaded = false;
  bool _popped = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(_bg)
      ..addJavaScriptChannel(
        'HoopRankBridge',
        onMessageReceived: _onBridgeMessage,
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) => _onPageFinished(),
        ),
      )
      ..loadFlutterAsset('assets/html/avatar_lab.html');
  }

  Future<void> _onPageFinished() async {
    final initial = widget.initialConfig;
    if (initial != null && isFlatAvatarConfig(initial)) {
      final axes = jsonEncode(flatAvatarAxes(initial));
      // `state` and `render` are globals in the lab page.
      await _controller.runJavaScript(
        'try { state = Object.assign({}, state, $axes); render(); } catch (e) {}',
      );
    }
    if (mounted) setState(() => _loaded = true);
  }

  void _onBridgeMessage(JavaScriptMessage message) {
    if (_popped) return;
    try {
      final decoded = jsonDecode(message.message);
      if (decoded is! Map<String, dynamic>) return;
      if (decoded['type'] != 'hooprank-avatar') return;
      final config = decoded['config'];
      final svg = decoded['svg'];
      if (config is! Map<String, dynamic> || svg is! String) return;
      _popped = true;
      Navigator.of(context).pop(
        AvatarLabResult(config: config, svg: svg),
      );
    } catch (e) {
      debugPrint('AvatarLabScreen: bad bridge message: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text(
          'CREATE YOUR PLAYER',
          style: TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.6,
          ),
        ),
        centerTitle: true,
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (!_loaded)
            const Center(
              child: CircularProgressIndicator(color: Color(0xFFF4581B)),
            ),
        ],
      ),
    );
  }
}
