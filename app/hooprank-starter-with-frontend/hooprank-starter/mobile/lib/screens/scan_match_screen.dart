import 'package:flutter/material.dart';
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

  Future<void> _handleRawQr(String rawValue) async {
    if (_isHandlingScan) return;

    final payload = QuickPlayQrPayload.tryParse(rawValue);
    if (payload == null) {
      _showMessage('That QR is not a Quick Play match code.');
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
      appBar: AppBar(title: const Text('Scan Match')),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _scannerController,
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
                  ],
                ],
              ),
            ),
          ),
        ],
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
