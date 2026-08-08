// ── subscription_screen.dart ──────────────────────────────────────────────────
// Only _activateCode() changes — now calls Supabase RPC atomically.
// Everything else (UI, plan cards, how-it-works rows) is identical to original.

import 'dart:async';
import 'dart:math';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/supabase_service.dart';
import '../services/billing_service.dart';
import '../services/fcm_service.dart';
import '../services/notification_service.dart';
import '../services/analytics_service.dart';
import '../models/rishta_proposal.dart';
import '../widgets/rishta_card.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../utils/theme.dart';
import '../widgets/common_widgets.dart';
import '../widgets/searchable_grouped_dropdown.dart';
import 'edit_profile_screen.dart';

// ── Responsive scale helper ────────────────────────────────────────────────
class _S {
  final double scale;
  const _S(this.scale);
  double f(double size) => size * scale;
  double s(double size) => size * scale;
  double d(double size) => size * scale;
  static _S of(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    final scale = (w / 390.0).clamp(0.72, 1.0);
    return _S(scale);
  }
}

class SubscriptionScreen extends StatefulWidget {
  final VoidCallback? onBack;
  final VoidCallback? onOpenCreateAccount;
  // Opens the same shared account sheet as onOpenCreateAccount, but
  // directly in its login section — used specifically when a logged-out
  // person taps the Featured plan, since attempting a purchase with no
  // account isn't the right recovery path there; they almost certainly
  // already have a profile and just need to sign back in.
  final VoidCallback? onOpenLogin;
  final bool scrollToPlans;
  final VoidCallback? onPaidStatusChanged;
  final VoidCallback? onOwnProfileEdited;
  final VoidCallback? onLoggedOut;
  // Fired when the Renew CTA in the account popover is tapped — the
  // popover can be showing from a different tab (e.g. avatar tapped while
  // on the feed tab), so MainShell needs to switch to the Subscription
  // tab before this same screen's own _plansKey scroll can be seen.
  final VoidCallback? onRenewTap;
  // Plan index to preselect on first build (e.g. the feed's "Unlock All
  // Profiles" banner links straight to the standard plan, already
  // selected, instead of landing on an empty "Select a Plan" state).
  // -1 (default) means nothing preselected.
  final int initialSelectedPlan;
  const SubscriptionScreen({super.key, this.onBack, this.onOpenCreateAccount, this.onOpenLogin, this.onPaidStatusChanged, this.scrollToPlans = false, this.onOwnProfileEdited, this.onLoggedOut, this.onRenewTap, this.initialSelectedPlan = -1});

  @override
  State<SubscriptionScreen> createState() => SubscriptionScreenState();
}

class SubscriptionScreenState extends State<SubscriptionScreen> with WidgetsBindingObserver {
  final _db = SupabaseService.instance;
  late int _selectedPlan = widget.initialSelectedPlan;
  final _codeController = TextEditingController();
  final _pinController = TextEditingController();
  bool _pinObscure = true;
  bool _codeError = false;
  bool _affiliateLoginMode = false;
  bool _codeSuccess = false;
  bool _loggedInThisSession = false;
  bool _isAdminView = false;
  Map<String, dynamic>? _userStatus;
  RealtimeChannel? _statusChannel;
  String? _cachedPhotoUrl;     // storage URL
  bool _activating = false;
  String? _codeErrorMessage;
  final _scrollCtrl = ScrollController();
  final _plansKey = GlobalKey();
  // The account popover (showAccountPopover) renders as a separate overlay, not
  // as a child of this State's own build tree — so a plain setState() here
  // doesn't make it rebuild. Anything that changes _userStatus (Pause/
  // Resume, Edit, profile refresh) also bumps this so the sheet can listen
  // and stay in sync while it's open.
  final ValueNotifier<int> _cardVersion = ValueNotifier(0);
  void _bumpCardVersion() => _cardVersion.value++;

