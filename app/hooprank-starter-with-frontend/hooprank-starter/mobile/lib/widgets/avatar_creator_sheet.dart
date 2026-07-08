import 'package:flutter/material.dart';
import '../utils/generated_avatar.dart';
import 'avatar_render_stage.dart';

class AvatarCreatorResult {
  final Map<String, dynamic> config;
  final String dataUrl;

  const AvatarCreatorResult({
    required this.config,
    required this.dataUrl,
  });
}

class AvatarCreatorSheet extends StatefulWidget {
  final String seed;
  final String label;
  final String? position;
  final Map<String, dynamic>? initialConfig;
  final bool isNewPlayer;
  final bool enableModelViewer;

  const AvatarCreatorSheet({
    super.key,
    required this.seed,
    required this.label,
    this.position,
    this.initialConfig,
    this.isNewPlayer = false,
    this.enableModelViewer = false,
  });

  static Future<AvatarCreatorResult?> show(
    BuildContext context, {
    required String seed,
    required String label,
    String? position,
    Map<String, dynamic>? initialConfig,
    bool isNewPlayer = false,
    bool enableModelViewer = false,
  }) {
    return showModalBottomSheet<AvatarCreatorResult>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AvatarCreatorSheet(
        seed: seed,
        label: label,
        position: position,
        initialConfig: initialConfig,
        isNewPlayer: isNewPlayer,
        enableModelViewer: enableModelViewer,
      ),
    );
  }

  @override
  State<AvatarCreatorSheet> createState() => _AvatarCreatorSheetState();
}

class _AvatarCreatorSheetState extends State<AvatarCreatorSheet> {
  late HoopRankAvatarConfig _config;

  @override
  void initState() {
    super.initState();
    final hasPlayerLabel = widget.label.trim().isNotEmpty;
    final shouldUseNewPlayerAvatar = widget.isNewPlayer ||
        (!hasPlayerLabel &&
            (widget.initialConfig == null ||
                isNewPlayerAvatarConfig(widget.initialConfig)));
    final initial = widget.initialConfig != null &&
            isGeneratedAvatarConfig(widget.initialConfig)
        ? HoopRankAvatarConfig.fromJson(widget.initialConfig!)
        : HoopRankAvatarConfig.fromJson(
            buildGeneratedAvatarConfig(
              seed: widget.seed,
              label: shouldUseNewPlayerAvatar
                  ? newPlayerAvatarLabel
                  : widget.label,
              variant: 0,
              position: widget.position,
              isNewPlayer: shouldUseNewPlayerAvatar,
            ),
          );
    _config = initial.copyWith(
      seed: widget.seed,
      label: shouldUseNewPlayerAvatar ? newPlayerAvatarLabel : widget.label,
      position: widget.position ?? initial.position,
      isNewPlayer: shouldUseNewPlayerAvatar,
    );
  }

  @override
  void dispose() {
    super.dispose();
  }

  void _setConfig(HoopRankAvatarConfig config) {
    setState(() => _config = config);
  }

