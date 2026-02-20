import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/theme.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final supabase = Supabase.instance.client;
  String _userRole = 'standard';
  bool _isLoading = true;

  final List<Map<String, dynamic>> _strategies = [
    {
      'id': 'turtle_breakout',
      'name': '黃金 Turtle 1H 突破',
      'category': 'Premium',
      'roi': '45.2%',
      'winRate': '62%',
      'icon': Icons.security_rounded
    },
    {
      'id': 'dual_ema',
      'name': '雙 EMA 均線策略',
      'category': 'Basic',
      'roi': '22.8%',
      'winRate': '55%',
      'icon': Icons.insights_rounded
    },
    {
      'id': 'macd_ma',
      'name': 'MACD + 均線組合',
      'category': 'Basic',
      'roi': '18.5%',
      'winRate': '51%',
      'icon': Icons.show_chart_rounded
    },
  ];

  @override
  void initState() {
    super.initState();
    _fetchProfile();
  }

  Future<void> _fetchProfile() async {
    try {
      final user = supabase.auth.currentUser;
      if (user != null) {
        final data = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        setState(() {
          _userRole = data['role'] ?? 'standard';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _logout() async {
    await supabase.auth.signOut();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (context) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('QUANTSIGNAL'),
        actions: [
          IconButton(
            onPressed: _logout,
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        backgroundColor: AppTheme.surfaceGrey,
        selectedItemColor: AppTheme.primaryGold,
        unselectedItemColor: Colors.grey,
        currentIndex: 0,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_rounded), label: '市場策略'),
          BottomNavigationBarItem(icon: Icon(Icons.notifications_active_rounded), label: '即時訊號'),
          BottomNavigationBarItem(icon: Icon(Icons.person_rounded), label: '我的帳戶'),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchProfile,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildWelcomeCard(),
                  const SizedBox(height: 16),
                  _buildGoldHighlightCard(),
                  const SizedBox(height: 24),
                  const Text('熱門量化策略',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  ..._strategies.map((s) => _buildStrategyCard(s)),
                ],
              ),
            ),
    );
  }

  Widget _buildWelcomeCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.surfaceGrey,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '歡迎回來！',
            style: TextStyle(color: Colors.grey, fontSize: 16),
          ),
          const SizedBox(height: 4),
          Text(
            supabase.auth.currentUser?.email ?? '交易員',
            style: const TextStyle(
                color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppTheme.primaryGold.withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              _userRole.toUpperCase(),
              style: const TextStyle(color: AppTheme.primaryGold, fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGoldHighlightCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.yellow.shade700.withOpacity(0.2),
            AppTheme.backgroundBlack,
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.yellow.shade700.withOpacity(0.3)),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -10,
            top: -10,
            child: Icon(
              Icons.savings_rounded,
              size: 80,
              color: Colors.yellow.shade700.withOpacity(0.1),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: Colors.yellow,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'MARKET TOP ASSET',
                    style: TextStyle(
                      color: Colors.yellow.shade700,
                      fontSize: 10,
                      fontWeight: FontWeight.black,
                      letterSpacing: 1.2,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'TETHER GOLD (XAU/USDT)',
                style: TextStyle(
                  color: Colors.grey,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  const Text(
                    '\$2,735.42',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.black,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '+1.77%',
                    style: TextStyle(
                      color: AppTheme.primaryGold,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const Divider(height: 32, color: Colors.white10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '今日精選信號 (VIP PREVIEW)',
                        style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.bolt, color: Colors.yellow.shade700, size: 16),
                          const SizedBox(width: 4),
                          Text(
                            '海龜突破策略: [多單訊號預備]',
                            style: TextStyle(
                              color: Colors.yellow.shade700,
                              fontSize: 13,
                              fontWeight: FontWeight.black,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const Icon(Icons.verified_user_rounded, color: Colors.yellow, size: 20),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStrategyCard(Map<String, dynamic> strategy) {
    final bool isLocked = strategy['category'] == 'Premium' && (_userRole != 'advanced' && _userRole != 'admin' && _userRole != 'platinum');

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: InkWell(
        onTap: () {
          // Navigate to detail
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.primaryGold.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(strategy['icon'], color: AppTheme.primaryGold),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(strategy['name'],
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        if (isLocked)
                          const Padding(
                            padding: EdgeInsets.only(left: 8.0),
                            child: Icon(Icons.lock_outline, size: 14, color: Colors.grey),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('ROI: ${strategy['roi']} | 勝率: ${strategy['winRate']}',
                        style: const TextStyle(color: Colors.grey, fontSize: 13)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: Colors.grey),
            ],
          ),
        ),
      ),
    );
  }
}