  void _loadSettings() {
    SupabaseService.instance.fetchAppSettings(); // updates cache + notifies listeners
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    AnalyticsService.plansView();
    // Pre-load photo URL synchronously to avoid avatar flash on first frame
    SharedPreferences.getInstance().then((prefs) {
      final photoUrl = prefs.getString('user_photo_url');
      if (photoUrl != null && photoUrl.isNotEmpty && mounted) {
        setState(() => _cachedPhotoUrl = photoUrl);
      }
    });
    // Re-fetch settings whenever SupabaseService notifies (e.g. admin changes pricing)
    SupabaseService.instance.addListener(_loadSettings);
    _codeController.clear();
    _pinController.clear();
    SupabaseService.instance.fetchAppSettings();
    _restoreActivationState().then((_) {
      _refreshUserStatus();
      // _userStatus is now populated after restore, so proposalId will be valid
      final proposalId = _userStatus?['id'] as String?;
      _subscribeToStatusChanges(proposalId);
    });
    if (widget.scrollToPlans) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = _plansKey.currentContext;
        if (ctx != null) {
          Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 500), curve: Curves.easeInOut);
        }
      });
    }
    // Fire-and-forget: connects to Google Play and loads product prices in
    // the background. Nothing here blocks the rest of initState, and
    // buyProduct() below calls init() again itself as a safety net if this
    // hasn't finished (or failed) by the time someone actually taps to buy.
    BillingService.instance.init();
  }

  Future<void> _restoreActivationState() async {
    final prefs = await SharedPreferences.getInstance();
    final activated = prefs.getBool('is_paid_user') ?? false;
    // is_paid_user is deliberately flipped to false once an account is
    // found to be pending/deleted/rejected (see group_feed_screen's
    // permanent-deletion check) — that's correct for "are they currently
    // paid", but gating the ENTIRE restore on it meant a pending/deleted
    // account (still logged in, just not active) never got its cached
    // name/photo/status restored either. showAccountPopover then opened
    // with its dim barrier but an empty body, since _loggedInThisSession
    // and _userStatus were never populated. user_status stays cached
    // regardless of the paid flag, so use its presence as the real
    // "is there a known account on this device" signal.
    final cachedStatus = prefs.getString('user_status');
    final hasKnownAccount = activated || (cachedStatus != null && cachedStatus.isNotEmpty);
    if (hasKnownAccount && mounted) {
      final name       = prefs.getString('user_name');
      final expiry     = prefs.getString('user_expiry');
      final tier       = prefs.getString('user_tier');
      final status     = prefs.getString('user_status');
      final subStatus  = prefs.getString('user_subscription_status');
      final deletedFrom = prefs.getString('user_deleted_from');
      final proposalId = prefs.getString('user_proposal_id');
      final photoUrl   = prefs.getString('user_photo_url');
      final photoB64   = prefs.getString('user_photo');
      final isAdminView = prefs.getBool('is_admin_view') ?? false;
      final restoredCnic = prefs.getString('user_cnic');
      final adminAccountId = prefs.getString('admin_account_id');
      if (restoredCnic != null && restoredCnic.isNotEmpty) {
        SupabaseService.instance.setActivatedCnic(restoredCnic);
      }
      setState(() {
        _codeSuccess = true;
        _loggedInThisSession = name != null;
        _isAdminView = isAdminView;
        if (name != null) {
          _userStatus = isAdminView
              ? {
                  // Mirrors exactly what the admin-login branch of
                  // _activateCode() builds — restoring across a restart
                  // should look identical to a fresh admin login.
                  'id': 'admin:${adminAccountId ?? ''}',
                  'name': name,
                  'cnic': restoredCnic ?? '',
                  'password': '',
                  'subscription_tier': 'featured',
                  'status': 'active',
                }
              : {
                  'name': name,
                  'id': proposalId,
                  'profile_photo_url': photoUrl,
                  'subscription_expiry': expiry,
                  'subscription_tier': tier ?? 'none',
                  'status': status ?? 'active',
                  'subscription_status': subStatus,
                  'deleted_from': deletedFrom,
                };
          if (!isAdminView && photoUrl != null && photoUrl.isNotEmpty) {
            _cachedPhotoUrl = photoUrl;
          }
        }
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _loadSettings();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadSettings();
      _refreshUserStatus();
      // Resubscribe in case connection was lost
      _subscribeToStatusChanges(_userStatus?['id'] as String?);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    SupabaseService.instance.removeListener(_loadSettings);
    _statusChannel?.unsubscribe();
    _scrollCtrl.dispose();
    _codeController.dispose();
    _pinController.dispose();
    _couponCtrl.dispose();
    _cardVersion.dispose();
    super.dispose();
  }

  // The proposal ID for the current user — stored after they submit a proposal.
  // In a real app this comes from SharedPreferences or a provider.
  // For now we read from a simple in-memory store in SupabaseService.
  String? _proposalId; // Set via your state management when user submits

  // ── Coupon code state (used in the payment-instructions dialog) ──────────
  final _couponCtrl = TextEditingController();
  int? _appliedCouponDiscount;
  int? _appliedCouponFreeDays;
  String? _appliedCouponCode;
  String? _couponMessage; // shown under the field — success or error text
  bool _couponIsError = false;
  bool _validatingCoupon = false;

  void _subscribeToStatusChanges(String? proposalId) {
    if (proposalId == null) return;
    _statusChannel?.unsubscribe();
    final subscribedAt = DateTime.now();
    String? _previousStatus = _userStatus?['status'] as String?;
    // Read from SharedPreferences for reliable initial state
    SharedPreferences.getInstance().then((prefs) {
      final initialStatus = prefs.getString('user_status');
      final initialSubStatus = prefs.getString('user_subscription_status');
      _statusChannel = _db.subscribeToProposalStatus(proposalId, (newStatus, deletedFrom, newSubStatus) {
      if (mounted) {
        // A hard delete (admin's "Delete Permanently") means this row is
        // gone for good — there's nothing left to ever look up again, so
        // leaving the person in a "logged in, but pending/deleted" limbo
        // (which is otherwise the right call for a recoverable soft-delete,
        // so they can still see their own status) is wrong here. Show a
        // clear one-time notice, then force the same full logout the
        // explicit "Log Out" button performs so every part of the app
        // (avatar, FAB, header filter icon) snaps back to a clean
        // signed-out state instead of staying stuck showing a dead account.
        if (newStatus == 'deleted' && deletedFrom == 'permanent') {
          showDialog(
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
          _performLogout();
          return;
        }
        final wasAlreadyPaused = _previousStatus == 'paused' || initialStatus == 'paused';
        // If subscription renewed — re-fetch full status to get new expiry date
        if (newSubStatus == 'active' && newStatus == 'active' && !wasAlreadyPaused) {
          _refreshUserStatus();
          _previousStatus = newStatus;
          setState(() => _userStatus = {...?_userStatus, 'status': newStatus, 'subscription_status': 'active'});
          _bumpCardVersion();
          SharedPreferences.getInstance().then((p) {
            p.setString('user_status', newStatus);
            p.setString('user_subscription_status', 'active');
          });
          return;
        }
        // UI update only — FCM handles all notifications
        _previousStatus = newStatus;
        setState(() => _userStatus = {...?_userStatus, 'status': newStatus, if (newSubStatus != null) 'subscription_status': newSubStatus, if (deletedFrom != null) 'deleted_from': deletedFrom});
        _bumpCardVersion();
        SharedPreferences.getInstance().then((p) {
          p.setString('user_status', newStatus);
          if (newSubStatus != null) p.setString('user_subscription_status', newSubStatus);
          if (deletedFrom != null) p.setString('user_deleted_from', deletedFrom);
          if (deletedFrom == null && newStatus == 'deleted') p.remove('user_deleted_from');
        });
        // Notify feed to re-check paid/pending status on ANY status change
        // — previously this only fired for paused/resumed, so a reject
        // (status -> 'deleted') or a restore (status -> 'pending'/'active')
        // never told GroupFeedScreen anything happened. Its own cached
        // isPaidUser/isPendingUser and gender-locked filters stayed frozen
        // at whatever they were before the change, silently mismatched
        // from what prefs now correctly said, until a full app restart
        // (the only place that re-derives everything from scratch) fixed it.
        widget.onPaidStatusChanged?.call();
      }
    }, initialStatus: initialStatus, initialSubStatus: initialSubStatus);
    }); // end SharedPreferences.getInstance().then
  }

  // Public entry point so other screens (e.g. the group feed's own rishta
  // card, which has its own separate Edit button) can tell this screen to
  // pull the latest name/status after they push EditProfileScreen — this
  // screen's own in-memory _userStatus has no way of knowing about an edit
  // that happened somewhere else.
  Future<void> refreshOwnProfile() => _refreshUserStatus();

  /// Lets another screen (e.g. the feed's "Unlock All Profiles" banner)
  /// select a plan on this already-alive screen instance — MainShell keeps
  /// SubscriptionScreen alive via IndexedStack, so a fresh
  /// initialSelectedPlan on construction only ever applies once, not on
  /// every subsequent tab switch.
  void selectPlan(int index) {
    if (mounted) setState(() => _selectedPlan = index);
  }

  Future<void> _onEditTap() async {
    final prefs = await SharedPreferences.getInstance();
    final pid = _proposalId ?? prefs.getString('user_proposal_id');
    if (pid == null) return;
    final cnic = await _db.resolveEffectiveCnic();
    if (cnic == null) return;
    try {
      final data = await Supabase.instance.client
          .rpc('fetch_own_proposal_full', params: {'p_id': pid, 'p_cnic': cnic});
      if (!context.mounted) return;
      await Navigator.push(context, MaterialPageRoute(
        builder: (_) => EditProfileScreen(
          proposalId: pid,
          currentData: data as Map<String, dynamic>,
        ),
      ));
      // Edit saves apply immediately to the proposals
      // table, but _userStatus here is just an
      // in-memory snapshot — refresh it after returning
      // so a name (or any other) change shows right
      // away instead of waiting for some unrelated
      // refresh to happen to catch up. Refetch directly
      // by id (already known) rather than via CNIC,
      // which isn't guaranteed to be cached under the
      // same key for every login path.
      try {
        final refreshed = await Supabase.instance.client
            .rpc('fetch_own_proposal_full', params: {'p_id': pid, 'p_cnic': cnic});
        if (mounted) {
          setState(() {
            _userStatus = {...?_userStatus, ...refreshed as Map<String, dynamic>};
            // _cachedPhotoUrl takes priority over _userStatus['profile_photo_url']
            // everywhere the avatar is rendered — if this isn't updated too,
            // a photo change here would save correctly but the avatar would
            // keep showing the old (stale-cached) photo indefinitely.
            final refreshedPhoto = refreshed['profile_photo_url'] as String?;
            if (refreshedPhoto != null) _cachedPhotoUrl = refreshedPhoto;
          });
          _bumpCardVersion();
          widget.onOwnProfileEdited?.call();
          final refreshedName = refreshed['name'] as String?;
          if (refreshedName != null) await prefs.setString('user_name', refreshedName);
        }
      } catch (_) {}
    } catch (_) {}
  }

  Widget _accountSheetRow({required _S s, required IconData icon, required String label, required Color color, required VoidCallback? onTap}) {
    final disabled = onTap == null;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: s.s(16), vertical: s.s(9)),
        child: Row(children: [
          Container(
            width: s.d(26), height: s.d(26),
            decoration: BoxDecoration(color: (disabled ? kInkFaint : color).withOpacity(0.12), borderRadius: BorderRadius.circular(s.s(8))),
            child: Icon(icon, size: s.d(13), color: disabled ? kInkFaint : color),
          ),
          SizedBox(width: s.s(10)),
          Text(label, style: TextStyle(fontSize: s.f(11.5), fontWeight: FontWeight.w600, color: disabled ? kInkFaint : kInk)),
        ]),
      ),
    );
  }

  void _showAvatarImage(BuildContext ctx, String url) {
    final s = _S.of(ctx);
    showDialog(
      context: ctx,
      barrierColor: Colors.black87,
      builder: (_) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: EdgeInsets.all(s.s(16)),
        child: Stack(
          alignment: Alignment.topRight,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(s.s(16)),
              child: InteractiveViewer(
                child: CachedNetworkImage(
                  imageUrl: url,
                  fit: BoxFit.contain,
                  errorWidget: (_, __, ___) => const Padding(
                    padding: EdgeInsets.all(24),
                    child: Icon(Icons.broken_image_outlined, color: Colors.white, size: 40),
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.all(s.s(6)),
              child: GestureDetector(
                onTap: () => Navigator.pop(ctx),
                child: Container(
                  padding: EdgeInsets.all(s.s(6)),
                  decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                  child: Icon(Icons.close_rounded, color: Colors.white, size: s.d(18)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void showAccountPopover(BuildContext ctx, GlobalKey anchorKey) {
    final renderBox = anchorKey.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox == null || !renderBox.attached) return;
    final anchorPos = renderBox.localToGlobal(Offset.zero);
    final anchorSize = renderBox.size;
    final screenSize = MediaQuery.of(ctx).size;

    showGeneralDialog(
      context: ctx,
      barrierLabel: 'Account',
      barrierDismissible: true,
      barrierColor: Colors.black.withOpacity(0.2),
      transitionDuration: const Duration(milliseconds: 180),
      pageBuilder: (dialogCtx, __, ___) {
        final s = _S.of(dialogCtx);
        return ValueListenableBuilder<int>(
          valueListenable: _cardVersion,
          builder: (_, __, ___) {
            if (!_loggedInThisSession) return const SizedBox.shrink();
            final name = _userStatus?['name'] as String? ?? 'Account';
            final initials = name.trim().isEmpty ? '?' : name.trim().split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase();
            final photo = _cachedPhotoUrl ?? _userStatus?['profile_photo_url'] as String?;
            final label = _statusLabel(_userStatus);
            // Raw pending status — deliberately NOT the same as
            // isPendingAccount below. Matches the website's Delete button,
            // which is disabled only for a genuinely pending submission
            // (`user.status === 'pending'`), not for Rejected/Removed/
            // Inactive — someone should always be able to finish deleting
            // their own already-rejected/removed/expired account.
            final isPending = (_userStatus?['status'] as String? ?? '') == 'pending';
            final isPausedStatus = (_userStatus?['status'] as String? ?? '') == 'paused';
            // Mirrors the website's isPendingAccount exactly: nothing has
            // been reviewed yet (raw pending), or there's no live profile
            // left to act on (Rejected/Removed).
            final isPendingAccount = isPending || label == 'Rejected' || label == 'Removed';
            final isInactive = label == 'Inactive';
            // Edit/View/Pause/Share all share this same lock formula on
            // the website (isAdmin || isPendingAccount || isInactive) —
            // enabled only for Active/Featured/Paused.
            final isLocked = _isAdminView || isPendingAccount || isInactive;
            final deleteLocked = isPending;
            final subtitle = _isAdminView
                ? (_userStatus?['cnic'] as String? ?? '')
                : _statusLabel(_userStatus) == 'Removed'
                    ? 'Contact Support'
                    : _statusLabel(_userStatus) == 'Rejected'
                        ? 'Contact Support'
                        : isPending
                            ? 'Profile under review'
                            : _statusLabel(_userStatus) == 'Inactive'
                                ? 'Subscription inactive'
                                : _userStatus?['subscription_expiry'] != null
                                    ? 'Subscription ends ${_formatExpiry(_userStatus!['subscription_expiry'])}'
                                    : '';
            final avatarContent = photo != null && photo.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: photo, fit: BoxFit.cover,
                    placeholder: (_, __) => Center(child: Text(initials, style: TextStyle(color: Colors.white, fontSize: s.f(16), fontWeight: FontWeight.w800))),
                    errorWidget: (_, __, ___) => Center(child: Text(initials, style: TextStyle(color: Colors.white, fontSize: s.f(16), fontWeight: FontWeight.w800))),
                  )
                : Center(child: Text(initials, style: TextStyle(color: Colors.white, fontSize: s.f(16), fontWeight: FontWeight.w800)));

            final popoverWidth = min(screenSize.width - 24, 300.0);
            double right = screenSize.width - (anchorPos.dx + anchorSize.width);
            right = right.clamp(12.0, max(12.0, screenSize.width - popoverWidth - 12.0));
            final top = anchorPos.dy + anchorSize.height + 10;

            void closeThen(VoidCallback action) {
              Navigator.pop(dialogCtx);
              action();
            }

            return Stack(
              children: [
                Positioned(
                  top: top,
                  right: right,
                  width: popoverWidth,
                  child: Material(
                    color: Colors.transparent,
                    child: Container(
                      decoration: BoxDecoration(
                        color: kCardBg,
                        borderRadius: BorderRadius.circular(s.s(18)),
                        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.18), blurRadius: 24, offset: const Offset(0, 8))],
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // ── Compact identity row ──
                          Padding(
                            padding: EdgeInsets.fromLTRB(s.s(16), s.s(16), s.s(16), s.s(12)),
                            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: (photo != null && photo.isNotEmpty) ? () => _showAvatarImage(dialogCtx, photo) : null,
                                child: Container(
                                  width: s.d(40), height: s.d(40),
                                  decoration: BoxDecoration(shape: BoxShape.circle, gradient: const LinearGradient(colors: [kPurple, kPurpleDeep])),
                                  child: ClipOval(child: avatarContent),
                                ),
                              ),
                              SizedBox(width: s.s(10)),
                              Expanded(
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(name, style: TextStyle(fontSize: s.f(14), fontWeight: FontWeight.w800, color: kInk), maxLines: 1, overflow: TextOverflow.ellipsis),
                                  if (subtitle.isNotEmpty) ...[
                                    SizedBox(height: s.s(2)),
                                    Text(subtitle, style: TextStyle(fontSize: s.f(11), color: kInkLight), maxLines: 1, overflow: TextOverflow.ellipsis),
                                  ],
                                ]),
                              ),
                              SizedBox(width: s.s(6)),
                              // Color-coded by actual status (green=Active,
                              // amber=Pending, rose=Rejected/Removed,
                              // gray=Paused/Inactive, etc. — see
                              // _statusColor()) instead of always showing
                              // the same purple chip regardless of status.
                              // Admin keeps its own purple tag since it's a
                              // view mode, not a proposal status.
                              Builder(builder: (_) {
                                final tagColor = _isAdminView ? kPurple : _statusColor(_userStatus);
                                return Container(
                                  padding: EdgeInsets.symmetric(horizontal: s.s(7), vertical: s.s(3)),
                                  decoration: BoxDecoration(color: tagColor.withOpacity(0.14), borderRadius: BorderRadius.circular(s.s(6))),
                                  child: Text(
                                    _isAdminView ? 'Admin' : _statusLabel(_userStatus),
                                    style: TextStyle(fontSize: s.f(9.5), color: tagColor, fontWeight: FontWeight.w800),
                                  ),
                                );
                              }),
                            ]),
                          ),
                          Padding(padding: EdgeInsets.symmetric(horizontal: s.s(16)), child: Divider(height: 1, color: kBorder)),
                          // ── Quick actions ──
                          Padding(
                            padding: EdgeInsets.fromLTRB(s.s(16), s.s(12), s.s(16), s.s(4)),
                            child: Row(children: [
                              Expanded(child: _ActionBtn(icon: Icons.edit_rounded, label: 'Edit', onTap: isLocked ? null : () => closeThen(_onEditTap))),
                              SizedBox(width: s.s(6)),
                              // Deliberately always shown, even while paused —
                              // unlike the website, which hides View entirely
                              // for a paused profile. Kept visible here so the
                              // owner can still preview their own profile
                              // regardless of pause state.
                              Expanded(child: _ActionBtn(icon: Icons.person_rounded, label: 'View', onTap: isLocked ? null : () => closeThen(_viewProfile))),
                              SizedBox(width: s.s(6)),
                              Expanded(child: _ActionBtn(
                                icon: isPausedStatus ? Icons.play_arrow_rounded : Icons.pause_rounded,
                                label: isPausedStatus ? 'Resume' : 'Pause',
                                onTap: isLocked ? null : () => _togglePause(),
                                color: isPausedStatus ? kGreen : const Color(0xFF6B7280),
                              )),
                              SizedBox(width: s.s(6)),
                              // Share uses the same lock formula as Pause/View
                              // on the website (isAdmin || isPendingAccount ||
                              // isInactive) — previously missing the Inactive
                              // case here, so an expired-but-not-deleted
                              // account could still tap Share with nothing
                              // live to actually share.
                              Expanded(child: _ActionBtn(icon: Icons.share_rounded, label: 'Share', onTap: isLocked ? null : () => closeThen(_shareProfile))),
                            ]),
                          ),
                          // Renew — only when the subscription has actually
                          // expired, matching the website's Renew button.
                          if (isInactive) Padding(
                            padding: EdgeInsets.fromLTRB(s.s(16), s.s(8), s.s(16), 0),
                            child: SizedBox(
                              width: double.infinity,
                              child: ElevatedButton.icon(
                                onPressed: () => closeThen(_goToRenew),
                                icon: Icon(Icons.autorenew_rounded, size: s.d(16), color: Colors.white),
                                label: Text('Renew Subscription', style: TextStyle(fontSize: s.f(12), fontWeight: FontWeight.w700, color: Colors.white)),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: kPurple,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  padding: EdgeInsets.symmetric(vertical: s.s(10)),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(s.s(10))),
                                ),
                              ),
                            ),
                          ),
                          // Pay / awaiting-approval. Only applies to a
                          // profile that's still in the pre-approval phase:
                          // raw Pending, or Rejected from the Orders screen
                          // (never actually went live). "Removed" is
                          // different — that profile was already approved
                          // and live before being taken down from the Users
                          // screen, so there's no "awaiting approval" step
                          // happening at all; nothing shows for Removed
                          // regardless of payment. "Pay Now" only makes
                          // sense for a fresh, unpaid pending submission.
                          // Once paid, "Paid — awaiting admin approval"
                          // stays visible for Pending/Rejected — a rejection
                          // doesn't erase the payment, and hiding that could
                          // make them think their money vanished. It only
                          // disappears once an admin actually approves.
                          if (isPending || label == 'Rejected') Builder(builder: (_) {
                            final hasPaid = (_userStatus?['subscription_status'] as String? ?? '') == 'active';
                            debugPrint('[PAYSTATUS] name=${_userStatus?['name']} status=${_userStatus?['status']} '
                                'subscription_status=${_userStatus?['subscription_status']} isPending=$isPending label=$label hasPaid=$hasPaid freeMode=$_freeMode');
                            if (!hasPaid) {
                              if (!isPending || _freeMode) return const SizedBox.shrink();
                              return Padding(
                                padding: EdgeInsets.fromLTRB(s.s(16), s.s(8), s.s(16), 0),
                                child: SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton.icon(
                                    onPressed: () => closeThen(_goToMakePayment),
                                    icon: Icon(Icons.payments_rounded, size: s.d(16), color: Colors.white),
                                    label: Text('Pay Now', style: TextStyle(fontSize: s.f(12), fontWeight: FontWeight.w700, color: Colors.white)),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: kPurple,
                                      foregroundColor: Colors.white,
                                      elevation: 0,
                                      padding: EdgeInsets.symmetric(vertical: s.s(10)),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(s.s(10))),
                                    ),
                                  ),
                                ),
                              );
                            }
                            return Padding(
                              padding: EdgeInsets.fromLTRB(s.s(16), s.s(8), s.s(16), 0),
                              child: Container(
                                width: double.infinity,
                                padding: EdgeInsets.symmetric(vertical: s.s(10), horizontal: s.s(12)),
                                decoration: BoxDecoration(
                                  color: kGreen.withOpacity(0.08),
                                  borderRadius: BorderRadius.circular(s.s(10)),
                                  border: Border.all(color: kGreen.withOpacity(0.3)),
                                ),
                                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                  Icon(Icons.check_circle_rounded, size: s.d(15), color: kGreen),
                                  SizedBox(width: s.s(6)),
                                  Flexible(child: Text('Paid — awaiting admin approval', style: TextStyle(fontSize: s.f(12), fontWeight: FontWeight.w700, color: kGreen), overflow: TextOverflow.ellipsis)),
                                ]),
                              ),
                            );
                          }),
                          SizedBox(height: s.s(8)),
                          Padding(padding: EdgeInsets.symmetric(horizontal: s.s(16)), child: Divider(height: 1, color: kBorder)),
                          // ── Featured Credits ──
                          // A status-tag-style pill showing the current
                          // balance, and below it one button that adapts:
                          // no credits -> "Buy Featured Credits" (opens the
                          // purchase flow); has credits -> "Schedule
                          // Featured Post" (opens the booking flow).
                          Builder(builder: (_) {
                            final purchased = (_userStatus?['featured_credits_purchased'] as num?)?.toInt() ?? 0;
                            final used = (_userStatus?['featured_credits_used'] as num?)?.toInt() ?? 0;
                            final available = purchased - used;
                            final hasCredits = available > 0;
                            return Padding(
                              padding: EdgeInsets.fromLTRB(s.s(16), s.s(10), s.s(16), s.s(2)),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                // Left: Manage (underlined, minimal icon) —
                                // opens the sheet listing running/scheduled
                                // featured posts with cancel options.
                                // Right: balance pill, same styling as the
                                // Active/Featured status tags above.
                                Row(children: [
                                  GestureDetector(
                                    onTap: _isAdminView ? null : () => closeThen(_showManageFeaturedSheet),
                                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                                      Icon(Icons.settings_rounded, size: s.d(12), color: _isAdminView ? kInkFaint : kInkLight),
                                      SizedBox(width: s.s(4)),
                                      Text(
                                        'Manage',
                                        style: TextStyle(
                                          fontSize: s.f(10.5), color: _isAdminView ? kInkFaint : kInkLight,
                                          fontWeight: FontWeight.w700,
                                          decoration: TextDecoration.underline,
                                          decorationColor: _isAdminView ? kInkFaint : kInkLight,
                                        ),
                                      ),
                                    ]),
                                  ),
                                  const Spacer(),
                                  Container(
                                    padding: EdgeInsets.symmetric(horizontal: s.s(7), vertical: s.s(3)),
                                    decoration: BoxDecoration(color: (_isAdminView ? kInkFaint : kAmber).withOpacity(0.14), borderRadius: BorderRadius.circular(s.s(6))),
                                    child: Text(
                                      'Featured Credits: $available',
                                      style: TextStyle(fontSize: s.f(9.5), color: _isAdminView ? kInkFaint : kAmber, fontWeight: FontWeight.w800),
                                    ),
                                  ),
                                ]),
                                SizedBox(height: s.s(8)),
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton.icon(
                                    onPressed: _isAdminView ? null : () => closeThen(hasCredits ? _bookFeaturedWithCredits : _buyFeaturedViaPlayBilling),
                                    icon: Icon(hasCredits ? Icons.calendar_month_rounded : Icons.bolt_rounded, size: s.d(16), color: Colors.white),
                                    label: Text(
                                      hasCredits ? 'Schedule Featured Post' : 'Buy Featured Credits',
                                      style: TextStyle(fontSize: s.f(12), fontWeight: FontWeight.w700, color: Colors.white),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: _isAdminView ? kInkFaint : kAmber,
                                      foregroundColor: Colors.white,
                                      elevation: 0,
                                      padding: EdgeInsets.symmetric(vertical: s.s(10)),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(s.s(10))),
                                    ),
                                  ),
                                ),
                              ]),
                            );
                          }),
                          // ── Account settings ──
                          _accountSheetRow(
                            s: s, icon: Icons.lock_outline_rounded, label: 'Change Password', color: kPurple,
                            onTap: () => closeThen(_showChangePasswordDialog),
                          ),
                          _accountSheetRow(
                            s: s, icon: Icons.logout_rounded, label: 'Log Out', color: kPurple,
                            onTap: () => closeThen(_confirmLogout),
                          ),
                          _accountSheetRow(
                            s: s, icon: Icons.delete_outline_rounded, label: 'Delete Account', color: kRose,
                            onTap: deleteLocked ? null : () => closeThen(() {
                              // Matches the website exactly: Rejected/Removed
                              // (like Admin) skip straight to the password
                              // confirmation with no reason collected —
                              // there's no live profile left to explain a
                              // reason for. Everyone else (Active/Featured/
                              // Paused/Inactive) picks a reason first.
                              if (_isAdminView) {
                                _confirmDelete('Admin account removed');
                              } else if (label == 'Rejected' || label == 'Removed') {
                                _confirmDelete('');
                              } else {
                                _showDeleteOptions();
                              }
                            }),
                          ),
                          SizedBox(height: s.s(6)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        );
      },
      transitionBuilder: (dialogCtx, anim, __, child) {
        return FadeTransition(
          opacity: anim,
          child: ScaleTransition(
            scale: CurvedAnimation(parent: anim, curve: Curves.easeOutBack),
            alignment: Alignment.topRight,
            child: child,
          ),
        );
      },
    );
  }

  Future<void> _refreshUserStatus() async {
    if (!_loggedInThisSession) return;
    if (_isAdminView) {
      // Admin accounts live in `admin_accounts`, not `proposals` — this
      // function only ever queries `proposals`, so it would always get
      // "no row found" for an admin and (before this check existed)
      // treated that as "the account was deleted", silently logging the
      // admin out and wiping _userStatus/_isAdminView on the next resume
      // or background/foreground cycle. There's nothing to refresh here
      // for an admin session, so just skip it.
      return;
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      final cnic = prefs.getString('user_cnic') ?? '';
      if (cnic.isEmpty) { return; }
      final updated = await _db.fetchUserStatusByCnic(cnic);
      if (mounted && updated != null) {
        final oldStatus = prefs.getString('user_status') ?? '';
        final oldExpiryStr = prefs.getString('user_expiry') ?? '';
        final wasAlreadyExpired = prefs.getString('user_subscription_status') == 'expired';
        final newStatus = updated['status'] as String? ?? '';        setState(() {
          _userStatus = {...?_userStatus, ...updated};
          if (updated['profile_photo_url'] != null) _cachedPhotoUrl = updated['profile_photo_url'] as String;
        });
        _bumpCardVersion();
        await prefs.setString('user_status', newStatus);
        // The cached name was never being refreshed here — only
        // status/expiry/tier were. That left a stale name sitting in
        // SharedPreferences indefinitely, which _restoreActivationState()
        // then re-reads as the very first thing on every fresh screen
        // load, undoing whatever this function had just fixed in memory.
        if (updated['name'] != null) await prefs.setString('user_name', updated['name'] as String);
        if (updated['subscription_status'] != null) await prefs.setString('user_subscription_status', updated['subscription_status'] as String);
        if (updated['subscription_expiry'] != null) await prefs.setString('user_expiry', updated['subscription_expiry'] as String);
        if (updated['subscription_tier'] != null) await prefs.setString('user_tier', updated['subscription_tier'] as String);
        if (updated['deleted_from'] != null) await prefs.setString('user_deleted_from', updated['deleted_from'] as String);
        if (updated['deleted_from'] == null) await prefs.remove('user_deleted_from');
        final expiryStr = updated['subscription_expiry'] as String?;
        final newSubStatus = updated['subscription_status'] as String? ?? '';
        // UI update only — FCM handles all notifications
        // (no notification calls here to avoid duplicates)
      } else if (mounted && updated == null) {
        // No row at all for this CNIC anymore — the account was
        // permanently deleted. This was previously silently ignored,
        // leaving the stale cached "active" state on screen indefinitely.
        setState(() {
          _codeSuccess = false;
          _loggedInThisSession = false;
          _userStatus = null;
          _cachedPhotoUrl = null;
          _isAdminView = false;
        });
        await prefs.setBool('is_paid_user', false);
        await prefs.setString('user_status', 'deleted');
      }
    } catch (_) {}
  }

  void _showDeleteOptions() {
    final reasons = [
      'I have found a proposal through Jor.',
      'I have found a proposal from an external source.',
      'I have decided to take a break and may return later.',
      'I did not find this application useful.',
      'Other',
    ];
    String? selected;
    final otherCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) {
          final isOther = selected == 'Other';
          final canDelete = selected != null && (!isOther || otherCtrl.text.trim().isNotEmpty);
          return AlertDialog(
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text('Delete Profile', style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: kInk)),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Please tell us why you want to delete your profile:', style: TextStyle(fontSize: 13, color: kInkLight)),
                  const SizedBox(height: 12),
                  ...reasons.map((r) => GestureDetector(
                    onTap: () => setS(() => selected = r),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: selected == r ? kPurpleLight : kSurface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: selected == r ? kPurple : kBorder),
                      ),
                      child: Row(children: [
                        Icon(selected == r ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                            size: 16, color: selected == r ? kPurple : kInkFaint),
                        const SizedBox(width: 10),
                        Expanded(child: Text(r, style: TextStyle(fontSize: 12.5, color: selected == r ? kPurple : kInk, fontWeight: selected == r ? FontWeight.w600 : FontWeight.w400))),
                      ]),
                    ),
                  )),
                  if (isOther) ...[
                    const SizedBox(height: 4),
                    Stack(
                      children: [
                        TextField(
                          controller: otherCtrl,
                          maxLength: 200,
                          maxLines: 3,
                          onChanged: (_) => setS(() {}),
                          decoration: InputDecoration(
                            hintText: 'Please describe your reason...',
                            hintStyle: const TextStyle(fontSize: 12.5, color: kInkFaint),
                            counterText: '',
                            contentPadding: const EdgeInsets.fromLTRB(12, 12, 12, 28),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: kBorder)),
                            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: kBorder)),
                            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: kPurple)),
                            filled: true,
                            fillColor: kSurface,
                          ),
                          style: const TextStyle(fontSize: 12.5, color: kInk),
                        ),
                        Positioned(
                          bottom: 6, right: 10,
                          child: Text(
                            '${otherCtrl.text.length}/200',
                            style: TextStyle(fontSize: 10.5, color: otherCtrl.text.length >= 180 ? kRose : kInkFaint),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel', style: TextStyle(color: kInkLight)),
              ),
              TextButton(
                onPressed: !canDelete ? null : () {
                  final reason = isOther ? otherCtrl.text.trim() : selected!;
                  Navigator.pop(ctx);
                  _confirmDelete(reason);
                },
                child: Text('Delete', style: TextStyle(color: !canDelete ? kInkFaint : kRose, fontWeight: FontWeight.w700)),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _confirmDelete(String reason) async {
    final passwordCtrl = TextEditingController();
    String? passwordError;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          contentPadding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
          title: const Text('Confirm Deletion', style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: kRose)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!_isAdminView && reason.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(8)),
                  child: Text('Reason: $reason', style: const TextStyle(fontSize: 12, color: kRose)),
                ),
                const SizedBox(height: 12),
              ],
              const Text('This cannot be undone. Enter your password to confirm.', style: TextStyle(fontSize: 13, color: kInkLight)),
              const SizedBox(height: 12),
              TextField(
                controller: passwordCtrl,
                obscureText: true,
                onChanged: (_) => setS(() => passwordError = null),
                decoration: InputDecoration(
                  hintText: 'Your password',
                  hintStyle: const TextStyle(fontSize: 13, color: kInkFaint),
                  errorText: passwordError,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: kBorder)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: kBorder)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: kPurple)),
                  filled: true,
                  fillColor: kSurface,
                ),
                style: const TextStyle(fontSize: 13, color: kInk),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel', style: TextStyle(color: kInkLight))),
            TextButton(
              onPressed: () {
                final entered = passwordCtrl.text.trim();
                final stored = (_userStatus?['password'] as String? ?? '').trim();
                if (entered.isEmpty) { setS(() => passwordError = 'Please enter your password.'); return; }
                if (entered != stored) { setS(() => passwordError = 'Incorrect password. Please try again.'); return; }
                Navigator.pop(ctx, true);
              },
              child: const Text('Delete', style: TextStyle(color: kRose, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) return;
    final id = _userStatus?['id'] as String?;
    if (id == null) return;
    try {
      if (id.startsWith('admin:')) {
        // Admin accounts aren't proposals — hard-delete via a
        // security-definer function that re-verifies the password
        // server-side, rather than a direct table write (admin_accounts
        // no longer grants raw write access to the anon key).
        final cnic = _userStatus?['cnic'] as String? ?? '';
        final ok = await Supabase.instance.client.rpc('admin_account_self_delete', params: {
          'p_cnic': cnic,
          'p_current_password': passwordCtrl.text.trim(),
        }) as bool? ?? false;
        if (!ok) throw Exception('Incorrect password or delete failed');
      } else {
        final cnic = await _db.resolveEffectiveCnic();
        if (cnic == null) throw Exception('Could not verify account');
        await Supabase.instance.client.rpc('update_own_status', params: {
          'p_id': id,
          'p_cnic': cnic,
          'p_new_status': 'deleted',
          'p_reason': reason,
        });
      }
      // Reuse the exact same cleanup logout uses — clearing the in-memory
      // activatedCnic, the activated_cnic pref, and notifying
      // GroupFeedScreen/MainShell via onLoggedOut. The account is deleted
      // server-side at this point regardless, but without this the header
      // avatar/name (and hasAccount/FAB state) kept showing the
      // just-deleted account's stale cached data — appearing "frozen" —
      // since only this screen's own fields were being reset, not the
      // rest of the app.
      await _performLogout();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Account deleted', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          backgroundColor: kInk,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 72),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          duration: const Duration(seconds: 3),
        ));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Failed: $e'),
        backgroundColor: kRose,
        behavior: SnackBarBehavior.floating,
      ));
    }
  }

  /// Switches MainShell to the Subscription tab (harmless no-op if already
  /// there) then scrolls to the plans section, same as scrollToPlans does
  /// on a fresh navigation — this callback exists because the popover this
  /// gets tapped from can be showing on top of any tab.
  void _goToRenew() {
    widget.onRenewTap?.call();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _plansKey.currentContext;
      if (ctx != null) {
        Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 500), curve: Curves.easeInOut);
      }
    });
  }

  // Tapping "Pay Now" on a still-pending profile is a much more
  // explicit, single-purpose action than Renew's general "go look at the
  // plans" — so this goes straight into the purchase flow rather than
  // just scrolling to the plan cards and waiting for another tap.
  void _goToMakePayment() {
    widget.onRenewTap?.call();
    _buyRishtaProfileViaPlayBilling();
  }

  Future<void> _togglePause() async {
    final id = _userStatus?['id'] as String?;
    if (id == null) return;
    final isPaused = (_userStatus?['status'] as String? ?? '') == 'paused';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(isPaused ? 'Resume Profile?' : 'Pause Profile?',
            style: const TextStyle(fontWeight: FontWeight.w800, color: kInk)),
        content: Text(
          isPaused
              ? 'Your profile will become visible in the group again.'
              : 'Your profile will be hidden from the group. You can resume it anytime.',
          style: const TextStyle(fontSize: 13, color: kInkLight),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel', style: TextStyle(color: kInkLight)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(
              isPaused ? 'Resume' : 'Pause',
              style: TextStyle(color: isPaused ? kGreen : kPurple, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      final cnic = await _db.resolveEffectiveCnic();
      if (cnic == null) throw Exception('Could not verify account');
      if (isPaused) {
        await Supabase.instance.client.rpc('update_own_status', params: {
          'p_id': id, 'p_cnic': cnic, 'p_new_status': 'active',
        });
      } else {
        await Supabase.instance.client.rpc('update_own_status', params: {
          'p_id': id, 'p_cnic': cnic, 'p_new_status': 'paused',
        });
        // NOTE: the "Profile Paused" push + in-app notification is fired by
        // a database trigger (on proposals.status -> 'paused'), not from
        // here. That way it fires consistently no matter which client
        // causes the pause (this app, the website, or elsewhere) — firing
        // it locally here too would double-notify this device.
      }
      final newStatus = isPaused ? 'active' : 'paused';
      setState(() => _userStatus = {...?_userStatus, 'status': newStatus});
      _bumpCardVersion();
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_status', newStatus);
      // On resume, notify MainShell so FAB switches back to filter icon
      if (isPaused) widget.onPaidStatusChanged?.call();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Failed: $e'),
        backgroundColor: kRose,
        behavior: SnackBarBehavior.floating,
      ));
    }
  }

  Future<void> _viewProfile() async {
    final id = _userStatus?['id'] as String?;
    if (id == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Profile ID not found. Please login again.'),
        backgroundColor: kRose,
        behavior: SnackBarBehavior.floating,
      ));
      return;
    }
    showDialog(
      context: context,
      builder: (_) => _ProfileViewDialog(proposalId: id),
    );
  }

  void _shareProfile() {
    final id = _userStatus?['id'] as String?;
    if (id == null) return;
    final name           = _userStatus?['name']           as String? ?? '';
    final age            = (_userStatus?['age']            as num?)?.toInt() ?? 0;
    final city           = _userStatus?['city']            as String? ?? '';
    final country        = _userStatus?['country']         as String? ?? '';
    final profession     = _userStatus?['profession']      as String? ?? '';
    final education      = _userStatus?['education']       as String? ?? '';
    final caste          = _userStatus?['caste']           as String? ?? '';
    final sect           = _userStatus?['sect']            as String? ?? '';
    final maritalStatus  = _userStatus?['marital_status']  as String? ?? '';
    final practiceLevel  = _userStatus?['practice_level']  as String? ?? '';
    final hijab          = _userStatus?['hijab']           as String? ?? '';
    final beard          = _userStatus?['beard']           as String? ?? '';
    final homeType       = _userStatus?['home_type']       as String? ?? '';
    final houseSize      = _userStatus?['house_size']      as String? ?? '';
    final location       = _userStatus?['location']        as String? ?? '';
    final about          = _userStatus?['about']           as String? ?? '';
    final fatherAlive    = _userStatus?['father_alive']    as bool?;
    final motherAlive    = _userStatus?['mother_alive']    as bool?;
    final brothers       = (_userStatus?['brothers']       as num?)?.toInt() ?? 0;
    final sisters        = (_userStatus?['sisters']        as num?)?.toInt() ?? 0;
    final hi             = (_userStatus?['height_inches']  as num?)?.toDouble() ?? 65;
    final heightStr      = "${hi ~/ 12}'${hi.round() % 12}\"";
    final contactPhone   = _userStatus?['contact_phone']   as String? ?? '';
    final contactPhone2  = _userStatus?['contact_phone_2'] as String? ?? '';
    final proposalNumber = (_userStatus?['proposal_number'] as num?)?.toInt();
    final webLink        = proposalNumber != null
        ? 'https://joronline.com/profile/$proposalNumber'
        : 'https://jor-share.asdmglx.workers.dev/$id';

    String formatPK(String raw) {
      String digits = raw.replaceAll(RegExp(r'[^\d]'), '');
      if (digits.startsWith('92')) digits = digits.substring(2);
      if (digits.startsWith('0')) digits = digits.substring(1);
      if (digits.length >= 10) return '+92 ${digits.substring(0, 3)} ${digits.substring(3)}';
      return '+92 $digits';
    }

    final _wa = StringBuffer();
    _wa.write('*Rishta Proposal — Jor Matrimonial 💫*\n\n');
    // Sharing your own profile — always show the real number, no masking.
    if (contactPhone2.isNotEmpty) {
      _wa.write('*Contact 1:* ${formatPK(contactPhone)}\n');
      _wa.write('*Contact 2:* ${formatPK(contactPhone2)}\n');
    } else if (contactPhone.isNotEmpty) {
      _wa.write('*Contact:* ${formatPK(contactPhone)}\n');
    }
    _wa.write('\n');
    _wa.write('👤 *Name:* $name\n');
    _wa.write('🎂 *Age:* $age yrs\n');
    _wa.write('📏 *Height:* $heightStr\n');
    if (country.isNotEmpty) _wa.write('🌍 *Lives in:* $country\n');
    _wa.write('📍 *City:* from $city\n');
    if (homeType.isNotEmpty) _wa.write('🏠 *Home:* $homeType${houseSize.isNotEmpty ? " ($houseSize)" : ""}\n');
    if (location.isNotEmpty) _wa.write('🛣️ *Location:* $location\n');
    _wa.write('💼 *Profession:* $profession\n');
    _wa.write('🎓 *Education:* $education\n');
    if (maritalStatus.isNotEmpty) {
      final needsKids = ['Divorced', 'Khula', 'Widowed'].contains(maritalStatus);
      final b = (_userStatus?['boys'] as num?)?.toInt() ?? 0;
      final g = (_userStatus?['girls'] as num?)?.toInt() ?? 0;
      final kidsStr = (needsKids && (b > 0 || g > 0))
          ? ' (${[if (b > 0) '$b boy${b > 1 ? "s" : ""}', if (g > 0) '$g girl${g > 1 ? "s" : ""}'].join(", ")})'
          : '';
      _wa.write('💍 *Marital Status:* $maritalStatus$kidsStr\n');
    }
    _wa.write('🧬 *Caste:* $caste\n');
    {
      final sectExtras = <String>[];
      if (practiceLevel.isNotEmpty) sectExtras.add(practiceLevel);
      if (hijab.isNotEmpty) sectExtras.add('Hijab: $hijab');
      if (beard.isNotEmpty) sectExtras.add('Beard: $beard');
      final sectStr = sectExtras.isEmpty ? sect : '$sect (${sectExtras.join(", ")})';
      _wa.write('🕌 *Sect:* $sectStr\n');
    }
    if (fatherAlive != null || motherAlive != null) {
      final fStr = fatherAlive == null ? '' : 'Father: ${fatherAlive ? "Alive" : "Deceased"}';
      final mStr = motherAlive == null ? '' : 'Mother: ${motherAlive ? "Alive" : "Deceased"}';
      final fm = [fStr, mStr].where((s) => s.isNotEmpty).join(', ');
      if (fm.isNotEmpty) _wa.write('👨\u200d👩\u200d👧 *Parents:* $fm\n');
    }
    if (brothers > 0 || sisters > 0) {
      final sibParts = <String>[];
      if (brothers > 0) sibParts.add('$brothers brother${brothers > 1 ? "s" : ""}');
      if (sisters > 0) sibParts.add('$sisters sister${sisters > 1 ? "s" : ""}');
      _wa.write('👫 *Siblings:* ' + sibParts.join(', ') + '\n\n');
    }
    if (about.isNotEmpty) _wa.write('\n💬 *About:* ${about.length > 120 ? about.substring(0, 120) + "..." : about}\n');
    _wa.write('\n✅ _Verified matrimonial profiles on Jor_');
    _wa.write('\n\n🔗 $webLink');
    final text = _wa.toString();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const SizedBox(height: 8),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE0E0E0), borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(children: [
                const Text('Share My Profile', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: kInk)),
                const Spacer(),
                GestureDetector(onTap: () => Navigator.pop(context), child: const Icon(Icons.close_rounded, color: kInkFaint)),
              ]),
            ),
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Share $name\'s profile with friends & family', style: const TextStyle(fontSize: 13, color: kInkFaint)),
              ),
            ),
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _SubShareOption(
                    svgAsset: 'assets/icons/whatsapp-share.svg',
                    label: 'WhatsApp',
                    color: const Color(0xFF25D366),
                    onTap: () async {
                      Navigator.pop(context);
                      final url = Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}');
                      await launchUrl(url, mode: LaunchMode.externalApplication);
                    },
                  ),
                  const SizedBox(width: 40),
                  _SubShareOption(
                    iconData: Icons.link_rounded,
                    label: 'Copy Link',
                    color: kPurple,
                    onTap: () {
                      Navigator.pop(context);
                      Clipboard.setData(ClipboardData(text: webLink));
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        content: const Text('Link copied!'),
                        backgroundColor: kPurple,
                        behavior: SnackBarBehavior.floating,
                        margin: const EdgeInsets.fromLTRB(16, 0, 16, 72),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        duration: const Duration(seconds: 2),
                      ));
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ]),
        ),
      ),
    );
  }

  /// Public entry point for forcing a logout from outside this screen —
  /// e.g. GroupFeedScreen's cold-start check, which discovers the account
  /// was permanently deleted by querying the DB directly (catching the case
  /// where the deletion happened while the app wasn't even running, so the
  /// realtime listener in _subscribeToStatusChanges never had a chance to
  /// see it). Does the exact same clearing _confirmLogout does, just without
  /// the confirmation dialog since this isn't a choice the person is making.
  Future<void> forceLogout() => _performLogout();

  Future<void> _confirmLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Log Out?', style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: kInk)),
        content: const Text('You will need to enter your CNIC and password to log in again.', style: TextStyle(fontSize: 13, color: kInkLight)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel', style: TextStyle(color: kInkLight))),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Log Out', style: TextStyle(color: kRose, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _performLogout();
  }

  /// Clears the local session entirely and notifies MainShell/GroupFeedScreen
  /// so every part of the app (avatar, FAB, header filter icon, filters)
  /// snaps back to the true signed-out visitor state immediately, instead of
  /// only clearing this screen's own in-memory fields. Used both by the
  /// explicit "Log Out" button (after confirmation, above) and by the
  /// automatic logout that fires when this account gets permanently deleted
  /// while the person is actively using the app (see _subscribeToStatusChanges).
  Future<void> _performLogout() async {
    // Clear this device's push token from the profile being logged out of —
    // otherwise it stays on file and this device keeps getting notified for
    // that profile even after logout (or worse, after a different profile
    // logs in on the same device later).
    final loggedOutProposalId = _userStatus?['id'] as String?;
    if (loggedOutProposalId != null && !loggedOutProposalId.startsWith('admin:')) {
      try {
        final cnic = await _db.resolveEffectiveCnic();
        if (cnic != null) {
          await Supabase.instance.client.rpc('set_fcm_token_by_id', params: {
            'p_id': loggedOutProposalId,
            'p_cnic': cnic,
            'p_token': null,
          });
        }
      } catch (_) {}
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('is_paid_user');
    await prefs.remove('user_name');
    await prefs.remove('user_cnic');
    await prefs.remove('user_proposal_id');
    await prefs.remove('user_expiry');
    await prefs.remove('user_tier');
    await prefs.remove('user_status');
    await prefs.remove('user_photo');
    await prefs.remove('user_photo_url');
    await prefs.remove('is_admin_view');
    await prefs.remove('admin_account_id');
    await prefs.remove('activated_cnic');
    // Clear in-memory CNIC from supabase service
    _db.clearActivatedCnic();
    _statusChannel?.unsubscribe();
    // Bell history is keyed off user_proposal_id, which was just removed
    // above — refresh now so it clears immediately instead of showing the
    // logged-out profile's history until the next resume.
    NotificationService.instance.refresh();
    if (mounted) {
      setState(() { _codeSuccess = false; _loggedInThisSession = false; _userStatus = null; _cachedPhotoUrl = null; _isAdminView = false; });
      _bumpCardVersion();
      // Clear the previous account's cached name/photo/paid-state off the
      // feed screen too — it stays alive in memory (IndexedStack), so
      // without this it would keep showing the logged-out account's avatar
      // or a stale locked/unlocked state until a full app restart.
      widget.onLoggedOut?.call();
      widget.onBack?.call();
    }
  }

  void _showAccountSettingsMenu({required bool isLocked}) {
    // Delete stays active for admin accounts even though other actions
    // (represented by the isLocked param passed in) are locked for them.
    // Matches the website: locked only for a genuinely pending submission,
    // not for Rejected/Removed/Inactive.
    final isPending = (_userStatus?['status'] as String? ?? '') == 'pending';
    final deleteLocked = isPending;
    // Named statusLabel (not label) — the nested row() function below
    // already has its own 'label' parameter, and shadowing it here would
    // be an easy way to accidentally reference the wrong one.
    final statusLabel = _statusLabel(_userStatus);
    Widget row({required IconData icon, required String label, required Color color, required VoidCallback? onTap}) {
      final disabled = onTap == null;
      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
          child: Row(children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(color: (disabled ? kInkFaint : color).withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, size: 18, color: disabled ? kInkFaint : color),
            ),
            const SizedBox(width: 14),
            Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: disabled ? kInkFaint : kInk)),
          ]),
        ),
      );
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (sheetCtx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 10),
          Container(width: 36, height: 4, decoration: BoxDecoration(color: kBorder, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 18),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text('Account', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kInkLight, letterSpacing: 0.3)),
            ),
          ),
          const SizedBox(height: 4),
          row(
            icon: Icons.lock_outline_rounded, label: 'Change Password', color: kPurple,
            onTap: () { Navigator.pop(sheetCtx); _showChangePasswordDialog(); },
          ),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: Divider(height: 1, color: kBorder)),
          row(
            icon: Icons.privacy_tip_outlined, label: 'Privacy Policy', color: kPurple,
            onTap: () { Navigator.pop(sheetCtx); launchUrl(Uri.parse('https://joronline.com/privacy-policy'), mode: LaunchMode.externalApplication); },
          ),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: Divider(height: 1, color: kBorder)),
          row(
            icon: Icons.description_outlined, label: 'Terms & Conditions', color: kPurple,
            onTap: () { Navigator.pop(sheetCtx); launchUrl(Uri.parse('https://joronline.com/terms'), mode: LaunchMode.externalApplication); },
          ),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: Divider(height: 1, color: kBorder)),
          row(
            icon: Icons.logout_rounded, label: 'Log Out', color: kPurple,
            onTap: () { Navigator.pop(sheetCtx); _confirmLogout(); },
          ),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: Divider(height: 1, color: kBorder)),
          row(
            icon: Icons.delete_outline_rounded, label: 'Delete Account', color: kRose,
            onTap: deleteLocked ? null : () {
              Navigator.pop(sheetCtx);
              // Matches the website: Rejected/Removed skip straight to
              // password confirmation, same as Admin — no reason collected.
              if (_isAdminView) {
                _confirmDelete('Admin account removed');
              } else if (statusLabel == 'Rejected' || statusLabel == 'Removed') {
                _confirmDelete('');
              } else {
                _showDeleteOptions();
              }
            },
          ),
          const SizedBox(height: 10),
        ]),
      ),
    );
  }

  String? get prefs_cnic => null;

  void _showChangePasswordDialog() {
    final currentCtrl = TextEditingController();
    final newCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();
    String? errorMsg;
    bool saving = false;
    bool obscureCurrent = true, obscureNew = true, obscureConfirm = true;

    Widget field({
      required String label,
      required TextEditingController controller,
      required bool obscure,
      required VoidCallback onToggleObscure,
      String? hint,
    }) {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kInkLight)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          obscureText: obscure,
          style: const TextStyle(fontSize: 13.5, color: kInk),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 12.5, color: kInkFaint),
            filled: true,
            fillColor: kSurface,
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: kBorder)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: kBorder)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: kPurple, width: 1.5)),
            suffixIcon: IconButton(
              icon: Icon(obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 18, color: kInkFaint),
              onPressed: onToggleObscure,
            ),
          ),
        ),
      ]);
    }

    showDialog(
      context: context,
      builder: (dialogCtx) => StatefulBuilder(builder: (dialogCtx, setDialogState) => Dialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                width: 38, height: 38,
                decoration: BoxDecoration(color: kPurpleLight, borderRadius: BorderRadius.circular(11)),
                child: const Icon(Icons.lock_outline_rounded, color: kPurple, size: 19),
              ),
              const SizedBox(width: 12),
              const Text('Change Password', style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: kInk)),
            ]),
            const SizedBox(height: 18),
            field(label: 'Current Password', controller: currentCtrl, obscure: obscureCurrent,
                onToggleObscure: () => setDialogState(() => obscureCurrent = !obscureCurrent)),
            const SizedBox(height: 12),
            field(label: 'New Password', controller: newCtrl, obscure: obscureNew, hint: 'Min. 6 characters',
                onToggleObscure: () => setDialogState(() => obscureNew = !obscureNew)),
            const SizedBox(height: 12),
            field(label: 'Confirm New Password', controller: confirmCtrl, obscure: obscureConfirm,
                onToggleObscure: () => setDialogState(() => obscureConfirm = !obscureConfirm)),
            if (errorMsg != null) ...[
              const SizedBox(height: 12),
              Row(children: [
                const Icon(Icons.error_rounded, color: kRose, size: 14),
                const SizedBox(width: 6),
                Expanded(child: Text(errorMsg!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kRose))),
              ]),
            ],
            const SizedBox(height: 20),
            Row(children: [
              Expanded(child: TextButton(
                onPressed: saving ? null : () => Navigator.pop(dialogCtx),
                style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 13)),
                child: const Text('Cancel', style: TextStyle(color: kInkLight, fontWeight: FontWeight.w600)),
              )),
              const SizedBox(width: 10),
              Expanded(child: GestureDetector(
                onTap: saving ? null : () async {
                  final current = currentCtrl.text;
                  final newPass = newCtrl.text;
                  final confirm = confirmCtrl.text;
                  final actualPassword = _userStatus?['password'] as String? ?? '';

                  if (current != actualPassword) {
                    setDialogState(() => errorMsg = 'Current password is incorrect');
                    return;
                  }
                  if (newPass.length < 6) {
                    setDialogState(() => errorMsg = 'Min password length is 6 characters');
                    return;
                  }
                  if (newPass != confirm) {
                    setDialogState(() => errorMsg = 'Passwords do not match');
                    return;
                  }

                  setDialogState(() { saving = true; errorMsg = null; });
                  try {
                    final id = _userStatus?['id'] as String?;
                    if (id == null) throw Exception('Missing profile id');
                    if (id.startsWith('admin:')) {
                      // Admin sessions aren't real proposals — their
                      // password lives in admin_accounts, and now goes
                      // through a security-definer function that
                      // re-verifies the current password server-side,
                      // rather than a direct table write (admin_accounts
                      // no longer grants raw write access to the anon key).
                      final cnic = _userStatus?['cnic'] as String? ?? '';
                      final ok = await Supabase.instance.client.rpc('admin_account_self_update_password', params: {
                        'p_cnic': cnic,
                        'p_current_password': current,
                        'p_new_password': newPass,
                      }) as bool? ?? false;
                      if (!ok) throw Exception('Update rejected');
                    } else {
                      final cnic = await _db.resolveEffectiveCnic();
                      if (cnic == null) throw Exception('Could not verify account');
                      await Supabase.instance.client.rpc('update_own_proposal', params: {
                        'p_id': id,
                        'p_cnic': cnic,
                        'p_changes': {'password': newPass},
                      });
                    }
                    if (mounted) setState(() => _userStatus = {...?_userStatus, 'password': newPass});
                    if (dialogCtx.mounted) Navigator.pop(dialogCtx);
                  } catch (_) {
                    setDialogState(() { saving = false; errorMsg = 'Could not update password — try again'; });
                  }
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  decoration: BoxDecoration(color: saving ? kPurple.withOpacity(0.5) : kPurple, borderRadius: BorderRadius.circular(11)),
                  child: Center(
                    child: saving
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Save', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13.5)),
                  ),
                ),
              )),
            ]),
          ]),
        ),
      )),
    );
  }


  Widget _buildAvatar() {
    final s = _S.of(context);
    if (_loggedInThisSession) {
      final name = _userStatus?['name'] as String? ?? '';
      final initials = name.trim().isEmpty ? '?' : name.trim().split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase();
      final photo = (_cachedPhotoUrl != null || _userStatus?['profile_photo_url'] != null)
          ? ClipOval(child: CachedNetworkImage(
              imageUrl: _cachedPhotoUrl ?? _userStatus!['profile_photo_url'] as String,
              width: s.d(40), height: s.d(40), fit: BoxFit.cover,
              placeholder: (_, __) => _initialsAvatar(initials),
              errorWidget: (_, __, ___) => _initialsAvatar(initials)))
          : _initialsAvatar(initials);
      return photo;
    }
    return Container(width: s.d(40), height: s.d(40), decoration: BoxDecoration(color: kPurpleLight, borderRadius: BorderRadius.circular(s.s(12))), child: Icon(Icons.login_rounded, color: kPurple, size: s.d(20)));
  }

  Widget _initialsAvatar(String initials) {
    final s = _S.of(context);
    return ClipOval(
      child: Container(
        width: s.d(40), height: s.d(40),
        color: kPurple,
        child: Center(child: Text(initials, style: TextStyle(color: Colors.white, fontSize: s.f(15), fontWeight: FontWeight.w800))),
      ),
    );
  }

  String _generateAffiliateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    final rand = Random();
    return List.generate(6, (_) => chars[rand.nextInt(chars.length)]).join();
  }

  void _showJoinAffiliateDialog(BuildContext ctx) {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final passwordCtrl = TextEditingController();
    final confirmPasswordCtrl = TextEditingController();
    final addressCtrl = TextEditingController();
    String? selectedCity;
    String code = _generateAffiliateCode();
    Uint8List? cnicFrontBytes;
    Uint8List? cnicBackBytes;
    TimeOfDay? openTime;
    TimeOfDay? closeTime;
    bool obscurePw = true;
    bool obscureConfirmPw = true;
    bool submitting = false;
    String? error;

    String formatTime(TimeOfDay t) {
      final hour12 = t.hourOfPeriod == 0 ? 12 : t.hourOfPeriod;
      final minute = t.minute.toString().padLeft(2, '0');
      final period = t.period == DayPeriod.am ? 'AM' : 'PM';
      return '$hour12:$minute $period';
    }

    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) => StatefulBuilder(
        builder: (sheetCtx, setSheet) {
          final bottom = MediaQuery.of(sheetCtx).viewInsets.bottom + MediaQuery.of(sheetCtx).padding.bottom;

          Future<void> pickCnic({required bool isFront}) async {
            final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85, maxWidth: 1600);
            if (picked == null) return;
            final bytes = await File(picked.path).readAsBytes();
            setSheet(() { if (isFront) { cnicFrontBytes = bytes; } else { cnicBackBytes = bytes; } });
          }

          Future<void> pickTime({required bool isOpen}) async {
            final initial = (isOpen ? openTime : closeTime) ?? const TimeOfDay(hour: 9, minute: 0);
            final picked = await showTimePicker(
              context: sheetCtx, initialTime: initial,
              builder: (c, child) => Theme(data: Theme.of(c).copyWith(colorScheme: const ColorScheme.light(primary: kPurple)), child: child!),
            );
            if (picked == null) return;
            setSheet(() { if (isOpen) { openTime = picked; } else { closeTime = picked; } });
          }

          InputDecoration deco(String label, IconData icon, {Widget? suffix}) => InputDecoration(
            labelText: label, labelStyle: const TextStyle(fontSize: 13, color: kInkLight),
            prefixIcon: Icon(icon, size: 18, color: kInkFaint), suffixIcon: suffix,
            filled: true, fillColor: const Color(0xFFF7F6FE),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          );

          Widget cnicPicker(String label, Uint8List? bytes, VoidCallback onTap) => GestureDetector(
            onTap: onTap,
            child: Container(
              height: 84,
              decoration: BoxDecoration(color: const Color(0xFFF7F6FE), borderRadius: BorderRadius.circular(10), border: Border.all(color: bytes != null ? kPurple.withOpacity(0.5) : kBorder)),
              child: bytes != null
                  ? ClipRRect(borderRadius: BorderRadius.circular(9), child: Image.memory(bytes, fit: BoxFit.cover, width: double.infinity))
                  : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      const Icon(Icons.add_a_photo_outlined, color: kInkFaint, size: 20),
                      const SizedBox(height: 4),
                      Text(label, style: const TextStyle(color: kInkLight, fontSize: 11.5, fontWeight: FontWeight.w600)),
                    ]),
            ),
          );

          Widget timeButton(String label, TimeOfDay? time, VoidCallback onTap) => GestureDetector(
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              decoration: BoxDecoration(color: const Color(0xFFF7F6FE), borderRadius: BorderRadius.circular(10), border: Border.all(color: time != null ? kPurple.withOpacity(0.5) : kBorder)),
              child: Row(children: [
                const Icon(Icons.access_time_rounded, size: 18, color: kInkFaint),
                const SizedBox(width: 8),
                Expanded(child: Text(time != null ? formatTime(time) : label, style: TextStyle(fontSize: 14, color: time != null ? kInk : kInkLight, fontWeight: time != null ? FontWeight.w600 : FontWeight.w400))),
              ]),
            ),
          );

          return Container(
            decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
            padding: EdgeInsets.fromLTRB(20, 20, 20, bottom + 24),
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Expanded(child: Text('Join as Affiliate', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: kInk))),
                  GestureDetector(onTap: () => Navigator.pop(sheetCtx), child: const Icon(Icons.close_rounded, color: kInkFaint, size: 22)),
                ]),
                const SizedBox(height: 4),
                const Text('Fill in your details and share your code with others to earn rewards.', style: TextStyle(fontSize: 12.5, color: kInkLight)),
                const SizedBox(height: 18),

                TextField(controller: nameCtrl, style: const TextStyle(fontSize: 14, color: kInk), decoration: deco('Full Name', Icons.person_outline_rounded)),
                const SizedBox(height: 12),
                TextField(
                  controller: phoneCtrl, keyboardType: TextInputType.phone,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
                  style: const TextStyle(fontSize: 14, color: kInk), decoration: deco('Phone Number', Icons.phone_outlined),
                ),
                const SizedBox(height: 12),
                SearchableGroupedDropdown(label: 'City', value: selectedCity, groups: SupabaseService.instance.citiesGrouped,
                  onChanged: (v) => setSheet(() => selectedCity = v), icon: Icons.location_city_outlined),
                const SizedBox(height: 12),
                TextField(controller: addressCtrl, style: const TextStyle(fontSize: 14, color: kInk), decoration: deco('Support Center Address (optional)', Icons.location_on_outlined)),
                const SizedBox(height: 12),

                const Text('Timing', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kInkLight)),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(child: timeButton('Opens', openTime, () => pickTime(isOpen: true))),
                  const SizedBox(width: 10),
                  Expanded(child: timeButton('Closes', closeTime, () => pickTime(isOpen: false))),
                ]),
                const SizedBox(height: 12),

                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(color: kPurpleLight, borderRadius: BorderRadius.circular(10)),
                  child: Row(children: [
                    const Icon(Icons.tag_rounded, size: 18, color: kPurple),
                    const SizedBox(width: 8),
                    Expanded(child: Text('Your Code: $code', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: kPurple, letterSpacing: 2))),
                    GestureDetector(onTap: () => setSheet(() => code = _generateAffiliateCode()), child: const Icon(Icons.refresh_rounded, size: 18, color: kPurple)),
                  ]),
                ),
                const SizedBox(height: 16),

                const Text('CNIC Photos', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kInkLight)),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(child: cnicPicker('CNIC Front', cnicFrontBytes, () => pickCnic(isFront: true))),
                  const SizedBox(width: 10),
                  Expanded(child: cnicPicker('CNIC Back', cnicBackBytes, () => pickCnic(isFront: false))),
                ]),
                const SizedBox(height: 16),

                TextField(
                  controller: passwordCtrl, obscureText: obscurePw,
                  style: const TextStyle(fontSize: 14, color: kInk),
                  decoration: deco('Password', Icons.lock_outline_rounded,
                    suffix: GestureDetector(onTap: () => setSheet(() => obscurePw = !obscurePw), child: Icon(obscurePw ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 18, color: kInkFaint))),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: confirmPasswordCtrl, obscureText: obscureConfirmPw,
                  style: const TextStyle(fontSize: 14, color: kInk),
                  decoration: deco('Confirm Password', Icons.lock_outline_rounded,
                    suffix: GestureDetector(onTap: () => setSheet(() => obscureConfirmPw = !obscureConfirmPw), child: Icon(obscureConfirmPw ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 18, color: kInkFaint))),
                ),

                if (error != null) ...[
                  const SizedBox(height: 12),
                  Text(error!, style: const TextStyle(fontSize: 12.5, color: kRose, fontWeight: FontWeight.w600)),
                ],

                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPurple, foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      disabledBackgroundColor: kPurple.withOpacity(0.6),
                    ),
                    onPressed: submitting ? null : () async {
                      setSheet(() => error = null);
                      if (nameCtrl.text.trim().isEmpty) { setSheet(() => error = 'Name is required'); return; }
                      final digits = phoneCtrl.text.replaceAll(RegExp(r'[^\d]'), '');
                      final requiredLen = digits.startsWith('0') ? 11 : 10;
                      if (digits.isEmpty || digits.length != requiredLen) { setSheet(() => error = 'Enter a valid Pakistani number ($requiredLen digits)'); return; }
                      if (passwordCtrl.text.length < 6) { setSheet(() => error = 'Password must be at least 6 characters'); return; }
                      if (passwordCtrl.text != confirmPasswordCtrl.text) { setSheet(() => error = 'Passwords do not match'); return; }
                      if (openTime == null || closeTime == null) { setSheet(() => error = 'Please select opening and closing time'); return; }
                      if (cnicFrontBytes == null) { setSheet(() => error = 'CNIC front photo is required'); return; }
                      if (cnicBackBytes == null) { setSheet(() => error = 'CNIC back photo is required'); return; }

                      setSheet(() => submitting = true);
                      try {
                        final frontUrl = await SupabaseService.instance.uploadAffiliateCnic(cnicFrontBytes!, side: 'front');
                        final backUrl = await SupabaseService.instance.uploadAffiliateCnic(cnicBackBytes!, side: 'back');
                        await SupabaseService.instance.client.rpc('affiliate_self_register_secure', params: {
                          'p_name': nameCtrl.text.trim(),
                          'p_phone': phoneCtrl.text.trim(),
                          'p_password': passwordCtrl.text,
                          'p_code': code,
                          'p_support_center_address': addressCtrl.text.trim().isEmpty ? null : addressCtrl.text.trim(),
                          'p_support_center_city': selectedCity,
                          'p_timing': '${formatTime(openTime!)} - ${formatTime(closeTime!)}',
                          'p_cnic_front_url': frontUrl,
                          'p_cnic_back_url': backUrl,
                        });
                        if (sheetCtx.mounted) Navigator.pop(sheetCtx);
                        if (mounted) ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Request submitted! We will contact you soon.'), backgroundColor: kPurple),
                        );
                      } catch (e) {
                        setSheet(() { submitting = false; error = 'Something went wrong. Please try again.'; });
                      }
                    },
                    child: submitting
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Submit', style: TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
              ]),
            ),
          );
        },
      ),
    );
  }

  // Mirrors the user account "Forgot Password" flow in main.dart exactly —
  // same structure, same WhatsApp-to-admin handoff, same CNIC front photo
  // requirement for identity verification — with the one difference the
  // affiliate flow needs: identified by referral code instead of CNIC
  // number, since that's how affiliates are looked up.
  void _showAffiliateForgotPasswordDialog(BuildContext ctx) {
    final codeCtrl = TextEditingController();
    File? photoFile;
    String? errorMsg;
    bool submitting = false;

    showModalBottomSheet(
      context: ctx,
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
                const SizedBox(height: 2),
                const Text(
                  'We\'ll verify you on WhatsApp and reset your password.',
                  style: TextStyle(fontSize: 13, color: kInkLight, height: 1.4),
                ),
                const SizedBox(height: 18),
                const Text('Referral Code', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kInkLight)),
                const SizedBox(height: 6),
                TextField(
                  controller: codeCtrl,
                  textCapitalization: TextCapitalization.characters,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kInk, letterSpacing: 2),
                  onChanged: (_) => setSheetState(() => errorMsg = null),
                  decoration: InputDecoration(
                    hintText: 'e.g. JOR4X2',
                    hintStyle: const TextStyle(color: kInkFaint, fontSize: 13.5),
                    filled: true, fillColor: kSurface,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    prefixIcon: const Icon(Icons.tag_rounded, color: kInkFaint, size: 18),
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
                      final code = codeCtrl.text.trim().toUpperCase();
                      if (code.isEmpty) { setSheetState(() => errorMsg = 'Enter your referral code.'); return; }
                      if (photoFile == null) { setSheetState(() => errorMsg = 'Please upload a color photo of your CNIC front side.'); return; }
                      setSheetState(() { submitting = true; errorMsg = null; });

                      String url;
                      try {
                        final bytes = await photoFile!.readAsBytes();
                        url = await SupabaseService.instance.uploadAffiliateCnic(bytes, side: 'front');
                      } catch (_) {
                        if (sheetCtx.mounted) setSheetState(() { submitting = false; errorMsg = 'Failed to upload CNIC photo. Please try again.'; });
                        return;
                      }
                      if (!sheetCtx.mounted) return;

                      final waNumber = SupabaseService.instance.cachedSettings['whatsapp_number'] ?? '923000000000';
                      final text = 'Hi, I forgot my affiliate password.\n\nMy Referral Code: $code\n\nCNIC front photo (for verification): $url\n\nPlease help me reset my password.';
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
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Send via WhatsApp', style: TextStyle(fontWeight: FontWeight.w800)),
                  )),
                ]),
              ]),
            ),
          );
        },
      ),
    );
  }

  void _showAffiliateLoginDialog(BuildContext ctx) {
    final codeCtrl = TextEditingController();
    final passwordCtrl = TextEditingController();
    bool obscurePw = true;
    bool loading = false;
    String? error;
    Map<String, dynamic>? affiliateData;

    showDialog(
      context: ctx,
      builder: (_) => StatefulBuilder(
        builder: (dlgCtx, setDlg) => AlertDialog(
          backgroundColor: kCardBg,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text(affiliateData != null ? 'Welcome, ${affiliateData!['name']}!' : 'Affiliate Login',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: kInk)),
          content: affiliateData != null
            ? _buildAffiliateStats(affiliateData!)
            : Column(mainAxisSize: MainAxisSize.min, children: [
                const Text('Enter your affiliate code and password to view your referrals and earnings.', style: TextStyle(fontSize: 12, color: kInkLight)),
                const SizedBox(height: 16),
                TextField(
                  controller: codeCtrl,
                  textCapitalization: TextCapitalization.characters,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: kPurple, letterSpacing: 3),
                  decoration: InputDecoration(
                    labelText: 'Your Affiliate Code',
                    labelStyle: const TextStyle(fontSize: 13, color: kInkLight),
                    prefixIcon: const Icon(Icons.tag_rounded, size: 18, color: kInkFaint),
                    filled: true, fillColor: const Color(0xFFF7F6FE),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: passwordCtrl,
                  obscureText: obscurePw,
                  style: const TextStyle(fontSize: 14, color: kInk),
                  decoration: InputDecoration(
                    labelText: 'Password',
                    labelStyle: const TextStyle(fontSize: 13, color: kInkLight),
                    prefixIcon: const Icon(Icons.lock_outline_rounded, size: 18, color: kInkFaint),
                    suffixIcon: GestureDetector(
                      onTap: () => setDlg(() => obscurePw = !obscurePw),
                      child: Icon(obscurePw ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 18, color: kInkFaint),
                    ),
                    filled: true, fillColor: const Color(0xFFF7F6FE),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                ),
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () { Navigator.pop(dlgCtx); _showAffiliateForgotPasswordDialog(ctx); },
                    style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                    child: const Text('Forgot Password?', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kPurple)),
                  ),
                ),
                if (error != null) ...[
                  const SizedBox(height: 4),
                  Text(error!, style: const TextStyle(fontSize: 12, color: kRose)),
                ],
              ]),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dlgCtx),
              child: Text(affiliateData != null ? 'Close' : 'Cancel', style: const TextStyle(color: kInkFaint)),
            ),
            if (affiliateData == null)
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPurple, foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: loading ? null : () async {
                  final code = codeCtrl.text.trim().toUpperCase();
                  if (code.isEmpty) { setDlg(() => error = 'Enter your affiliate code.'); return; }
                  if (passwordCtrl.text.isEmpty) { setDlg(() => error = 'Enter your password.'); return; }
                  setDlg(() { loading = true; error = null; });
                  try {
                    final res = await SupabaseService.instance.client.rpc('affiliate_login_secure', params: {
                      'p_code': code,
                      'p_password': passwordCtrl.text,
                    });
                    if (res == null || res['error'] != null) {
                      setDlg(() { loading = false; error = res?['error'] ?? 'Login failed. Please try again.'; });
                      return;
                    }
                    final settings = SupabaseService.instance.cachedSettings;
                    final rate = settings['referral_commission'] ?? '500';
                    final dataWithRate = Map<String, dynamic>.from(res as Map);
                    dataWithRate['referral_rate'] = rate;
                    setDlg(() { loading = false; affiliateData = dataWithRate; });
                  } catch (e) {
                    debugPrint('Affiliate login failed: $e');
                    setDlg(() { loading = false; error = "Couldn't log in — please check your connection and try again."; });
                  }
                },
                child: loading
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Login'),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildAffiliateStats(Map<String, dynamic> data) {
    final paid      = (data['paid_commission'] as num?)?.toInt() ?? 0;
    final pending   = (data['pending_amount'] as num?)?.toInt() ?? 0;
    final referrals = (data['referrals'] as num?)?.toInt() ?? 0;
    final rate      = data['referral_rate'] ?? '500';

    return Column(mainAxisSize: MainAxisSize.min, children: [
      Row(children: [
        _aStatBox('Commission Rate', 'Rs $rate', kPurple),
        const SizedBox(width: 8),
        _aStatBox('Total Referrals', '$referrals', kAmber),
      ]),
      const SizedBox(height: 8),
      Row(children: [
        _aStatBox('Amount Paid', 'Rs $paid', const Color(0xFF2E7D32)),
        const SizedBox(width: 8),
        _aStatBox('Pending', 'Rs $pending', kRose),
      ]),
    ]);
  }

  Widget _aStatBox(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFF7F6FE),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: kBorder),
        ),
        child: Column(children: [
          Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 10, color: kInkLight), textAlign: TextAlign.center),
        ]),
      ),
    );
  }

  String _formatExpiry(String isoDate) {
    final d = DateTime.tryParse(isoDate);
    if (d == null) return isoDate;
    final months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }

  bool _hasFeaturedBoostToday(Map<String, dynamic>? s) {
    if (s == null) return false;
    final boosts = s['featured_boosts'] as List?;
    if (boosts == null || boosts.isEmpty) return false;
    final now = DateTime.now();
    return boosts.any((b) {
      final scheduled = b['scheduled_date'] != null ? DateTime.tryParse(b['scheduled_date']) : null;
      final isUsed = b['is_used'] as bool? ?? true;
      if (scheduled == null || isUsed) return false;
      return now.isAfter(scheduled) && now.isBefore(scheduled.add(const Duration(hours: 24)));
    });
  }

  String _statusLabel(Map<String, dynamic>? s) {
    if (s == null) return 'Inactive';
    final status = s['status'] as String? ?? '';
    final deletedFrom = s['deleted_from'] as String?;
    final tier = s['subscription_tier'] as String? ?? 'none';
    final isBoosted = s['is_boosted'] == true;
    final expiry = s['subscription_expiry'] != null ? DateTime.tryParse(s['subscription_expiry']) : null;
    final isActive = expiry != null && expiry.isAfter(DateTime.now());
    // Mirrors the website's getStatusLabel() exactly, same order — see
    // app/my-profile/MyProposalClient.tsx. The admin app doesn't set a
    // literal 'rejected' status for a submission it rejects from the
    // pending queue — it calls the same delete path used for removing a
    // live user, just tagged deleted_from: 'orders'. That tag is the only
    // thing distinguishing "rejected before ever going live" from
    // "removed after being live"; this was previously checking for the
    // wrong value ('users' instead of 'orders'), which meant almost every
    // deleted row defaulted to the wrong label.
    if (status == 'deleted') return deletedFrom == 'orders' ? 'Rejected' : 'Removed';
    if (status == 'rejected') return 'Rejected';
    if (status == 'pending') return 'Pending';
    if (status == 'paused') return 'Paused';
    // Featured: only when subscription is also active
    if (isActive && (_hasFeaturedBoostToday(s) || isBoosted || tier == 'featured')) return 'Featured';
    // Active with valid subscription
    if ((status == 'active' || status == 'approved') && isActive) return 'Active';
    // Subscription lapsed
    if (expiry != null && !expiry.isAfter(DateTime.now())) return 'Inactive';
    if (status == 'active' || status == 'approved') return 'Active';
    return 'Inactive';
  }

  Color _statusColor(Map<String, dynamic>? s) {
    switch (_statusLabel(s)) {
      case 'Active':   return kGreen;
      case 'Featured': return kAmber;
      case 'Inactive': return const Color(0xFF6B7280);
      case 'Removed':  return kRose;
      case 'Rejected': return kRose;
      case 'Paused':   return const Color(0xFF6B7280);
      case 'Pending':  return const Color(0xFFF59E0B); // amber-500
      default:         return const Color(0xFF6B7280);
    }
  }

  Widget _buildStatusTag(Map<String, dynamic>? s) {
    final label = _statusLabel(s);
    final color = _statusColor(s);
    final sc = _S.of(context);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: sc.s(6), vertical: sc.s(2)),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(sc.s(5))),
      child: Text(label, style: TextStyle(fontSize: sc.f(10), color: Colors.white, fontWeight: FontWeight.w800)),
    );
  }

  // Lets another screen (e.g. the Login form inside the create-account
  // bottom sheet) drive this exact same login flow — same admin check,
  // password verification, activation RPC, and SharedPreferences/session
  // setup — without duplicating any of that logic. Returns null on success,
  // or an error message on failure.
  Future<String?> loginProgrammatically(String cnic, String password) async {
    _codeController.text = cnic;
    _pinController.text = password;
    await _activateCode();
    if (_codeError) return _codeErrorMessage ?? 'Could not log in. Check your CNIC and password.';
    return null;
  }

  Future<void> _activateCode() async {
    final raw = _codeController.text.trim();
    final digits = raw.replaceAll('-', '');
    final pin = _pinController.text.trim();

    if (digits.length < 13) {
      setState(() { _codeError = true; _codeErrorMessage = 'Enter complete CNIC (13 digits).'; });
      return;
    }
    if (pin.length < 6) {
      setState(() { _codeError = true; _codeErrorMessage = 'Invalid password length.'; });
      return;
    }

    // Clear any photo cached from a previous account's session before this
    // login resolves — otherwise switching accounts without logging out
    // first (e.g. a regular account, then an admin account) leaves the
    // previous account's photo showing in the header indefinitely, since
    // _cachedPhotoUrl takes priority over _userStatus['profile_photo_url']
    // everywhere the avatar is rendered.
    setState(() { _activating = true; _codeError = false; _cachedPhotoUrl = null; });

    // ── Check admin credentials (admin_accounts table) ──────────────────
    // Previously checked app_settings.admin_view_cnic/password and a JSON
    // admin_view_credentials list — both were retired when the "Create
    // Admin" feature moved to a real admin_accounts table (multiple admins
    // supported). This now goes through the admin_account_login RPC, which
    // does the same cnic/password matching server-side instead of pulling
    // the whole admin_accounts table (including every admin's password)
    // down to the client to check locally.
    Map<String, dynamic>? adminRow;
    try {
      final result = await _db.client.rpc('admin_account_login', params: {
        'p_raw_cnic': raw,
        'p_password': pin,
      });
      adminRow = result as Map<String, dynamic>?;
    } catch (_) {
      adminRow = null;
    }
    final bool isAdminLogin = adminRow != null;
    debugPrint('[LOGIN] cnic=$raw isAdminLogin=$isAdminLogin');
    if (isAdminLogin) {
      // Admin login — bypass proposals table entirely
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('is_paid_user', true);
      await prefs.setBool('is_admin_view', true);
      await prefs.setString('user_cnic', raw);
      await prefs.setString('user_name', (adminRow['name'] as String?) ?? 'Admin');
      // Needed to rebuild _userStatus['id'] ('admin:<id>') on app restart —
      // without this, an admin session that persists across restarts would
      // have no way to reconstruct the id used for admin-only actions like
      // deleting their own admin_accounts row.
      await prefs.setString('admin_account_id', (adminRow['id'] as String?) ?? '');
      // IMPORTANT: this used to only set the in-memory _userStatus map
      // below (status: 'active') and never touched SharedPreferences.
      // GroupFeedScreen reads 'user_status'/'user_subscription_status'
      // straight from SharedPreferences, not from this screen's memory —
      // so it kept seeing whatever was cached from a previous session
      // (e.g. 'deleted' or 'expired') and treated the admin as
      // permanently pending/locked, no matter how many times they logged
      // in. Persist an explicit unlocked status here so the feed screen
      // agrees the admin is actually logged in.
      await prefs.setString('user_status', 'active');
      await prefs.remove('user_subscription_status');
      await prefs.remove('user_deleted_from');
      SupabaseService.instance.setActivatedCnic(raw);
      // Same registration the real admin login screen does — without this,
      // "New Order" pushes keep going to whichever device last logged in
      // there, even if that's stale, instead of following whichever
      // device is actually being used as admin right now.
      await FCMService.instance.saveAdminToken();
      if (!mounted) return;
      _codeController.clear();
      _pinController.clear();
      setState(() {
        _codeSuccess = true;
        _activating = false;
        _loggedInThisSession = true;
        _isAdminView = true;
        _userStatus = {
          'id': 'admin:${adminRow?['id']}',
          'name': (adminRow?['name'] as String?) ?? 'Admin',
          'cnic': (adminRow?['cnic'] as String?) ?? raw,
          'password': (adminRow?['password'] as String?) ?? '',
          'subscription_tier': 'featured',
          'status': 'active',
        };
      });
      // Without this, GroupFeedScreen (and MainShell's FAB/header cache
      // that mirrors it) never finds out this login happened — it only
      // reflects prefs/server state whenever something explicitly tells
      // it to recheck, and nothing else does that right after a login.
      widget.onPaidStatusChanged?.call();
      return;
    }

    // Verify password matches CNIC in proposals table
    final passwordValid = await _db.verifyCnicPassword(raw, pin);
    debugPrint('[LOGIN] passwordValid=$passwordValid');
    if (!mounted) return;
    if (!passwordValid) {
      setState(() { _activating = false; _codeError = true; _codeErrorMessage = 'Incorrect CNIC or password.'; });
      return;
    }

    final result = await _db.activateByCnic(raw);
    debugPrint('[LOGIN] activateByCnic success=${result.success} error=${result.error}');

    if (!mounted) return;

    final errorMsg = result.error?.toLowerCase() ?? "";
    final loginAllowed = result.success ||
        errorMsg.contains("already active") ||
        errorMsg.contains("paused") ||
        errorMsg.contains("pending") ||
        errorMsg.contains("no profile") ||
        errorMsg.contains("not found");
    debugPrint('[LOGIN] errorMsg="$errorMsg" loginAllowed=$loginAllowed');
    if (loginAllowed) {
      // This call site intentionally still treats an error the same as "no
      // row found" (falls back to 'pending' below) — unlike the app-startup
      // and background-refresh call sites, here we just came from a
      // successful activateByCnic, so a transient failure right after
      // should not block the login itself.
      Map<String, dynamic>? userStatus;
      try {
        userStatus = await _db.fetchUserStatusByCnic(raw);
      } catch (_) {
        userStatus = null;
      }
      debugPrint('[LOGIN] userStatus=$userStatus');
      if (!mounted) return;
      // Save to SharedPreferences
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('is_paid_user', true);
      // A regular login must clear any leftover admin-session flag — if a
      // previous session on this device was an admin login, this flag was
      // never cleared afterwards, and _restoreActivationState() treats any
      // is_admin_view=true on app start as "wipe the whole session", which
      // forced a real user to re-login on every single app restart.
      await prefs.setBool('is_admin_view', false);
      if (userStatus != null) {
        if (userStatus['name'] != null) await prefs.setString('user_name', userStatus['name']);
        if (userStatus['id'] != null) await prefs.setString('user_proposal_id', userStatus['id']);
        await prefs.setString('user_cnic', raw);
        // Immediately refresh the bell so it shows THIS user's notifications,
        // not whoever was logged in before on this device. Without this call
        // the in-memory history stays stale until the next app resume or
        // screen navigation triggers a refresh — meaning a second person
        // logging in would briefly (or permanently, if they never navigate)
        // see the previous user's notification history in the bell.
        NotificationService.instance.refresh();
        AnalyticsService.loginSuccess();
        if (userStatus['profile_photo_url'] != null) await prefs.setString('user_photo_url', userStatus['profile_photo_url']);
        if (userStatus['subscription_expiry'] != null) await prefs.setString('user_expiry', userStatus['subscription_expiry']);
        if (userStatus['subscription_tier'] != null) await prefs.setString('user_tier', userStatus['subscription_tier']);
        if (userStatus['subscription_status'] != null) await prefs.setString('user_subscription_status', userStatus['subscription_status']);
        if (userStatus['status'] != null) await prefs.setString('user_status', userStatus['status']);
        if (userStatus['deleted_from'] != null) await prefs.setString('user_deleted_from', userStatus['deleted_from'] as String);
        if (userStatus['deleted_from'] == null) await prefs.remove('user_deleted_from');
      } else {
        // fetchUserStatusByCnic returned null (e.g. DB error).
        // The login was allowed because of a 'no profile'/'pending' error from activateByCnic,
        // so this user is pending. Guard against group feed unlocking by saving pending status.
        await prefs.setString('user_status', 'pending');
        await prefs.setString('user_cnic', raw);
      }
      if (!mounted) return;
      _codeController.clear();
      _pinController.clear();
      SupabaseService.instance.setActivatedCnic(raw);
      setState(() { _codeSuccess = true; _activating = false; _userStatus = userStatus; _loggedInThisSession = true; });
      debugPrint('[LOGIN] wrote prefs: is_paid_user=${prefs.getBool('is_paid_user')} '
          'user_status=${prefs.getString('user_status')} '
          'user_cnic=${prefs.getString('user_cnic')} '
          'user_subscription_status=${prefs.getString('user_subscription_status')}');
      // This was previously never called on this path (only on pause/
      // resume elsewhere) — GroupFeedScreen's own isPaidUser/isPendingUser
      // and its gender-filtered feed were never told a login had just
      // happened, so right after logging in someone would briefly (or
      // until a manual pull-to-refresh) still see the signed-out header
      // filter icon, the "+" FAB, and a feed queried as if logged out.
      widget.onPaidStatusChanged?.call();
      // Load avatar from URL
      if (userStatus?['profile_photo_url'] != null) {
        _cachedPhotoUrl = userStatus!['profile_photo_url'] as String;
      }
      // Sync FCM token to DB (device registration only — no push is sent)
      FCMService.instance.syncTokenToDb();
      // Refresh bell history for this profile now, instead of waiting for
      // the next app resume to pick it up.
      NotificationService.instance.refresh();
      _subscribeToStatusChanges(userStatus?['id'] as String?);
      // Small delay to show the success state, then go back
      // Stay on subscription screen after login
    } else {
      _codeController.clear();
      _pinController.clear();
      setState(() {
        _codeError = true;
        _codeErrorMessage = result.error ?? 'Could not activate. Check your CNIC and try again.';
        _activating = false;
      });
    }
  }

  // Settings read directly from SupabaseService cache — rebuilds via ListenableBuilder

  Map<String, String> get _settings => SupabaseService.instance.cachedSettings;
  // free_mode is meant as a one-time free trial per person, not something
  // re-granted every time someone comes back — if this logged-in user
  // already has (had) a subscription and it's expired, they're renewing,
  // not signing up for the first time, so they see the real price even
  // while free_mode is globally on for new signups. Matches the same fix
  // on the website (app/plans/SubscriptionClient.tsx).
  bool get _hasExpiredSubscription {
    final expiryStr = _userStatus?['subscription_expiry'] as String?;
    if (expiryStr == null) return false;
    final expiry = DateTime.tryParse(expiryStr);
    if (expiry == null) return false;
    return expiry.isBefore(DateTime.now());
  }
  bool get _freeMode => _settings['free_mode'] == 'true' && !_hasExpiredSubscription;
  bool get _referralEnabled => _settings['referral_enabled'] != 'false';
  bool get _referralSignupEnabled => _settings['referral_signup_enabled'] != 'false';
  String get _stdPrice => _freeMode ? 'Free' : ("Rs. " + (_settings["standard_plan_price"] ?? "1,000"));
  // Same fix as group_feed_screen.dart's _stdDays — Free Mode has its own
  // trial-length setting (free_mode_trial_days), separate from the regular
  // plan length (standard_plan_days). This previously always read
  // standard_plan_days, so a 3-day free trial still showed "1 month" here.
  String get _stdDays  => _freeMode
      ? (_settings['free_mode_trial_days'] ?? '30')
      : (_settings['standard_plan_days'] ?? '90');
  String get _stdMonths { final d = int.tryParse(_stdDays) ?? 90; if (d % 30 == 0 && d > 0) { final m = d ~/ 30; return "$m month${m > 1 ? 's' : ''}"; } return "$d days"; }
  String get _ftPrice => "Rs. " + (_settings["featured_post_price"] ?? "200");
  int get _ftPriceInt => int.tryParse((_settings['featured_post_price'] ?? '200').replaceAll(',', '')) ?? 200;
  String get _ftDays   => _settings['featured_post_duration'] ?? '1';
  String get _adminWhatsApp => _settings['whatsapp_number'] ?? '923000000000';
  String get _ftDuration { final d = int.tryParse(_ftDays) ?? 1; return d == 1 ? "24 hours" : "$d days"; }

  List<_Plan> get _plans {
    return [
    _Plan(index: 0, name: 'Rishta Profile', priceLabel: _stdPrice, duration: _stdMonths, tagline: 'Connect with families', color: kPurple, lightColor: kPurpleLight, icon: Icons.visibility_rounded, isPopular: true,
      features: ['Publish your profile', 'Unlimited Local Proposals', 'Unlimited Overseas Proposals', 'Unlock Contact numbers and Photos', 'Use Advanced Search Filters', 'Pause or Edit your profile', 'Validity for 1 Month', '24 hours support'],
      notIncluded: ['Featured profile'], requiredNote: null),
    _Plan(index: 1, name: 'Featured Profile', priceLabel: _ftPrice, duration: _ftDuration, tagline: 'Stand out. Get noticed.', color: kAmber, lightColor: kAmberLight, icon: Icons.bolt_rounded, isPopular: false,
      features: ['Schedule Your Featured Date', 'Choose Your Featured City', 'Up to 5× more visibility', "$_ftDuration validity"],
      notIncluded: [],
      requiredNote: 'Requires Rishta Profile subscription'),
  ];
  }

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return ListenableBuilder(
      listenable: SupabaseService.instance,
      builder: (context, _) => Scaffold(
      backgroundColor: kSurface,
      appBar: AppBar(
        backgroundColor: kCardBg,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.transparent,
        elevation: 0,
        automaticallyImplyLeading: false,
        leading: IconButton(
          onPressed: () => Navigator.canPop(context) ? Navigator.pop(context) : widget.onBack?.call(),
          icon: const Icon(Icons.arrow_back_rounded, color: kInk),
        ),
        title: Text('Choose a Plan', style: TextStyle(fontSize: s.f(17), fontWeight: FontWeight.w800, color: kInk)),
        actions: [
          Padding(
            padding: EdgeInsets.only(right: s.s(12)),
            child: GestureDetector(
              onTap: () async {
                final uri = Uri.parse('https://wa.me/$_adminWhatsApp');
                if (await canLaunchUrl(uri)) launchUrl(uri, mode: LaunchMode.externalApplication);
              },
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: s.s(12), vertical: s.s(7)),
                decoration: BoxDecoration(
                  color: const Color(0xFF25D366),
                  borderRadius: BorderRadius.circular(s.s(10)),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  SvgPicture.asset('assets/icons/whatsapp.svg', width: s.d(16), height: s.d(16)),
                  SizedBox(width: s.s(6)),
                  Text('Contact Support', style: TextStyle(fontSize: s.f(12), fontWeight: FontWeight.w700, color: Colors.white)),
                ]),
              ),
            ),
          ),
        ],
        bottom: PreferredSize(preferredSize: const Size.fromHeight(1), child: Container(height: 1, color: kBorder)),
      ),
      body: SingleChildScrollView(
        controller: _scrollCtrl,
        padding: EdgeInsets.all(s.s(20)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Why Choose Jor', style: TextStyle(fontSize: s.f(14), fontWeight: FontWeight.w800, color: kInk)),
            SizedBox(height: s.s(12)),
            _HowItWorksRow(icon: Icons.assignment_turned_in_rounded, color: kTeal, bg: kTealLight, title: 'Verified Profiles', subtitle: 'We verify identity before posting'),
            _HowItWorksRow(icon: Icons.sell_rounded, color: kAmber, bg: kAmberLight, title: 'One Simple Plan', subtitle: 'Affordable pricing with no hidden charges'),
            _HowItWorksRow(icon: Icons.visibility_rounded, color: kPurple, bg: kPurpleLight, title: 'Connect with Families', subtitle: 'Phone numbers unlocked instantly'),
            _HowItWorksRow(icon: Icons.admin_panel_settings_rounded, color: Colors.blue.shade700, bg: Colors.blue.shade50, title: 'Privacy Protected', subtitle: 'Photos & phone numbers hidden from visitors'),
            _HowItWorksRow(icon: Icons.delete_outline_rounded, color: kRose, bg: kRoseLight, title: 'Easy Deletion', subtitle: 'Delete your profile anytime in just a few clicks.'),
            SizedBox(height: s.s(20)),

            Text('Select a Plan', key: _plansKey, style: TextStyle(fontSize: s.f(14), fontWeight: FontWeight.w800, color: kInk)),
            SizedBox(height: s.s(12)),
            ..._plans.map((plan) => _PlanCard(plan: plan, selected: _selectedPlan == plan.index, onSelect: () => setState(() => _selectedPlan = _selectedPlan == plan.index ? -1 : plan.index))),
            SizedBox(height: s.s(12)),
            Builder(builder: (ctx) {
              final tier = _userStatus?['subscription_tier'] as String? ?? 'none';
              // Matches the website's isSubscriptionActive() exactly — tier
              // alone isn't enough, since it stays set to the old plan even
              // after the subscription expires. Without also checking
              // expiry, an expired account could never see the Select Plan
              // button again — it would show "Already Subscribed" forever,
              // with no way to actually renew.
              final expiryStr = _userStatus?['subscription_expiry'] as String?;
              final expiry = expiryStr != null ? DateTime.tryParse(expiryStr) : null;
              final isSubscribed = _userStatus != null && tier != 'none' && expiry != null && expiry.isAfter(DateTime.now());
              if (isSubscribed && _selectedPlan == 0) {
                return Container(
                  width: double.infinity,
                  padding: EdgeInsets.symmetric(vertical: s.s(16)),
                  decoration: BoxDecoration(
                    color: kBorder,
                    borderRadius: BorderRadius.circular(s.s(14)),
                  ),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.check_circle_rounded, color: kInkFaint, size: s.d(18)),
                    SizedBox(width: s.s(8)),
                    Text('Already Subscribed', style: TextStyle(fontSize: s.f(15), fontWeight: FontWeight.w700, color: kInkFaint)),
                  ]),
                );
              }
              return GradientButton(
                label: _selectedPlan == -1 ? 'Select a Plan to Continue' : 'Continue with ${_plans[_selectedPlan].name} – ${_plans[_selectedPlan].priceLabel}',
                onTap: _selectedPlan == -1 ? () {} : _onSubscribe,
                icon: Icons.lock_open_rounded,
              );
            }),
            SizedBox(height: s.s(28)),
            if (_referralEnabled) ...[
            Text('Affiliate Program', style: TextStyle(fontSize: s.f(14), fontWeight: FontWeight.w800, color: kInk)),
            SizedBox(height: s.s(12)),
            Container(
              padding: EdgeInsets.all(s.s(16)),
              decoration: BoxDecoration(color: kCardBg, borderRadius: BorderRadius.circular(s.s(14)), border: Border.all(color: kBorder)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Container(width: s.d(42), height: s.d(42), decoration: BoxDecoration(color: kPurpleLight, borderRadius: BorderRadius.circular(s.s(12))),
                    child: Center(child: Icon(Icons.handshake_rounded, color: kPurple, size: s.d(22)))),
                  SizedBox(width: s.s(12)),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Text('Refer & Earn', style: TextStyle(fontSize: s.f(13.5), fontWeight: FontWeight.w800, color: kInk)),
                      const Spacer(),
                      if (_referralSignupEnabled) GestureDetector(
                        onTap: () => setState(() => _affiliateLoginMode = !_affiliateLoginMode),
                        child: Container(
                          padding: EdgeInsets.symmetric(horizontal: s.s(8), vertical: s.s(3)),
                          decoration: BoxDecoration(
                            color: kPurpleLight,
                            borderRadius: BorderRadius.circular(s.s(20)),
                          ),
                          child: Text(
                            _affiliateLoginMode ? 'Join' : 'Login',
                            style: TextStyle(fontSize: s.f(10), fontWeight: FontWeight.w700, color: kPurple),
                          ),
                        ),
                      ),
                    ]),
                    SizedBox(height: s.s(2)),
                    Text('Help others find their life partner with Jor.', style: TextStyle(fontSize: s.f(11.5), color: kInkLight)),
                  ])),
                ]),
                SizedBox(height: s.s(14)),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => (_affiliateLoginMode || !_referralSignupEnabled)
                        ? _showAffiliateLoginDialog(context)
                        : _showJoinAffiliateDialog(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPurple,
                      foregroundColor: Colors.white,
                      padding: EdgeInsets.symmetric(vertical: s.s(13)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(s.s(10))),
                    ),
                    child: Text((_affiliateLoginMode || !_referralSignupEnabled) ? 'Login as Affiliate' : 'Join as Affiliate',
                      style: TextStyle(fontSize: s.f(13.5), fontWeight: FontWeight.w700)),
                  ),
                ),
              ]),
            ),
            ], // end if (_referralEnabled)
            _LocateUsSection(),
            SizedBox(height: s.s(24)),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  GestureDetector(
                    onTap: () => launchUrl(Uri.parse('https://joronline.com'), mode: LaunchMode.externalApplication),
                    child: Text('joronline.com', style: TextStyle(fontSize: s.f(12.5), fontWeight: FontWeight.w700, color: kPurple)),
                  ),
                  SizedBox(height: s.s(4)),
                  // NOTE: update this to match whatever version you publish
                  // to the Play Store / App Store for each release.
                  Text('App version 1.0.0', style: TextStyle(fontSize: s.f(11), color: kInkFaint)),
                ],
              ),
            ),
            SizedBox(height: s.s(12)),
          ],
        ),
      ),
    ),
    );
  }

  int? get _basePriceInt => int.tryParse((_settings['standard_plan_price'] ?? '1000').replaceAll(',', ''));

  /// Returns the standard-plan price string with the applied coupon
  /// factored in — a discounted price for a percentage coupon, the normal
  /// price for a free-days coupon (that type only adds bonus days, it
  /// doesn't touch the price), or the plain price if no coupon is applied.
  String _stdPriceWithCoupon() {
    if (_appliedCouponFreeDays != null) return _stdPrice;
    final base = _basePriceInt;
    if (base == null || _appliedCouponDiscount == null) return _stdPrice;
    final discounted = (base * (100 - _appliedCouponDiscount!) / 100).round();
    return 'Rs. $discounted';
  }

  Future<void> _applyCoupon(void Function(void Function()) setDialogState) async {
    final code = _couponCtrl.text.trim();
    if (code.isEmpty) return;
    setDialogState(() { _validatingCoupon = true; _couponMessage = null; });
    try {
      final res = await _db.client
          .from('coupon_codes')
          .select('coupon_type, discount_percent, free_days, active, expires_at')
          .ilike('code', code)
          .maybeSingle();
      final expiresAt = res?['expires_at'] != null ? DateTime.tryParse(res!['expires_at'] as String) : null;
      final expired = expiresAt != null && expiresAt.isBefore(DateTime.now());
      if (res == null || res['active'] != true || expired) {
        setDialogState(() {
          _validatingCoupon = false;
          _couponIsError = true;
          _couponMessage = expired ? 'This coupon has expired' : 'Invalid or inactive coupon code';
          _appliedCouponDiscount = null;
          _appliedCouponFreeDays = null;
          _appliedCouponCode = null;
        });
        return;
      }
      final type = res['coupon_type'] as String? ?? 'percentage';
      final pct = (res['discount_percent'] as num?)?.toInt();
      final freeDays = (res['free_days'] as num?)?.toInt();
      setDialogState(() {
        _validatingCoupon = false;
        _couponIsError = false;
        _appliedCouponCode = code.toUpperCase();
        if (type == 'free_days' && freeDays != null) {
          _appliedCouponFreeDays = freeDays;
          _appliedCouponDiscount = null;
          _couponMessage = '+$freeDays bonus days added!';
        } else {
          _appliedCouponDiscount = pct;
          _appliedCouponFreeDays = null;
          _couponMessage = '$pct% discount applied!';
        }
      });

      // Persist on the proposal now, not just locally — this is what the
      // admin's approval flow actually reads to apply it, so it needs to be
      // saved even if the person closes this dialog right after.
      final prefs = await SharedPreferences.getInstance();
      final pid = _proposalId ?? prefs.getString('user_proposal_id');
      if (pid != null) {
        final cnic = await _db.resolveEffectiveCnic();
        if (cnic != null) {
          await Supabase.instance.client.rpc('update_own_proposal', params: {
            'p_id': pid,
            'p_cnic': cnic,
            'p_changes': {'applied_coupon_code': code.toUpperCase()},
          });
        }
      }
    } catch (_) {
      setDialogState(() {
        _validatingCoupon = false;
        _couponIsError = true;
        _couponMessage = 'Could not verify coupon — check your connection';
      });
    }
  }

  // Guards against the payment-instructions dialog opening twice from a fast
  // double-tap on Continue. showDialog() is now called synchronously (no
  // await in between taps), so without this a rapid double-tap could mount
  // two AlertDialogs at once — both containing a TextField bound to the same
  // shared _couponCtrl, which corrupts the element tree and throws
  // "'_dependents.isEmpty': is not true".
  bool _paymentDialogOpen = false;

  Future<void> _onSubscribe() async {
    if (_selectedPlan == -1) return;
    if (_paymentDialogOpen) return;
    final plan = _plans[_selectedPlan];
    final isStandard = plan.index == 0;
    debugPrint('[BILLING] _onSubscribe: selectedPlan=$_selectedPlan isStandard=$isStandard '
        'freeMode=$_freeMode loggedInThisSession=$_loggedInThisSession '
        'userStatus=${_userStatus == null ? "null" : "present"}');

    // Visitors with no account yet still need somewhere useful to go —
    // send them to Create Account instead of showing a purchase flow for
    // an account that doesn't exist. Someone who's already logged in (e.g.
    // renewing after expiry) proceeds to the real purchase below.
    if (_freeMode && isStandard) {
      if (!_loggedInThisSession) {
        debugPrint('[BILLING] _onSubscribe: freeMode branch, not logged in -> Create Account');
        widget.onOpenCreateAccount?.call();
        return;
      }
      debugPrint('[BILLING] _onSubscribe: freeMode branch, logged in -> closing screen');
      if (Navigator.canPop(context)) Navigator.pop(context);
      else widget.onBack?.call();
      return;
    }

    // Featured specifically: someone tapping this almost certainly
    // already has a profile — a purchase attempt with no session behind
    // it would otherwise fall through to Create Account, which isn't the
    // right recovery path here. Check for a real session first and open
    // the login sheet directly instead, before ever starting a purchase.
    if (!isStandard) {
      final cnic = await _db.resolveEffectiveCnic();
      if (cnic == null || cnic.isEmpty) {
        debugPrint('[BILLING] _onSubscribe: featured branch, not logged in -> Login');
        widget.onOpenLogin?.call();
        return;
      }
    }

    // Both plans now go through Google Play Billing exclusively — the app
    // must never offer (or link to) any other payment method alongside it.
    // The old manual-payment dialog (bank transfer / WhatsApp proof
    // upload) has been removed from this file entirely — see below.
    // The purchase functions themselves resolve the real CNIC (via
    // resolveEffectiveCnic()'s fallback chain) and route to Create
    // Account if none can be found, rather than gating on
    // _loggedInThisSession here — that flag is only reliably true right
    // after a fresh in-session login and was incorrectly blocking
    // genuinely logged-in/returning accounts from ever reaching a
    // purchase at all.
    if (isStandard) {
      _buyRishtaProfileViaPlayBilling();
    } else {
      _buyFeaturedViaPlayBilling();
    }
  }

  // ── Google Play Billing purchase flows ──────────────────────────────────

  Future<void> _buyRishtaProfileViaPlayBilling() async {
    final cnic = await _db.resolveEffectiveCnic();
    debugPrint('[BILLING] _buyRishtaProfileViaPlayBilling: resolved cnic="$cnic"');
    if (cnic == null || cnic.isEmpty) {
      debugPrint('[BILLING] _buyRishtaProfileViaPlayBilling: no cnic found, routing to Create Account');
      // No known identity for this device at all — genuine visitor, not a
      // resolution glitch for an existing account. Send them to create
      // one rather than showing an error about "your account".
      widget.onOpenCreateAccount?.call();
      return;
    }

    if (!BillingService.instance.isAvailable) {
      final ok = await BillingService.instance.init();
      if (!ok) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Google Play Billing is not available on this device.'),
            backgroundColor: kRose, behavior: SnackBarBehavior.floating,
          ));
        }
        return;
      }
    }
    if (!mounted) return;

    final tiers = <({String id, String label, int months})>[
      (id: JorProducts.rishta1Month, label: '1 Month', months: 1),
      (id: JorProducts.rishta2Month, label: '2 Months', months: 2),
      (id: JorProducts.rishta3Month, label: '3 Months', months: 3),
    ];

    // Real discount, computed from whatever prices are actually set in
    // Play Console — not a hardcoded "10%"/"15%" label that could go
    // stale the moment a price changes. Compares each tier's per-month
    // cost against the 1-month tier's price as the baseline.
    final baseProduct = BillingService.instance.productFor(JorProducts.rishta1Month);
    final basePerMonth = baseProduct?.rawPrice;

    final chosenId = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (sheetCtx) => Container(
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(sheetCtx).padding.bottom + 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Choose Duration', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: kInk)),
          const SizedBox(height: 6),
          const Text('Pay securely with Google Play.', style: TextStyle(fontSize: 13, color: kInkLight)),
          const SizedBox(height: 18),
          ...tiers.map((t) {
            final product = BillingService.instance.productFor(t.id);
            int? discountPercent;
            if (product != null && basePerMonth != null && basePerMonth > 0 && t.months > 1) {
              final perMonth = product.rawPrice / t.months;
              final pct = ((basePerMonth - perMonth) / basePerMonth * 100).round();
              if (pct > 0) discountPercent = pct;
            }
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GestureDetector(
                onTap: () => Navigator.pop(sheetCtx, t.id),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: kBorder)),
                  child: Row(children: [
                    Expanded(
                      child: Row(children: [
                        Text(t.label, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: kInk)),
                        if (discountPercent != null) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(color: kGreenLight, borderRadius: BorderRadius.circular(6)),
                            child: Text('Save $discountPercent%', style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: kGreen)),
                          ),
                        ],
                      ]),
                    ),
                    Text(product?.price ?? '—', style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: kPurple)),
                  ]),
                ),
              ),
            );
          }),
        ]),
      ),
    );

    if (chosenId == null || !mounted) return;

    setState(() => _paymentDialogOpen = true);
    final result = await BillingService.instance.buyProduct(productId: chosenId, cnic: cnic);
    if (mounted) setState(() => _paymentDialogOpen = false);
    if (!mounted) return;

    if (result.outcome == BillingOutcome.success) {
      await _refreshUserStatus();
      widget.onPaidStatusChanged?.call();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: const Text('Subscription activated!', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        backgroundColor: kGreen, behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 72),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ));
    } else if (result.outcome == BillingOutcome.error) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(result.errorMessage ?? 'Purchase failed. Please try again.'),
        backgroundColor: kRose, behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 72),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ));
    }
    // Cancelled: silent, matches how the rest of the app treats a
    // dismissed dialog — no error, person just changed their mind.
  }

  Future<void> _buyFeaturedViaPlayBilling() async {
    final cnic = await _db.resolveEffectiveCnic();
    debugPrint('[BILLING] _buyFeaturedViaPlayBilling: resolved cnic="$cnic"');
    if (cnic == null || cnic.isEmpty) {
      debugPrint('[BILLING] _buyFeaturedViaPlayBilling: no cnic found, routing to Create Account');
      widget.onOpenCreateAccount?.call();
      return;
    }

    if (!BillingService.instance.isAvailable) {
      final ok = await BillingService.instance.init();
      if (!ok) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Google Play Billing is not available on this device.'),
            backgroundColor: kRose, behavior: SnackBarBehavior.floating,
          ));
        }
        return;
      }
    }
    if (!mounted) return;

    // New flow: buy credits first, schedule later. The person just picks
    // how many credits (1–3) to buy here; scheduling city+date happens
    // afterwards, whenever they want, from the avatar popup's Featured
    // Credits section — completely decoupled from checkout.
    final count = await _pickCreditCountForPurchase();
    if (count == null || !mounted) return;

    // Exact per-count pricing — each count maps 1:1 to its own product,
    // no bundling or rounding up.
    final productId = switch (count) {
      1 => JorProducts.featured1,
      2 => JorProducts.featured2,
      _ => JorProducts.featured3,
    };

    setState(() => _paymentDialogOpen = true);
    final result = await BillingService.instance.buyProduct(productId: productId, cnic: cnic);
    if (mounted) setState(() => _paymentDialogOpen = false);
    if (!mounted) return;

    if (result.outcome != BillingOutcome.success) {
      if (result.outcome == BillingOutcome.error) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(result.errorMessage ?? 'Purchase failed. Please try again.'),
          backgroundColor: kRose, behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 72),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ));
      }
      return; // cancelled or error — no credits were granted
    }

    // Payment succeeded — credits are now on their account (granted by the
    // billing pipeline). Refresh so the avatar popup's balance is current,
    // then point them to where they can schedule.
    await _refreshUserStatus();
    widget.onPaidStatusChanged?.call();
    if (!mounted) return;
    AnalyticsService.featuredCreditsPurchase(credits: count);
    await showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Credits Purchased', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: kInk)),
        content: Text(
          '$count Featured credit${count == 1 ? '' : 's'} added to your account.\n\nTap your profile picture and open "Featured Credits" to book your featured date and city whenever you\'re ready.',
          style: const TextStyle(fontSize: 13, color: kInkLight, height: 1.5),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
        actions: [
          TextButton(
            style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
            onPressed: () => Navigator.pop(context),
            child: const Text('OK', style: TextStyle(color: kPurple, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  /// Simple count picker (1–3) for buying Featured credits — replaces the
  /// old pre-checkout city+date picker. Shows the exact Play price for the
  /// selected count, same 1:1 product mapping as before.
  Future<int?> _pickCreditCountForPurchase() async {
    int selected = 1;
    return showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (sheetCtx) => StatefulBuilder(
        builder: (sheetCtx, setSheetState) {
          final bottom = MediaQuery.of(sheetCtx).viewInsets.bottom + MediaQuery.of(sheetCtx).padding.bottom;
          final priceProductId = switch (selected) {
            1 => JorProducts.featured1,
            2 => JorProducts.featured2,
            _ => JorProducts.featured3,
          };
          final priceLabel = BillingService.instance.productFor(priceProductId)?.price;

          return Container(
            decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
            padding: EdgeInsets.fromLTRB(20, 20, 20, bottom + 24),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Buy Featured Credits', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: kInk)),
              const SizedBox(height: 6),
              const Text('Each credit features your profile in one city for one day. Book your date and city anytime after purchase.', style: TextStyle(fontSize: 13, color: kInkLight, height: 1.4)),
              const SizedBox(height: 18),
              Row(
                children: List.generate(3, (i) {
                  final count = i + 1;
                  final isSelected = selected == count;
                  return Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(right: i < 2 ? 10 : 0),
                      child: GestureDetector(
                        onTap: () => setSheetState(() => selected = count),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          decoration: BoxDecoration(
                            color: isSelected ? kAmberLight : kSurface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: isSelected ? kAmber : kBorder, width: isSelected ? 1.5 : 1),
                          ),
                          child: Column(children: [
                            Icon(Icons.bolt_rounded, size: 20, color: isSelected ? kAmber : kInkFaint),
                            const SizedBox(height: 6),
                            Text('$count', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: isSelected ? kInk : kInkLight)),
                            Text('credit${count == 1 ? '' : 's'}', style: TextStyle(fontSize: 11, color: isSelected ? kInk : kInkFaint)),
                          ]),
                        ),
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 16),
              if (priceLabel != null)
                Align(
                  alignment: Alignment.centerRight,
                  child: Text(priceLabel, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: kInk)),
                ),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(child: OutlinedButton(
                  onPressed: () => Navigator.pop(sheetCtx),
                  style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 13), side: const BorderSide(color: kBorder), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                  child: const Text('Cancel', style: TextStyle(color: kInkLight, fontWeight: FontWeight.w700)),
                )),
                const SizedBox(width: 10),
                Expanded(flex: 2, child: ElevatedButton(
                  onPressed: () => Navigator.pop(sheetCtx, selected),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPurple, foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: const Text('Continue to Payment', style: TextStyle(fontWeight: FontWeight.w800)),
                )),
              ]),
            ]),
          );
        },
      ),
    );
  }

  /// Books featured slots using ALREADY-OWNED credits — the second half of
  /// the new buy-first-schedule-later flow, opened from the avatar popup's
  /// Featured Credits section. Reuses the same city+date picker sheet the
  /// old pre-checkout flow used, then spends credits via the same
  /// book_featured_slot_with_credit RPC (which still auto-shifts to the
  /// next open date when a chosen day is full, and safely restores the
  /// credit if nothing is available for 30 days).
  Future<void> _bookFeaturedWithCredits() async {
    final cnic = await _db.resolveEffectiveCnic();
    if (cnic == null || cnic.isEmpty) return;

    final purchased = (_userStatus?['featured_credits_purchased'] as num?)?.toInt() ?? 0;
    final used = (_userStatus?['featured_credits_used'] as num?)?.toInt() ?? 0;
    final available = purchased - used;
    if (available <= 0) return;

    // Same picker as before — but capped at however many credits they
    // actually have (up to 3 per sitting, matching the old per-purchase max).
    final slots = <Map<String, dynamic>>[
      {'city': null, 'date': null, 'checking': false},
    ];
    final confirmed = await _pickFeaturedSlotsForBooking(slots, maxSlots: available < 3 ? available : 3);
    if (confirmed != true || !mounted) return;

    final bookingLines = <String>[];
    final bookedTodayFlags = <bool>[];
    for (final slot in slots) {
      final city = slot['city'] as String;
      final date = slot['date'] as DateTime;
      try {
        final res = await SupabaseService.instance.client.rpc('book_featured_slot_with_credit', params: {
          'p_cnic': cnic,
          'p_city': city,
          'p_date': date.toIso8601String().split('T').first,
        });
        final map = res as Map<String, dynamic>?;
        if (map?['success'] == true) {
          final shifted = map?['shifted'] == true;
          final bookedDateStr = map?['booked_date'] as String?;
          final bookedDate = bookedDateStr != null ? DateTime.tryParse(bookedDateStr) : null;
          final display = bookedDate != null ? _formatExpiry(bookedDate.toIso8601String()) : (bookedDateStr ?? '—');
          bookingLines.add(shifted
              ? 'Your booking in $city has been moved to $display because your requested date was fully booked.'
              : '$city — $display');
          bookedTodayFlags.add(bookedDate != null && _isSameDay(bookedDate, DateTime.now()));
        } else {
          bookingLines.add('$city — could not be booked (${map?['error'] ?? 'please contact support'}). Your credit has not been lost.');
          bookedTodayFlags.add(false);
        }
      } catch (_) {
        bookingLines.add('$city — could not be booked right now. Please contact support — your credit is safe.');
        bookedTodayFlags.add(false);
      }
    }

    if (!mounted) return;
    await _refreshUserStatus();
    widget.onPaidStatusChanged?.call();
    if (!mounted) return;
    // Track each successfully booked slot
    for (final slot in slots) {
      if (slot['city'] != null) {
        AnalyticsService.scheduleFeaturedPost(city: slot['city'] as String);
      }
    }
    // today's date (immediate activation) — using the real booked_date
    // results, since a shift could move a "today" request to a later
    // date. Falls back to the generic title if any slot is future-dated,
    // mixed, or failed.
    final allStartedToday = bookedTodayFlags.isNotEmpty && bookedTodayFlags.every((v) => v);
    await showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(allStartedToday ? 'Featured Post Started' : 'Featured Booking Confirmed',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: kInk)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: bookingLines.map((l) => Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(l, style: const TextStyle(fontSize: 13, color: kInkLight, height: 1.4)),
          )).toList(),
        ),
        // Explicit actionsPadding so OK's right edge lines up exactly
        // with the content's right edge — AlertDialog's default
        // actionsPadding doesn't match contentPadding's horizontal inset,
        // which is what made the right side look wider than the left.
        actionsPadding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
        actions: [
          TextButton(
            style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
            onPressed: () => Navigator.pop(context),
            child: const Text('OK', style: TextStyle(color: kPurple, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  /// Manage sheet — lists the person's current featured posts in two
  /// groups: Running Now (scheduled_date already reached, still active)
  /// and Scheduled (future dates), each with a Cancel action. Cancelling a
  /// SCHEDULED post returns its credit in full; cancelling a RUNNING post
  /// returns nothing (the spotlight was already used) — both spelled out
  /// in the confirmation dialog before anything happens.
  Future<void> _showManageFeaturedSheet() async {
    final cnic = await _db.resolveEffectiveCnic();
    if (cnic == null || cnic.isEmpty || !mounted) return;

    // Refresh first so the list reflects reality, not a stale cache.
    await _refreshUserStatus();
    if (!mounted) return;

    bool cancelling = false;
    String? manageErrorMsg;
    // History view — separate from the live boosts list above (which
    // only ever contains unused/current boosts). Fetched lazily, only
    // once the person actually taps the History icon.
    String sheetView = 'current';
    List<Map<String, dynamic>>? history;
    bool loadingHistory = false;
    String? historyError;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (sheetCtx) => StatefulBuilder(
        builder: (sheetCtx, setSheetState) {
          final bottom = MediaQuery.of(sheetCtx).viewInsets.bottom + MediaQuery.of(sheetCtx).padding.bottom;
          final now = DateTime.now();

          final boosts = ((_userStatus?['featured_boosts'] as List?) ?? [])
              .whereType<Map<String, dynamic>>()
              .where((b) => b['is_used'] != true && b['id'] != null)
              .toList();
          final running = <Map<String, dynamic>>[];
          final scheduled = <Map<String, dynamic>>[];
          const windowDuration = Duration(hours: 24);
          for (final b in boosts) {
            final d = DateTime.tryParse(b['scheduled_date'] as String? ?? '');
            if (d == null) continue;
            if (d.isAfter(now)) {
              scheduled.add(b);
              continue;
            }
            // Same windowStart resolution as boostRow's countdown below
            // (created_at for same-day bookings, otherwise scheduled_date
            // itself) — a boost only counts as still running if its 24h
            // window from that start hasn't actually ended yet. Once it
            // has, it's dropped from both lists rather than lingering in
            // Running Now with a countdown stuck at 0h 00m 00s until the
            // next full status refresh happens to catch up.
            final createdAt = DateTime.tryParse(b['created_at'] as String? ?? '');
            final windowStart = (createdAt != null && _isSameDay(createdAt, d)) ? createdAt : d;
            if (now.isBefore(windowStart.add(windowDuration))) running.add(b);
          }

          Future<void> cancelBoost(Map<String, dynamic> boost, {required bool isRunning}) async {
            final city = boost['city'] as String? ?? '';
            final confirmed = await showDialog<bool>(
              context: sheetCtx,
              builder: (dCtx) => AlertDialog(
                backgroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                title: Text(isRunning ? 'Cancel Running Post?' : 'Cancel Scheduled Post?',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: kInk)),
                content: Text(
                  isRunning
                      ? 'Your featured post in $city is currently running. Cancelling stops it now and the used credit will NOT be returned.'
                      : 'Your featured post in $city hasn\'t started yet. Cancelling it will return the full credit to your balance.',
                  style: const TextStyle(fontSize: 13, color: kInkLight, height: 1.5),
                ),
                actionsPadding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
                actions: [
                  TextButton(
                    style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8), minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                    onPressed: () => Navigator.pop(dCtx, false),
                    child: const Text('Keep it', style: TextStyle(color: kInkLight, fontWeight: FontWeight.w700)),
                  ),
                  TextButton(
                    style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                    onPressed: () => Navigator.pop(dCtx, true),
                    child: const Text('Cancel Post', style: TextStyle(color: kRose, fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
            );
            if (confirmed != true) return;

            setSheetState(() => cancelling = true);
            String? errorText;
            try {
              final res = await SupabaseService.instance.client.rpc('cancel_featured_boost', params: {
                'p_cnic': cnic,
                'p_boost_id': boost['id'],
              });
              final map = res as Map<String, dynamic>?;
              if (map?['success'] != true) {
                errorText = (map?['error'] as String?) ?? 'Could not cancel. Please try again.';
              }
            } catch (_) {
              errorText = 'Could not cancel right now. Please try again.';
            }
            await _refreshUserStatus();
            widget.onPaidStatusChanged?.call();
            if (!sheetCtx.mounted) return;
            setSheetState(() { cancelling = false; manageErrorMsg = errorText; });
          }

          Future<void> loadHistory() async {
            setSheetState(() => sheetView = 'history');
            if (history != null || loadingHistory) return;
            setSheetState(() { loadingHistory = true; historyError = null; });
            try {
              final res = await SupabaseService.instance.client.rpc('get_featured_boost_history', params: {
                'p_cnic': cnic,
              });
              final list = (res as List? ?? []).whereType<Map<String, dynamic>>().toList();
              if (!sheetCtx.mounted) return;
              setSheetState(() { history = list; loadingHistory = false; });
            } catch (_) {
              if (!sheetCtx.mounted) return;
              setSheetState(() { historyError = 'Could not load history right now. Please try again.'; loadingHistory = false; });
            }
          }

          Widget boostRow(Map<String, dynamic> b, {required bool isRunning}) {
            final d = DateTime.tryParse(b['scheduled_date'] as String? ?? '');
            final createdAt = DateTime.tryParse(b['created_at'] as String? ?? '');
            final dateLabel = d != null ? _formatExpiry(d.toIso8601String()) : '—';
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Container(
                    width: 34, height: 34,
                    decoration: BoxDecoration(color: kAmber.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
                    child: Icon(isRunning ? Icons.bolt_rounded : Icons.schedule_rounded, size: 17, color: kAmber),
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(b['city'] as String? ?? '', style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: kInk), maxLines: 1, overflow: TextOverflow.ellipsis),
                    Text(isRunning ? 'Running • $dateLabel' : dateLabel, style: const TextStyle(fontSize: 11.5, color: kInkLight)),
                  ])),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: cancelling ? null : () => cancelBoost(b, isRunning: isRunning),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      side: BorderSide(color: kRose.withOpacity(0.5)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('Cancel', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: kRose)),
                  ),
                ]),
                // Live countdown bar for running boosts — anchored to
                // whichever start makes sense: if this was booked and
                // scheduled for the same calendar day (started right
                // away), anchor to the real booking moment (created_at)
                // rather than the date-only scheduled_date, which sits at
                // midnight UTC (5am Pakistan time) and would otherwise
                // show several hours already "elapsed" the instant
                // someone books later in their day. Advance-scheduled
                // boosts that only activate later keep using
                // scheduled_date, which is correct for that case.
                if (isRunning && d != null)
                  _RunningBoostBar(
                    windowStart: (createdAt != null && _isSameDay(createdAt, d)) ? createdAt : d,
                  ),
              ]),
            );
          }

          Widget historyRow(Map<String, dynamic> b) {
            final d = DateTime.tryParse(b['scheduled_date'] as String? ?? '');
            final dateLabel = d != null ? _formatExpiry(d.toIso8601String()) : '—';
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(children: [
                Container(
                  width: 34, height: 34,
                  decoration: BoxDecoration(color: kPurple.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                  child: Icon(Icons.check_circle_rounded, size: 17, color: kPurple),
                ),
                const SizedBox(width: 10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(b['city'] as String? ?? '', style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: kInk), maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(dateLabel, style: const TextStyle(fontSize: 11.5, color: kInkLight)),
                ])),
              ]),
            );
          }

          return Container(
            decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
            padding: EdgeInsets.fromLTRB(20, 20, 20, bottom + 24),
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(sheetView == 'history' ? 'Featured Post History' : 'Manage Featured Posts', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: kInk)),
                  if (sheetView == 'current')
                    OutlinedButton.icon(
                      onPressed: loadHistory,
                      icon: const Icon(Icons.history_rounded, size: 15, color: kInkLight),
                      label: const Text('History', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: kInkLight)),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        side: BorderSide(color: kBorder),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    )
                  else
                    OutlinedButton(
                      onPressed: () => setSheetState(() => sheetView = 'current'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        side: BorderSide(color: kBorder),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.arrow_back_rounded, size: 14, color: kInkLight),
                        SizedBox(width: 4),
                        Text('Back', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: kInkLight)),
                      ]),
                    ),
                ]),
                const SizedBox(height: 6),
                Text(
                  sheetView == 'history' ? 'Featured posts that have already run and finished.' : 'Make your profile stand out and get noticed',
                  style: const TextStyle(fontSize: 12.5, color: kInkLight, height: 1.4),
                ),
                if (manageErrorMsg != null) ...[
                  const SizedBox(height: 10),
                  Text(manageErrorMsg!, style: const TextStyle(fontSize: 12.5, color: kRose, fontWeight: FontWeight.w600)),
                ],
                const SizedBox(height: 18),
                if (sheetView == 'history') ...[
                  if (loadingHistory)
                    const Padding(padding: EdgeInsets.symmetric(vertical: 18), child: Center(child: Text('Loading history…', style: TextStyle(fontSize: 13, color: kInkFaint)))),
                  if (!loadingHistory && historyError != null)
                    Padding(padding: const EdgeInsets.symmetric(vertical: 18), child: Center(child: Text(historyError!, style: const TextStyle(fontSize: 13, color: kRose)))),
                  if (!loadingHistory && historyError == null && (history?.isEmpty ?? false))
                    const Padding(padding: EdgeInsets.symmetric(vertical: 18), child: Center(child: Text('No past featured posts yet.', style: TextStyle(fontSize: 13, color: kInkFaint)))),
                  if (!loadingHistory && historyError == null && history != null && history!.isNotEmpty)
                    for (int i = 0; i < history!.length; i++) ...[
                      if (i > 0) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Divider(height: 1, color: kBorder.withOpacity(0.6))),
                      historyRow(history![i]),
                    ],
                ] else ...[
                if (running.isEmpty && scheduled.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 18),
                    child: Center(child: Text('No running or scheduled featured posts.', style: TextStyle(fontSize: 13, color: kInkFaint))),
                  ),
                if (running.isNotEmpty) ...[
                  const Text('RUNNING NOW', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: kInkFaint, letterSpacing: 0.5)),
                  const SizedBox(height: 10),
                  for (int i = 0; i < running.length; i++) ...[
                    if (i > 0) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Divider(height: 1, color: kBorder.withOpacity(0.6))),
                    boostRow(running[i], isRunning: true),
                  ],
                  const SizedBox(height: 8),
                ],
                if (scheduled.isNotEmpty) ...[
                  const Text('SCHEDULED', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: kInkFaint, letterSpacing: 0.5)),
                  const SizedBox(height: 10),
                  for (int i = 0; i < scheduled.length; i++) ...[
                    if (i > 0) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Divider(height: 1, color: kBorder.withOpacity(0.6))),
                    boostRow(scheduled[i], isRunning: false),
                  ],
                ],
                ],
              ]),
            ),
          );
        },
      ),
    );
  }

  /// Location+date picker for booking Featured slots with already-owned
  /// credits. Reuses the shared _LocationPickerSheet class and
  /// _formatExpiry helper (both still used elsewhere in this file). No
  /// price shown and no payment follows — the credits being spent were
  /// bought earlier.
  Future<bool?> _pickFeaturedSlotsForBooking(List<Map<String, dynamic>> slots, {required int maxSlots}) async {
    String? errorMsg;
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (sheetCtx) => StatefulBuilder(
        builder: (sheetCtx, setSheetState) {
          final bottom = MediaQuery.of(sheetCtx).viewInsets.bottom + MediaQuery.of(sheetCtx).padding.bottom;

          Future<void> checkSlot(Map<String, dynamic> slot) async {
            final slotCity = slot['city'] as String?;
            final slotDate = slot['date'] as DateTime?;
            if (slotCity == null || slotDate == null) return;
            setSheetState(() { slot['checking'] = true; errorMsg = null; });
            bool available = true;
            try {
              available = await SupabaseService.instance.isFeaturedSlotAvailable(slotCity, slotDate);
            } catch (_) {}
            setSheetState(() {
              slot['checking'] = false;
              if (!available) {
                slot['date'] = null;
                errorMsg = 'No Featured slots left in $slotCity on that date. Please pick another date.';
              }
            });
          }

          return Container(
            decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
            padding: EdgeInsets.fromLTRB(20, 20, 20, bottom + 24),
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Select Date & Location', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: kInk)),
                const SizedBox(height: 6),
                const Text('Pick where and when you want your profile featured. One credit is used per date & location.', style: TextStyle(fontSize: 13, color: kInkLight, height: 1.4)),
                const SizedBox(height: 18),
                ...List.generate(slots.length, (i) {
                  final slot = slots[i];
                  final slotCity = slot['city'] as String?;
                  final slotDate = slot['date'] as DateTime?;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Expanded(
                        flex: 2,
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('Date ${i + 1}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: kInkLight)),
                          const SizedBox(height: 6),
                          GestureDetector(
                            onTap: () async {
                              final now = DateTime.now();
                              final picked = await showDatePicker(
                                context: sheetCtx,
                                initialDate: slotDate != null && slotDate.isAfter(now) ? slotDate : now,
                                firstDate: now,
                                lastDate: now.add(const Duration(days: 90)),
                              );
                              if (picked == null) return;
                              setSheetState(() => slot['date'] = picked);
                              await checkSlot(slot);
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                              decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(10), border: Border.all(color: kBorder)),
                              child: Row(children: [
                                const Icon(Icons.calendar_today_rounded, size: 13, color: kInkFaint),
                                const SizedBox(width: 6),
                                Expanded(child: Text(slotDate != null ? _formatExpiry(slotDate.toIso8601String()) : 'Pick date', style: TextStyle(fontSize: 12.5, color: slotDate != null ? kInk : kInkFaint, fontWeight: slotDate != null ? FontWeight.w600 : FontWeight.w400), overflow: TextOverflow.ellipsis)),
                                if (slot['checking'] == true) ...[
                                  const SizedBox(width: 6),
                                  const SizedBox(width: 11, height: 11, child: CircularProgressIndicator(strokeWidth: 1.6, color: kPurple)),
                                ],
                              ]),
                            ),
                          ),
                        ]),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 3,
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('Location ${i + 1}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: kInkLight)),
                          const SizedBox(height: 6),
                          GestureDetector(
                            onTap: () async {
                              final picked = await showModalBottomSheet<String>(
                                context: sheetCtx,
                                isScrollControlled: true,
                                backgroundColor: Colors.transparent,
                                useSafeArea: true,
                                builder: (_) => _LocationPickerSheet(selected: slotCity),
                              );
                              if (picked != null) {
                                setSheetState(() { slot['city'] = picked; errorMsg = null; });
                                await checkSlot(slot);
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                              decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(10), border: Border.all(color: kBorder)),
                              child: Row(children: [
                                const Icon(Icons.location_on_outlined, size: 14, color: kInkFaint),
                                const SizedBox(width: 6),
                                Expanded(child: Text(slotCity ?? 'Select location', style: TextStyle(fontSize: 12.5, color: slotCity != null ? kInk : kInkFaint, fontWeight: slotCity != null ? FontWeight.w600 : FontWeight.w400), maxLines: 1, overflow: TextOverflow.ellipsis)),
                              ]),
                            ),
                          ),
                        ]),
                      ),
                      if (slots.length > 1)
                        Padding(
                          padding: const EdgeInsets.only(top: 22, left: 4),
                          child: GestureDetector(
                            onTap: () => setSheetState(() { slots.removeAt(i); errorMsg = null; }),
                            child: const Icon(Icons.close_rounded, size: 18, color: kInkFaint),
                          ),
                        ),
                    ]),
                  );
                }),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    if (slots.length < maxSlots)
                      Flexible(
                        child: GestureDetector(
                          onTap: () => setSheetState(() => slots.add({'city': null, 'date': null, 'checking': false})),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.add_circle_outline_rounded, size: 16, color: kPurple),
                            const SizedBox(width: 6),
                            Flexible(child: Text('Add another date & location', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kPurple), maxLines: 1, overflow: TextOverflow.ellipsis)),
                          ]),
                        ),
                      )
                    else
                      const SizedBox(),
                    const SizedBox(width: 8),
                    Text('${slots.length} credit${slots.length == 1 ? '' : 's'}', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kInk), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                ),
                if (errorMsg != null) ...[
                  const SizedBox(height: 10),
                  Text(errorMsg!, style: const TextStyle(fontSize: 12.5, color: kRose, fontWeight: FontWeight.w600)),
                ],
                const SizedBox(height: 20),
                Row(children: [
                  Expanded(child: OutlinedButton(
                    onPressed: () => Navigator.pop(sheetCtx, false),
                    style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 13), side: const BorderSide(color: kBorder), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                    child: const Text('Cancel', style: TextStyle(color: kInkLight, fontWeight: FontWeight.w700)),
                  )),
                  const SizedBox(width: 10),
                  Expanded(flex: 2, child: Builder(builder: (_) {
                    bool isSameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;
                    final today = DateTime.now();
                    final pickedDates = slots.map((s) => s['date']).whereType<DateTime>().toList();
                    // "Featured Now" when every chosen date is today (the
                    // boost starts right away); "Schedule Now" when any
                    // date is in the future. Defaults to Schedule Now
                    // while dates are still unpicked (button is disabled
                    // then anyway).
                    final allToday = pickedDates.isNotEmpty && pickedDates.length == slots.length && pickedDates.every((d) => isSameDay(d, today));
                    return ElevatedButton(
                      onPressed: slots.every((s) => s['city'] != null && s['date'] != null && s['checking'] != true)
                          ? () => Navigator.pop(sheetCtx, true)
                          : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kAmber, foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                        disabledBackgroundColor: kAmber.withOpacity(0.35),
                        disabledForegroundColor: Colors.white,
                      ),
                      child: Text(allToday ? 'Featured Now' : 'Schedule Now', style: const TextStyle(fontWeight: FontWeight.w800)),
                    );
                  })),
                ]),
              ]),
            ),
          );
        },
      ),
    );
  }

}

