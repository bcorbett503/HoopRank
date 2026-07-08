class QuickPlayQrPayload {
  final String hostId;
  final String hostName;
  final int generatedAtMs;
  final String? sessionToken;

  const QuickPlayQrPayload({
    required this.hostId,
    required this.hostName,
    required this.generatedAtMs,
    this.sessionToken,
  });

  String toQrString() {
    return Uri(
      scheme: 'hooprank',
      host: 'quick-play',
      queryParameters: {
        'v': '1',
        'hostId': hostId,
        'hostName': hostName,
        'ts': generatedAtMs.toString(),
        if (sessionToken != null && sessionToken!.trim().isNotEmpty)
          'sessionToken': sessionToken!.trim(),
      },
    ).toString();
  }

  static QuickPlayQrPayload? tryParse(String? raw) {
    if (raw == null) return null;

    final input = raw.trim();
    if (input.isEmpty) return null;

    Uri uri;
    try {
      uri = Uri.parse(input);
    } catch (_) {
      return null;
    }

    if (uri.scheme != 'hooprank' || uri.host != 'quick-play') {
      return null;
    }

    final hostId = uri.queryParameters['hostId']?.trim();
    final hostName = uri.queryParameters['hostName']?.trim();
    final tsRaw = uri.queryParameters['ts']?.trim();
    final sessionToken = uri.queryParameters['sessionToken']?.trim();

    if (hostId == null || hostId.isEmpty) return null;

    final generatedAtMs = int.tryParse(tsRaw ?? '') ?? 0;

    return QuickPlayQrPayload(
      hostId: hostId,
      hostName:
          (hostName == null || hostName.isEmpty) ? 'Quick Play Host' : hostName,
      generatedAtMs: generatedAtMs,
      sessionToken:
          (sessionToken == null || sessionToken.isEmpty) ? null : sessionToken,
    );
  }
}
