import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../services/profile_service.dart';
import '../services/api_service.dart';
import '../state/onboarding_checklist_state.dart';
import '../utils/image_utils.dart';

class ProfileSetupScreen extends StatefulWidget {
  const ProfileSetupScreen({super.key});

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
  String? _profilePictureUrl;
  File? _imageFile;
  bool _loading = true;

  // Track if fields have been touched for validation UI
  bool _firstNameTouched = false;
  bool _lastNameTouched = false;
  bool _cityTouched = false;

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
        if ((fName == 'New' && lName == 'Player') || fName == 'Unknown') {
          fName = '';
          lName = '';
        }
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

      if ((firstName == 'New' && lastName == 'Player') ||
          firstName == 'Unknown') {
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

      setState(() {
        _firstNameCtrl.text = firstName;
        _lastNameCtrl.text = lastName;
        _birthdate = existing?.birthdate;
        _cityCtrl.text = existing?.city ?? '';
        _selectedBadges = existing != null ? List.from(existing.badges) : [];
        _ft = existingHeightFt;
        _inch = existingHeightIn;
        _pos = existingPosition;
        _profilePictureUrl =
            auth.currentUser?.photoUrl ?? existing?.profilePictureUrl;
        _loading = false;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  Future<void> _pickImage() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt, color: Color(0xFFFF6B35)),
              title: const Text('Take a Photo'),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
            ListTile(
              leading:
                  const Icon(Icons.photo_library, color: Color(0xFFFF6B35)),
              title: const Text('Choose from Gallery'),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (source == null) return;

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
        // For now, we'll just use the local path as the URL.
        // In a real app, you'd upload this to storage and get a URL.
        _profilePictureUrl = pickedFile.path;
      });
    }
  }

  bool _saving = false;

  Future<void> _save() async {
    if (_saving) return;

    setState(() => _saving = true);

    try {
      final auth = context.read<AuthState>();
      final userId = auth.currentUser?.id;
      final playerId = auth.currentUser?.id;

      if (userId != null && playerId != null) {
        // Upload image via the proper upload endpoint if a new one was selected
        String? avatarUrl;
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
            }
          } catch (e) {
            debugPrint('Failed to upload profile photo: $e');
          }
        } else if (_profilePictureUrl != null &&
            !_profilePictureUrl!.startsWith('/') &&
            !_profilePictureUrl!.startsWith('data:')) {
          // Keep existing network URL (but not data: URIs)
          avatarUrl = _profilePictureUrl;
        }

        // Save profile data including avatar via API
        final profileUpdates = <String, dynamic>{
          'name': '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}',
          'city': _cityCtrl.text.trim(),
          'badges': _selectedBadges,
          'position': _pos,
          'height': "$_ft'$_inch\"",
        };
        if (avatarUrl != null) {
          profileUpdates['avatarUrl'] = avatarUrl;
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
          profilePictureUrl: avatarUrl ?? _profilePictureUrl,
          visibility: _visibility,
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
        final fullName =
            '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}'.trim();
        final effectivePhotoUrl = avatarUrl ?? _profilePictureUrl;
        await auth.updateUserPosition(
          _pos,
          height: "$_ft'$_inch\"",
          name: fullName.isNotEmpty ? fullName : null,
          photoUrl: effectivePhotoUrl,
          city: _cityCtrl.text.trim().isEmpty ? null : _cityCtrl.text.trim(),
          badges: _selectedBadges,
        );
        debugPrint('Local user position updated to: $_pos');

        // Mark the checklist item as complete if they edit their profile.
        if (mounted) {
          context
              .read<OnboardingChecklistState>()
              .completeItem(OnboardingItems.setupProfile);
          context.go('/play');
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

  @override
  Widget build(BuildContext context) {
    if (_loading)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));

    // City is optional. If provided, it accepts any text.
    final cityValid = true; // City is optional
    final nameValid = _firstNameCtrl.text.trim().isNotEmpty &&
        _lastNameCtrl.text.trim().isNotEmpty;
    // Only name is required — City is optional (GPS provides location)
    final canSave = nameValid && cityValid;

    return Scaffold(
      appBar: AppBar(title: const Text('Setup Profile')),
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

            // Profile Picture
            Center(
              child: GestureDetector(
                onTap: _pickImage,
                child: Stack(
                  children: [
                    Container(
                      width: 110,
                      height: 110,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFF2C3E50),
                        border: Border.all(
                          color: const Color(0xFFFF6B35),
                          width: 3,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFFF6B35).withOpacity(0.3),
                            blurRadius: 8,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                      child: ClipOval(
                        child: _imageFile != null
                            ? Image.file(_imageFile!,
                                fit: BoxFit.cover, width: 110, height: 110)
                            : (_profilePictureUrl != null &&
                                    !_profilePictureUrl!.startsWith('/'))
                                ? Image(
                                    image:
                                        safeImageProvider(_profilePictureUrl!),
                                    fit: BoxFit.cover,
                                    width: 110,
                                    height: 110,
                                    errorBuilder: (_, __, ___) => Icon(
                                      Icons.person,
                                      color: Colors.grey.shade600,
                                      size: 40,
                                    ),
                                  )
                                : Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.person,
                                          color: Colors.grey.shade600,
                                          size: 40),
                                      const SizedBox(height: 4),
                                      Text('Add Photo',
                                          style: TextStyle(
                                              color: Colors.grey.shade600,
                                              fontSize: 11)),
                                    ],
                                  ),
                      ),
                    ),
                    // Camera overlay icon
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFF6B35),
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: const Color(0xFF1A252F), width: 2),
                        ),
                        child: const Icon(Icons.camera_alt,
                            color: Colors.white, size: 18),
                      ),
                    ),
                  ],
                ),
              ),
            ),
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
              onChanged: (_) => setState(() => _firstNameTouched = true),
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
              onChanged: (_) => setState(() => _lastNameTouched = true),
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
                        value: _ft,
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
                        value: _inch,
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
                      if (s) setState(() => _pos = p);
                    },
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 32),

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
                  selectedColor: Colors.deepOrange.withOpacity(0.2),
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
            const SizedBox(height: 32),

            // Save
            SizedBox(
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
                          valueColor:
                              AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Text('Save & Continue'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
