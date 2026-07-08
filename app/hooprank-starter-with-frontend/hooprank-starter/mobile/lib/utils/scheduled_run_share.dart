import '../app_config.dart';

Uri buildScheduledRunShareUri({
  String? runId,
  int? statusId,
  String? courtId,
  String? courtName,
  required String title,
  required DateTime scheduledAt,
  String? hostName,
  String? gameMode,
  String? ageRange,
}) {
  final trimmedRunId = runId?.trim();
  final parameters = <String, String>{};

  void addIfPresent(String key, String? value) {
    final trimmed = value?.trim();
    if (trimmed == null || trimmed.isEmpty) return;
    parameters[key] = trimmed;
  }

  if (trimmedRunId != null && trimmedRunId.isNotEmpty) {
    // Keep share URLs to a single short smart link. The landing page can
    // resolve the rest of the run metadata from the run id.
  } else {
    parameters['title'] = title;
    parameters['scheduledAt'] = scheduledAt.toUtc().toIso8601String();
    addIfPresent('runId', runId);
    if (statusId != null) {
      parameters['statusId'] = statusId.toString();
    }
    addIfPresent('courtId', courtId);
    addIfPresent('courtName', courtName);
    addIfPresent('hostName', hostName);
    addIfPresent('gameMode', gameMode);
    addIfPresent('ageRange', ageRange);
  }

  final path = trimmedRunId != null && trimmedRunId.isNotEmpty
      ? '${AppConfig.scheduledRunSharePath}/${Uri.encodeComponent(trimmedRunId)}'
      : AppConfig.scheduledRunSharePath;

  return AppConfig.marketingSiteUrl.replace(
    path: path,
    queryParameters: parameters.isEmpty ? null : parameters,
  );
}

String buildScheduledRunShareText({
  String? runId,
  int? statusId,
  String? courtId,
  String? courtName,
  required String title,
  required DateTime scheduledAt,
  String? hostName,
  String? gameMode,
  String? ageRange,
}) {
  final shareUri = buildScheduledRunShareUri(
    runId: runId,
    statusId: statusId,
    courtId: courtId,
    courtName: courtName,
    title: title,
    scheduledAt: scheduledAt,
    hostName: hostName,
    gameMode: gameMode,
    ageRange: ageRange,
  );
  final localScheduledAt = scheduledAt.toLocal();
  final lines = <String>[
    'HoopRank Run:',
    title,
    _formatShareDateTime(localScheduledAt),
  ];

  final details = [
    gameMode?.trim(),
    _formatAgeRangeLabel(ageRange),
  ]
      .where((value) => value != null && value.isNotEmpty)
      .cast<String>()
      .join(' • ');
  if (details.isNotEmpty) {
    lines.add(details);
  }

  lines.add('');
  lines.add('RSVP: $shareUri');
  lines.add('App Store: ${AppConfig.appStoreUrlString}');

  return lines.join('\n');
}

String? _formatAgeRangeLabel(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) {
    return null;
  }

  if (trimmed.toLowerCase() == 'open') {
    return 'Open';
  }

  return trimmed;
}

String buildScheduledRunAppDeepLink({
  String? courtId,
  String? courtName,
  String? runId,
  int? statusId,
  DateTime? scheduledAt,
}) {
  final queryParameters = <String, String>{};

  void addIfPresent(String key, String? value) {
    final trimmed = value?.trim();
    if (trimmed == null || trimmed.isEmpty) return;
    queryParameters[key] = trimmed;
  }

  addIfPresent('courtId', courtId);
  addIfPresent('courtName', courtName);
  addIfPresent('runId', runId);
  if (statusId != null) {
    queryParameters['statusId'] = statusId.toString();
  }
  if (scheduledAt != null) {
    queryParameters['scheduledAt'] = scheduledAt.toUtc().toIso8601String();
  }

  return Uri(
    scheme: AppConfig.appDeepLinkScheme,
    path: '/courts',
    queryParameters: queryParameters.isEmpty ? null : queryParameters,
  ).toString();
}

String _formatShareDateTime(DateTime value) {
  final weekday = const [
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun'
  ][value.weekday - 1];
  final hour =
      value.hour == 0 ? 12 : (value.hour > 12 ? value.hour - 12 : value.hour);
  final minute = value.minute.toString().padLeft(2, '0');
  final period = value.hour >= 12 ? 'PM' : 'AM';
  return '$weekday ${value.month}/${value.day} at $hour:$minute $period';
}
