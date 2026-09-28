import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

const _serviceUrl = 'https://my-memo-gray.vercel.app/';
const _ink = Color(0xFF202124);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.white,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const MyMemoApp());
}

class MyMemoApp extends StatelessWidget {
  const MyMemoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Master Planner 3.0',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: _ink,
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: Colors.white,
        useMaterial3: true,
      ),
      home: const ServicePage(),
    );
  }
}

class ServicePage extends StatefulWidget {
  const ServicePage({super.key});

  @override
  State<ServicePage> createState() => _ServicePageState();
}

class _ServicePageState extends State<ServicePage> {
  late final WebViewController _controller;
  int _loadingProgress = 0;
  bool _canGoBack = false;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (progress) {
            if (!mounted) return;
            setState(() {
              _loadingProgress = progress;
              if (progress > 0) _loadError = null;
            });
          },
          onPageStarted: (_) {
            if (!mounted) return;
            setState(() {
              _loadingProgress = 0;
              _loadError = null;
            });
          },
          onPageFinished: (_) => _refreshBackState(),
          onWebResourceError: (error) {
            if (error.isForMainFrame != true || !mounted) return;
            setState(() => _loadError = '인터넷 연결을 확인한 뒤 다시 시도해주세요.');
          },
        ),
      )
      ..loadRequest(Uri.parse(_serviceUrl));
  }

  Future<void> _refreshBackState() async {
    final canGoBack = await _controller.canGoBack();
    if (!mounted) return;
    setState(() {
      _canGoBack = canGoBack;
      _loadingProgress = 100;
    });
  }

  Future<void> _goBack() async {
    if (await _controller.canGoBack()) {
      await _controller.goBack();
      await _refreshBackState();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope<void>(
      canPop: !_canGoBack,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _canGoBack) _goBack();
      },
      child: Scaffold(
        body: SafeArea(
          child: Stack(
            children: [
              WebViewWidget(controller: _controller),
              if (_loadingProgress < 100)
                LinearProgressIndicator(
                  value: _loadingProgress == 0 ? null : _loadingProgress / 100,
                  minHeight: 2,
                  backgroundColor: Colors.transparent,
                  color: _ink,
                ),
              if (_loadError != null)
                ColoredBox(
                  color: Colors.white,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(28),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.wifi_off, size: 28, color: _ink),
                          const SizedBox(height: 14),
                          Text(
                            _loadError!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 15, color: _ink),
                          ),
                          const SizedBox(height: 18),
                          OutlinedButton(
                            onPressed: () => _controller.reload(),
                            child: const Text('다시 시도'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