// ── Plan data + card (identical to original) ──────────────────────────────────
class _Plan {
  final int index;
  final String name, priceLabel, duration, tagline;
  final Color color, lightColor;
  final IconData icon;
  final bool isPopular;
  final List<String> features, notIncluded;
  final String? requiredNote;

  _Plan({required this.index, required this.name, required this.priceLabel, required this.duration, required this.tagline, required this.color, required this.lightColor, required this.icon, this.isPopular = false, required this.features, required this.notIncluded, this.requiredNote});
}

class _PlanCard extends StatelessWidget {
  final _Plan plan;
  final bool selected;
  final VoidCallback onSelect;
  const _PlanCard({required this.plan, required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return GestureDetector(
      onTap: onSelect,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: EdgeInsets.only(bottom: s.s(12)),
        padding: EdgeInsets.all(s.s(16)),
        decoration: BoxDecoration(
          color: selected ? plan.lightColor : kCardBg,
          borderRadius: BorderRadius.circular(s.s(16)),
          border: Border.all(color: selected ? plan.color : kBorder, width: selected ? 2 : 1),
          boxShadow: selected ? [BoxShadow(color: plan.color.withOpacity(0.15), blurRadius: 12, offset: const Offset(0, 4))] : [],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(width: s.d(40), height: s.d(40), decoration: BoxDecoration(color: plan.color, borderRadius: BorderRadius.circular(s.s(12))), child: Icon(plan.icon, color: Colors.white, size: s.d(20))),
            SizedBox(width: s.s(12)),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(plan.name, style: TextStyle(fontSize: s.f(15), fontWeight: FontWeight.w800, color: selected ? plan.color : kInk), overflow: TextOverflow.ellipsis)),
                if (plan.isPopular) ...[SizedBox(width: s.s(6)), Container(padding: EdgeInsets.symmetric(horizontal: s.s(6), vertical: s.s(2)), decoration: BoxDecoration(color: plan.color, borderRadius: BorderRadius.circular(s.s(6))), child: Text('POPULAR', style: TextStyle(fontSize: s.f(9), color: Colors.white, fontWeight: FontWeight.w800)))],
              ]),
              Text(plan.tagline, style: TextStyle(fontSize: s.f(12), color: kInkLight)),
            ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(plan.priceLabel, style: TextStyle(fontSize: s.f(17), fontWeight: FontWeight.w800, color: plan.color)),
              Text(plan.duration, style: TextStyle(fontSize: s.f(11), color: kInkFaint)),
            ]),
          ]),
          SizedBox(height: s.s(14)),
          const Divider(color: kBorder, height: 1),
          SizedBox(height: s.s(12)),
          ...plan.features.map((f) => Padding(padding: EdgeInsets.only(bottom: s.s(6)), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(Icons.check_circle_rounded, size: s.d(15), color: plan.color),
            SizedBox(width: s.s(8)),
            Expanded(child: Text(f, style: TextStyle(fontSize: s.f(12.5), color: kInk, fontWeight: FontWeight.w500))),
          ]))),
          ...plan.notIncluded.map((f) => Padding(padding: EdgeInsets.only(bottom: s.s(6)), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(Icons.cancel_outlined, size: s.d(15), color: kInkFaint),
            SizedBox(width: s.s(8)),
            Expanded(child: Text(f, style: TextStyle(fontSize: s.f(12.5), color: kInkFaint))),
          ]))),
          if (plan.requiredNote != null) ...[
            SizedBox(height: s.s(2)),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(Icons.info_outline_rounded, size: s.d(13), color: kInkFaint),
              SizedBox(width: s.s(6)),
              Expanded(child: Text(plan.requiredNote!, style: TextStyle(fontSize: s.f(11.5), color: kInkFaint, fontStyle: FontStyle.italic))),
            ]),
          ],
        ]),
      ),
    );
  }
}

