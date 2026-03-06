import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/api_service.dart';
import '../state/app_state.dart';
import '../utils/quick_play_qr.dart';

class ScanMatchScreen extends StatefulWidget {
  const ScanMatchScreen({super.key});

  @override
  State<ScanMatchScreen> createState() => _ScanMatchScreenState();
}

class _ScanMatchScreenState extends State<ScanMatchScreen> {
  final MobileScannerController _scannerController = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
  );

  bool _isHandlingScan = false;
  String? _statusMessage;

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
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
    final initialText = await _readClipboardText() ?? '';
    if (!mounted) return;

    final controller = TextEditingController(text: initialText);
    final submitted = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) {
        return Padding(
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
                autofocus: initialText.isEmpty,
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
                                content: Text('Clipboard is empty.')),
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
                        Navigator.of(sheetContext).pop(controller.text.trim());
                      },
                      child: const Text('Start Match'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
    controller.dispose();

    if (submitted == null || submitted.isEmpty) return;
    await _handleRawQr(submitted);
  }

  Future<void> _handleRawQr(String rawValue) async {
    if (_isHandlingScan) return;

    final payload = QuickPlayQrPayload.tryParse(rawValue);
    if (payload == null) {
      _showMessage('That code is not a valid Quick Play match code.');
      return;
    }

    final me = context.read<AuthState>().currentUser;
    if (me == null) {
      _showMessage('Sign in first, then scan again.');
      return;
    }

    if (payload.hostId == me.id) {
      _showMessage('This is your own Quick Play code.');
      return;
    }

    setState(() {
      _isHandlingScan = true;
      _statusMessage = 'Creating match...';
    });

    try {
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

  Future<String?> _readClipboardText() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text?.trim();
    if (text == null || text.isEmpty) return null;
    return text;
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
