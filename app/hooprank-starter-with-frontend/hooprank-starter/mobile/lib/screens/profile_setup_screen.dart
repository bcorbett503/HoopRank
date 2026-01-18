import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
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
  int _age = 18;
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
          _age = existing.age.clamp(13, 65);
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
          _age = p.age.clamp(13, 65);
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
    final pickedFile = await picker.pickImage(source: source);

    if (pickedFile != null) {
      setState(() {
        _imageFile = File(pickedFile.path);
        // For now, we'll just use the local path as the URL. 
        // In a real app, you'd upload this to storage and get a URL.
        _profilePictureUrl = pickedFile.path; 
      });
    }
  }

  Future<void> _save() async {
    final auth = context.read<AuthState>();
    final userId = auth.currentUser?.id;
    final playerId = auth.currentUser?.id;

    if (userId != null && playerId != null) {
      // Upload image if a new one was selected
      if (_imageFile != null) {
        final uploaded = await ApiService.uploadImage(
          type: 'profile',
          targetId: userId,
          imageFile: _imageFile!,
        );
        if (uploaded) {
          debugPrint('Profile photo uploaded successfully');
        }
      }
      
      final data = ProfileData(
        firstName: _firstNameCtrl.text.trim(),
        lastName: _lastNameCtrl.text.trim(),
        age: _age,
        zip: _zipCtrl.text.trim(),
        heightFt: _ft,
        heightIn: _inch,
        position: _pos,
        profilePictureUrl: _profilePictureUrl,
        visibility: _visibility,
      );
      await ProfileService.saveProfile(userId, data);
      ProfileService.applyProfileToPlayer(playerId, data);
      
      // Refresh user data from API to update the app state
      await auth.refreshUser();
      
      if (mounted) context.go('/play');
    }
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
            const SizedBox(height: 16),

            // Profile Visibility
            const Text('Profile Visibility', style: TextStyle(color: Colors.grey, fontSize: 12)),
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade300),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                children: [
                  RadioListTile<String>(
                    title: const Text('Public'),
                    subtitle: const Text('Anyone can see your profile', style: TextStyle(fontSize: 12)),
                    value: 'public',
                    groupValue: _visibility,
                    onChanged: (val) => setState(() => _visibility = val!),
                  ),
                  const Divider(height: 1),
                  RadioListTile<String>(
                    title: const Text('Friends Only'),
                    subtitle: const Text('Only your friends can see your profile', style: TextStyle(fontSize: 12)),
                    value: 'friends',
                    groupValue: _visibility,
                    onChanged: (val) => setState(() => _visibility = val!),
                  ),
                  const Divider(height: 1),
                  RadioListTile<String>(
                    title: const Text('Private'),
                    subtitle: const Text('Only you can see your profile', style: TextStyle(fontSize: 12)),
                    value: 'private',
                    groupValue: _visibility,
                    onChanged: (val) => setState(() => _visibility = val!),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            const Divider(),
            const SizedBox(height: 16),
            const Text('Player Details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),

            // Age
            const Text('Age', style: TextStyle(color: Colors.grey, fontSize: 12)),
            Slider(
              value: _age.toDouble(),
              min: 13,
              max: 65,
              divisions: 52,
              label: _age.toString(),
              onChanged: (val) => setState(() => _age = val.toInt()),
            ),
            Text('$_age years old', style: const TextStyle(fontWeight: FontWeight.bold)),
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
            
            // Push Notifications (Optional)
            Container(
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                border: Border.all(color: Colors.blue.shade300),
                borderRadius: BorderRadius.circular(8),
              ),
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Icon(Icons.notifications, color: Colors.blue),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Push Notifications', style: TextStyle(fontWeight: FontWeight.bold)),
                        Text('Get notified about match invites and results', style: TextStyle(fontSize: 12, color: Colors.grey)),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      // TODO: Request push notification permission
                      // In a real app: FirebaseMessaging.instance.requestPermission()
                    },
                    child: const Text('Enable'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Save
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: canSave ? _save : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.deepOrange,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: const Text('Save & Continue'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
