import 'dart:math';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'screens/proposal_deep_link_screen.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:app_links/app_links.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'services/supabase_service.dart';
import 'services/notification_service.dart';
import 'services/fcm_service.dart';
import 'utils/theme.dart';
import 'screens/group_feed_screen.dart';
import 'screens/submit_proposal_screen.dart';
import 'screens/subscription_screen.dart';

String _generateUuidV4() {
  final rng = Random.secure();
  final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  String hex(int b) => b.toRadixString(16).padLeft(2, '0');
  return '${bytes.sublist(0,4).map(hex).join()}-'
      '${bytes.sublist(4,6).map(hex).join()}-'
      '${bytes.sublist(6,8).map(hex).join()}-'
      '${bytes.sublist(8,10).map(hex).join()}-'
      '${bytes.sublist(10,16).map(hex).join()}';
}

/// Resolves a device identifier that survives app reinstalls / cleared app
/// data — unlike a random UUID stored in SharedPreferences (the previous
/// approach), which resets on every reinstall and silently inflated the
/// "unique visitors" count with repeat visits from the same device.
///
/// Uses app_set_id: Android's App Set ID (Google's own recommended
/// replacement for ANDROID_ID for exactly this kind of non-advertising
/// analytics use case) and iOS's identifierForVendor, both via one unified
/// call. Falls back to a persisted random UUID only if the platform call
/// fails — better a rare inflated count than no tracking at all.
Future<String> _resolveDeviceId(SharedPreferences prefs) async {
  String? platformId;
  try {
    const channel = MethodChannel('jor/device_id');
    final id = await channel.invokeMethod<String>('getAppSetId');
    if (id != null && id.isNotEmpty) platformId = id;
  } catch (_) {
    platformId = null;
  }

  if (platformId != null) {
    // Persist it too, purely as a fast local cache — the platform call
    // itself is still the source of truth on the next launch.
    await prefs.setString('device_id', platformId);
    return platformId;
  }

  // Fallback: reuse a previously-generated UUID if one exists, otherwise
  // generate and persist a fresh one. This still resets on reinstall, same
  // as before the fix, but only affects devices where the platform call
  // failed outright.
  final existing = prefs.getString('device_id');
  if (existing != null && existing.isNotEmpty) return existing;
  final fresh = _generateUuidV4();
  await prefs.setString('device_id', fresh);
  return fresh;
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (kReleaseMode) {
    debugPrint = (String? message, {int? wrapWidth}) {};
  }

  await Future.wait([
    Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform),
    () async {
      try {
        await Supabase.initialize(
          url: 'https://olzfarkfxhwcwabgribo.supabase.co',
          anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9semZhcmtmeGh3Y3dhYmdyaWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDI5NTEsImV4cCI6MjA5NTc3ODk1MX0.Vqo_21U6zW7Igc7th_LPt5AEv238G4lBCYSVW4l8WxI',
        ).timeout(const Duration(seconds: 10), onTimeout: () => Supabase.instance);
      } catch (_) {}
    }(),
  ]);

  await SupabaseService.instance.restorePersistedCnic();
  await SupabaseService.instance.restoreCachedSettings();
  await SupabaseService.instance.restoreCachedCastes();
  await SupabaseService.instance.restoreCachedOccupations();
  await SupabaseService.instance.restoreCachedCities();

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    systemNavigationBarColor: Color(0xFFF8F8FC),
    systemNavigationBarDividerColor: Color(0xFFE8E6F5),
    systemNavigationBarIconBrightness: Brightness.dark,
  ));

  runApp(const JorApp());

  NotificationService.instance.init();
  FCMService.instance.init();
  SharedPreferences.getInstance().then((prefs) async {
    final deviceId = await _resolveDeviceId(prefs);
    SupabaseService.instance.trackAppVisit(deviceId);
  });
}

final _navigatorKey = GlobalKey<NavigatorState>();