  @override
  Widget build(BuildContext context) {
    final configJson = _config.toJson();
    final dataUrl = _config.toDataUrl();
    final allowDevelopmentModelViewer =
        widget.enableModelViewer && debugPrototypeAvatarModelsEnabled;
    final previewModelSpec = widget.enableModelViewer
        ? generatedAvatarModelSpec(
            configJson,
            allowDevelopmentBaseRig: allowDevelopmentModelViewer,
          )
        : null;
    final avatarScale = generatedAvatarPreviewScale(configJson);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final previewHeight =
        (MediaQuery.of(context).size.height * 0.38).clamp(300.0, 380.0);

    return SafeArea(
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.94,
        ),
        padding: EdgeInsets.fromLTRB(18, 12, 18, 18 + bottomInset),
        decoration: const BoxDecoration(
          color: Color(0xFF111827),
          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        ),
        child: Column(
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.35),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Build Your Player',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                _IconAction(
                  icon: Icons.shuffle_rounded,
                  onTap: () => _setConfig(_randomizedConfig()),
                  tooltip: 'Shuffle',
                ),
                const SizedBox(width: 8),
                _IconAction(
                  icon: Icons.restart_alt_rounded,
                  onTap: () => _setConfig(
                    HoopRankAvatarConfig.fromJson(
                      buildGeneratedAvatarConfig(
                        seed: widget.seed,
                        label: _config.isNewPlayer
                            ? newPlayerAvatarLabel
                            : widget.label,
                        variant: 0,
                        position: widget.position,
                        isNewPlayer: _config.isNewPlayer,
                      ),
                    ),
                  ),
                  tooltip: 'Reset',
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: previewHeight.toDouble(),
              width: double.infinity,
              child: AvatarRenderStage(
                imageUrl: dataUrl,
                modelUrl: previewModelSpec?.url,
                modelPosterUrl: previewModelSpec?.posterUrl,
                modelAnimationName: previewModelSpec?.animationName,
                modelCameraOrbit: previewModelSpec?.cameraOrbit,
                modelCameraTarget: previewModelSpec?.cameraTarget,
                modelFieldOfView: previewModelSpec?.fieldOfView,
                modelScale: previewModelSpec?.scale,
                preferModelViewer: previewModelSpec != null,
                fallback: const ColoredBox(color: Color(0xFF0F172A)),
                padding: const EdgeInsets.fromLTRB(4, 0, 4, 0),
                avatarScale: avatarScale,
                avatarConfig: configJson,
                allowDevelopmentAvatarSprite: debugPrototypeAvatarModelsEnabled,
              ),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: ListView(
                key: const ValueKey('avatar-creator-options-list'),
                children: [
                  _basePersonSection(),
                  _genderSection(),
                  _buildSection(),
                  _heightSection(),
                  _lookSection(),
                  _hairSection(),
                  _clothesSection(),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: BorderSide(
                        color: Colors.white.withValues(alpha: 0.24),
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(
                      context,
                      AvatarCreatorResult(
                        config: _config.toJson(),
                        dataUrl: _config.toDataUrl(),
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFF6B35),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text('Use Avatar'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _lookSection() {
    return _Section(
      title: 'Pose / Outfit',
      child: SizedBox(
        height: 196,
        child: ListView.separated(
          key: const ValueKey('avatar-look-selector'),
          scrollDirection: Axis.horizontal,
          itemCount: avatarLookPresets.length,
          separatorBuilder: (_, __) => const SizedBox(width: 10),
          itemBuilder: (context, index) {
            final look = avatarLookPresets[index];
            final lookConfig = look.applyTo(_config);
            final lookJson = lookConfig.toJson();
            final isSelected =
                _config.outfit == look.outfit && _config.stance == look.stance;
            return SizedBox(
              width: 124,
              child: InkWell(
                onTap: () => _setConfig(look.applyTo(_config)),
                borderRadius: BorderRadius.circular(10),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  curve: Curves.easeOut,
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? const Color(0xFFFF6B35).withValues(alpha: .18)
                        : const Color(0xFF1F2937),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isSelected
                          ? const Color(0xFFFFB067)
                          : Colors.white.withValues(alpha: 0.1),
                      width: isSelected ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AspectRatio(
                        aspectRatio: .82,
                        child: AvatarRenderStage(
                          imageUrl: lookConfig.toDataUrl(),
                          padding: const EdgeInsets.fromLTRB(2, 0, 2, 0),
                          avatarScale: generatedAvatarPreviewScale(lookJson)
                              .clamp(1.0, 1.12)
                              .toDouble(),
                          avatarConfig: lookJson,
                          allowDevelopmentAvatarSprite:
                              debugPrototypeAvatarModelsEnabled,
                          fallback: const ColoredBox(
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        look.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight:
                              isSelected ? FontWeight.w900 : FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        look.caption,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: .62),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _basePersonSection() {
    return _Section(
      title: 'Base Player',
      child: SizedBox(
        height: 178,
        child: ListView.separated(
          key: const ValueKey('avatar-base-person-selector'),
          scrollDirection: Axis.horizontal,
          itemCount: avatarBasePersonPresets.length,
          separatorBuilder: (_, __) => const SizedBox(width: 10),
          itemBuilder: (context, index) {
            final preset = avatarBasePersonPresets[index];
            final presetConfig = preset.applyTo(_config);
            final presetJson = presetConfig.toJson();
            final isSelected = _config.baseAppearance == preset.value;
            return SizedBox(
              width: 122,
              child: InkWell(
                onTap: () => _setConfig(preset.applyTo(_config)),
                borderRadius: BorderRadius.circular(10),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  curve: Curves.easeOut,
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? const Color(0xFFFF6B35).withValues(alpha: .18)
                        : const Color(0xFF1F2937),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isSelected
                          ? const Color(0xFFFFB067)
                          : Colors.white.withValues(alpha: 0.1),
                      width: isSelected ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: AvatarRenderStage(
                          imageUrl: presetConfig.toDataUrl(),
                          padding: const EdgeInsets.fromLTRB(4, 0, 4, 0),
                          avatarScale: generatedAvatarPreviewScale(presetJson)
                              .clamp(.92, 1.06)
                              .toDouble(),
                          avatarConfig: presetJson,
                          fallback: const ColoredBox(
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Container(
                            width: 16,
                            height: 16,
                            decoration: BoxDecoration(
                              color: _hexColor(preset.skinHex),
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: Colors.white.withValues(alpha: .35),
                              ),
                            ),
                          ),
                          const SizedBox(width: 7),
                          Expanded(
                            child: Text(
                              preset.label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: isSelected
                                    ? FontWeight.w900
                                    : FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _genderSection() {
    return _OptionSection(
      title: 'Gender',
      options: avatarGenderOptions,
      selectedValue: _config.gender,
      onSelected: (value) => _setConfig(_config.copyWith(gender: value)),
    );
  }

  Widget _buildSection() {
    return _OptionSection(
      title: 'Build',
      options: avatarBodyOptions,
      selectedValue: _config.bodyType,
      onSelected: (value) => _setConfig(_config.copyWith(bodyType: value)),
    );
  }

  Widget _hairSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _OptionSection(
          title: 'Hair',
          options: avatarHairStyleOptions,
          selectedValue: _config.hairStyle,
          onSelected: (value) => _setConfig(_config.copyWith(hairStyle: value)),
        ),
        _OptionSection(
          title: 'Hair Color',
          options: avatarHairColorOptions,
          selectedValue: _config.hairColor,
          colorForValue: (value) => _hexColor(
            generatedAvatarHairColorHex(
              _config.copyWith(hairColor: value).toJson(),
            ),
          ),
          onSelected: (value) => _setConfig(_config.copyWith(hairColor: value)),
        ),
      ],
    );
  }

  Widget _heightSection() {
    return _OptionSection(
      title: 'Height',
      options: avatarHeightOptions,
      selectedValue: _config.height,
      onSelected: (value) => _setConfig(_config.copyWith(height: value)),
    );
  }

  Widget _clothesSection() {
    return _Section(
      title: 'Clothes Color',
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: avatarColorOptions.map((swatch) {
          final selected = _config.primaryColor == swatch.primary &&
              _config.secondaryColor == swatch.secondary;
          return _ChoicePill(
            label: swatch.label,
            selected: selected,
            swatchColor: _hexColor(swatch.primary),
            onTap: () => _setConfig(
              _config.copyWith(
                primaryColor: swatch.primary,
                secondaryColor: swatch.secondary,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  HoopRankAvatarConfig _randomizedConfig() {
    final seed = '${widget.seed}-${DateTime.now().microsecondsSinceEpoch}';
    final hash = seed.hashCode.abs();
    final swatch = avatarColorOptions[hash % avatarColorOptions.length];
    final basePreset =
        avatarBasePersonPresets[hash % avatarBasePersonPresets.length];
    return avatarLookPresets[hash % avatarLookPresets.length]
        .applyTo(_config)
        .copyWith(
          variant: hash,
          gender: avatarGenderOptions[hash % avatarGenderOptions.length].value,
          baseAppearance: basePreset.value,
          bodyType: avatarBodyOptions[hash % avatarBodyOptions.length].value,
          height: avatarHeightOptions[(hash ~/ 2) % avatarHeightOptions.length]
              .value,
          skinTone: basePreset.skinTone,
          hairStyle: avatarHairStyleOptions[
                  (hash ~/ 5) % avatarHairStyleOptions.length]
              .value,
          hairColor: avatarHairColorOptions[
                  (hash ~/ 7) % avatarHairColorOptions.length]
              .value,
          primaryColor: swatch.primary,
          secondaryColor: swatch.secondary,
        );
  }
}

class _OptionSection extends StatelessWidget {
  final String title;
  final List<AvatarOption> options;
  final String selectedValue;
  final ValueChanged<String> onSelected;
  final Color? Function(String value)? colorForValue;

  const _OptionSection({
    required this.title,
    required this.options,
    required this.selectedValue,
    required this.onSelected,
    this.colorForValue,
  });

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: title,
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: options.map((option) {
          return _ChoicePill(
            label: option.label,
            selected: option.value == selectedValue,
            swatchColor: colorForValue?.call(option.value),
            onTap: () => onSelected(option.value),
          );
        }).toList(),
      ),
    );
  }
}

class _ChoicePill extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color? swatchColor;

  const _ChoicePill({
    required this.label,
    required this.selected,
    required this.onTap,
    this.swatchColor,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: selected
              ? const Color(0xFFFF6B35).withValues(alpha: .18)
              : const Color(0xFF1F2937),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected
                ? const Color(0xFFFFB067)
                : Colors.white.withValues(alpha: .1),
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (swatchColor != null) ...[
              Container(
                width: 15,
                height: 15,
                decoration: BoxDecoration(
                  color: swatchColor,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Colors.white.withValues(alpha: .45),
                  ),
                ),
              ),
              const SizedBox(width: 8),
            ],
            Text(
              label,
              style: TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: selected ? FontWeight.w900 : FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final Widget child;

  const _Section({
    required this.title,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

Color? _hexColor(String value) {
  final hex = value.trim().replaceFirst('#', '');
  if (hex.length != 6) return null;
  final parsed = int.tryParse(hex, radix: 16);
  return parsed == null ? null : Color(0xFF000000 | parsed);
}

class _IconAction extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;

  const _IconAction({
    required this.icon,
    required this.onTap,
    required this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: 38,
          height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFF1F2937),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          ),
          child: Icon(icon, color: Colors.white, size: 20),
        ),
      ),
    );
  }
}
