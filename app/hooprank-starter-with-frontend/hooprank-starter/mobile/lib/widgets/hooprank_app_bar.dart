import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../state/onboarding_checklist_state.dart';

/// Shared HoopRank app bar widget for consistent top bar across all screens
class HoopRankAppBar extends StatelessWidget implements PreferredSizeWidget {
  const HoopRankAppBar({super.key});

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      automaticallyImplyLeading: false,
      title: RichText(
        text: TextSpan(
          style: GoogleFonts.teko(
            fontSize: 32,
            fontWeight: FontWeight.bold,
            fontStyle: FontStyle.italic,
            letterSpacing: 1.2,
          ),
          children: [
            TextSpan(
              text: 'HOOP',
              style: TextStyle(
                color: Colors.deepOrange,
                shadows: [
                  Shadow(
                    color: Colors.black.withOpacity(0.5),
                    offset: const Offset(2, 2),
                    blurRadius: 4,
                  ),
                ],
              ),
            ),
            TextSpan(
              text: 'RANK',
              style: TextStyle(
                color: Colors.white,
                shadows: [
                  Shadow(
                    color: Colors.black.withOpacity(0.5),
                    offset: const Offset(2, 2),
                    blurRadius: 4,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        // Profile avatar button
        Consumer<AuthState>(
          builder: (context, auth, _) {
            final photoUrl = auth.currentUser?.photoUrl;
            return GestureDetector(
              onTap: () => context.push('/profile'),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: CircleAvatar(
                  radius: 16,
                  backgroundImage: photoUrl != null
                      ? (photoUrl.startsWith('data:')
                          ? MemoryImage(Uri.parse(photoUrl).data!.contentAsBytes())
                          : NetworkImage(photoUrl) as ImageProvider)
                      : null,
                  child: photoUrl == null
                      ? const Icon(Icons.person, size: 18)
                      : null,
                ),
              ),
            );
          },
        ),
        // Help/Tutorial button - restarts the interactive tutorial
        IconButton(
          icon: const Icon(Icons.help_outline),
          tooltip: 'Show Checklist',
          onPressed: () async {
            final onboarding =
                  Provider.of<OnboardingChecklistState>(context, listen: false);
              await onboarding.undismiss();
              if (context.mounted) {
                context.go('/play');
              }
          },
        ),
        // Logout button
        IconButton(
          icon: const Icon(Icons.logout),
          onPressed: () async {
            final auth = Provider.of<AuthState>(context, listen: false);
            await auth.logout();
            if (context.mounted) {
              context.go('/login');
            }
          },
        ),
      ],
    );
  }
}
