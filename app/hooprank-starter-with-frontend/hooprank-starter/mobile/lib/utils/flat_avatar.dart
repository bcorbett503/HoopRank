/// Helpers for the flat (Avatar Lab) avatar system.
///
/// A flat avatar config is the JSON emitted by assets/html/avatar_lab.html:
/// the configurator's axes plus a rendered `svg` string and a `schema` marker
/// so it can coexist with the legacy generated-avatar config shape.
const String flatAvatarSchema = 'hooprank-flat-v1';

bool isFlatAvatarConfig(Map<String, dynamic>? config) =>
    config != null && config['schema'] == flatAvatarSchema;

/// The rendered SVG for a flat avatar config, or null when the config is
/// absent, legacy-shaped, or missing its render.
String? flatAvatarSvg(Map<String, dynamic>? config) {
  if (!isFlatAvatarConfig(config)) return null;
  final svg = config!['svg'];
  return svg is String && svg.startsWith('<svg') ? svg : null;
}

/// Strips render/marker fields, leaving just the configurator axes —
/// what the Avatar Lab web view expects as its initial state.
Map<String, dynamic> flatAvatarAxes(Map<String, dynamic> config) {
  final axes = Map<String, dynamic>.from(config);
  axes.remove('svg');
  axes.remove('schema');
  return axes;
}