class JorApp extends StatelessWidget {
  const JorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Jor',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      navigatorKey: _navigatorKey,
      home: const MainShell(),
      onGenerateRoute: (settings) {
        // Handle jor://proposal/ID deep links
        if (settings.name != null && (settings.name!.startsWith('/proposal/') || settings.name!.startsWith('/p/'))) {
          final id = settings.name!.replaceFirst('/proposal/', '').replaceFirst('/p/', '');
          return MaterialPageRoute(builder: (_) => ProposalDeepLinkScreen(proposalId: id));
        }
        return null;
      },
    );
  }
}

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;
  int _filterCount = 0;
  bool _isPaidUser = false;
  final _feedKey = GlobalKey<GroupFeedScreenState>();
  final _subscriptionKey = GlobalKey<SubscriptionScreenState>();
  late final List<Widget> _screens;

  @override
  void initState() {
    super.initState();
    _screens = [
      GroupFeedScreen(
        key: _feedKey,
        onOpenSubscription: () {
          setState(() => _currentIndex = 1);
          // "Unlock All Profiles" banner is this callback's only caller —
          // land on the standard plan already selected instead of an
          // empty "Select a Plan to Continue" state.
          _subscriptionKey.currentState?.selectPlan(0);
        },
        onOpenCreateAccount: () => _showCreateAccountSheet(context),
        onPaidStatusChanged: () async {
          // checkAndRefresh() is what actually re-derives GroupFeedScreen's
          // own _isPaidUser/_isPendingUser fields (and its gender-filtered
          // feed data) from prefs/server. Without calling it here first,
          // this callback was just re-reading whatever GroupFeedScreen's
          // fields already happened to be — which, right after a fresh
          // login, was still the old signed-out values, since nothing had
          // told GroupFeedScreen a login had just happened.
          await _feedKey.currentState?.checkAndRefresh();
          if (!mounted) return;
          setState(() {
            _filterCount = _feedKey.currentState?.filtersActiveCount ?? 0;
            _isPaidUser = _feedKey.currentState?.isPaidUser ?? false;
            debugPrint('[SHELL] onPaidStatusChanged fired. read isPaidUser=${_feedKey.currentState?.isPaidUser} '
                '=> stored MainShell._isPaidUser=$_isPaidUser');
          });
        },
        onOwnProfileEdited: () => _subscriptionKey.currentState?.refreshOwnProfile(),
        onOpenMyAccount: (ctx, anchorKey) => _subscriptionKey.currentState?.showAccountPopover(ctx, anchorKey),
        onAccountPermanentlyDeleted: () async {
          // Cold-start case: the account was already permanently deleted
          // by the time the app opened, so the realtime DELETE listener
          // (which only fires for deletions that happen while a session is
          // live) never saw it. Show the same notice, then force the same
          // full logout the live-delete path uses, so this doesn't leave
          // the account in the old "logged in but pending" limbo instead.
          if (!mounted) return;
          await showDialog(
            context: context,
            barrierDismissible: false,
            builder: (_) => AlertDialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Text('Profile Removed', style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: kInk)),
              content: const Text(
                'Your profile was removed by admin. You have been logged out.',
                style: TextStyle(fontSize: 13, color: kInkLight),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('OK', style: TextStyle(color: kPurple, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          );
          await _subscriptionKey.currentState?.forceLogout();
        },
      ),
      SubscriptionScreen(
        key: _subscriptionKey,
        onBack: () {
          setState(() => _currentIndex = 0);
          _feedKey.currentState?.checkAndRefresh();
        },
        onPaidStatusChanged: () async {
          // Without this, a status change reported via realtime while the
          // person stays on the Group tab the whole time (e.g. admin
          // rejects their profile, then restores it) never reaches
          // GroupFeedScreen — this callback used to just re-read whatever
          // isPaidUser/filtersActiveCount GroupFeedScreen's fields already
          // happened to be, without ever telling it to actually recheck
          // itself first. checkAndRefresh() is what re-derives those
          // fields (and reapplies/clears the gender-locked filter) from
          // the now-current prefs/server state.
          await _feedKey.currentState?.checkAndRefresh();
          if (!mounted) return;
          setState(() {
            _isPaidUser = _feedKey.currentState?.isPaidUser ?? false;
            _filterCount = _feedKey.currentState?.filtersActiveCount ?? 0;
          });
        },
        onOpenCreateAccount: () {
          setState(() => _currentIndex = 0);
          _showCreateAccountSheet(context);
        },
        onOpenLogin: () {
          setState(() => _currentIndex = 0);
          _showCreateAccountSheet(context, initialLoginMode: true);
        },
        onOwnProfileEdited: () => _feedKey.currentState?.refreshOwnAvatar(),
        onLoggedOut: () {
          _feedKey.currentState?.resetOwnAccountState();
          // resetOwnAccountState() only triggers a rebuild of
          // GroupFeedScreenState (a separate State object) — it doesn't
          // touch MainShell, which is what actually builds the FAB. Without
          // this, the FAB kept showing the paid-user "filter" icon after
          // logout until something else (e.g. switching tabs) happened to
          // rebuild MainShell and re-evaluate isPaidUser.
          setState(() { _isPaidUser = false; _filterCount = 0; });
        },
        scrollToPlans: true,
        onRenewTap: () => setState(() => _currentIndex = 1),
      ),
    ];
    SupabaseService.instance.fetchAppSettings();
    SupabaseService.instance.fetchCastes();
    SupabaseService.instance.fetchOccupations();
    SupabaseService.instance.fetchCities();
    SharedPreferences.getInstance().then((prefs) {
      final paid = prefs.getBool('is_paid_user') ?? false;
      final status = prefs.getString('user_status') ?? '';
      final subStatus = prefs.getString('user_subscription_status') ?? '';
      final isPending = status == 'pending' || status == 'deleted' ||
          status == 'rejected' || status == 'paused' || subStatus == 'expired';
      if (paid && !isPending && mounted) setState(() => _isPaidUser = true);
    });
    _initDeepLinks();
  }

  void _initDeepLinks() {
    final appLinks = AppLinks();
    // Handle deep link when app is already open
    appLinks.uriLinkStream.listen((uri) {
      _handleDeepLink(uri);
    });
    // Handle deep link that launched the app cold
    appLinks.getInitialLink().then((uri) {
      if (uri != null) _handleDeepLink(uri);
    });
  }

  void _handleDeepLink(Uri uri) {
    if (uri.scheme == 'jor' && uri.host == 'proposal') {
      final id = uri.pathSegments.isNotEmpty ? uri.pathSegments.first : null;
      if (id != null && id.isNotEmpty && mounted) {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => ProposalDeepLinkScreen(proposalId: id)),
        );
      }
    }
  }

  void _showCreateAccountSheet(BuildContext context, {bool initialLoginMode = false}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (_) => _CreateAccountSheet(
        initialLoginMode: initialLoginMode,
        onContinue: (cnic, password) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => SubmitProposalScreen(
                prefillCnic: cnic,
                prefillPassword: password,
                onLoginTap: () => _showCreateAccountSheet(context, initialLoginMode: true),
              ),
            ),
          );
        },
        onLogin: (cnic, password) => _subscriptionKey.currentState?.loginProgrammatically(cnic, password) ?? Future.value('Something went wrong. Please try again.'),
        onLoginSuccess: () async {
          await _feedKey.currentState?.checkAndRefresh();
          // Belt-and-braces: checkAndRefresh only re-pulls the name/photo
          // in specific branches. Always refresh directly after a login so
          // the header avatar never gets stuck on '?' or a previous
          // account's picture.
          await _feedKey.currentState?.refreshOwnAvatar();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      floatingActionButton: _currentIndex == 0
          ? ((_feedKey.currentState?.hasAccount ?? _isPaidUser) == true
              ? (() { debugPrint('[SHELL] FAB build: showing FILTER icon (isPaidUser=${_feedKey.currentState?.isPaidUser}, hasAccount=${_feedKey.currentState?.hasAccount}, cached=$_isPaidUser)'); return _FilterFAB(
                  onTap: () => _feedKey.currentState?.openFilterSheet(),
                  activeCount: _filterCount,
                ); })()
              : (() { debugPrint('[SHELL] FAB build: showing PLUS icon (isPaidUser=${_feedKey.currentState?.isPaidUser}, hasAccount=${_feedKey.currentState?.hasAccount}, cached=$_isPaidUser)'); return _SubmitFAB(
                  onTap: () => _showCreateAccountSheet(context),
                ); })())
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: _BottomNav(
        currentIndex: _currentIndex,
        onTap: (i) {
          setState(() => _currentIndex = i);
          if (i == 0) _feedKey.currentState?.checkAndRefresh();
        },
      ),
    );
  }
}

