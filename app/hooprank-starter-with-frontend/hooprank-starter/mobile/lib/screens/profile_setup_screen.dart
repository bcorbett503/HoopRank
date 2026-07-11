import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../navigation/auth_redirect.dart';
import '../services/profile_service.dart';
import '../services/api_service.dart';
import '../services/analytics_service.dart';
import '../state/onboarding_checklist_state.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../utils/flat_avatar.dart';
import '../utils/generated_avatar.dart';
import '../utils/neutral_avatar_svg.dart';
import '../widgets/avatar_render_stage.dart';
import 'avatar_lab_screen.dart';

class ProfileSetupScreen extends StatefulWidget {
  const ProfileSetupScreen({
    super.key,
    this.returnTo,
  });

  final String? returnTo;

  @override
  State<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends State<ProfileSetupScreen> {
  final TextEditingController _firstNameCtrl = TextEditingController();
  final TextEditingController _lastNameCtrl = TextEditingController();
  final TextEditingController _cityCtrl = TextEditingController();
  List<String> _selectedBadges = [];

  final List<String> _availableBadges = const [
    // Scorers & Shooters
    'Bucket', 'Sniper', 'Middy', 'Deep Bag', 'Slasher', 'Microwave', 'Clutch',
    // Playmakers & Handlers
    'Handles', 'Dimes', 'Floor General', 'Ankle Breaker', 'Pace Pusher',
    // Defenders & Hustlers
    'Lock Down', 'Shot Blocker', 'Pick Pocket', 'Hustle', 'Glue Guy', 'Pest',
    // Bigs & Rebounders
    'Big', 'Glass Cleaner', 'Paint Beast', 'Stretch Big', 'Lob Threat',
    // Hybrids
    '3&D', 'Two-Way', 'Point Forward', 'Combo Guard',
  ];

  DateTime? _birthdate;
  int _ft = 6;
  int _inch = 0;
  String _pos = 'G';
  String _visibility = 'public';
  bool _acceptingChallenges = true;
  String? _profilePictureUrl;
  Map<String, dynamic>? _avatarConfig;
  File? _imageFile;
  bool _photoRemoved =
      false; // user explicitly removed their photo this session
  bool _loading = true;

  // Track if fields have been touched for validation UI
  bool _firstNameTouched = false;
  bool _lastNameTouched = false;
  bool _cityTouched = false;

  bool _isPlaceholderName(String firstName, String lastName) {
    final full = '$firstName $lastName'.trim();
    if ((firstName == 'New' && lastName == 'Player') ||
        firstName == 'Unknown') {
      return true;
    }
    return full.startsWith('HoopRank Player');
  }

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _cityCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    final auth = context.read<AuthState>();
    final userId = auth.currentUser?.id;
    final isFirstTimeSetup =
        auth.currentUser != null && !auth.currentUser!.isProfileComplete;

    if (userId != null) {
      final existing = await ProfileService.getProfile(userId);
      // For first-login/profile-creation we intentionally do NOT prefill the
      // text fields. The user should see hint/placeholder text (so they don't
      // have to delete random values), while still benefiting from their
      // provider avatar if available.
      if (existing != null && !isFirstTimeSetup) {
        var fName = existing.firstName;
        var lName = existing.lastName;
        if (_isPlaceholderName(fName, lName)) {
          fName = '';
          lName = '';
        }
        final existingAvatarConfig =
            auth.currentUser?.avatarConfig ?? existing.avatarConfig;
        final hasAvatarConfig = isFlatAvatarConfig(existingAvatarConfig) ||
            isGeneratedAvatarConfig(existingAvatarConfig);
        setState(() {
          _firstNameCtrl.text = fName;
          _lastNameCtrl.text = lName;
          _birthdate = existing.birthdate;
          _cityCtrl.text = existing.city;
          _selectedBadges = List.from(existing.badges);
          _ft = existing.heightFt.clamp(4, 7);
          _inch = existing.heightIn.clamp(0, 11);
          _pos = existing.position;
          _visibility = existing.visibility;
          _acceptingChallenges = existing.acceptingChallenges;
          // Avatar is the primary identity; the photo (if any) is optional.
          _avatarConfig = hasAvatarConfig ? existingAvatarConfig : null;
          _profilePictureUrl = existing.profilePictureUrl;
          _loading = false;
        });
        return;
      }

      // First-time setup: pre-fill name from the auth provider (Apple/Google)
      // so the user doesn't have to re-type what they already provided.
      final fullName = auth.currentUser?.name ?? '';
      final nameParts = fullName.trim().split(RegExp(r'\s+'));
      var firstName = nameParts.isNotEmpty ? nameParts.first : '';
      var lastName = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '';

      if (_isPlaceholderName(firstName, lastName)) {
        firstName = '';
        lastName = '';
      }
      final existingHeightFt =
          existing != null ? existing.heightFt.clamp(4, 7) : 6;
      final existingHeightIn =
          existing != null ? existing.heightIn.clamp(0, 11) : 0;
      final existingPosition = (existing?.position.trim().isNotEmpty == true)
          ? existing!.position
          : 'G';
      final initialPhoto =
          auth.currentUser?.photoUrl ?? existing?.profilePictureUrl;
      final authAvatarConfig =
          auth.currentUser?.avatarConfig ?? existing?.avatarConfig;
      // New players start on the neutral avatar (Customize Look sets it);
      // keep an existing flat/generated avatar if they have one.
      final startingAvatarConfig = (isFlatAvatarConfig(authAvatarConfig) ||
              isGeneratedAvatarConfig(authAvatarConfig))
          ? Map<String, dynamic>.from(authAvatarConfig!)
          : null;

      setState(() {
        _firstNameCtrl.text = firstName;
        _lastNameCtrl.text = lastName;
        _birthdate = existing?.birthdate;
        _cityCtrl.text = existing?.city ?? '';
        _selectedBadges = existing != null ? List.from(existing.badges) : [];
        _ft = existingHeightFt;
        _inch = existingHeightIn;
        _pos = existingPosition;
        _acceptingChallenges = existing?.acceptingChallenges ??
            auth.currentUser?.acceptingChallenges ??
            true;
        _avatarConfig = startingAvatarConfig;
        _profilePictureUrl = initialPhoto;
        _loading = false;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  /// True when an optional profile photo has been set (a picked file or a
  /// real image URL — not an avatar data URL).
  bool get _hasPhoto {
    if (_imageFile != null) return true;
    final u = _profilePictureUrl;
    return u != null && (u.startsWith('http://') || u.startsWith('https://'));
  }

  /// Add/replace the OPTIONAL profile photo. The avatar stays as the primary
  /// identity (Snapchat-style) and is never cleared here.
  Future<void> _pickImage() async {
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt, color: Color(0xFFFF6B35)),
              title: const Text('Take a Photo'),
              onTap: () => Navigator.pop(context, 'camera'),
            ),
            ListTile(
              leading:
                  const Icon(Icons.photo_library, color: Color(0xFFFF6B35)),
              title: const Text('Choose from Gallery'),
              onTap: () => Navigator.pop(context, 'gallery'),
            ),
            if (_hasPhoto)
              ListTile(
                leading:
                    const Icon(Icons.delete_outline, color: Colors.white70),
                title: const Text('Remove Photo'),
                onTap: () => Navigator.pop(context, 'remove'),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (action == null) return;
    if (action == 'remove') {
      setState(() {
        _imageFile = null;
        _profilePictureUrl = null;
        _photoRemoved = true;
      });
      return;
    }

    final source =
        action == 'camera' ? ImageSource.camera : ImageSource.gallery;

    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(
      source: source,
      maxWidth: 512,
      maxHeight: 512,
      imageQuality: 75,
    );

    if (pickedFile != null) {
      setState(() {
        _imageFile = File(pickedFile.path);
        // Photo is optional and additive; keep the avatar as the main identity.
        _profilePictureUrl = pickedFile.path;
        _photoRemoved = false;
      });
    }
  }

  Future<void> _openAvatarCreator() async {
    final result = await Navigator.of(context).push<AvatarLabResult>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => AvatarLabScreen(
          initialConfig:
              isFlatAvatarConfig(_avatarConfig) ? _avatarConfig : null,
        ),
      ),
    );

    if (!mounted || result == null) return;
    setState(() {
      _imageFile = null;
      _avatarConfig = {
        ...result.config,
        'schema': flatAvatarSchema,
        'svg': result.svg,
      };
      // Keep a real photo URL, but drop any stale legacy generated-avatar
      // data URL sitting in _profilePictureUrl — otherwise it would be saved
      // as the photo. Real photos are http(s); generated ones are data:/local.
      final p = _profilePictureUrl;
      if (p != null && !(p.startsWith('http://') || p.startsWith('https://'))) {
        _profilePictureUrl = null;
      }
    });

    // "Save avatar" must stick immediately: persisting only on the profile's
    // Save & Continue silently reverted the new look whenever the user backed
    // out of this screen instead. Failure is non-fatal — Save & Continue
    // still carries the config with the rest of the profile.
    final auth = context.read<AuthState>();
    final userId = auth.currentUser?.id;
    if (userId != null && _avatarConfig != null) {
      try {
        await ApiService.updateProfile(userId, {'avatarConfig': _avatarConfig});
        await auth.refreshUser();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Avatar saved')),
          );
        }
      } catch (e) {
        debugPrint(
            'Immediate avatar save failed (profile save will retry): $e');
      }
    }
  }

  String _currentAvatarLabel() {
    final label =
        '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}'.trim();
    if (label.isNotEmpty) return label;
    final currentName = context.read<AuthState>().currentUser?.name.trim();
    if (currentName != null &&
        currentName.isNotEmpty &&
        !_isPlaceholderName(currentName.split(' ').first,
            currentName.split(' ').skip(1).join(' '))) {
      return currentName;
    }
    return '';
  }

  void _syncGeneratedAvatarPreview({bool promoteNewPlayer = false}) {
    if (_avatarConfig == null || _imageFile != null) return;
    if (isFlatAvatarConfig(_avatarConfig)) return;
    final current = HoopRankAvatarConfig.fromJson(_avatarConfig!);
    final label = _currentAvatarLabel();
    final shouldStayNewPlayer =
        current.isNewPlayer && !promoteNewPlayer && label.isEmpty;
    final next = current.copyWith(
      label: shouldStayNewPlayer
          ? newPlayerAvatarLabel
          : (label.isEmpty ? 'HoopRank Player' : label),
      position: _pos,
      isNewPlayer: shouldStayNewPlayer,
    );
    _avatarConfig = next.toJson();
    _profilePictureUrl = next.toDataUrl();
  }

  String _avatarOptionLabel(List<AvatarOption> options, String value) {
    return options
        .firstWhere(
          (option) => option.value == value,
          orElse: () => options.first,
        )
        .label;
  }

  bool _saving = false;

  String _resolveReturnToPath() {
    return sanitizeAuthReturnToPath(widget.returnTo);
  }

  String _buildClaimAccountRoute() {
    return buildClaimAccountRoute(
      returnTo: _resolveReturnToPath(),
    );
  }

  Future<void> _save() async {
    if (_saving) return;

    setState(() => _saving = true);

    try {
      final auth = context.read<AuthState>();
      if (auth.isAnonymousSession) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Save your account with Apple or Google before finishing profile setup.',
              ),
            ),
          );
          context.go(_buildClaimAccountRoute());
        }
        return;
      }

      final userId = auth.currentUser?.id;
      final playerId = auth.currentUser?.id;
      final wasProfileComplete = auth.currentUser?.isProfileComplete ?? false;

      if (userId != null && playerId != null) {
        final profileName =
            '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}'.trim();
        // Stamp identity onto a legacy generated avatar before saving. The
        // photo (_profilePictureUrl) is left untouched — it's optional and
        // independent of the avatar.
        if (_avatarConfig != null && !isFlatAvatarConfig(_avatarConfig)) {
          final avatar = HoopRankAvatarConfig.fromJson(_avatarConfig!);
          final completedAvatar = avatar.copyWith(
            label: profileName.isEmpty ? 'HoopRank Player' : profileName,
            position: _pos,
            isNewPlayer: false,
          );
          _avatarConfig = completedAvatar.toJson();
        }

        // Upload image via the proper upload endpoint if a new one was selected
        String? avatarUrl;
        bool photoUploadFailed = false;
        if (_imageFile != null) {
          try {
            final uploadedUrl = await ApiService.uploadImage(
              type: 'avatar',
              targetId: userId,
              imageFile: _imageFile!,
            );
            if (uploadedUrl != null) {
              avatarUrl = uploadedUrl;
              debugPrint('Profile photo uploaded: $avatarUrl');
            } else {
              debugPrint('Profile photo upload returned null');
              photoUploadFailed = true;
            }
          } catch (e) {
            debugPrint('Failed to upload profile photo: $e');
            photoUploadFailed = true;
          }
        }

        // The photo to persist must be a real remote URL — never a device-local
        // path (starts with '/') or a generated data: URL.
        String? resolvedPhotoUrl = avatarUrl;
        if (resolvedPhotoUrl == null &&
            _profilePictureUrl != null &&
            (_profilePictureUrl!.startsWith('http://') ||
                _profilePictureUrl!.startsWith('https://'))) {
          resolvedPhotoUrl = _profilePictureUrl;
        }
        // Explicit removal (or a failed upload leaving no valid photo) should
        // clear the server value, not silently keep the old one.
        final clearPhoto =
            resolvedPhotoUrl == null && (_photoRemoved || photoUploadFailed);

        if (photoUploadFailed && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text(
                    'Photo upload failed — your profile was saved without it.')),
          );
        }

        // Save profile data including avatar via API
        final profileUpdates = <String, dynamic>{
          'name': profileName,
          'city': _cityCtrl.text.trim(),
          'badges': _selectedBadges,
          'position': _pos,
          'height': "$_ft'$_inch\"",
          'acceptingChallenges': _acceptingChallenges,
        };
        if (resolvedPhotoUrl != null) {
          profileUpdates['avatarUrl'] = resolvedPhotoUrl;
        } else if (clearPhoto) {
          profileUpdates['avatarUrl'] = '';
        }
        if (_avatarConfig != null) {
          profileUpdates['avatarConfig'] = _avatarConfig;
        }

        // Persist flat avatars to the dedicated endpoint as well; tolerate
        // backends that don't have it yet (config still saves locally).
        if (isFlatAvatarConfig(_avatarConfig)) {
          try {
            await ApiService.updateAvatar(userId, _avatarConfig!);
          } catch (e) {
            debugPrint('Avatar endpoint unavailable (continuing): $e');
          }
        }

        try {
          await ApiService.updateProfile(userId, profileUpdates);
          debugPrint('Profile updated successfully');
        } catch (e) {
          debugPrint('Profile update failed: $e');
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                  content: Text('Failed to save profile: $e'),
                  backgroundColor: Colors.red),
            );
            setState(() => _saving = false);
            return;
          }
        }

        final data = ProfileData(
          firstName: _firstNameCtrl.text.trim(),
          lastName: _lastNameCtrl.text.trim(),
          birthdate: _birthdate,
          city: _cityCtrl.text.trim(),
          badges: _selectedBadges,
          heightFt: _ft,
          heightIn: _inch,
          position: _pos,
          profilePictureUrl: resolvedPhotoUrl,
          avatarConfig: _avatarConfig,
          visibility: _visibility,
          acceptingChallenges: _acceptingChallenges,
        );
        await ProfileService.saveProfile(userId, data);
        ProfileService.applyProfileToPlayer(playerId, data);

        // Refresh user data from API to update the app state
        try {
          await auth.refreshUser();
        } catch (e) {
          debugPrint('Refresh user failed (continuing anyway): $e');
        }

        // Keep local user profile coherent even when the refresh endpoint is stale/unavailable.
        final fullName = profileName;
        // Pass the cleared value ('') through so the local cache drops the old
        // photo too; otherwise keep the resolved remote URL (null = unchanged).
        final effectivePhotoUrl = resolvedPhotoUrl ?? (clearPhoto ? '' : null);
        await auth.updateUserPosition(
          _pos,
          height: "$_ft'$_inch\"",
          name: fullName.isNotEmpty ? fullName : null,
          photoUrl: effectivePhotoUrl,
          city: _cityCtrl.text.trim().isEmpty ? null : _cityCtrl.text.trim(),
          badges: _selectedBadges,
          avatarConfig: _avatarConfig,
          acceptingChallenges: _acceptingChallenges,
        );
        if (!wasProfileComplete) {
          await AnalyticsService.logRegistrationCompletedOnce(
            userId: userId,
            provider: 'profile_setup',
          );
        }
        debugPrint('Local user position updated to: $_pos');

        // Mark the checklist item as complete if they edit their profile.
        if (mounted) {
          context
              .read<OnboardingChecklistState>()
              .completeItem(OnboardingItems.setupProfile);
          context.go(_resolveReturnToPath());
        }
      }
    } catch (e) {
      debugPrint('Profile save error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  int _calculateAge(DateTime birthdate) {
    final now = DateTime.now();
    int age = now.year - birthdate.year;
    if (now.month < birthdate.month ||
        (now.month == birthdate.month && now.day < birthdate.day)) {
      age--;
    }
    return age;
  }

  /// Builds a field label with optional red/green validation indicator
  Widget _buildFieldLabel(String label, bool isValid, bool isTouched,
      {bool required = false, bool optional = false}) {
    Widget? indicator;

    if (required && isTouched) {
      // Required field: show indicator once touched
      indicator = Icon(
        isValid ? Icons.check_circle : Icons.cancel,
        color: isValid ? Colors.green : Colors.red,
        size: 16,
      );
    } else if (!required && isValid) {
      // Optional field: only show green check if filled
      indicator = const Icon(
        Icons.check_circle,
        color: Colors.green,
        size: 16,
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(color: Colors.grey, fontSize: 12),
          ),
          if (optional)
            const Text(
              ' (optional)',
              style: TextStyle(
                  color: Colors.grey,
                  fontSize: 12,
                  fontStyle: FontStyle.italic),
            ),
          if (indicator != null) ...[
            const SizedBox(width: 6),
            indicator,
          ],
        ],
      ),
    );
  }

  Widget _buildAvatarSetupSection() {
    final generatedAvatar = isGeneratedAvatarConfig(_avatarConfig)
        ? HoopRankAvatarConfig.fromJson(_avatarConfig!)
        : null;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: const Color(0xFFFF6B35).withValues(alpha: 0.26),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.sports_basketball, color: Color(0xFFFF6B35)),
              SizedBox(width: 8),
              Text(
                'Avatar',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            height: 320,
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(14),
            ),
            // Avatar is always the main preview; an optional photo shows as a
            // small badge in the corner (Snapchat-style).
            child: Stack(
              children: [
                Positioned.fill(
                  child: _buildAvatarPreview(generatedAvatar != null),
                ),
                if (_hasPhoto)
                  Positioned(
                    right: 4,
                    bottom: 4,
                    child: GestureDetector(
                      onTap: _pickImage,
                      child: Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: const Color(0xFFFF6B35), width: 2),
                          image: DecorationImage(
                            fit: BoxFit.cover,
                            image: _imageFile != null
                                ? FileImage(_imageFile!)
                                : NetworkImage(_profilePictureUrl!)
                                    as ImageProvider,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (generatedAvatar != null) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _buildAvatarTag(
                  Icons.checkroom,
                  _avatarOptionLabel(
                    avatarOutfitOptions,
                    generatedAvatar.outfit,
                  ),
                ),
                _buildAvatarTag(
                  Icons.sports_handball,
                  _avatarOptionLabel(
                    avatarStanceOptions,
                    generatedAvatar.stance,
                  ),
                ),
                _buildAvatarTag(
                  Icons.groups_2,
                  _avatarOptionLabel(
                    avatarBaseAppearanceOptions,
                    generatedAvatar.baseAppearance,
                  ),
                ),
                _buildAvatarTag(
                  Icons.person,
                  _avatarOptionLabel(
                    avatarGenderOptions,
                    generatedAvatar.gender,
                  ),
                ),
                _buildAvatarTag(
                  Icons.face_retouching_natural,
                  _avatarOptionLabel(
                    avatarHairStyleOptions,
                    generatedAvatar.hairStyle,
                  ),
                ),
                _buildAvatarTag(
                  Icons.fitness_center,
                  _avatarOptionLabel(
                    avatarBodyOptions,
                    generatedAvatar.bodyType,
                  ),
                ),
                _buildAvatarTag(
                  Icons.height,
                  _avatarOptionLabel(
                    avatarHeightOptions,
                    generatedAvatar.height,
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _openAvatarCreator,
              icon: const Icon(Icons.auto_awesome, size: 18),
              label: const Text('Customize Look'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFF6B35),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: TextButton.icon(
              onPressed: _pickImage,
              icon: const Icon(Icons.photo_camera_outlined, size: 17),
              label:
                  Text(_hasPhoto ? 'Change photo' : 'Add a photo (optional)'),
              style: TextButton.styleFrom(
                foregroundColor: Colors.white70,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // The avatar is always the main preview; a photo, if set, only appears as an
  // optional corner badge (handled by the caller).
  Widget _buildAvatarPreview(bool generatedAvatar) {
    final flatSvg = flatAvatarSvg(_avatarConfig);
    if (flatSvg != null) {
      return Center(
        child: SvgPicture.string(
          flatSvg,
          fit: BoxFit.contain,
          height: double.infinity,
        ),
      );
    }

    // Legacy generated-avatar config: keep rendering it via the render stage.
    if (generatedAvatar) {
      final modelSpec = generatedAvatarModelSpec(
        _avatarConfig,
        allowDevelopmentBaseRig: debugPrototypeAvatarModelsEnabled,
      );
      return AvatarRenderStage(
        imageUrl: generatedAvatarDataUrl(_avatarConfig!),
        modelUrl: modelSpec?.url,
        modelPosterUrl: modelSpec?.posterUrl,
        modelAnimationName: modelSpec?.animationName,
        modelCameraOrbit: modelSpec?.cameraOrbit,
        modelCameraTarget: modelSpec?.cameraTarget,
        modelFieldOfView: modelSpec?.fieldOfView,
        modelScale: modelSpec?.scale,
        avatarScale: generatedAvatarPreviewScale(_avatarConfig),
        avatarConfig: _avatarConfig,
        preferModelViewer: modelSpec != null,
        allowDevelopmentAvatarSprite: debugPrototypeAvatarModelsEnabled,
        fallback: const Center(
          child: Icon(Icons.person, color: Colors.white54, size: 72),
        ),
      );
    }

    // Nothing customized yet: show the neutral avatar awaiting customization.
    return Center(
      child: SvgPicture.string(
        neutralAvatarSvg,
        fit: BoxFit.contain,
        height: double.infinity,
      ),
    );
  }

  Widget _buildAvatarTag(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: const Color(0xFFFFB067), size: 14),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    // City is optional. If provided, it accepts any text.
    const cityValid = true; // City is optional
    final nameValid = _firstNameCtrl.text.trim().isNotEmpty &&
        _lastNameCtrl.text.trim().isNotEmpty;
    // Only name is required — City is optional (GPS provides location)
    final canSave = nameValid && cityValid;

    return Scaffold(
      appBar: AppBar(title: const Text('Setup Profile')),
      // Save & Continue floats above the scroll content: buried at the
      // bottom of the page, users never found it and got stuck here.
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: canSave && !_saving ? _save : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.deepOrange,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: _saving
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : const Text('Save & Continue'),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Set up your profile',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'We use this to place you on local leaderboards. You can change it later.',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 24),
            _buildAvatarSetupSection(),
            const SizedBox(height: 24),

            // First Name
            _buildFieldLabel('First Name',
                _firstNameCtrl.text.trim().isNotEmpty, _firstNameTouched,
                required: true),
            TextField(
              controller: _firstNameCtrl,
              decoration: const InputDecoration(
                hintText: 'e.g. John',
                border: OutlineInputBorder(),
              ),
              textCapitalization: TextCapitalization.words,
              onChanged: (_) => setState(() {
                _firstNameTouched = true;
                _syncGeneratedAvatarPreview(promoteNewPlayer: true);
              }),
            ),
            const SizedBox(height: 16),

            // Last Name
            _buildFieldLabel('Last Name', _lastNameCtrl.text.trim().isNotEmpty,
                _lastNameTouched,
                required: true),
            TextField(
              controller: _lastNameCtrl,
              decoration: const InputDecoration(
                hintText: 'e.g. Doe',
                border: OutlineInputBorder(),
              ),
              textCapitalization: TextCapitalization.words,
              onChanged: (_) => setState(() {
                _lastNameTouched = true;
                _syncGeneratedAvatarPreview(promoteNewPlayer: true);
              }),
            ),
            const SizedBox(height: 24),

            const Divider(),
            const SizedBox(height: 16),
            const Text('Player Details',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),

            // Birthdate (Optional per App Store Guideline 5.1.1)
            _buildFieldLabel('Birthday', _birthdate != null, true,
                required: false, optional: true),
            const SizedBox(height: 8),
            InkWell(
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate:
                      _birthdate ?? DateTime(DateTime.now().year - 25, 1, 1),
                  firstDate: DateTime(1940),
                  lastDate:
                      DateTime.now().subtract(const Duration(days: 365 * 13)),
                  helpText: 'Select your birthday',
                  initialEntryMode: DatePickerEntryMode.input,
                );
                if (picked != null) {
                  setState(() => _birthdate = picked);
                }
              },
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade400),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _birthdate != null
                          ? DateFormat('MMMM d, yyyy').format(_birthdate!)
                          : 'Select your birthday',
                      style: TextStyle(
                        color: _birthdate != null ? Colors.white : Colors.grey,
                      ),
                    ),
                    const Icon(Icons.calendar_today, color: Colors.grey),
                  ],
                ),
              ),
            ),
            if (_birthdate != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  '${_calculateAge(_birthdate!)} years old',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            const SizedBox(height: 16),

            // City - Optional, GPS handles location (App Store Guidelines 5.1.1 & 2.1)
            _buildFieldLabel(
                'City', _cityCtrl.text.trim().isNotEmpty, _cityTouched,
                required: false, optional: true),
            TextField(
              controller: _cityCtrl,
              decoration: const InputDecoration(
                hintText: 'e.g. San Francisco, CA',
                helperText: 'Optional — we can use your GPS location instead',
                helperStyle: TextStyle(color: Colors.grey, fontSize: 11),
                border: OutlineInputBorder(),
              ),
              textCapitalization: TextCapitalization.words,
              onChanged: (_) => setState(() => _cityTouched = true),
            ),
            const SizedBox(height: 16),

            // Height
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Height (ft)',
                          style: TextStyle(color: Colors.grey, fontSize: 12)),
                      DropdownButtonFormField<int>(
                        initialValue: _ft,
                        items: [4, 5, 6, 7]
                            .map((h) => DropdownMenuItem(
                                value: h, child: Text('$h ft')))
                            .toList(),
                        onChanged: (val) => setState(() => _ft = val!),
                        decoration:
                            const InputDecoration(border: OutlineInputBorder()),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Height (in)',
                          style: TextStyle(color: Colors.grey, fontSize: 12)),
                      DropdownButtonFormField<int>(
                        initialValue: _inch,
                        items: List.generate(12, (i) => i)
                            .map((h) => DropdownMenuItem(
                                value: h, child: Text('$h in')))
                            .toList(),
                        onChanged: (val) => setState(() => _inch = val!),
                        decoration:
                            const InputDecoration(border: OutlineInputBorder()),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Position
            const Text('Position',
                style: TextStyle(color: Colors.grey, fontSize: 12)),
            const SizedBox(height: 8),
            Row(
              children: ['G', 'F', 'C'].map((p) {
                final selected = _pos == p;
                return Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: ChoiceChip(
                    label: Text(p),
                    selected: selected,
                    onSelected: (s) {
                      if (s) {
                        setState(() {
                          _pos = p;
                          _syncGeneratedAvatarPreview(promoteNewPlayer: true);
                        });
                      }
                    },
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 32),

            SwitchListTile.adaptive(
              value: _acceptingChallenges,
              contentPadding: EdgeInsets.zero,
              activeThumbColor: const Color(0xFFFF6B35),
              title: const Text(
                'Accepting Challenges',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
              subtitle: Text(
                _acceptingChallenges
                    ? 'Challenge-ready on the map'
                    : 'Hidden from challenge-ready highlights',
                style: TextStyle(color: Colors.grey[500], fontSize: 12),
              ),
              onChanged: (value) {
                setState(() => _acceptingChallenges = value);
              },
            ),
            const SizedBox(height: 16),

            // Badges
            const Text('Player Badges',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text(
              'Select up to 3 badges that define your playstyle.',
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8.0,
              runSpacing: 8.0,
              children: _availableBadges.map((badge) {
                final isSelected = _selectedBadges.contains(badge);
                return FilterChip(
                  label: Text(badge),
                  selected: isSelected,
                  selectedColor: Colors.deepOrange.withValues(alpha: 0.2),
                  checkmarkColor: Colors.deepOrange,
                  side: BorderSide(
                    color:
                        isSelected ? Colors.deepOrange : Colors.grey.shade300,
                  ),
                  onSelected: (bool selected) {
                    setState(() {
                      if (selected) {
                        if (_selectedBadges.length < 3) {
                          _selectedBadges.add(badge);
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content:
                                    Text('You can only select up to 3 badges.'),
                                duration: Duration(seconds: 2)),
                          );
                        }
                      } else {
                        _selectedBadges.remove(badge);
                      }
                    });
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