class _HowItWorksRow extends StatelessWidget {
  final IconData icon;
  final Color color, bg;
  final String title, subtitle;
  const _HowItWorksRow({required this.icon, required this.color, required this.bg, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: s.s(10)),
      child: Row(children: [
        Container(width: s.d(40), height: s.d(40), decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(s.s(12))), child: Icon(icon, color: color, size: s.d(20))),
        SizedBox(width: s.s(12)),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: TextStyle(fontSize: s.f(13.5), fontWeight: FontWeight.w700, color: kInk)),
          Text(subtitle, style: TextStyle(fontSize: s.f(12), color: kInkLight)),
        ])),
      ]),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final Color? color;
  const _ActionBtn({required this.icon, required this.label, required this.onTap, this.color});

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    final disabled = onTap == null;
    final bg = disabled ? kBorder : (color ?? kPurple);
    final fg = disabled ? kInkFaint : Colors.white;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.symmetric(horizontal: s.s(7), vertical: s.s(5)),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(s.s(7)),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, color: fg, size: s.d(11)),
          SizedBox(width: s.s(3)),
          Flexible(child: Text(label, style: TextStyle(fontSize: s.f(10), color: fg, fontWeight: FontWeight.w700), maxLines: 1, softWrap: false, overflow: TextOverflow.ellipsis)),
        ]),
      ),
    );
  }
}