class _FilterFAB extends StatelessWidget {
  final VoidCallback onTap;
  final int activeCount;
  const _FilterFAB({required this.onTap, this.activeCount = 0});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 60, height: 60,
            decoration: BoxDecoration(
              color: const Color(0xFF534AB7),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF534AB7).withOpacity(0.4),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: const Icon(Icons.tune_rounded, color: Colors.white, size: 26),
          ),
          if (activeCount > 0)
            Positioned(
              right: 8, top: 8,
              child: Container(
                width: 8, height: 8,
                decoration: const BoxDecoration(
                  color: Color(0xFFE11D48),
                  shape: BoxShape.circle,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _SubmitFAB extends StatelessWidget {
  final VoidCallback onTap;
  const _SubmitFAB({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.mediumImpact();
        onTap();
      },
      child: Container(
        width: 56, height: 56,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [kPurple, kPurpleDeep],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(
            color: kPurple.withOpacity(0.4),
            blurRadius: 14,
            offset: const Offset(0, 4),
          )],
        ),
        child: const Icon(Icons.add_rounded, color: Colors.white, size: 28),
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  const _BottomNav({required this.currentIndex, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: kCardBg,
        border: Border(top: BorderSide(color: kBorder, width: 1)),
        boxShadow: [BoxShadow(
          color: Colors.black.withOpacity(0.08),
          blurRadius: 8,
          offset: const Offset(0, -2),
        )],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 60,
          child: Row(
            children: [
              Expanded(child: _NavItem(
                icon: Icons.chat_bubble_outline_rounded,
                activeIcon: Icons.chat_bubble_rounded,
                label: 'Group',
                selected: currentIndex == 0,
                onTap: () => onTap(0),
              )),
              const SizedBox(width: 56),
              Expanded(child: _NavItem(
                icon: Icons.star_outline_rounded,
                activeIcon: Icons.star_rounded,
                label: 'Subscription',
                selected: currentIndex == 1,
                onTap: () => onTap(1),
              )),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon, activeIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(selected ? activeIcon : icon,
              color: selected ? kPurple : kInkFaint, size: 24),
          const SizedBox(height: 3),
          Text(label, style: TextStyle(
            fontSize: (MediaQuery.of(context).size.width / 390.0).clamp(0.72, 1.0) * 10.5,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? kPurple : kInkFaint,
          )),
        ],
      ),
    );
  }
}

// ── Create Account Bottom Sheet ───────────────────────────────────────────────
class _CreateAccountSheet extends StatefulWidget {
  final void Function(String cnic, String password) onContinue;
  final Future<String?> Function(String cnic, String password) onLogin;
  final VoidCallback onLoginSuccess;
  final bool initialLoginMode;
  const _CreateAccountSheet({required this.onContinue, required this.onLogin, required this.onLoginSuccess, this.initialLoginMode = false});

  @override
  State<_CreateAccountSheet> createState() => _CreateAccountSheetState();
}

class _CreateAccountSheetState extends State<_CreateAccountSheet> {
  final _cnicCtrl    = TextEditingController();
  final _passCtrl    = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _passObscure    = true;
  bool _confirmObscure = true;
  int  _cnicDigits     = 0;
  String? _errorMsg;
  bool _cnicTaken      = false;
  bool _cnicChecking   = false;
  SharedPreferences? _prefs;

  // ── Login mode ────────────────────────────────────────────────────────
  late bool _isLoginMode;
  final _loginCnicCtrl = TextEditingController();
  final _loginPassCtrl = TextEditingController();
  bool _loginPassObscure = true;
  int  _loginCnicDigits  = 0;
  String? _loginError;
  // Which specific field the current _loginError applies to — 'cnic',
  // 'password', or null for both/neither. Previously both fields turned
  // red for ANY login error (e.g. typing a too-short password also
  // highlighted a perfectly valid CNIC field), since both borders were
  // keyed off the same shared _loginError flag with no way to tell which
  // field actually caused it.
  String? _loginInvalidField;
  bool _loggingIn = false;

  static const _kCnic     = 'sheet_draft_cnic';
  static const _kPass     = 'sheet_draft_password';
  static const _kConfirm  = 'sheet_draft_confirm';

  @override
  void initState() {
    super.initState();
    _isLoginMode = widget.initialLoginMode;
    // Load prefs once and cache the instance
    SharedPreferences.getInstance().then((prefs) {
      if (!mounted) return;
      _prefs = prefs;
      if (prefs.getBool('proposal_submitted') == true) {
        prefs.remove('proposal_submitted');
        prefs.remove(_kCnic);
        prefs.remove(_kPass);
        prefs.remove(_kConfirm);
        return;
      }
      final cnic = prefs.getString(_kCnic) ?? '';
      if (cnic.isNotEmpty) {
        _cnicCtrl.text    = cnic;
        _passCtrl.text    = prefs.getString(_kPass) ?? '';
        _confirmCtrl.text = prefs.getString(_kConfirm) ?? '';
        setState(() => _cnicDigits = cnic.replaceAll('-', '').length);
      }
    });
    // Save on every keystroke
    _cnicCtrl.addListener(_onCnicChanged);
    _passCtrl.addListener(_saveSheet);
    _confirmCtrl.addListener(_saveSheet);
  }

  void _onCnicChanged() {
    final digits = _cnicCtrl.text.replaceAll('-', '').length;
    setState(() { _cnicDigits = digits; _errorMsg = null; _cnicTaken = false; });
    _saveSheet();
    if (digits == 13) _checkCnic();
  }

  void _saveSheet() {
    if (_cnicCtrl.text.isEmpty || _prefs == null) return;
    _prefs!.setString(_kCnic,    _cnicCtrl.text);
    _prefs!.setString(_kPass,    _passCtrl.text);
    _prefs!.setString(_kConfirm, _confirmCtrl.text);
  }

  Future<void> _clearSheet() async {
    final prefs = _prefs ?? await SharedPreferences.getInstance();
    await prefs.remove(_kCnic);
    await prefs.remove(_kPass);
    await prefs.remove(_kConfirm);
  }

  Future<void> _checkCnic() async {
    if (!mounted) return;
    setState(() { _cnicChecking = true; _cnicTaken = false; });
    final taken = await SupabaseService.instance.checkCnicExists(_cnicCtrl.text);
    if (!mounted) return;
    setState(() { _cnicChecking = false; _cnicTaken = taken; });
  }

  @override
  void dispose() {
    _cnicCtrl.removeListener(_onCnicChanged);
    _passCtrl.removeListener(_saveSheet);
    _confirmCtrl.removeListener(_saveSheet);
    _cnicCtrl.dispose(); _passCtrl.dispose(); _confirmCtrl.dispose();
    _loginCnicCtrl.dispose(); _loginPassCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    final cnic = _cnicCtrl.text.trim();
    final pass = _passCtrl.text.trim();
    final conf = _confirmCtrl.text.trim();
    if (_cnicDigits < 13) {
      setState(() => _errorMsg = 'Enter complete CNIC (13 digits)'); return;
    }
    if (_cnicTaken) {
      setState(() => _errorMsg = 'This CNIC already has an account. Please login instead.'); return;
    }
    if (pass.length < 6) {
      setState(() => _errorMsg = 'Min password length is 6 characters'); return;
    }
    if (pass != conf) {
      setState(() => _errorMsg = 'Passwords do not match'); return;
    }
    Navigator.pop(context);
    widget.onContinue(cnic, pass);
  }

  void _onLoginCnicChanged() {
    setState(() {
      _loginCnicDigits = _loginCnicCtrl.text.replaceAll('-', '').length;
      _loginError = null;
      _loginInvalidField = null;
    });
  }

  Future<void> _submitLogin() async {
    final cnic = _loginCnicCtrl.text.trim();
    final pass = _loginPassCtrl.text.trim();
    if (_loginCnicDigits < 13) {
      setState(() { _loginError = 'Enter complete CNIC (13 digits)'; _loginInvalidField = 'cnic'; });
      return;
    }
    if (pass.length < 6) {
      setState(() { _loginError = 'Invalid password length.'; _loginInvalidField = 'password'; });
      return;
    }
    setState(() { _loggingIn = true; _loginError = null; _loginInvalidField = null; });
    final error = await widget.onLogin(cnic, pass);
    if (!mounted) return;
    if (error == null) {
      widget.onLoginSuccess();
      Navigator.pop(context);
    } else {
      // A rejected CNIC+password combination could be either field's
      // fault — we genuinely can't tell which, so both are highlighted.
      setState(() { _loggingIn = false; _loginError = error; _loginInvalidField = 'both'; });
    }
  }

  // Mirrors the website's "Forgot Password" flow: CNIC + a color photo of
  // the CNIC front, sent to admin over WhatsApp for manual verification —
  // there's no automated reset, admin confirms identity and resets it by
  // hand. Kept as a self-contained bottom sheet with its own local state
  // (via StatefulBuilder) rather than adding more fields to the parent
  // widget's state, since none of this needs to persist beyond the sheet.
  void _showForgotPasswordDialog() {
    final cnicCtrl = TextEditingController();
    File? photoFile;
    String? errorMsg;
    bool submitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) => StatefulBuilder(
        builder: (sheetCtx, setSheetState) {
          final bottom = MediaQuery.of(sheetCtx).viewInsets.bottom + MediaQuery.of(sheetCtx).padding.bottom;
          return Container(
            decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
            padding: EdgeInsets.fromLTRB(20, 20, 20, bottom + 24),
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Forgot Password', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: kInk)),
                const SizedBox(height: 6),
                const Text(
                  'Enter your CNIC and upload a photo of its front side — we\'ll verify you on WhatsApp and reset your password.',
                  style: TextStyle(fontSize: 13, color: kInkLight, height: 1.4),
                ),
                const SizedBox(height: 18),
                const Text('CNIC Number', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kInkLight)),
                const SizedBox(height: 6),
                TextField(
                  controller: cnicCtrl,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[\d-]')),
                    _CnicSheetFormatter(),
                  ],
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kInk),
                  onChanged: (_) => setSheetState(() => errorMsg = null),
                  decoration: InputDecoration(
                    hintText: '35202-1234567-1',
                    hintStyle: const TextStyle(color: kInkFaint, fontSize: 13.5),
                    filled: true, fillColor: kSurface,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    prefixIcon: const Icon(Icons.credit_card_rounded, color: kInkFaint, size: 18),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kBorder)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kBorder)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kPurple, width: 1.5)),
                  ),
                ),
                const SizedBox(height: 16),
                const Text('CNIC Front Photo (color)', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kInkLight)),
                const SizedBox(height: 6),
                InkWell(
                  onTap: submitting ? null : () async {
                    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
                    if (picked != null) setSheetState(() { photoFile = File(picked.path); errorMsg = null; });
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 14),
                    decoration: BoxDecoration(
                      color: kSurface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: kBorder),
                    ),
                    child: Row(children: [
                      Icon(photoFile != null ? Icons.check_circle_rounded : Icons.upload_rounded, size: 18, color: photoFile != null ? kGreen : kPurple),
                      const SizedBox(width: 8),
                      Expanded(child: Text(
                        photoFile != null ? 'Photo selected' : 'Upload CNIC front photo',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: photoFile != null ? kGreen : kPurple),
                      )),
                    ]),
                  ),
                ),
                if (errorMsg != null) ...[
                  const SizedBox(height: 10),
                  Text(errorMsg!, style: const TextStyle(fontSize: 12.5, color: kRose, fontWeight: FontWeight.w600)),
                ],
                const SizedBox(height: 20),
                Row(children: [
                  Expanded(child: OutlinedButton(
                    onPressed: submitting ? null : () => Navigator.pop(sheetCtx),
                    style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 13), side: const BorderSide(color: kBorder), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                    child: const Text('Cancel', style: TextStyle(color: kInkLight, fontWeight: FontWeight.w700)),
                  )),
                  const SizedBox(width: 10),
                  Expanded(flex: 2, child: ElevatedButton(
                    onPressed: submitting ? null : () async {
                      final digits = cnicCtrl.text.replaceAll('-', '');
                      if (digits.length != 13) { setSheetState(() => errorMsg = 'Enter a complete 13-digit CNIC number.'); return; }
                      if (photoFile == null) { setSheetState(() => errorMsg = 'Please upload a color photo of your CNIC front side.'); return; }
                      setSheetState(() { submitting = true; errorMsg = null; });

                      final url = await SupabaseService.instance.uploadForgotPasswordCnicPhoto(photoFile!, digits);
                      if (!sheetCtx.mounted) return;
                      if (url == null) {
                        setSheetState(() { submitting = false; errorMsg = 'Failed to upload CNIC photo. Please try again.'; });
                        return;
                      }

                      final waNumber = SupabaseService.instance.cachedSettings['whatsapp_number'] ?? '923000000000';
                      final text = 'Hi, I forgot my password.\n\nMy CNIC: ${cnicCtrl.text}\n\nCNIC front photo (for verification): $url\n\nPlease help me reset my password.';
                      final waUri = Uri.parse('https://wa.me/$waNumber?text=${Uri.encodeComponent(text)}');
                      if (sheetCtx.mounted) Navigator.pop(sheetCtx);
                      if (await canLaunchUrl(waUri)) {
                        await launchUrl(waUri, mode: LaunchMode.externalApplication);
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPurple, foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                      disabledBackgroundColor: kPurple.withOpacity(0.6),
                    ),
                    child: submitting
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Submit', style: TextStyle(fontWeight: FontWeight.w800)),
                  )),
                ]),
              ]),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom + MediaQuery.of(context).padding.bottom;
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(20, 12, 20, bottom + 24),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Handle
          Center(child: Container(width: 40, height: 4,
            decoration: BoxDecoration(color: kBorder, borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 20),
          // Header — deliberately static regardless of mode, so nothing
          // jumps or feels inconsistent when switching tabs below.
          Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
            Container(width: 38, height: 38,
              decoration: BoxDecoration(color: kPurple, borderRadius: BorderRadius.circular(10)),
              child: const Icon(Icons.favorite_rounded, color: Colors.white, size: 20)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text('Welcome to Jor', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: kInk), overflow: TextOverflow.ellipsis),
              const SizedBox(height: 3),
              const Text('Login to your account or create a new one', style: TextStyle(fontSize: 12.5, color: kInkLight)),
            ])),
          ]),
          const SizedBox(height: 18),
          _buildModeSwitcher(),
          const SizedBox(height: 22),
          AnimatedSize(
            duration: const Duration(milliseconds: 260),
            curve: Curves.easeOutCubic,
            alignment: Alignment.topCenter,
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              switchInCurve: Curves.easeOut,
              switchOutCurve: Curves.easeIn,
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween<Offset>(begin: const Offset(0, 0.03), end: Offset.zero).animate(animation),
                  child: child,
                ),
              ),
              child: KeyedSubtree(
                key: ValueKey(_isLoginMode),
                child: _isLoginMode ? _buildLoginForm() : _buildCreateAccountForm(),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  // Modern sliding segmented control — a single highlight pill animates
  // between "Login" and "Create Account" rather than the two modes having
  // visually distinct headers/icons, which is what felt inconsistent
  // before. This is the same pattern iOS and most modern apps use for a
  // two-way mode switch.
  Widget _buildModeSwitcher() {
    return LayoutBuilder(builder: (context, constraints) {
      final segmentWidth = (constraints.maxWidth - 8) / 2;
      return Container(
        height: 46,
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(14)),
        child: Stack(children: [
          AnimatedPositioned(
            duration: const Duration(milliseconds: 260),
            curve: Curves.easeOutCubic,
            left: _isLoginMode ? segmentWidth : 0,
            top: 0, bottom: 0,
            width: segmentWidth,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(11),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.07), blurRadius: 8, offset: const Offset(0, 2))],
              ),
            ),
          ),
          Row(children: [
            Expanded(child: _buildModeTab('Create Profile', !_isLoginMode, () => _switchMode(false))),
            Expanded(child: _buildModeTab('Login', _isLoginMode, () => _switchMode(true))),
          ]),
        ]),
      );
    });
  }

  Widget _buildModeTab(String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 200),
              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: active ? kPurple : kInkFaint),
              child: Text(label, maxLines: 1),
            ),
          ),
        ),
      ),
    );
  }

  void _switchMode(bool loginMode) {
    if (_isLoginMode == loginMode) return;
    setState(() {
      _isLoginMode = loginMode;
      _errorMsg = null;
      _loginError = null;
      _loginInvalidField = null;
    });
  }

  Widget _buildCreateAccountForm() {
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          // CNIC
          const Text('CNIC *', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kInkLight)),
          const SizedBox(height: 6),
          Stack(children: [
            TextFormField(
              controller: _cnicCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[\d-]')),
                _CnicSheetFormatter(),
              ],
              style: const TextStyle(fontSize: 14, color: kInk, fontWeight: FontWeight.w500),
              decoration: InputDecoration(
                hintText: '35202-1234567-1',
                hintStyle: const TextStyle(color: kInkFaint, fontSize: 13.5),
                filled: true, fillColor: kSurface,
                contentPadding: const EdgeInsets.fromLTRB(14, 12, 48, 12),
                prefixIcon: const Icon(Icons.credit_card_rounded, color: kInkFaint, size: 18),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kBorder)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kBorder)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kPurple, width: 1.5)),
              ),
            ),
            Positioned(right: 10, top: 0, bottom: 0,
              child: Center(child: _cnicDigits == 0 ? const SizedBox.shrink()
                : _cnicDigits < 13
                  ? Text('$_cnicDigits/13', style: const TextStyle(fontSize: 11, color: kInkFaint, fontWeight: FontWeight.w600))
                  : _cnicChecking
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: kInkFaint))
                    : _cnicTaken
                      ? const Icon(Icons.error_rounded, size: 18, color: kRose)
                      : const Icon(Icons.check_circle_rounded, size: 18, color: kGreen),
              ),
            ),
          ]),
          const SizedBox(height: 8),
          if (_cnicChecking)
            const Row(children: [
              SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: kInkFaint)),
              SizedBox(width: 8),
              Text('Checking CNIC...', style: TextStyle(fontSize: 12, color: kInkFaint)),
            ])
          else if (_cnicTaken)
            Row(children: [
              const Icon(Icons.warning_amber_rounded, size: 15, color: kRose),
              const SizedBox(width: 6),
              const Expanded(child: Text('CNIC already registered. Please login instead.', style: TextStyle(fontSize: 12, color: kRose, fontWeight: FontWeight.w600))),
              GestureDetector(
                onTap: () => setState(() { _isLoginMode = true; _errorMsg = null; }),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: kPurple, borderRadius: BorderRadius.circular(8)),
                  child: const Text('Login', style: TextStyle(fontSize: 11.5, color: Colors.white, fontWeight: FontWeight.w700)),
                ),
              ),
            ]),
          const SizedBox(height: 16),
          // Password
          const Text('Password *', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kInkLight)),
          const SizedBox(height: 6),
          TextFormField(
            controller: _passCtrl,
            obscureText: _passObscure,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kInk),
            decoration: InputDecoration(
              hintText: 'Min. 6 characters',
              hintStyle: TextStyle(fontSize: 14, color: kInkFaint.withOpacity(0.5)),
              filled: true, fillColor: kSurface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kBorder)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kBorder)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kPurple, width: 1.5)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              prefixIcon: const Icon(Icons.lock_outline_rounded, color: kInkFaint, size: 18),
              suffixIcon: IconButton(
                icon: Icon(_passObscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: kInkFaint, size: 20),
                onPressed: () => setState(() => _passObscure = !_passObscure),
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Confirm Password
          const Text('Confirm Password *', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kInkLight)),
          const SizedBox(height: 6),
          TextFormField(
            controller: _confirmCtrl,
            obscureText: _confirmObscure,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kInk),
            decoration: InputDecoration(
              hintText: 'Re-enter your password',
              hintStyle: TextStyle(fontSize: 14, color: kInkFaint.withOpacity(0.5)),
              filled: true, fillColor: kSurface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kBorder)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kBorder)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kPurple, width: 1.5)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              prefixIcon: const Icon(Icons.lock_outline_rounded, color: kInkFaint, size: 18),
              suffixIcon: IconButton(
                icon: Icon(_confirmObscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: kInkFaint, size: 20),
                onPressed: () => setState(() => _confirmObscure = !_confirmObscure),
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Error message — was previously being set in state by _submit()
          // but never actually rendered anywhere, so validation failures
          // (short password, mismatched confirm, etc.) silently did nothing.
          if (_errorMsg != null) ...[
            Row(children: [
              const Icon(Icons.error_rounded, color: kRose, size: 14),
              const SizedBox(width: 6),
              Expanded(child: Text(_errorMsg!, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: kRose))),
            ]),
            const SizedBox(height: 12),
          ],
          // Play Store requires this to be accessible in-app for apps that
          // collect personal data (CNIC, photos, phone number here) — not
          // just present in the store listing. Links to the existing
          // website pages rather than duplicating that content natively.
          const SizedBox(height: 8),
          Text.rich(
            TextSpan(
              style: const TextStyle(fontSize: 11.5, color: kInkFaint),
              children: [
                const TextSpan(text: 'By continuing, you accept our '),
                WidgetSpan(child: GestureDetector(
                  onTap: () => launchUrl(Uri.parse('https://joronline.com/privacy-policy'), mode: LaunchMode.externalApplication),
                  child: const Text('Privacy Policy', style: TextStyle(fontSize: 11.5, color: kPurple, fontWeight: FontWeight.w700, decoration: TextDecoration.underline)),
                )),
                const TextSpan(text: ' and '),
                WidgetSpan(child: GestureDetector(
                  onTap: () => launchUrl(Uri.parse('https://joronline.com/terms'), mode: LaunchMode.externalApplication),
                  child: const Text('Terms & Conditions', style: TextStyle(fontSize: 11.5, color: kPurple, fontWeight: FontWeight.w700, decoration: TextDecoration.underline)),
                )),
                const TextSpan(text: '.'),
              ],
            ),
          ),
          // Continue button
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: kPurple,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 15),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              child: const Text('Continue', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
            ),
          ),
    ]);
  }

  Widget _buildLoginForm() {
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      // CNIC
      const Text('CNIC *', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kInkLight)),
      const SizedBox(height: 6),
      Stack(children: [
        TextFormField(
          controller: _loginCnicCtrl,
          keyboardType: TextInputType.number,
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[\d-]')),
            _CnicSheetFormatter(),
          ],
          style: const TextStyle(fontSize: 14, color: kInk, fontWeight: FontWeight.w500),
          onChanged: (_) => _onLoginCnicChanged(),
          decoration: InputDecoration(
            hintText: '35202-1234567-1',
            hintStyle: const TextStyle(color: kInkFaint, fontSize: 13.5),
            filled: true, fillColor: kSurface,
            contentPadding: const EdgeInsets.fromLTRB(14, 12, 48, 12),
            prefixIcon: const Icon(Icons.credit_card_rounded, color: kInkFaint, size: 18),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: (_loginInvalidField == 'cnic' || _loginInvalidField == 'both') ? kRose : kBorder)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: (_loginInvalidField == 'cnic' || _loginInvalidField == 'both') ? kRose : kBorder)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: (_loginInvalidField == 'cnic' || _loginInvalidField == 'both') ? kRose : kPurple, width: 1.5)),
          ),
        ),
        Positioned(right: 10, top: 0, bottom: 0,
          child: Center(child: _loginCnicDigits == 0 || _loginCnicDigits == 13
            ? const SizedBox.shrink()
            : Text('$_loginCnicDigits/13', style: const TextStyle(fontSize: 11, color: kInkFaint, fontWeight: FontWeight.w600)),
          ),
        ),
      ]),
      const SizedBox(height: 16),
      // Password
      const Text('Password *', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kInkLight)),
      const SizedBox(height: 6),
      TextFormField(
        controller: _loginPassCtrl,
        obscureText: _loginPassObscure,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kInk),
        onChanged: (_) => setState(() { _loginError = null; _loginInvalidField = null; }),
        onFieldSubmitted: (_) => _loggingIn ? null : _submitLogin(),
        decoration: InputDecoration(
          hintText: 'Enter your password',
          hintStyle: TextStyle(fontSize: 14, color: kInkFaint.withOpacity(0.5)),
          filled: true, fillColor: kSurface,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: (_loginInvalidField == 'password' || _loginInvalidField == 'both') ? kRose : kBorder)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: (_loginInvalidField == 'password' || _loginInvalidField == 'both') ? kRose : kBorder)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: (_loginInvalidField == 'password' || _loginInvalidField == 'both') ? kRose : kPurple, width: 1.5)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          prefixIcon: const Icon(Icons.lock_outline_rounded, color: kInkFaint, size: 18),
          suffixIcon: IconButton(
            icon: Icon(_loginPassObscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: kInkFaint, size: 20),
            onPressed: () => setState(() => _loginPassObscure = !_loginPassObscure),
          ),
        ),
      ),
      Align(
        alignment: Alignment.centerRight,
        child: TextButton(
          onPressed: _loggingIn ? null : _showForgotPasswordDialog,
          style: TextButton.styleFrom(padding: const EdgeInsets.only(top: 4), minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
          child: const Text('Forgot Password?', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kPurple)),
        ),
      ),
      const SizedBox(height: 16),
      if (_loginError != null) ...[
        Row(children: [
          const Icon(Icons.error_rounded, color: kRose, size: 14),
          const SizedBox(width: 6),
          Expanded(child: Text(_loginError!, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: kRose))),
        ]),
        const SizedBox(height: 12),
      ],
      // Login button
      SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: _loggingIn ? null : _submitLogin,
          style: ElevatedButton.styleFrom(
            backgroundColor: kPurple,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 15),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            elevation: 0,
            disabledBackgroundColor: kPurple.withOpacity(0.6),
          ),
          child: _loggingIn
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Login', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
        ),
      ),
    ]);
  }
}

// CNIC auto-formatter for the sheet (XXXXX-XXXXXXX-X)
class _CnicSheetFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue old, TextEditingValue val) {
    final digits = val.text.replaceAll('-', '');
    if (digits.length > 13) return old;
    final buf = StringBuffer();
    for (int i = 0; i < digits.length; i++) {
      if (i == 5 || i == 12) buf.write('-');
      buf.write(digits[i]);
    }
    final s = buf.toString();
    return val.copyWith(text: s, selection: TextSelection.collapsed(offset: s.length));
  }
}
