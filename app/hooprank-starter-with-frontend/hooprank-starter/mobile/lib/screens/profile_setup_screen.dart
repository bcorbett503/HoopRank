import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../services/mock_data.dart';
import '../services/profile_service.dart';
import '../services/api_service.dart';

class ProfileSetupScreen extends StatefulWidget {
  const ProfileSetupScreen({super.key});

  @override
  State<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends State<ProfileSetupScreen> {
  final TextEditingController _firstNameCtrl = TextEditingController();
  final TextEditingController _lastNameCtrl = TextEditingController();
  final TextEditingController _zipCtrl = TextEditingController();
  DateTime? _birthdate;
  int _ft = 6;
  int _inch = 0;
  String _pos = 'G';
  String _visibility = 'public';
  String? _profilePictureUrl;
  File? _imageFile;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _zipCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    final auth = context.read<AuthState>();
    final userId = auth.currentUser?.id;
    final playerId = auth.currentUser?.id;

    if (userId != null && playerId != null) {
      final existing = await ProfileService.getProfile(userId);
      if (existing != null) {
        setState(() {
          _firstNameCtrl.text = existing.firstName;
          _lastNameCtrl.text = existing.lastName;
          _birthdate = existing.birthdate;
          _zipCtrl.text = existing.zip;
          _ft = existing.heightFt.clamp(4, 7);
          _inch = existing.heightIn.clamp(0, 11);
          _pos = existing.position;
          _visibility = existing.visibility;
          _profilePictureUrl = existing.profilePictureUrl;
          _loading = false;
        });
        return;
      }

      // Fallback to mock player data
      try {
        final p = mockPlayers.firstWhere((p) => p.id == playerId);
        final nameParts = p.name.split(' ');
        setState(() {
          _firstNameCtrl.text = nameParts.isNotEmpty ? nameParts[0] : '';
          _lastNameCtrl.text = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '';
          // Calculate birthdate from age if available
          final age = p.age.clamp(13, 65);
          _birthdate = DateTime(DateTime.now().year - age, 1, 1);
          _zipCtrl.text = p.zip ?? '';
          // Parse height "6'4""
          final parts = p.height.split("'");
          if (parts.length > 0) _ft = (int.tryParse(parts[0]) ?? 6).clamp(4, 7);
          if (parts.length > 1) _inch = (int.tryParse(parts[1].replaceAll('"', '')) ?? 0).clamp(0, 11);
          _pos = p.position;
          _loading = false;
        });
      } catch (e) {
        setState(() => _loading = false);
      }
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
              leading: const Icon(Icons.photo_library, color: Color(0xFFFF6B35)),
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
        // Upload image if a new one was selected - convert to base64 data URL
        String? avatarUrl;
        if (_imageFile != null) {
          try {
            final bytes = await _imageFile!.readAsBytes();
            final base64Image = base64Encode(bytes);
            final mimeType = _imageFile!.path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
            avatarUrl = 'data:$mimeType;base64,$base64Image';
            debugPrint('Profile photo encoded: ${avatarUrl.length} chars');
          } catch (e) {
            debugPrint('Failed to encode profile photo: $e');
          }
        } else if (_profilePictureUrl != null && !_profilePictureUrl!.startsWith('/')) {
          // Keep existing network URL
          avatarUrl = _profilePictureUrl;
        }
        
        // Save profile data including avatar via API
        final profileUpdates = <String, dynamic>{
          'name': '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}',
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
              SnackBar(content: Text('Failed to save profile: $e'), backgroundColor: Colors.red),
            );
            setState(() => _saving = false);
            return;
          }
        }
        
        final data = ProfileData(
          firstName: _firstNameCtrl.text.trim(),
          lastName: _lastNameCtrl.text.trim(),
          birthdate: _birthdate,
          zip: _zipCtrl.text.trim(),
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
        
        // CRITICAL: Update local user position to ensure isProfileComplete returns true
        // This is needed because refreshUser might fail but we know the profile was saved
        await auth.updateUserPosition(_pos);
        debugPrint('Local user position updated to: $_pos');
        
        if (mounted) context.go('/play');
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

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    final zipValid = RegExp(r'^[0-9]{5}$').hasMatch(_zipCtrl.text);
    final nameValid = _firstNameCtrl.text.trim().isNotEmpty && _lastNameCtrl.text.trim().isNotEmpty;
    final canSave = zipValid && nameValid;

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
                            ? Image.file(_imageFile!, fit: BoxFit.cover, width: 110, height: 110)
                            : (_profilePictureUrl != null && !_profilePictureUrl!.startsWith('/'))
                                ? Image.network(_profilePictureUrl!, fit: BoxFit.cover, width: 110, height: 110)
                                : Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.person, color: Colors.grey.shade600, size: 40),
                                      const SizedBox(height: 4),
                                      Text('Add Photo', style: TextStyle(color: Colors.grey.shade600, fontSize: 11)),
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
                          border: Border.all(color: const Color(0xFF1A252F), width: 2),
                        ),
                        child: const Icon(Icons.camera_alt, color: Colors.white, size: 18),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // First Name
            const Text('First Name', style: TextStyle(color: Colors.grey, fontSize: 12)),
            TextField(
              controller: _firstNameCtrl,
              decoration: const InputDecoration(
                hintText: 'e.g. John',
                border: OutlineInputBorder(),
              ),
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 16),

            // Last Name
            const Text('Last Name', style: TextStyle(color: Colors.grey, fontSize: 12)),
            TextField(
              controller: _lastNameCtrl,
              decoration: const InputDecoration(
                hintText: 'e.g. Doe',
                border: OutlineInputBorder(),
              ),
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 24),

            const Divider(),
            const SizedBox(height: 16),
            const Text('Player Details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),

            // Birthdate
            const Text('Birthday', style: TextStyle(color: Colors.grey, fontSize: 12)),
            const SizedBox(height: 8),
            InkWell(
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _birthdate ?? DateTime(DateTime.now().year - 25, 1, 1),
                  firstDate: DateTime(1940),
                  lastDate: DateTime.now().subtract(const Duration(days: 365 * 13)),
                  helpText: 'Select your birthday',
                  initialEntryMode: DatePickerEntryMode.input,
                );
                if (picked != null) {
                  setState(() => _birthdate = picked);
                }
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
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

            // ZIP
            const Text('ZIP Code', style: TextStyle(color: Colors.grey, fontSize: 12)),
            TextField(
              controller: _zipCtrl,
              decoration: InputDecoration(
                hintText: 'e.g. 94103',
                errorText: _zipCtrl.text.isNotEmpty && !zipValid ? 'Enter a valid 5-digit ZIP' : null,
                border: const OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),

            // Height
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Height (ft)', style: TextStyle(color: Colors.grey, fontSize: 12)),
                      DropdownButtonFormField<int>(
                        value: _ft,
                        items: [4, 5, 6, 7].map((h) => DropdownMenuItem(value: h, child: Text('$h ft'))).toList(),
                        onChanged: (val) => setState(() => _ft = val!),
                        decoration: const InputDecoration(border: OutlineInputBorder()),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Height (in)', style: TextStyle(color: Colors.grey, fontSize: 12)),
                      DropdownButtonFormField<int>(
                        value: _inch,
                        items: List.generate(12, (i) => i).map((h) => DropdownMenuItem(value: h, child: Text('$h in'))).toList(),
                        onChanged: (val) => setState(() => _inch = val!),
                        decoration: const InputDecoration(border: OutlineInputBorder()),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Position
            const Text('Position', style: TextStyle(color: Colors.grey, fontSize: 12)),
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
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
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