// ── Profile View Dialog ───────────────────────────────────────────────────────
class _ProfileViewDialog extends StatefulWidget {
  final String proposalId;
  const _ProfileViewDialog({required this.proposalId});
  @override State<_ProfileViewDialog> createState() => _ProfileViewDialogState();
}

class _ProfileViewDialogState extends State<_ProfileViewDialog> {
  RishtaProposal? _proposal;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    try {
      final cnic = await SupabaseService.instance.resolveEffectiveCnic();
      if (cnic == null) {
        if (mounted) setState(() => _loading = false);
        return;
      }
      final data = await Supabase.instance.client
          .rpc('fetch_own_proposal_full', params: {'p_id': widget.proposalId, 'p_cnic': cnic});
      if (mounted) setState(() {
        _proposal = RishtaProposal.fromJson(data as Map<String, dynamic>);
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(16),
      child: Container(
        decoration: BoxDecoration(color: kCardBg, borderRadius: BorderRadius.circular(20)),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 8, 0),
            child: Row(children: [
              const Text('Your Profile', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: kInk)),
              const Spacer(),
              IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close_rounded, color: kInkFaint)),
            ]),
          ),
          if (_loading)
            const Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator(color: kPurple))
          else if (_proposal == null)
            const Padding(padding: EdgeInsets.all(32), child: Text('Profile not found', style: TextStyle(color: kInkLight)))
          else
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
                child: Column(
                  children: [
                    RishtaCard(
                      proposal: _proposal!,
                      isPaidUser: true,
                      isSelected: false,
                      onTap: () {},
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: kPurpleLight,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: kPurple.withOpacity(0.2)),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.info_outline_rounded, size: 16, color: kPurple),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              'You can share your profile with others.',
                              style: TextStyle(fontSize: 12.5, color: kPurple),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ]),
      ),
    );
  }
}


