import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../app_config.dart';
import '../state/app_state.dart';
import '../utils/quick_play_qr.dart';

class QuickPlayScreen extends StatefulWidget {
  const QuickPlayScreen({super.key});

  @override
  State<QuickPlayScreen> createState() => _QuickPlayScreenState();
}

class _QuickPlayScreenState extends State<QuickPlayScreen> {
  late final int _generatedAtMs;

  @override
  void initState() {
    super.initState();
    _generatedAtMs = DateTime.now().millisecondsSinceEpoch;
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
    final matchQrData = user == null
        ? ''
        : QuickPlayQrPayload(
            hostId: user.id,
            hostName: hostName,
            generatedAtMs: _generatedAtMs,
          ).toQrString();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Quick Play'),
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
                  subtitle:
                      'After they install/login, have them tap Scan Match and scan this QR or paste your copied code.',
                  qrData: matchQrData,
                ),
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
