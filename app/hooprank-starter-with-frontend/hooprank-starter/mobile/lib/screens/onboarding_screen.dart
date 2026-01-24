import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';

class OnboardingScreen extends StatefulWidget {
  final VoidCallback onComplete;
  
  const OnboardingScreen({super.key, required this.onComplete});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> 
    with SingleTickerProviderStateMixin {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  
  final List<OnboardingSlide> _slides = [
    // Slide 1: Start with the Play screen - your home base
    OnboardingSlide(
      title: 'Your HoopRank Home',
      description: 'See your 1v1, 3v3, and 5v5 ratings. Tap "Start a Game" to record a match and update your rank!',
      imagePath: 'assets/onboarding/play.png',
      color: Colors.deepOrange,
      highlights: [
        HighlightArea(
          top: 0.26,   // The "Start a Game" button
          left: 0.20,
          width: 0.60,
          height: 0.045,
          label: 'Tap to start a match',
        ),
      ],
    ),
    // Slide 2: Find courts nearby
    OnboardingSlide(
      title: 'Find Courts Near You',
      description: 'Browse the map to discover basketball courts. Signature courts have Kings you can challenge!',
      imagePath: 'assets/onboarding/courts.png',
      color: Colors.orange,
      highlights: [
        HighlightArea(
          top: 0.64,   // The Olympic Club signature court card
          left: 0.05,
          width: 0.90,
          height: 0.11,
          label: 'Tap a court for details',
        ),
      ],
    ),
    // Slide 3: Rankings - find opponents
    OnboardingSlide(
      title: 'Find Players',
      description: 'See who\'s playing in your area. Tap a player to view their profile and send a challenge!',
      imagePath: 'assets/onboarding/rankings.png',
      color: Colors.green,
      highlights: [
        HighlightArea(
          top: 0.29,   // The first player card (Brett Corbett)
          left: 0.05,
          width: 0.90,
          height: 0.085,
          label: 'Tap to view profile',
        ),
      ],
    ),
    // Slide 4: Messages - challenge and chat
    OnboardingSlide(
      title: 'Message & Challenge',
      description: 'Chat with players and send 1v1 challenges. Coordinate games directly!',
      imagePath: 'assets/onboarding/messages.png',
      color: Colors.blue,
      highlights: [
        HighlightArea(
          top: 0.32,   // First DM under "Direct Messages"
          left: 0.05,
          width: 0.90,
          height: 0.085,
          label: 'Tap to chat',
        ),
      ],
    ),
    // Slide 5: Teams - for 3v3 and 5v5
    OnboardingSlide(
      title: 'Build Your Squad',
      description: 'Create or join a team for 3v3 and 5v5 matches. Teams earn their own HoopRank!',
      imagePath: 'assets/onboarding/teams.png',
      color: Colors.purple,
      highlights: [
        HighlightArea(
          top: 0.72,   // The "+ Create Team" button
          left: 0.50,
          width: 0.45,
          height: 0.055,
          label: 'Create a team',
        ),
      ],
    ),
  ];

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);
    
    _pulseAnimation = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pageController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  void _nextPage() {
    if (_currentPage < _slides.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      _completeOnboarding();
    }
  }

  void _skipOnboarding() {
    _completeOnboarding();
  }

  Future<void> _completeOnboarding() async {
    await context.read<AuthState>().completeOnboarding();
    widget.onComplete();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A252F),
      body: SafeArea(
        child: Column(
          children: [
            // Header with skip button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Page indicator
                  Text(
                    '${_currentPage + 1}/${_slides.length}',
                    style: TextStyle(
                      color: Colors.grey[400],
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  TextButton(
                    onPressed: _skipOnboarding,
                    child: Text(
                      'Skip',
                      style: TextStyle(
                        color: Colors.grey[400],
                        fontSize: 16,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            
            // Page content
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: (index) {
                  setState(() {
                    _currentPage = index;
                  });
                },
                itemCount: _slides.length,
                itemBuilder: (context, index) {
                  return _buildSlide(_slides[index]);
                },
              ),
            ),
            
            // Progress dots
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                _slides.length,
                (index) => _buildDot(index),
              ),
            ),
            const SizedBox(height: 24),
            
            // Next/Get Started button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _nextPage,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _slides[_currentPage].color,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 4,
                    shadowColor: _slides[_currentPage].color.withOpacity(0.5),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _currentPage == _slides.length - 1 ? 'Get Started' : 'Next',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        _currentPage == _slides.length - 1 
                            ? Icons.rocket_launch 
                            : Icons.arrow_forward,
                        size: 20,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildSlide(OnboardingSlide slide) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          // Title
          Text(
            slide.title,
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: slide.color,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          
          // Description
          Text(
            slide.description,
            style: TextStyle(
              fontSize: 15,
              color: Colors.grey[300],
              height: 1.4,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          
          // Screenshot with highlights
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: slide.color.withOpacity(0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    return Stack(
                      children: [
                        // Screenshot image
                        Positioned.fill(
                          child: Image.asset(
                            slide.imagePath,
                            fit: BoxFit.contain,
                          ),
                        ),
                        // Highlight overlays
                        ...slide.highlights.map((highlight) => 
                          _buildHighlight(highlight, slide.color, constraints)),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHighlight(HighlightArea highlight, Color color, BoxConstraints constraints) {
    final top = constraints.maxHeight * highlight.top;
    final left = constraints.maxWidth * highlight.left;
    final width = constraints.maxWidth * highlight.width;
    final height = constraints.maxHeight * highlight.height;
    
    return Positioned(
      top: top,
      left: left,
      child: AnimatedBuilder(
        animation: _pulseAnimation,
        builder: (context, child) {
          return Container(
            width: width,
            height: height,
            decoration: BoxDecoration(
              border: Border.all(
                color: color.withOpacity(_pulseAnimation.value),
                width: 3,
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: color.withOpacity(0.3 * _pulseAnimation.value),
                  blurRadius: 15,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // Finger tap indicator
                Positioned(
                  bottom: -30,
                  right: -10,
                  child: Transform.rotate(
                    angle: -0.3,
                    child: Icon(
                      Icons.touch_app,
                      color: Colors.white.withOpacity(0.9),
                      size: 32,
                      shadows: [
                        Shadow(
                          color: Colors.black.withOpacity(0.5),
                          blurRadius: 8,
                          offset: const Offset(2, 2),
                        ),
                      ],
                    ),
                  ),
                ),
                // Optional label tooltip
                if (highlight.label.isNotEmpty)
                  Positioned(
                    top: -32,
                    left: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8, 
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: color,
                        borderRadius: BorderRadius.circular(6),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.3),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Text(
                        highlight.label,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildDot(int index) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      margin: const EdgeInsets.symmetric(horizontal: 4),
      width: _currentPage == index ? 24 : 8,
      height: 8,
      decoration: BoxDecoration(
        color: _currentPage == index
            ? _slides[_currentPage].color
            : Colors.grey[600],
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}

class OnboardingSlide {
  final String title;
  final String description;
  final String imagePath;
  final Color color;
  final List<HighlightArea> highlights;

  OnboardingSlide({
    required this.title,
    required this.description,
    required this.imagePath,
    required this.color,
    required this.highlights,
  });
}

class HighlightArea {
  final double top;      // Fraction of image height (0.0 - 1.0)
  final double left;     // Fraction of image width (0.0 - 1.0)
  final double width;    // Fraction of image width
  final double height;   // Fraction of image height
  final String label;    // Tooltip text

  HighlightArea({
    required this.top,
    required this.left,
    required this.width,
    required this.height,
    this.label = '',
  });
}