// ── Locate Us ─────────────────────────────────────────────────────────────────
class _JorCenter {
  final String name;
  final String city;
  final String address;
  final String phone;
  final String timing;

  const _JorCenter({
    required this.name,
    required this.city,
    required this.address,
    required this.phone,
    required this.timing,
  });
}

// Centers loaded from DB — see _LocateUsSectionState

class _LocateUsSection extends StatefulWidget {
  const _LocateUsSection();
  @override
  State<_LocateUsSection> createState() => _LocateUsSectionState();
}

class _LocateUsSectionState extends State<_LocateUsSection> {
  late final PageController _pageCtrl;
  int _currentPage = 0;
  List<_JorCenter> _allCenters = [];
  bool _loadingCenters = true;

  List<String> get _cities {
    final seen = <String>{};
    return _allCenters.map((c) => c.city).where((city) => seen.add(city)).toList();
  }

  @override
  void initState() {
    super.initState();
    _pageCtrl = PageController(viewportFraction: 1.0);
    _loadCenters();
  }

  Future<void> _loadCenters() async {
    try {
      final res = await Supabase.instance.client
          .from('jor_centers')
          .select()
          .eq('is_active', true)
          .order('sort_order')
          .order('city');
      final list = res as List<dynamic>;
      setState(() {
        _allCenters = list.map((r) => _JorCenter(
          name: r['name'] as String? ?? '',
          city: r['city'] as String? ?? '',
          address: r['address'] as String? ?? '',
          phone: r['phone'] as String? ?? '',
          timing: r['timing'] as String? ?? '',
        )).toList();
        _loadingCenters = false;
        _currentPage = 0;
      });
      // Jump controller to page 0 after frame renders
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_pageCtrl.hasClients) _pageCtrl.jumpToPage(0);
      });
    } catch (_) {
      setState(() => _loadingCenters = false);
    }
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  void _onPillTap(String? city) {
    if (city == null) {
      // "All" — go to first card
      _pageCtrl.animateToPage(0, duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
    } else {
      final idx = _allCenters.indexWhere((c) => c.city == city);
      if (idx != -1) _pageCtrl.animateToPage(idx, duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    final currentCity = _currentPage < _allCenters.length ? _allCenters[_currentPage].city : null;

    // Hide entire section while loading or when no centers
    if (_loadingCenters || _allCenters.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(height: s.s(28)),
        // ── Header ──
        Text('Locate Us', style: TextStyle(fontSize: s.f(14), fontWeight: FontWeight.w800, color: kInk)),
        SizedBox(height: s.s(12)),

        // ── City filter pills — only show when >1 center and centers loaded ──
        if (!_loadingCenters && _allCenters.length > 1) ...[
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: [
              ..._cities.map((city) => _CityPill(
                label: city,
                selected: city == currentCity,
                onTap: () => _onPillTap(city),
              )),
            ]),
          ),
          SizedBox(height: s.s(10)),
        ],

        // ── Center card(s) — always full width, swipeable when there's
        // more than one (viewportFraction: 1.0 above, so no peek gap).
        // Height tightened to match the card's actual content (icon +
        // name row, address, phone, timing, with padding) — the old 172
        // was sized for the previous peek-carousel layout and left visible
        // empty space under the Timing row once that changed.
        SizedBox(
          height: s.d(156),
          child: PageView.builder(
            key: ValueKey(_allCenters.length),
            controller: _pageCtrl,
            itemCount: _allCenters.length,
            onPageChanged: (i) => setState(() => _currentPage = i),
            itemBuilder: (_, i) => Padding(
              padding: EdgeInsets.only(bottom: s.s(4)),
              child: _CenterCard(center: _allCenters[i]),
            ),
          ),
        ),
      ],
    );
  }
}

