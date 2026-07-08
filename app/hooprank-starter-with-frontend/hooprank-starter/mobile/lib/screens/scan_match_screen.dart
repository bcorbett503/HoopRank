import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../state/app_state.dart';
import '../utils/quick_play_qr.dart';

class ScanMatchScreen extends StatefulWidget {
  const ScanMatchScreen({
    super.key,
    this.enableScanner = true,
    this.initialCode,
  });

  final bool enableScanner;
  final String? initialCode;

  @override
  State<ScanMatchScreen> createState() => _ScanMatchScreenState();
}

class _ScanMatchScreenState extends State<ScanMatchScreen> {
  final MobileScannerController _scannerController = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
  );

  bool _isHandlingScan = false;
  bool _handledInitialCode = false;
  String? _statusMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _maybeHandleInitialCode();
    });
  }

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

  Future<void> _maybeHandleInitialCode() async {
    if (_handledInitialCode) return;
    final initialCode = widget.initialCode?.trim();
    if (initialCode == null || initialCode.isEmpty) return;
    _handledInitialCode = true;
    await _handleRawQr(initialCode);
  }

  String _fallbackPlayerName(String seed) {
    var hash = 0;
    for (final codeUnit in seed.codeUnits) {
      hash = (hash * 31 + codeUnit) % 100000;
    }
    final suffix = hash.toString().padLeft(5, '0');
    return 'HoopRank Player$suffix';
  }

  String _buildLoginRouteForExistingAccount(String rawValue) {
    final joinRoute = Uri(
      path: '/join',
      queryParameters: <String, String>{
        'code': rawValue,
      },
    ).toString();
    return Uri(
      path: '/login',
      queryParameters: <String, String>{
        'returnTo': joinRoute,
      },
    ).toString();
  }

  Future<bool?> _promptForJoinMode(QuickPlayQrPayload payload) {
    final hostName = _firstNonEmpty(payload.hostName, 'your opponent')!;
    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Join Match'),
        content: Text(
          'If you already have a HoopRank account, sign in first so this match attaches to your rank. New here? Continue as a guest against $hostName.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Continue as Guest'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('I Have an Account'),
          ),
        ],
      ),
    );
  }

  Future<User?> _resolveQuickPlayUser(
    QuickPlayQrPayload payload,
    String rawValue,
  ) async {
    final authState = context.read<AuthState>();
    final existingUser = authState.currentUser;
    if (existingUser != null) {
      return existingUser;
    }

    final signInFirst = await _promptForJoinMode(payload);
    if (!mounted) return null;
    if (signInFirst == null) {
      return null;
    }
    if (signInFirst) {
      context.push(_buildLoginRouteForExistingAccount(rawValue));
      return null;
    }

    return _ensureQuickPlayUser();
  }

  Future<User> _ensureQuickPlayUser() async {
    final authState = context.read<AuthState>();
    final existingUser = authState.currentUser;
    if (existingUser != null) {
      return existingUser;
    }

    setState(() {
      _statusMessage = 'Starting guest session...';
    });

    final identity = await AuthService.ensureGuestSession();

    try {
      final user = await ApiService.authenticate(
        identity.idToken,
        uid: identity.uid,
        email: identity.email,
        name: identity.displayName,
        photoUrl: identity.photoUrl,
        provider: identity.isAnonymous ? 'guest' : null,
      );
      await authState.login(user, token: identity.idToken);
      return user;
    } catch (e) {
      // Backend guest registration failed (offline / cold backend). Retry once
      // before falling back, since a later match-create with an unregistered
      // uid would fail server-side.
      debugPrint('Guest authenticate failed, retrying once: $e');
      try {
        final user = await ApiService.authenticate(
          identity.idToken,
          uid: identity.uid,
          email: identity.email,
          name: identity.displayName,
          photoUrl: identity.photoUrl,
          provider: identity.isAnonymous ? 'guest' : null,
        );
        await authState.login(user, token: identity.idToken);
        return user;
      } catch (e2) {
        debugPrint('Guest authenticate retry failed: $e2');
        if (mounted) {
          _showMessage(
              'Could not start a guest session — check your connection and try again.');
        }
        final fallbackUser = User(
          id: identity.uid,
          name: identity.displayName ?? _fallbackPlayerName(identity.uid),
          photoUrl: identity.photoUrl,
        );
        await authState.login(fallbackUser, token: identity.idToken);
        return fallbackUser;
      }
    }
  }

  Future<void> _pasteCodeFromClipboard() async {
    final clipboardText = await _readClipboardText();
    if (!mounted) return;

    if (clipboardText == null || clipboardText.isEmpty) {
      _showMessage('Clipboard is empty.');
      return;
    }

    await _handleRawQr(clipboardText);
  }

  Future<void> _showManualEntrySheet() async {
    // Don't auto-read the clipboard here: on iOS 16+ that fires the system
    // "would like to paste" prompt the instant the user taps Enter Code, even
    // though they only asked to type. The in-sheet Paste button covers the
    // paste path explicitly (Apple's guidance), so open empty and autofocus.
    final controller = TextEditingController();
    final submitted = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) {
        return SingleChildScrollView(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              16,
              16,
              16,
              MediaQuery.of(sheetContext).viewInsets.bottom + 16,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Enter Match Code',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Paste the Step 2 Quick Play code your opponent copied or sent you.',
                  style: TextStyle(color: Colors.white70),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: controller,
                  autofocus: true,
                  minLines: 2,
                  maxLines: 4,
                  textInputAction: TextInputAction.done,
                  decoration: const InputDecoration(
                    hintText: 'hooprank://quick-play?...',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () async {
                          final pasted = await _readClipboardText();
                          if (pasted == null || pasted.isEmpty) {
                            if (!sheetContext.mounted) return;
                            ScaffoldMessenger.of(sheetContext).showSnackBar(
                              const SnackBar(
                                content: Text('Clipboard is empty.'),
                              ),
                            );
                            return;
                          }

                          controller.value = TextEditingValue(
                            text: pasted,
                            selection: TextSelection.collapsed(
                              offset: pasted.length,
                            ),
                          );
                        },
                        icon: const Icon(Icons.content_paste),
                        label: const Text('Paste'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton(
                        onPressed: () {
                          Navigator.of(sheetContext)
                              .pop(controller.text.trim());
                        },
                        child: const Text('Start Match'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );

    if (submitted == null || submitted.isEmpty) return;
    await Future<void>.delayed(const Duration(milliseconds: 250));
    if (!mounted) return;
    await _handleRawQr(submitted);
  }

  Future<void> _handleRawQr(String rawValue) async {
    if (_isHandlingScan) return;

    final payload = QuickPlayQrPayload.tryParse(rawValue);
    if (payload == null) {
      _showMessage('That code is not a valid Quick Play match code.');
      return;
    }

    setState(() {
      _isHandlingScan = true;
      _statusMessage = null;
    });

    try {
      final me = await _resolveQuickPlayUser(payload, rawValue);
      if (me == null || !mounted) {
        setState(() {
          _isHandlingScan = false;
          _statusMessage = null;
        });
        return;
      }

      if (payload.hostId == me.id) {
        _showMessage('This is your own Quick Play code.');
        setState(() {
          _isHandlingScan = false;
          _statusMessage = null;
        });
        return;
      }

      setState(() {
        _statusMessage = 'Creating match...';
      });

      Map<String, dynamic>? profile;
      try {
        profile = await ApiService.getProfile(payload.hostId);
      } catch (_) {
        profile = null;
      }
      final opponentName = _firstNonEmpty(
            profile?['name']?.toString(),
            payload.hostName,
          ) ??
          'Opponent';
      final opponentPosition = _firstNonEmpty(
            profile?['position']?.toString(),
            'G',
          ) ??
          'G';
      final opponentRating = _parseDouble(
        profile?['rating'] ?? profile?['hoop_rank'],
        fallback: 3.0,
      );

      final created = await ApiService.createQuickPlayMatch(
        opponentId: payload.hostId,
        quickPlayToken: payload.sessionToken,
      );

      final matchId = _extractMatchId(created);
      if (matchId == null || matchId.isEmpty) {
        throw Exception('Match created, but no match ID was returned.');
      }

      if (!mounted) return;
      final matchState = context.read<MatchState>();
      matchState.reset();
      matchState.mode = '1v1';
      matchState.setCourt(null);
      matchState.setOpponent(
        Player(
          id: payload.hostId,
          slug: payload.hostId,
          name: opponentName,
          team: 'Free Agent',
          position: opponentPosition,
          age: 25,
          height: '6\'0"',
          weight: '180 lbs',
          rating: opponentRating,
          offense: 75,
          defense: 75,
          shooting: 75,
          passing: 75,
          rebounding: 75,
        ),
      );
      matchState.setMatchId(matchId);
      matchState.startMatch();

      context.go('/match/live');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isHandlingScan = false;
        _statusMessage = null;
      });
      _showMessage('Failed to start match: $e');
    }
  }

  Future<String?> _readClipboardText() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text?.trim();
    return (text == null || text.isEmpty) ? null : text;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan Match'),
        actions: [
          IconButton(
            tooltip: 'Enter code manually',
            icon: const Icon(Icons.keyboard_alt_outlined),
            onPressed: _isHandlingScan ? null : _showManualEntrySheet,
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (widget.enableScanner)
            MobileScanner(
              controller: _scannerController,
              placeholderBuilder: (context) => const ColoredBox(
                color: Colors.black,
                child: Center(
                  child: CircularProgressIndicator(),
                ),
              ),
              errorBuilder: (context, error) => _buildScannerError(error),
              onDetect: (capture) {
                if (_isHandlingScan) return;
                for (final barcode in capture.barcodes) {
                  final raw = barcode.rawValue;
                  if (raw != null && raw.trim().isNotEmpty) {
                    _handleRawQr(raw);
                    return;
                  }
                }
              },
            )
          else
            Container(
              color: const Color(0xFF1A252F),
              alignment: Alignment.center,
              padding: const EdgeInsets.all(24),
              child: const Text(
                'Scanner disabled for this build. Use Paste Code or Enter Code below.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70),
              ),
            ),
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Scan the Step 2 Quick Play QR code',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (_statusMessage != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      _statusMessage!,
                      style: const TextStyle(color: Colors.white70),
                    ),
                  ] else ...[
                    const SizedBox(height: 6),
                    const Text(
                      'If the camera flow fails, paste the Step 2 code instead.',
                      style: TextStyle(color: Colors.white70),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed:
                              _isHandlingScan ? null : _pasteCodeFromClipboard,
                          icon: const Icon(Icons.content_paste),
                          label: const Text('Paste Code'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton.tonalIcon(
                          onPressed:
                              _isHandlingScan ? null : _showManualEntrySheet,
                          icon: const Icon(Icons.keyboard_alt_outlined),
                          label: const Text('Enter Code'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScannerError(MobileScannerException error) {
    final detail = error.errorDetails?.message?.trim();
    final message =
        detail != null && detail.isNotEmpty ? detail : error.errorCode.message;

    return ColoredBox(
      color: Colors.black,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.qr_code_scanner,
                size: 54,
                color: Colors.white70,
              ),
              const SizedBox(height: 12),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Use the match code fallback below to start the game without a camera.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String? _firstNonEmpty(String? a, String? b) {
    if (a != null && a.trim().isNotEmpty) return a.trim();
    if (b != null && b.trim().isNotEmpty) return b.trim();
    return null;
  }

  double _parseDouble(dynamic value, {required double fallback}) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? fallback;
    return fallback;
  }

  String? _extractMatchId(Map<String, dynamic> created) {
    final direct = created['id']?.toString();
    if (direct != null && direct.isNotEmpty) return direct;

    final nested = created['match'];
    if (nested is Map<String, dynamic>) {
      final nestedId = nested['id']?.toString();
      if (nestedId != null && nestedId.isNotEmpty) return nestedId;
    }

    final matchId = created['matchId']?.toString();
    if (matchId != null && matchId.isNotEmpty) return matchId;

    return null;
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}
