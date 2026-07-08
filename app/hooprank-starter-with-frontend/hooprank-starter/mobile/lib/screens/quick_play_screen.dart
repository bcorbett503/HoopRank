import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../app_config.dart';
import '../models.dart';
import '../services/api_service.dart';
import '../state/app_state.dart';
import '../utils/quick_play_qr.dart';

class QuickPlayScreen extends StatefulWidget {
  /// When set, this screen starts an EXISTING challenge match: the QR
  /// carries the matchId, the opponent's scan verify-starts it server-side,
  /// and this device polls until that happens, then jumps into the live
  /// match. Without it, this is the classic ad-hoc Quick Play flow.
  final String? matchId;
  final String? opponentId;
  final String? opponentName;

  const QuickPlayScreen({
    super.key,
    this.matchId,
    this.opponentId,
    this.opponentName,
  });

  @override
  State<QuickPlayScreen> createState() => _QuickPlayScreenState();
}

class _QuickPlayScreenState extends State<QuickPlayScreen> {
  late final int _generatedAtMs;
  late final String _sessionToken;
  Timer? _verifyPoll;

  @override
  void initState() {
    super.initState();
    _generatedAtMs = DateTime.now().millisecondsSinceEpoch;
    _sessionToken = _buildSessionToken();
    if (widget.matchId != null && widget.matchId!.isNotEmpty) {
      _verifyPoll = Timer.periodic(
        const Duration(seconds: 3),
        (_) => _checkMatchVerified(),
      );
    }
  }

  @override
  void dispose() {
    _verifyPoll?.cancel();
    super.dispose();
  }

  /// The opponent's scan flips scan_verified server-side; the moment we see
  /// it, both phones are in — go live.
  Future<void> _checkMatchVerified() async {
    final matchId = widget.matchId;
    if (matchId == null || !mounted) return;
    try {
      final match = await ApiService.getMatch(matchId);
      if (match == null || !mounted) return;
      final verified = match['scan_verified'] == true;
      final status = (match['status'] ?? '').toString().toLowerCase();
      if (verified && (status == 'live' || status == 'accepted')) {
        _verifyPoll?.cancel();
        _enterLiveMatch();
      }
    } catch (_) {
      // Poll again on the next tick.
    }
  }

  void _enterLiveMatch() {
    final matchState = context.read<MatchState>();
    matchState.reset();
    matchState.mode = '1v1';
    matchState.setOpponent(Player(
      id: widget.opponentId ?? '',
      slug: widget.opponentId ?? '',
      name: widget.opponentName ?? 'Opponent',
      team: 'Free Agent',
      position: 'G',
      age: 25,
      height: "6'0\"",
      weight: '180 lbs',
      rating: 3.0,
      offense: 75,
      defense: 75,
      shooting: 75,
      passing: 75,
      rebounding: 75,
    ));
    matchState.setMatchId(widget.matchId);
    matchState.startMatch();
    context.go('/match/live');
  }

  String _buildSessionToken() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    return bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
  }

  Future<void> _copyMatchCode(String matchQrData) async {
    if (matchQrData.trim().isEmpty) return;

    await Clipboard.setData(ClipboardData(text: matchQrData));
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
            'Quick Play code copied. Your opponent can paste it into Scan Match.'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().currentUser;
    final hostName = user?.name.trim().isNotEmpty == true ? user!.name : 'Host';
    final isChallengeStart =
        widget.matchId != null && widget.matchId!.isNotEmpty;
    final opponentLabel = widget.opponentName ?? 'your opponent';
    final matchQrData = user == null
        ? ''
        : QuickPlayQrPayload(
            hostId: user.id,
            hostName: hostName,
            generatedAtMs: _generatedAtMs,
            sessionToken: _sessionToken,
            matchId: widget.matchId,
          ).toQrString();

    return Scaffold(
      appBar: AppBar(
        title: Text(isChallengeStart ? 'Start Match' : 'Quick Play'),
        leading: BackButton(
          onPressed: () {
            // Entered via push (back stack) or via deep link/tab (no stack):
            // always leave somewhere sensible.
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/play');
            }
          },
        ),
        actions: [
          IconButton(
            tooltip: 'Scan Match',
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: () => context.push('/quick-play/scan'),
          ),
        ],
      ),
      body: user == null
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Sign in to start Quick Play.',
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(14),
              children: [
                _buildQrCard(
                  stepTag: 'STEP 1',
                  accentColor: const Color(0xFF2563EB),
                  title: 'Step 1: Download HoopRank',
                  subtitle:
                      'If your opponent does not have the app yet, have them scan this first.',
                  qrData: AppConfig.appStoreUrl.toString(),
                ),
                const SizedBox(height: 10),
                _buildQrCard(
                  stepTag: 'STEP 2',
                  accentColor: const Color(0xFFF97316),
                  title: 'Step 2: Start This Match',
                  subtitle: isChallengeStart
                      ? 'Have $opponentLabel scan this code (or scan theirs). '
                          'Both players must scan in person — that\'s what '
                          'makes the result count.'
                      : 'Once they are in the app, have them tap Continue without an account or Scan Match, then scan this QR or paste your copied code.',
                  qrData: matchQrData,
                ),
                if (isChallengeStart) ...[
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(0xFFF97316),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Waiting for $opponentLabel to scan\u2026',
                        style: const TextStyle(
                            color: Colors.white70, fontSize: 12.5),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => _copyMatchCode(matchQrData),
                    icon: const Icon(Icons.copy_all_outlined),
                    label: const Text('Copy Match Code'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: BorderSide(
                        color: Colors.white.withValues(alpha: 0.24),
                      ),
                      minimumSize: const Size.fromHeight(44),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'If scanning fails, copy Step 2 and have your opponent paste it into Scan Match.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => context.push('/quick-play/scan'),
                    icon: const Icon(Icons.qr_code_scanner),
                    label: const Text('Open Scan Match'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFF97316),
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(46),
                      textStyle: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Tip: Keep Step 2 visible while your opponent scans, or send the copied code.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ],
            ),
    );
  }

  Widget _buildQrCard({
    required String stepTag,
    required Color accentColor,
    required String title,
    required String subtitle,
    required String qrData,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF2C3E50),
        borderRadius: BorderRadius.circular(12),
        border:
            Border.all(color: accentColor.withValues(alpha: 0.7), width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              stepTag,
              style: TextStyle(
                color: accentColor,
                fontSize: 10.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(color: Colors.white70, fontSize: 14),
          ),
          const SizedBox(height: 10),
          Center(
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: QrImageView(
                data: qrData,
                size: 188,
                backgroundColor: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