class _CityPill extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _CityPill({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: EdgeInsets.only(right: s.s(6)),
        padding: EdgeInsets.symmetric(horizontal: s.s(12), vertical: s.s(6)),
        decoration: BoxDecoration(
          color: selected ? kPurple : Colors.white,
          borderRadius: BorderRadius.circular(s.s(30)),
          border: Border.all(color: selected ? kPurple : const Color(0xFFDDDDEE), width: selected ? 1.5 : 1),
        ),
        child: Text(label, style: TextStyle(
          fontSize: s.f(11.5),
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          color: selected ? Colors.white : kInkLight,
        )),
      ),
    );
  }
}

class _CenterCard extends StatelessWidget {
  final _JorCenter center;
  const _CenterCard({required this.center});

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return Container(
      padding: EdgeInsets.all(s.s(16)),
      decoration: BoxDecoration(
        color: kCardBg,
        borderRadius: BorderRadius.circular(s.s(14)),
        border: Border.all(color: kBorder),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Name + city badge
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Text(center.name, style: TextStyle(fontSize: s.f(13.5), fontWeight: FontWeight.w700, color: kInk))),
          SizedBox(width: s.s(8)),
          Container(
            padding: EdgeInsets.symmetric(horizontal: s.s(8), vertical: s.s(3)),
            decoration: BoxDecoration(color: kPurpleLight, borderRadius: BorderRadius.circular(s.s(20))),
            child: Text(center.city, style: TextStyle(fontSize: s.f(11), fontWeight: FontWeight.w700, color: kPurple)),
          ),
        ]),
        SizedBox(height: s.s(10)),
        // Address
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: EdgeInsets.only(top: s.s(1)),
            child: Icon(Icons.location_on_outlined, size: s.d(14), color: kPurple),
          ),
          SizedBox(width: s.s(6)),
          Expanded(child: Text(center.address, style: TextStyle(fontSize: s.f(12.5), color: kInkLight, height: 1.4))),
        ]),
        SizedBox(height: s.s(6)),
        // Phone
        Row(children: [
          Icon(Icons.phone_outlined, size: s.d(14), color: kPurple),
          SizedBox(width: s.s(6)),
          Flexible(child: Text(center.phone, style: TextStyle(fontSize: s.f(12.5), color: kInkLight, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis)),
        ]),
        SizedBox(height: s.s(6)),
        // Timing
        Row(children: [
          Icon(Icons.access_time_rounded, size: s.d(14), color: kPurple),
          SizedBox(width: s.s(6)),
          Text(center.timing, style: TextStyle(fontSize: s.f(12.5), color: kInkLight)),
        ]),
      ]),
    );
  }
}

