import 'package:flutter_test/flutter_test.dart';
import 'package:hooprank/utils/quick_play_qr.dart';

void main() {
  group('QuickPlayQrPayload', () {
    test('round trips a quick play payload with a session token', () {
      const payload = QuickPlayQrPayload(
        hostId: 'host-user-1',
        hostName: 'Host Player',
        generatedAtMs: 1731104100000,
        sessionToken: 'quick-play-token-1',
      );

      final qr = payload.toQrString();
      final parsed = QuickPlayQrPayload.tryParse(qr);

      expect(parsed, isNotNull);
      expect(parsed!.hostId, 'host-user-1');
      expect(parsed.hostName, 'Host Player');
      expect(parsed.generatedAtMs, 1731104100000);
      expect(parsed.sessionToken, 'quick-play-token-1');
      expect(parsed.matchId, isNull);
    });

    test('round trips a challenge-start payload with a matchId', () {
      const payload = QuickPlayQrPayload(
        hostId: 'host-user-1',
        hostName: 'Host Player',
        generatedAtMs: 1731104100000,
        sessionToken: 'quick-play-token-1',
        matchId: 'match-abc-123',
      );

      final parsed = QuickPlayQrPayload.tryParse(payload.toQrString());

      expect(parsed, isNotNull);
      expect(parsed!.matchId, 'match-abc-123');
      // Legacy codes without a matchId still parse (matchId just stays null),
      // so old app versions' QRs keep working through the create path.
    });

    test('rejects non quick play URLs', () {
      expect(
        QuickPlayQrPayload.tryParse('https://example.com/some-qr'),
        isNull,
      );
    });

    test('rejects quick play URLs without a host id', () {
      final qrWithoutHostId = Uri(
        scheme: 'hooprank',
        host: 'quick-play',
        queryParameters: const {
          'v': '1',
          'hostName': 'Host Player',
          'ts': '1731104100000',
        },
      ).toString();

      expect(QuickPlayQrPayload.tryParse(qrWithoutHostId), isNull);
    });

    test('defaults missing optional fields', () {
      final malformed = Uri(
        scheme: 'hooprank',
        host: 'quick-play',
        queryParameters: const {
          'hostId': 'host-user-1',
          'ts': 'not-a-timestamp',
        },
      ).toString();

      final parsed = QuickPlayQrPayload.tryParse(malformed);

      expect(parsed, isNotNull);
      expect(parsed!.hostName, 'Quick Play Host');
      expect(parsed.generatedAtMs, 0);
      expect(parsed.sessionToken, isNull);
    });

    test('rejects blank and null input', () {
      expect(QuickPlayQrPayload.tryParse('   '), isNull);
      expect(QuickPlayQrPayload.tryParse(null), isNull);
    });
  });
}
