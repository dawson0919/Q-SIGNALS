import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;

  Future<void> _handleLogin() async {
    setState(() => _isLoading = true);
    try {
      final response = await Supabase.instance.client.auth.signInWithPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
      );

      if (response.user != null) {
        if (mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (context) => const HomeScreen()),
          );
        }
      }
    } on AuthException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('登入失敗，請檢查網路連線')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleGoogleLogin() async {
    try {
      await Supabase.instance.client.auth.signInWithOAuth(
        OAuthProvider.google,
        // The context here is web, so it will redirect to Google.
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Google 登入啟動失敗')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Logo placeholder icon
              const Icon(Icons.auto_graph_rounded, size: 80, color: Colors.amber),
              const SizedBox(height: 16),
              const Text(
                'QUANTSIGNAL',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: Colors.amber,
                  letterSpacing: 2,
                ),
              ),
              const SizedBox(height: 8),
              const Text('專業量化交易策略平台', style: TextStyle(color: Colors.grey)),
              const SizedBox(height: 48),
              
              // Login Fields
              TextField(
                controller: _emailController,
                decoration: InputDecoration(
                  labelText: '電子郵件',
                  prefixIcon: const Icon(Icons.email_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                decoration: InputDecoration(
                  labelText: '密碼',
                  prefixIcon: const Icon(Icons.lock_outline),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                obscureText: true,
              ),
              const SizedBox(height: 32),
              
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.black)
                      : const Text('立即登入', style: TextStyle(fontSize: 16)),
                ),
              ),
              const SizedBox(height: 16),

              // OR divider
              const Row(
                children: [
                   Expanded(child: Divider(color: Colors.grey)),
                   Padding(
                     padding: EdgeInsets.symmetric(horizontal: 16),
                     child: Text('或', style: TextStyle(color: Colors.grey)),
                   ),
                   Expanded(child: Divider(color: Colors.grey)),
                ],
              ),
              const SizedBox(height: 16),

              // Google Login Button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: OutlinedButton.icon(
                  onPressed: _handleGoogleLogin,
                  icon: Image.network(
                    'https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png',
                    height: 24,
                  ),
                  label: const Text('使用 Google 帳號登入', style: TextStyle(color: Colors.white)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.white24),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),

              const SizedBox(height: 24),
              TextButton(
                onPressed: () {}, // Handle password reset
                child: const Text('忘記密碼？', style: TextStyle(color: Colors.grey)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