// ── Share option widget for subscription screen bottom sheet ─────────────────
class _SubShareOption extends StatelessWidget {
  final String? svgAsset;
  final IconData? iconData;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _SubShareOption({this.svgAsset, this.iconData, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Column(children: [
        Container(
          width: s.d(56), height: s.d(56),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(s.s(16)),
            border: Border.all(color: color.withOpacity(0.2)),
          ),
          child: Padding(
            padding: EdgeInsets.all(s.s(10)),
            child: svgAsset != null
              ? SvgPicture.asset(svgAsset!, width: s.d(36), height: s.d(36), fit: BoxFit.contain)
              : Icon(iconData!, color: color, size: s.d(36)),
          ),
        ),
        SizedBox(height: s.s(6)),
        Text(label, style: TextStyle(fontSize: s.f(11.5), fontWeight: FontWeight.w600, color: kInkLight)),
      ]),
    );
  }
}

// ── City picker sheet (used for Featured Post city+date slots) ────────────────
// Self-contained searchable, province-grouped picker over kCitiesGrouped —
// same city list used by the proposal submission form, but implemented here
// directly (rather than importing submit_proposal_screen.dart's version) to
// keep this screen's dialog free of a cross-screen dependency.
// Compares two instants by LOCAL calendar day (not UTC) — used to decide
// whether a boost was booked and scheduled for the same day the user
// actually made the purchase, so the countdown can anchor to the real
// booking moment instead of the date-only scheduled_date (stored at
// midnight UTC, which is 5am Pakistan time).
bool _isSameDay(DateTime a, DateTime b) {
  final la = a.toLocal();
  final lb = b.toLocal();
  return la.year == lb.year && la.month == lb.month && la.day == lb.day;
}

// ── Live countdown bar for a running Featured boost ──────────────────────────
// Faithful port of the admin app's boost countdown (admin_users_screen's
// _BoostListItem): same 24-hour window measured from scheduled_date, same
// green gradient progress bar over a 15%-opacity track, and the same
// per-second "Xh XXm XXs remaining" label. The timer stops itself at zero
// and on disposal.
class _RunningBoostBar extends StatefulWidget {
  final DateTime windowStart;
  const _RunningBoostBar({required this.windowStart});
  @override
  State<_RunningBoostBar> createState() => _RunningBoostBarState();
}

class _RunningBoostBarState extends State<_RunningBoostBar> {
  Timer? _timer;
  Duration _remaining = Duration.zero;

  Duration get _timeRemaining {
    final end = widget.windowStart.add(const Duration(hours: 24));
    final r = end.difference(DateTime.now());
    return r.isNegative ? Duration.zero : r;
  }

  @override
  void initState() {
    super.initState();
    _remaining = _timeRemaining;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      final r = _timeRemaining;
      if (mounted) setState(() => _remaining = r);
      if (r == Duration.zero) _timer?.cancel();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _fmtRemaining(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '${h}h ${m}m ${s}s remaining';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, left: 44),
      child: LayoutBuilder(builder: (_, constraints) {
        final total = const Duration(hours: 24).inSeconds.toDouble();
        final elapsed = (total - _remaining.inSeconds.toDouble()).clamp(0.0, total);
        final progress = elapsed / total;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Stack(
                children: [
                  Container(
                    height: 4,
                    width: constraints.maxWidth,
                    color: kGreen.withOpacity(0.15),
                  ),
                  Container(
                    height: 4,
                    width: constraints.maxWidth * progress,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [kGreen.withOpacity(0.7), kGreen],
                      ),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 5),
            Text(
              _fmtRemaining(_remaining),
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: kGreen.withOpacity(0.8),
              ),
            ),
          ],
        );
      }),
    );
  }
}

// Combined city/country picker for Featured booking — matches the
// website's FeaturedBookModal.tsx exactly: a Pakistan/Overseas toggle,
// then either qualifying Pakistani cities (grouped by province) or
// qualifying overseas countries, both fetched LIVE from the same shared
// Supabase RPCs the website uses (get_qualifying_cities /
// get_qualifying_countries) — not a separately hand-maintained local
// list. This is what keeps the website and app from ever showing
// different location options again: both call the exact same
// live-computed source instead of each keeping their own copy.
//
// Replaces the old _CityPickerSheet, which only offered Pakistani cities
// (no Overseas option existed at all) from a hardcoded kCitiesGrouped
// list that had already drifted from the website's own list (different
// cities entirely in several provinces).
class _LocationPickerSheet extends StatefulWidget {
  final String? selected;
  const _LocationPickerSheet({this.selected});
  @override
  State<_LocationPickerSheet> createState() => _LocationPickerSheetState();
}

class _LocationPickerSheetState extends State<_LocationPickerSheet> {
  final _searchCtrl = TextEditingController();
  String _query = '';
  bool _isOverseas = false;
  bool _loading = true;
  String? _error;
  Map<String, List<String>> _cityGroups = {};
  List<String> _countries = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final client = SupabaseService.instance.client;
      final cityRows = await client.rpc('get_qualifying_cities') as List;
      final countryRows = await client.rpc('get_qualifying_countries') as List;

      final groups = <String, List<String>>{};
      for (final row in cityRows) {
        final province = row['province'] as String;
        final city = row['city'] as String;
        groups.putIfAbsent(province, () => []).add(city);
      }
      final countries = countryRows.map((r) => r['country'] as String).toList();

      if (!mounted) return;
      setState(() {
        _cityGroups = groups;
        _countries = countries;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() { _loading = false; _error = 'Could not load locations. Please try again.'; });
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final q = _query.trim().toLowerCase();

    final filteredCities = <String, List<String>>{};
    _cityGroups.forEach((province, cities) {
      final matches = q.isEmpty ? cities : cities.where((c) => c.toLowerCase().contains(q)).toList();
      if (matches.isNotEmpty) filteredCities[province] = matches;
    });
    final filteredCountries = q.isEmpty ? _countries : _countries.where((c) => c.toLowerCase().contains(q)).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.8,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      expand: false,
      builder: (_, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          top: false,
          child: Column(children: [
            const SizedBox(height: 10),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE0E0E0), borderRadius: BorderRadius.circular(2))),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 10),
              child: Row(children: [
                const Text('Select Location', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: kInk)),
                const Spacer(),
                GestureDetector(onTap: () => Navigator.pop(context), child: const Icon(Icons.close_rounded, color: kInkFaint)),
              ]),
            ),
            // Pakistan / Overseas toggle — same two-step pattern as the
            // website. Switching modes clears any in-progress search but
            // does not clear the currently-selected value, matching how
            // FilterBar.tsx's own mode toggle behaves.
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(children: [
                Expanded(child: _ModeButton(label: 'Pakistan', selected: !_isOverseas, onTap: () => setState(() => _isOverseas = false))),
                const SizedBox(width: 8),
                Expanded(child: _ModeButton(label: 'Overseas', selected: _isOverseas, onTap: () => setState(() => _isOverseas = true))),
              ]),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: TextField(
                controller: _searchCtrl,
                autofocus: false,
                onChanged: (v) => setState(() => _query = v),
                style: const TextStyle(fontSize: 13.5, color: kInk),
                decoration: InputDecoration(
                  hintText: _isOverseas ? 'Search country...' : 'Search city...',
                  hintStyle: const TextStyle(fontSize: 13, color: kInkFaint),
                  prefixIcon: const Icon(Icons.search_rounded, size: 18, color: kInkFaint),
                  isDense: true,
                  filled: true, fillColor: kSurface,
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: kPurple))
                  : _error != null
                      ? Center(child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(mainAxisSize: MainAxisSize.min, children: [
                            Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: kInkFaint)),
                            const SizedBox(height: 12),
                            TextButton(onPressed: _load, child: const Text('Retry')),
                          ]),
                        ))
                      : _isOverseas
                          ? (filteredCountries.isEmpty
                              ? const Center(child: Text('No matching countries', style: TextStyle(color: kInkFaint)))
                              : ListView(
                                  controller: scrollCtrl,
                                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                                  children: filteredCountries.map((country) => _LocationTile(
                                    label: country,
                                    selected: widget.selected == country,
                                    onTap: () => Navigator.pop(context, country),
                                  )).toList(),
                                ))
                          : (filteredCities.isEmpty
                              ? const Center(child: Text('No matching cities', style: TextStyle(color: kInkFaint)))
                              : ListView(
                                  controller: scrollCtrl,
                                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                                  children: filteredCities.entries.expand((entry) => [
                                    Padding(
                                      padding: const EdgeInsets.only(top: 12, bottom: 6),
                                      child: Text(entry.key, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: kInkLight, letterSpacing: 0.3)),
                                    ),
                                    ...entry.value.map((city) => _LocationTile(
                                      label: city,
                                      selected: widget.selected == city,
                                      onTap: () => Navigator.pop(context, city),
                                    )),
                                  ]).toList(),
                                )),
            ),
          ]),
        ),
      ),
    );
  }
}

class _ModeButton extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _ModeButton({required this.label, required this.selected, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? kPurpleLight : kSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? kPurple : kBorder),
        ),
        child: Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 13, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: selected ? kPurple : kInk)),
      ),
    );
  }
}

class _LocationTile extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _LocationTile({required this.label, required this.selected, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: selected ? kPurpleLight : kSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? kPurple : kBorder),
        ),
        child: Text(label, style: TextStyle(fontSize: 13, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: selected ? kPurple : kInk)),
      ),
    );
  }
}
