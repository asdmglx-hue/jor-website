import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/rishta_proposal.dart';
import '../services/supabase_service.dart';
import '../utils/theme.dart';
import '../widgets/rishta_card.dart';
import '../widgets/featured_carousel.dart';
import 'edit_profile_screen.dart';
import '../widgets/filter_sheet.dart';
import '../widgets/common_widgets.dart';
import 'subscription_screen.dart';
import '../services/notification_service.dart';
import 'notification_screen.dart';

// ── Responsive scale helper ────────────────────────────────────────────────
// Reference design width is 390 px. Scales down on narrow screens, capped at 1.0.
class _S {
  final double scale;
  const _S(this.scale);
  double f(double size) => size * scale;   // font / icon sizes
  double s(double size) => size * scale;   // spacing / padding
  double d(double size) => size * scale;   // fixed dimensions

  static _S of(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    final scale = (w / 390.0).clamp(0.72, 1.0);
    return _S(scale);
  }
}

class GroupFeedScreen extends StatefulWidget {
  final VoidCallback? onOpenSubscription;
  final VoidCallback? onPaidStatusChanged;
  final VoidCallback? onOwnProfileEdited;
  // "Unlock All Profiles" banner routes here instead of the Subscription
  // screen when Free Mode is active and the tapper has no account yet —
  // there's nothing to subscribe to until they've actually created a
  // profile, so send them straight to Create Account.
  final VoidCallback? onOpenCreateAccount;
  final void Function(BuildContext, GlobalKey)? onOpenMyAccount;
  // Fired when a cold-start check discovers this device's account was
  // permanently deleted (no row left for its CNIC at all) — as opposed to
  // a live delete that happens while the app is open, which the realtime
  // listener in SubscriptionScreen handles separately.
  final VoidCallback? onAccountPermanentlyDeleted;
  const GroupFeedScreen({super.key, this.onOpenSubscription, this.onPaidStatusChanged, this.onOwnProfileEdited, this.onOpenMyAccount, this.onAccountPermanentlyDeleted, this.onOpenCreateAccount});

  @override
  State<GroupFeedScreen> createState() => GroupFeedScreenState();
}

class GroupFeedScreenState extends State<GroupFeedScreen>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  final _db = SupabaseService.instance;

  List<RishtaProposal> _allProposals = [];
  Map<String, int> _proposalCounts = {'total': 0, 'male': 0, 'female': 0};
  bool _countsLoaded = false;
  List<RishtaProposal> _filtered = [];
  // Which proposal ids are ACTUALLY boosted for the currently-selected
  // city filter(s), as opposed to just globally is_boosted somewhere.
  // Empty when no city filter is active — see _refreshBoostedForCities.
  Set<String> _boostedForSelectedCitiesIds = {};
  final Set<String> _notInterestedIds = {};
  bool _searchVisible = false;
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';
  Timer? _searchDebounce;
  FilterState _filters = const FilterState();
  Set<String> _savedIds = {};
  // Pricing read directly from SupabaseService cache

  Map<String, String> get _pricingSettings => SupabaseService.instance.cachedSettings;
  bool get _freeMode => _pricingSettings['free_mode'] == 'true';
  String get _stdPrice => _freeMode ? 'Free' : (_pricingSettings['standard_plan_price'] ?? '1,000');
  // When Free Mode is on, the duration shown/used should come from the
  // free-trial length the admin set (free_mode_trial_days), not the
  // regular paid-plan length (standard_plan_days) — those are two
  // different settings in the admin pricing screen. This was always
  // reading standard_plan_days regardless of Free Mode, so setting a
  // 3-day free trial still displayed "1 Month" everywhere.
  String get _stdDays  => _freeMode
      ? (_pricingSettings['free_mode_trial_days'] ?? '30')
      : (_pricingSettings['standard_plan_days'] ?? '90');
  String get _stdLabel { final d = int.tryParse(_stdDays) ?? 90; if (d % 30 == 0 && d > 0) { final m = d ~/ 30; return "$m Month${m > 1 ? 's' : ''}"; } return "$_stdDays Days"; }

  bool _isPaidUser = false;
  bool _isPendingUser = false;
  bool get isPaidUser => _isPaidUser && !_isPendingUser;
  // True only once the user has actually authenticated (CNIC + password
  // verified via the login/activation flow) — NOT merely because a CNIC
  // was cached from submitting the proposal form. Without this extra
  // check, hasAccount below (and therefore the header avatar) would treat
  // "just submitted a proposal" as identical to "logged in", which is the
  // exact bug where the avatar appeared after submitting without ever
  // logging in.
  bool get _isLoggedIn => _db.activatedCnic != null;
  // True for anyone with a real, authenticated account on this device —
  // paid, or logged-in-but-pending/deleted/rejected/expired. False for a
  // genuine signed-out visitor who never registered, AND false for
  // someone who has only submitted a proposal but never logged in.
  // Visitor-only chrome (the header filter icon, the "+" submit FAB)
  // should key off this being false.
  bool get hasAccount => (_isPaidUser || _isPendingUser) && _isLoggedIn;
  // Don't count gender filter for paid users (auto-locked to opposite gender)
  int get filtersActiveCount {
    if (!_isPaidUser) return _filters.activeCount;
    return _filters.activeCount - (_filters.gender != null ? 1 : 0);
  }
  String? _userGender; // locked to opposite gender in filters
  String? _ownProposalId; // ID of the logged-in user's own proposal
  String? _ownName;
  String? _ownPhotoUrl;
  final GlobalKey _avatarKey = GlobalKey();
  bool _loading = true;
  bool _isPullRefreshing = false;
  String? _error;

  // Realtime channel
  RealtimeChannel? _channel;

  final ScrollController _scrollCtrl = ScrollController();
  int _currentPage = 0;
  bool _hasMoreData = true;
  bool _loadingMore = false;
  static const _pageSize = 15;
  late AnimationController _entryCtrl;

  int _selectedChip = 0;
  String? _selectedCardId;
  final List<String> _chipLabels = [
    'All', 'Saved', 'New', '1 Month', '2 Months', '3+ Months',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _initAndLoad();
    _subscribeRealtime();
  }

  Future<void> _initAndLoad() async {
    // 1. Restore paid state from prefs
    final prefs = await SharedPreferences.getInstance();
    final paid = prefs.getBool('is_paid_user') ?? false;
    final status = prefs.getString('user_status') ?? '';
    final subStatusInit = prefs.getString('user_subscription_status') ?? '';
    final isPending = status == 'pending' || status == 'deleted' || status == 'rejected' || subStatusInit == 'expired';
    debugPrint('[FEED] _initAndLoad() ran. paid=$paid status="$status" isPending=$isPending');
    if (paid && mounted) {
      setState(() {
        _isPaidUser = true;
        _isPendingUser = isPending;
        // _ownName/_ownPhotoUrl otherwise start null and only get set once
        // _fetchUserGender()'s network call resolves further down — which
        // means the header avatar always shows the '?' fallback for a
        // moment on every cold start, then flashes to the real initial
        // once that request completes, even though the correct name was
        // already cached locally this whole time. Seeding from cache here
        // shows the right initial immediately; the network fetch below
        // still runs and corrects it if it's actually changed since.
        _ownName = prefs.getString('user_name');
        _ownPhotoUrl = prefs.getString('user_photo_url');
      });
      if (!isPending) widget.onPaidStatusChanged?.call();
    }

    // Re-check the account's real status with the server, not just the
    // cached value above — this specifically catches the case where the
    // account was permanently deleted (or soft-deleted) entirely while
    // this device's app was closed. The realtime subscription below only
    // catches changes that happen while the app is actively open; this
    // check catches whatever happened in between app sessions.
    //
    // Admin accounts are skipped entirely here: they live in
    // admin_accounts, not proposals, so this lookup would always return
    // "no row" for one and incorrectly conclude the admin was deleted,
    // wiping out an otherwise-valid restored admin session on every
    // single cold start.
    final isAdminSession = prefs.getBool('is_admin_view') ?? false;
    final cachedCnic = prefs.getString('user_cnic') ?? _db.submittedCnic;
    final hasCachedIdentity = paid || (cachedCnic != null && cachedCnic.isNotEmpty);
    // Deliberately keyed on cachedCnic's presence, not just `paid` — a
    // device that already hit the old (pre-fix) permanent-delete path once
    // would have is_paid_user flipped to false already, while user_cnic and
    // the rest stayed cached. Gating solely on `paid` meant that device
    // would silently skip this recheck forever afterwards, never actually
    // getting cleaned up. Keying on cachedCnic makes this self-healing
    // regardless of which state the device is stuck in.
    // Hoisted out of the try block below so it can be handed straight to
    // _fetchUserGender() further down — that call was independently asking
    // the server this exact same question (same RPC, same cnic) a moment
    // later, which meant every cold start made two identical network
    // requests back to back. Passing the result through here means one
    // request instead of two, with no change in what either caller does
    // with the data — _fetchUserGender() still fetches it itself whenever
    // this block didn't run or came back empty.
    Map<String, dynamic>? fresh;
    if (hasCachedIdentity && !isAdminSession) {
      if (cachedCnic != null && cachedCnic.isNotEmpty) {
        try {
          fresh = await _db.fetchUserStatusByCnic(cachedCnic);
          if (fresh == null) {
            // No row at all for this CNIC anymore — account was
            // permanently deleted while this device wasn't running (so the
            // realtime DELETE listener never had a chance to see it live).
            // Previously this just flipped local flags to a "pending"
            // state, which left the avatar/FAB/header in a half logged-in
            // limbo pointing at an account that no longer exists — nothing
            // to view, nothing to edit, but not signed out either. Force
            // an actual full logout instead, same as the live-delete path.
            if (mounted) widget.onAccountPermanentlyDeleted?.call();
          } else {
            final freshStatus = fresh['status'] as String? ?? status;
            if (freshStatus != status) {
              await prefs.setString('user_status', freshStatus);
              final freshIsPending = freshStatus == 'pending' || freshStatus == 'deleted' || freshStatus == 'rejected';
              if (mounted) setState(() { _isPendingUser = freshIsPending; });
            }
          }
        } catch (_) {
          // Network hiccup — keep showing the cached state rather than
          // logging someone out incorrectly over a temporary connection issue.
        }
      }
    }

    // Load pricing settings
    _loadPricingSettings();
    // Load saved + not-interested IDs (await so they're ready before feed loads)
    final savedIds = prefs.getStringList('saved_proposals') ?? [];
    final notInterested = prefs.getStringList('not_interested_proposals') ?? [];
    if (mounted) setState(() {
      _savedIds = savedIds.toSet();
      _notInterestedIds.addAll(notInterested);
    });
    // 2. Fetch gender filter BEFORE loading feed so first load is already filtered
    await _fetchUserGender(prefetchedStatus: fresh);

    // 3. Load not-interested IDs from DB then load feed
    await _loadNotInterestedIds();
    await _loadFeed();
    _db.fetchProposalCounts().then((counts) {
      if (mounted) setState(() { _proposalCounts = counts; _countsLoaded = true; });
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _channel?.unsubscribe();
    _scrollCtrl.dispose();
    _searchDebounce?.cancel();
    _searchCtrl.dispose();
    _entryCtrl.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _loadPricingSettings();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshFeedIfChanged();
      _loadPricingSettings();
      // checkAndRefresh() carries the server-side "does my account still
      // exist" recheck (added specifically to catch a permanent delete
      // whose realtime event got missed by a dropped connection while
      // backgrounded) — resume is the single most common real-world
      // trigger for that exact scenario, so it needs to run here too, not
      // just on tab switches. Deliberately untouched by the change below —
      // that check always runs on resume regardless of whether the feed
      // itself needed a reload.
      checkAndRefresh();
    }
  }

  /// Resume used to unconditionally call _loadFeed(), re-fetching the
  /// entire first page (with its full column list) every single time the
  /// app came back to the foreground — even on the extremely common case
  /// of "backgrounded for 10 seconds, nothing changed." This does a cheap
  /// counts-only check first (the same lightweight RPC already used for
  /// the "All Proposals 1256" badge and pull-to-refresh) and only pays for
  /// the full reload when the total active-proposal counts have actually
  /// moved since the last load. On any error, or the very first time
  /// counts haven't been loaded yet, this falls back to the original
  /// always-reload behavior — so the worst case is exactly what already
  /// existed, never staler.
  Future<void> _refreshFeedIfChanged() async {
    try {
      final counts = await _db.fetchProposalCounts();
      final changed = !_countsLoaded ||
          counts['total'] != _proposalCounts['total'] ||
          counts['male'] != _proposalCounts['male'] ||
          counts['female'] != _proposalCounts['female'];
      if (mounted) setState(() { _proposalCounts = counts; _countsLoaded = true; });
      if (changed) {
        await _loadFeed();
      }
    } catch (_) {
      // Counts check itself failed (network hiccup, etc.) — don't let that
      // silently skip a reload the old behavior would always have done.
      await _loadFeed();
    }
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  Future<void> _loadNotInterestedIds() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      // Clean up locally expired entries first
      final expiryData = prefs.getString('not_interested_expiry_v2') ?? '';
      if (expiryData.isNotEmpty) {
        final now = DateTime.now().millisecondsSinceEpoch;
        final active = expiryData.split(',').where((e) {
          final parts = e.split(':');
          if (parts.length != 2) return false;
          final exp = int.tryParse(parts[1]);
          return exp != null && exp > now;
        }).toList();
        await prefs.setString('not_interested_expiry_v2', active.join(','));
        final activeIds = active.map((e) => e.split(':')[0]).toSet();
        if (mounted) setState(() => _notInterestedIds.addAll(activeIds));
      }
      // Also fetch from DB (which also filters by expiry server-side)
      final cnic = prefs.getString('user_cnic') ?? '';
      if (cnic.isEmpty) return;
      final ids = await _db.fetchNotInterestedIds(cnic);
      if (mounted && ids.isNotEmpty) {
        setState(() => _notInterestedIds.addAll(ids));
      }
    } catch (_) {}
  }

  // Lets other screens (e.g. the account popover, which edits the profile
  // from a completely separate widget tree) tell this screen to re-pull the
  // logged-in user's name/photo — without this, the header avatar only ever
  // picked up changes on the next full app restart.
  Future<void> refreshOwnAvatar() => _fetchUserGender();

  /// Called by MainShell right after a logout. IndexedStack keeps this
  /// screen's state alive across the whole app session, so without this the
  /// previous account's name/photo/paid-flag would silently keep showing
  /// (or flip to '?' if only the name got cleared) until a full app
  /// restart — this is what caused the header avatar and lock state to
  /// look wrong/inconsistent right after logging out and back in.
  void resetOwnAccountState() {
    if (!mounted) return;
    setState(() {
      _ownName = null;
      _ownPhotoUrl = null;
      _ownProposalId = null;
      _isPaidUser = false;
      _isPendingUser = false;
      _userGender = null;
      // While logged in as a paid user, a gender filter gets auto-applied
      // behind the scenes (to show the opposite gender) — it was never
      // cleared on logout, so the filter icon's red "active filter" dot
      // stayed on afterwards even though the person never touched the
      // filter sheet themselves. Reset filters entirely on logout so the
      // icon accurately reflects "nothing applied."
      _filters = const FilterState();
      _selectedChip = 0;
    });
    _applyFilters();
    _refreshBoostedForCities();
  }

  Future<void> _fetchUserGender({Map<String, dynamic>? prefetchedStatus}) async {
    final prefs0 = await SharedPreferences.getInstance();
    final isAdminView = prefs0.getBool('is_admin_view') ?? false;
    if (isAdminView) {
      // Admin accounts live in `admin_accounts`, not `proposals` — querying
      // proposals by cnic for an admin always returns no row, which used
      // to leave the header avatar stuck showing '?' forever. Use the
      // name that was cached at admin-login time instead.
      final adminName = prefs0.getString('user_name');
      if (mounted) {
        setState(() {
          _ownName = adminName;
          _ownPhotoUrl = null;
          _ownProposalId = null;
        });
      }
      return;
    }
    String? cnic = _db.activatedCnic ?? _db.submittedCnic;
    if (cnic == null) {
      final prefs = await SharedPreferences.getInstance();
      cnic = prefs.getString('user_cnic');
    }
    // Fetch own proposal ID for edit button
    if (cnic != null) {
      try {
        // Reuse a result the caller already fetched moments earlier (same
        // RPC, same cnic) instead of asking the server the identical
        // question again — see _initAndLoad()/checkAndRefresh(), which
        // both already need this exact row to check whether the account
        // still exists before this function would otherwise re-fetch it.
        // Callers that don't have a fresh result to hand over (e.g.
        // refreshOwnAvatar(), or after editing a profile) simply don't
        // pass prefetchedStatus, and this falls back to fetching it here
        // exactly as before — nothing changes for them.
        final res = prefetchedStatus ?? await Supabase.instance.client
            .rpc('fetch_user_status_by_cnic', params: {'p_cnic': cnic});
        if (mounted && res != null) {
          final id = res['id'] as String?;
          setState(() {
            _ownProposalId = id;
            // Only surface the name/photo in the header avatar once the
            // user has actually logged in — a cnic cached merely from
            // submitting the proposal form (submittedCnic, no password
            // verified) must never populate the "logged in" identity, or
            // the avatar shows up for someone who never logged in.
            if (_isLoggedIn) {
              _ownName = res['name'] as String?;
              _ownPhotoUrl = res['profile_photo_url'] as String?;
            }
          });
          // Sync saved proposals from Supabase now that we have the user's ID
          if (id != null) {
            await _syncSavedFromSupabase(id);
            // Also persist for future loads
            final prefs2 = await SharedPreferences.getInstance();
            await prefs2.setString('user_proposal_id', id);
          }
        }
      } catch (_) {}
    }
    if (cnic == null) return;
    final gender = await _db.getUserGenderByCnic(cnic);
    if (gender != null && mounted) {
      // Lock filter to opposite gender
      final opposite = gender.toLowerCase() == 'male' ? 'Female' : 'Male';
      setState(() {
        _userGender = opposite;
        // Only auto-apply the gender filter for an actual active paid
        // user — the same condition _loadFeed() uses to decide whether to
        // keep this lock. Applying it here regardless of paid status
        // meant every cold start (even for a signed-out visitor, or
        // someone who'd merely submitted a proposal) briefly showed the
        // filter-icon red dot, only for _loadFeed() to immediately clear
        // it again a moment later since they weren't actually paid.
        if (_filters.gender == null && isPaidUser) {
          _filters = _filters.copyWith(gender: () => opposite);
          _applyFilters();
        }
      });
    }
  }

  /// Called by MainShell when user switches back from subscription tab
  Future<void> checkAndRefresh() async {
    final prefs = await SharedPreferences.getInstance();
    final paid = prefs.getBool('is_paid_user') ?? false;
    final status = prefs.getString('user_status') ?? '';
    final subStatusOnResume = prefs.getString('user_subscription_status') ?? '';
    final isPending = status == 'pending' || status == 'deleted' || status == 'rejected' || subStatusOnResume == 'expired';
    final effectivePaid = paid && !isPending;
    debugPrint('[FEED] checkAndRefresh() called. paid=$paid status="$status" isPending=$isPending '
        'effectivePaid=$effectivePaid current_isPaidUser=$isPaidUser current_isPendingUser=$_isPendingUser '
        '=> will update state? ${effectivePaid != isPaidUser}');

    // Re-validate against the server, not just cached prefs. Postgres
    // Changes realtime events fire once, with no replay on reconnect — if
    // this device's websocket happened to be disconnected at the exact
    // moment admin permanently deleted the account (backgrounded app,
    // brief network drop, OS killing the socket to save battery, etc.),
    // the live listener in SubscriptionScreen silently never sees it, and
    // nothing here would otherwise catch up until a full app restart.
    // Every resume/tab-switch is a free chance to self-heal that, the same
    // way the cold-start check in _initAndLoad does.
    final isAdminSession = prefs.getBool('is_admin_view') ?? false;
    final cachedCnic = prefs.getString('user_cnic') ?? _db.submittedCnic;
    // Hoisted so the _fetchUserGender() calls further down can reuse this
    // instead of asking the server the same question again a moment later
    // — same reasoning as the identical fix in _initAndLoad() above.
    Map<String, dynamic>? fresh;
    if (!isAdminSession && cachedCnic != null && cachedCnic.isNotEmpty && (paid || cachedCnic.isNotEmpty)) {
      try {
        fresh = await _db.fetchUserStatusByCnic(cachedCnic);
        if (fresh == null) {
          widget.onAccountPermanentlyDeleted?.call();
          return;
        }
      } catch (_) {
        // Network hiccup — fall through to the cached-state logic below
        // rather than logging someone out incorrectly over a temporary
        // connection issue.
      }
    }

    bool identityRefreshed = false;
    if (effectivePaid != isPaidUser) {
      if (effectivePaid) {
        if (mounted) setState(() { _loading = true; _allProposals = []; _filtered = []; });
        setState(() { _isPaidUser = true; _isPendingUser = false; });
        widget.onPaidStatusChanged?.call();
        await _fetchUserGender(prefetchedStatus: fresh);
        identityRefreshed = true;
        await _loadNotInterestedIds();
        final proposals = await _db.fetchFeedProposals(filters: _filters, isPaidUser: true);
        if (mounted) setState(() {
          final filtered = proposals.where((p) => !_notInterestedIds.contains(p.id)).toList();
          _allProposals = filtered;
          _filtered = _sortedProposals(filtered);
          _loading = false;
        });
      } else {
        if (mounted) setState(() { _isPendingUser = isPending; });
        await _loadFeed();
        widget.onPaidStatusChanged?.call();
      }
    } else if (effectivePaid) {
      // Paid status didn't flip (e.g. this screen's state was already
      // marked paid from a previous session and never got reset on
      // logout), but a login may have just happened for a *different*
      // account on the same device. Always re-pull the name/photo so the
      // header avatar reflects whoever is actually logged in now, instead
      // of silently keeping stale data (or showing '?').
      await _fetchUserGender(prefetchedStatus: fresh);
      identityRefreshed = true;
    }

    // Fallback for the case none of the branches above cover: logging
    // into an account that's still pending (not yet approved). paid stays
    // false both before and after that login, so effectivePaid never
    // "changes" and the branches above skip entirely — _isPendingUser
    // then never flips to true, which (via hasAccount) kept the header
    // avatar hidden right after login until something unrelated (like a
    // pull-to-refresh, which calls _loadFeed() and sets these directly)
    // happened to fix it. Always resync both here as a catch-all.
    if (mounted && _isPendingUser != isPending) {
      setState(() => _isPendingUser = isPending);
    }
    if (!identityRefreshed && _isLoggedIn) {
      await _fetchUserGender(prefetchedStatus: fresh);
    }
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 300) {
      _loadMore();
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMoreData) return;
    setState(() => _loadingMore = true);
    try {
      final nextPage = _currentPage + 1;
      final (chipFrom, chipTo) = _chipDateRange();
      final proposals = await _db.fetchFeedProposals(
        filters: _filters,
        isPaidUser: isPaidUser,
        page: nextPage,
        pageSize: _pageSize,
        postedAfter: chipFrom,
        postedBefore: chipTo,
        search: _searchQuery.isEmpty ? null : _searchQuery,
      );
      if (!mounted) return;
      setState(() {
        _currentPage = nextPage;
        _hasMoreData = proposals.length == _pageSize;
        final newProposals = proposals.where((p) => !_notInterestedIds.contains(p.id)).toList();
        _allProposals = [..._allProposals, ...newProposals];
        _filtered = _sortedProposals(_allProposals);
        _loadingMore = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingMore = false);
    }
  }

  Future<void> _loadFeed({bool silent = false}) async {
    if (!silent) setState(() { _loading = true; _error = null; _currentPage = 0; _hasMoreData = true; });
    try {
      // Always re-check isPaidUser from SharedPreferences to catch logout
      final prefs = await SharedPreferences.getInstance();
      final bool isPaid = prefs.getBool('is_paid_user') ?? false;
      final String userStatus = prefs.getString('user_status') ?? '';
      final String subStatus = prefs.getString('user_subscription_status') ?? '';
      final bool isPending = userStatus == 'pending' || userStatus == 'deleted' || userStatus == 'rejected' || subStatus == 'expired';

      // The New/1 Month/2 Months/3 Months chips need the server to
      // actually filter by posted_at — previously this always fetched the
      // plain newest-first page regardless of which chip was selected, and
      // left the date filtering to _applyFilters() re-filtering whatever
      // had already happened to load into memory. Since the feed loads
      // newest-first, older date buckets almost always came back empty
      // that way even when matching profiles genuinely existed — they'd
      // simply never been paginated in yet. _chipDateRange() returns
      // (null, null) for 'All'/'Saved', so this is a no-op for those.
      final (chipFrom, chipTo) = _chipDateRange();

      // Fetch first page of proposals
      final proposals = await _db.fetchFeedProposals(
        filters: _filters,
        isPaidUser: isPaid && !isPending,
        page: 0,
        pageSize: _pageSize,
        postedAfter: chipFrom,
        postedBefore: chipTo,
        search: _searchQuery.isEmpty ? null : _searchQuery,
      );


      if (!mounted) return;
      setState(() {
        _currentPage = 0;
        _hasMoreData = proposals.length == _pageSize;
        final filtered = proposals.where((p) => !_notInterestedIds.contains(p.id)).toList();
        _allProposals = filtered;
        _filtered = _sortedProposals(filtered);
        _loading = false;
        _isPaidUser = isPaid;
        _isPendingUser = isPending;
        // Clear auto-locked gender filter on logout/pending —
        // but only if it was auto-locked (userGender != null), not
        // if the user manually chose a gender in the filter sheet.
        if (!isPaid || isPending) {
          if (_userGender != null) {
            _filters = _filters.copyWith(gender: () => null);
          }
          _userGender = null;
        }
      });
      debugPrint('[FEED] _loadFeed() finished. isPaid(prefs)=$isPaid isPending(prefs)=$isPending '
          '_isPaidUser=$_isPaidUser _isPendingUser=$_isPendingUser isPaidUser(getter)=$isPaidUser '
          '=> calling widget.onPaidStatusChanged now');
      // This is the authoritative, settled read of paid/pending status —
      // it runs after other cold-start async work (like clearing a stale
      // admin session) has had time to finish, unlike the earlier read in
      // _initAndLoad(). Telling MainShell now ensures the FAB it builds
      // reflects this final result, not whatever an earlier racy read
      // reported.
      widget.onPaidStatusChanged?.call();
      _entryCtrl.forward(from: 0);
      // Keeps the "X Results" count badge in sync with what actually
      // loaded — previously this only happened inside _applyFilters(),
      // which the date-range chips now skip in favor of this full reload.
      _refreshServerCount();
    } catch (e, st) {
      if (!mounted) return;
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  void _subscribeRealtime() {
    _channel = _db.subscribeToFeed(
      (newProposal) {
        if (!mounted) return;
        setState(() {
          // A realtime INSERT event can fire for a row that's already in
          // the list from the initial fetch (timing between the fetch
          // completing and the subscription catching the same row's
          // insert/approval isn't guaranteed to avoid overlap). Blindly
          // prepending created a genuine duplicate — and the realtime
          // payload isn't guaranteed to carry every column the normal
          // fetch does, so that duplicate could silently show stale or
          // incomplete data sitting in front of the correct one. Only
          // add it if this proposal genuinely isn't already present.
          if (!_allProposals.any((p) => p.id == newProposal.id)) {
            _allProposals = [newProposal, ..._allProposals];
            _applyFilters();
          }
        });
      },
      onRemoved: (proposalId) {
        if (!mounted) return;
        setState(() {
          _allProposals.removeWhere((p) => p.id == proposalId);
          _filtered.removeWhere((p) => p.id == proposalId);
          if (_selectedCardId == proposalId) _selectedCardId = null;
        });
      },
    );
  }

  // ── Sorting ───────────────────────────────────────────────────────────────
  List<RishtaProposal> _sortedProposals(List<RishtaProposal> list) {
    // DB already sorts by is_boosted DESC, approved_at DESC — preserve that order
    final boosted = list.where((p) => p.isBoosted).toList();
    final rest = list.where((p) => !p.isBoosted).toList();
    return [...boosted, ...rest];
  }

  void _loadPricingSettings() {
    SupabaseService.instance.fetchAppSettings(); // updates cache + notifies
  }

  // ── Save / Bookmark ──────────────────────────────────────────────────────
  Future<void> _syncSavedFromSupabase(String userProposalId) async {
    try {
      final res = await Supabase.instance.client
          .from('saved_proposals')
          .select('saved_proposal_id')
          .eq('user_proposal_id', userProposalId);
      final ids = (res as List).map((e) => e['saved_proposal_id'] as String).toSet();
      if (mounted) {
        setState(() {
          _savedIds = ids;
        });
        final prefs = await SharedPreferences.getInstance();
        await prefs.setStringList('saved_proposals', ids.toList());
        if (mounted) _applyFilters();
      }
    } catch (_) {}
  }

  Future<void> _toggleSave(String id) async {
    final prefs = await SharedPreferences.getInstance();
    final userProposalId = prefs.getString('user_proposal_id');
    final isNowSaved = !_savedIds.contains(id); // the state we're optimistically moving to
    setState(() {
      if (_savedIds.contains(id)) { _savedIds.remove(id); }
      else { _savedIds.add(id); }
    });
    await prefs.setStringList('saved_proposals', _savedIds.toList());
    if (_selectedChip == 1) _applyFilters(); // refresh Saved tab
    // Sync to Supabase if logged in
    if (userProposalId != null && userProposalId.isNotEmpty) {
      try {
        if (isNowSaved) {
          await Supabase.instance.client.from('saved_proposals').upsert({
            'user_proposal_id': userProposalId,
            'saved_proposal_id': id,
          }, onConflict: 'user_proposal_id,saved_proposal_id');
        } else {
          await Supabase.instance.client.from('saved_proposals')
              .delete()
              .eq('user_proposal_id', userProposalId)
              .eq('saved_proposal_id', id);
        }
      } catch (e) {
        debugPrint('Failed to sync saved-proposal change: $e');
        // Server sync failed — roll back the optimistic local change so the
        // UI doesn't claim a save that didn't actually persist, and let the
        // user know so they can retry instead of silently losing it later.
        if (mounted) {
          setState(() {
            if (isNowSaved) { _savedIds.remove(id); } else { _savedIds.add(id); }
          });
          await prefs.setStringList('saved_proposals', _savedIds.toList());
          if (_selectedChip == 1) _applyFilters();
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(isNowSaved
                ? "Couldn't save — please check your connection and try again."
                : "Couldn't remove — please check your connection and try again."),
            behavior: SnackBarBehavior.floating,
          ));
        }
      }
    }
  }

  // ── Search matcher ──────────────────────────────────────────────────────
  // Matches on name, city/location, profession, or the proposal's "hash
  // code" (the #1234 number shown on the card) — with or without the '#'.
  bool _matchesSearch(RishtaProposal p, String query) {
    final q = query.toLowerCase();
    if (p.name.toLowerCase().contains(q)) return true;
    if (p.city.toLowerCase().contains(q)) return true;
    if ((p.location ?? '').toLowerCase().contains(q)) return true;
    if ((p.country ?? '').toLowerCase().contains(q)) return true;
    if (p.profession.toLowerCase().contains(q)) return true;
    if (p.caste.toLowerCase().contains(q)) return true;
    if (p.sect.toLowerCase().contains(q)) return true;
    if (p.maritalStatus.toLowerCase().contains(q)) return true;
    // homeType only ever holds "Own House" / "Rented House" — this also
    // naturally catches someone just typing "own" or "rented".
    if ((p.homeType ?? '').toLowerCase().contains(q)) return true;

    final numQuery = query.startsWith('#') ? query.substring(1) : query;
    final numSearch = int.tryParse(numQuery);
    if (numSearch != null) {
      if (p.proposalNumber == numSearch) return true;
      // A bare number is ambiguous between an age and a proposal number —
      // "#" makes the intent explicit (code only), otherwise match both.
      if (!query.startsWith('#') && p.age == numSearch) return true;
    }
    // Also allow partial/substring match against the code, e.g. "123" matching "#12345"
    if (numQuery.isNotEmpty &&
        RegExp(r'^\d+$').hasMatch(numQuery) &&
        p.proposalNumber != null &&
        p.proposalNumber.toString().contains(numQuery)) {
      return true;
    }
    return false;
  }

  // Filters like city, caste, profession, etc. are enforced server-side
  // (see SupabaseService.fetchFeedProposals). If we only re-filter whatever
  // is already loaded in memory, the count/list only reflects whichever
  // page(s) happened to be fetched before the filter was applied — not the
  // real matching set. So whenever such a filter changes, do a full reload
  // from the server (resets pagination too), then reapply the chip/search
  // filtering on top of the freshly fetched data.
  Future<void> _reloadWithFilters() async {
    await _loadFeed();
    if (mounted) _applyFilters();
  }

  /// Returns the (from, to) posted-date bounds for chip-based date filters
  /// (New / 1 Month / 2 Months / 3 Months), or null for "All"/"Saved" where
  /// no date bound applies. Shared between the client-side filtering below
  /// and the server-side count query, so they always agree.
  (DateTime?, DateTime?) _chipDateRange() {
    final now = DateTime.now();
    switch (_selectedChip) {
      case 2: return (now.subtract(const Duration(days: 7)), null);
      case 3: return (now.subtract(const Duration(days: 30)), now.subtract(const Duration(days: 7)));
      case 4: return (now.subtract(const Duration(days: 60)), now.subtract(const Duration(days: 30)));
      // "3+ Months" — 90 days old or older, open-ended (no upper bound),
      // so it covers 90-day-old profiles all the way back to the oldest
      // one that exists, instead of the old fixed 60-90-day-only bucket.
      case 5: return (null, now.subtract(const Duration(days: 90)));
      default: return (null, null);
    }
  }

  int? _serverFilteredCount;
  int _countRequestId = 0;

  /// Fetches the TRUE total number of matching proposals from the server
  /// (independent of how many pages have been paginated in so far) so the
  /// "Results" count shown in the feed is accurate — not just a count of
  /// whatever happens to already be loaded in memory.
  Future<void> _refreshServerCount() async {
    // "Saved" is a purely local list (never paginated from the server), so
    // there's no server count to fetch for it. Search, on the other hand,
    // is now matched server-side (see SupabaseService._buildFeedQuery), so
    // it can get an accurate total the same way the other filters do.
    if (_selectedChip == 1) {
      if (mounted) setState(() => _serverFilteredCount = null);
      return;
    }
    final requestId = ++_countRequestId;
    final (from, to) = _chipDateRange();
    try {
      final count = await _db.fetchFeedProposalsCount(
        filters: _filters,
        isPaidUser: isPaidUser,
        postedAfter: from,
        postedBefore: to,
        search: _searchQuery.isEmpty ? null : _searchQuery,
      );
      // Ignore stale responses if filters changed again while this was in flight.
      if (mounted && requestId == _countRequestId) {
        setState(() => _serverFilteredCount = count);
      }
    } catch (_) {
      if (mounted && requestId == _countRequestId) setState(() => _serverFilteredCount = null);
    }
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  void _applyFilters({String? searchOverride}) {
    final query = searchOverride ?? _searchQuery;

    // Saved filter
    if (_selectedChip == 1) {
      final list = _allProposals.where((p) {
        if (!_savedIds.contains(p.id)) return false;
        if (query.isNotEmpty && !_matchesSearch(p, query)) return false;
        return true;
      }).toList();
      setState(() { _filtered = _sortedProposals(list); _serverFilteredCount = null; });
      return;
    }

    final (chipFrom, chipTo) = _chipDateRange();
    final f = _filters;
    // profession_category is now captured explicitly at registration/edit
    // time, so this compares directly against the selected categories —
    // no more expanding a hand-maintained category->profession list that
    // could silently drift out of sync with what people can actually pick.
    // Single pass over _allProposals instead of a dozen sequential
    // where().toList() calls (each of which scans the whole list-so-far and
    // allocates a new list). This whole chain re-runs on every search
    // keystroke, so once _allProposals has grown from scrolling through
    // many pages, the old approach meant redoing 12 full scans per
    // keystroke — this does it in one.
    final list = _allProposals.where((p) {
      switch (_selectedChip) {
        case 2: if (!p.postedAt.isAfter(chipFrom!)) return false; break;
        case 3:
        case 4: if (!(p.postedAt.isAfter(chipFrom!) && p.postedAt.isBefore(chipTo!))) return false; break;
        // 3+ Months is open-ended on the lower end (chipFrom is null) —
        // just needs to be older than the 90-day cutoff.
        case 5: if (!p.postedAt.isBefore(chipTo!)) return false; break;
      }
      if (f.gender != null && p.gender.toLowerCase() != f.gender!.toLowerCase()) return false;
      if (f.cities.isNotEmpty && !f.cities.contains(p.city) && !_boostedForSelectedCitiesIds.contains(p.id)) return false;
      if (f.castes.isNotEmpty && !f.castes.contains(p.caste)) return false;
      if (f.sects.isNotEmpty && !f.sects.contains(p.sect)) return false;
      if (f.professions.isNotEmpty && !f.professions.contains(p.professionCategory)) return false;
      if (f.maritalStatuses.isNotEmpty && !f.maritalStatuses.contains(p.maritalStatus)) return false;
      if (f.educations.isNotEmpty && !f.educations.contains(p.education)) return false;
      if (f.cnicVerified == true && !p.cnicVerified) return false;
      if (p.age < f.ageRange.start || p.age > f.ageRange.end) return false;
      if (p.heightInches < f.heightRange.start || p.heightInches > f.heightRange.end) return false;
      if (f.locationFilter == 'local' && !(p.country == null || p.country!.toLowerCase() == 'pakistan')) return false;
      if (f.locationFilter == 'overseas') {
        if (!(p.country != null && p.country!.toLowerCase() != 'pakistan')) return false;
        if (f.countries.isNotEmpty && !f.countries.contains(p.country)) return false;
      }
      if (f.houses.isNotEmpty && !f.houses.contains(p.homeType)) return false;
      if (query.isNotEmpty && !_matchesSearch(p, query)) return false;
      return true;
    }).toList();

    setState(() => _filtered = _sortedProposals(list));
    _refreshServerCount();
  }

  /// Public method so MainShell can trigger filter from FAB
  void openFilterSheet() => _openFilterSheet();

  // Refreshes _boostedForSelectedCitiesIds to match the current city
  // filter — called after every place _filters.cities can change. Safe
  // to call even when cities is empty (the service method just returns
  // an empty set immediately without a network call in that case).
  Future<void> _refreshBoostedForCities() async {
    final ids = await _db.getBoostedProposalIdsForCities(_filters.cities);
    if (!mounted) return;
    setState(() => _boostedForSelectedCitiesIds = ids);
  }

  void _openFilterSheet() {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FilterSheet(
        initial: _filters,
        lockedGender: _userGender,
        onApply: (f) {
          setState(() => _filters = f);
          _reloadWithFilters();
          _refreshBoostedForCities();
          widget.onPaidStatusChanged?.call(); // rebuild FAB badge
        },
      ),
    );
  }

  void _openSubscriptionScreen() {
    // Free Mode + no account yet: there's nothing to subscribe to until
    // they've created a profile, so skip the Subscription screen entirely
    // and send them straight to Create Account. Someone who already has an
    // account (just pending/expired/paused, hence seeing this banner)
    // still goes through the normal plan-selected flow below, since their
    // free plan is activated there via CNIC + password, not by signing up
    // again.
    if (_freeMode && !_isLoggedIn) {
      widget.onOpenCreateAccount?.call();
      return;
    }
    // Use tab switch instead of push to avoid black screen flash
    if (widget.onOpenSubscription != null) {
      widget.onOpenSubscription!();
    } else {
      Navigator.push(
        context,
        PageRouteBuilder(
          pageBuilder: (_, __, ___) => const SubscriptionScreen(scrollToPlans: true, initialSelectedPlan: 0),
          transitionDuration: const Duration(milliseconds: 250),
          transitionsBuilder: (_, anim, __, child) => FadeTransition(opacity: anim, child: child),
        ),
      ).then((activated) async {
        if (activated == true) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setBool('is_paid_user', true);
          final String activatedStatus = prefs.getString('user_status') ?? '';
          final bool activatedPending = activatedStatus == 'pending' || activatedStatus == 'deleted' || activatedStatus == 'rejected';
          if (mounted && !activatedPending) {
            setState(() { _isPaidUser = true; _isPendingUser = false; });
            widget.onPaidStatusChanged?.call();
            await _fetchUserGender(); // wait for gender before reloading
            _showToast('✅ Profile activated! Phone numbers & photos are now visible.');
            final proposals = await _db.fetchFeedProposals(filters: _filters, isPaidUser: true);
            if (mounted) setState(() {
              _allProposals = proposals;
              _filtered = _sortedProposals(proposals);
            });
          }
        }
      });
    }
  }

  void _showToast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message, style: const TextStyle(fontWeight: FontWeight.w600)),
      backgroundColor: kPurple,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      duration: const Duration(seconds: 3),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kSurface,
      body: NestedScrollView(
        headerSliverBuilder: (_, __) => [
          _buildAppBar(),
          SliverToBoxAdapter(child: _buildQuickChips()),
          // Only for logged-out visitors — a logged-in pending account
          // (paid or not) gets its own accurate status via the avatar
          // popup instead, rather than this generic "Subscribe" banner
          // which would be misleading for someone who's already paid.
          if (!isPaidUser && !_isLoggedIn)
            SliverPersistentHeader(
              pinned: true,
              delegate: _BannerDelegate(child: _buildVisitorBanner()),
            ),
        ],
        body: NotificationListener<ScrollNotification>(
          onNotification: (notification) {
            if (notification is ScrollUpdateNotification) {
              final metrics = notification.metrics;
              if (metrics.pixels >= metrics.maxScrollExtent - 300) {
                _loadMore();
              }
            }
            return false;
          },
          child: RefreshIndicator(
            onRefresh: () async {
              setState(() { _isPullRefreshing = true; _countsLoaded = false; });
              _currentPage = 0;
              _hasMoreData = true;
              await _loadFeed();
              final counts = await _db.fetchProposalCounts();
              if (mounted) setState(() {
                _proposalCounts = counts;
                _countsLoaded = true;
                _isPullRefreshing = false;
              });
            },
            color: kPurple,
            displacement: 60,
            child: _loading && !_isPullRefreshing
                ? const _SkeletonFeedList()
                : _error != null
                    ? _buildError()
                    : _buildFeed(),
          ),
        ),
      ),
    );
  }

  Widget _buildError() {
    final s = _S.of(context);
    final isNoInternet = (_error ?? '').toLowerCase().contains('connection') ||
        (_error ?? '').toLowerCase().contains('socket') ||
        (_error ?? '').toLowerCase().contains('network');
    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: s.s(32)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: s.d(48), height: s.d(48),
              decoration: BoxDecoration(color: kPurpleLight, borderRadius: BorderRadius.circular(s.s(14))),
              child: Icon(
                isNoInternet ? Icons.wifi_off_rounded : Icons.cloud_off_rounded,
                color: kPurple, size: s.d(22),
              ),
            ),
            SizedBox(height: s.s(10)),
            Text(
              isNoInternet ? 'No Internet Connection' : 'Something Went Wrong',
              style: TextStyle(fontSize: s.f(14), fontWeight: FontWeight.w800, color: kInk),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: s.s(4)),
            Text(
              isNoInternet
                  ? 'Please check your connection and try again.'
                  : 'We couldn\'t load proposals. Please try again.',
              style: TextStyle(fontSize: s.f(12), color: kInkLight, height: 1.4),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: s.s(14)),
            _TryAgainButton(onTap: _loadFeed),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    final s = _S.of(context);
    debugPrint('[HEADER] _buildAppBar() rendering. isPaidUser=$isPaidUser (_isPaidUser=$_isPaidUser _isPendingUser=$_isPendingUser) '
        '=> header filter icon shown? ${!isPaidUser}');
    return SliverAppBar(
      pinned: true,
      floating: false,
      backgroundColor: kCardBg,
      surfaceTintColor: Colors.transparent,
      shadowColor: Colors.transparent,
      elevation: 0,
      expandedHeight: 0,
      title: Row(
        children: [
          Image.asset('assets/logo/logo.png', width: s.d(64), height: s.d(64), fit: BoxFit.contain),
          SizedBox(width: s.s(10)),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Flexible(child: Text('Verified Proposals', style: TextStyle(fontSize: s.f(13.5), fontWeight: FontWeight.w800, color: kInk), overflow: TextOverflow.ellipsis)),
                  SizedBox(width: s.s(4)),
                  Icon(Icons.verified_rounded, size: s.d(16), color: kPurple),
                ]),
                SizedBox(height: s.s(3)),
                Row(children: [
                  Icon(Icons.location_on_rounded, size: s.d(11), color: kInkFaint),
                  SizedBox(width: s.s(2)),
                  Flexible(
                    child: Text(
                      _filters.cities.isEmpty
                          ? 'Worldwide'
                          : _filters.cities.length == 1
                              ? _filters.cities.first
                              : '${_filters.cities.first} +${_filters.cities.length - 1} more',
                      style: TextStyle(fontSize: s.f(11), color: kInkFaint, fontWeight: FontWeight.w500),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ]),
              ],
            ),
          ),
        ],
      ),
      actions: [
        if (!hasAccount) Stack(
          children: [
            IconButton(
              onPressed: _openFilterSheet,
              icon: Container(
                width: s.d(36), height: s.d(36),
                decoration: BoxDecoration(
                  color: kPurpleLight,
                  borderRadius: BorderRadius.circular(s.s(10)),
                ),
                child: Icon(Icons.tune_rounded, color: kPurple, size: s.d(18)),
              ),
            ),
            if (_filters.activeCount > 0)
              Positioned(
                right: 14, top: 12,
                child: Container(
                  width: s.d(6), height: s.d(6),
                  decoration: BoxDecoration(color: kRose, borderRadius: BorderRadius.circular(s.s(3))),
                ),
              ),
          ],
        ),
        // Search + Refresh icons (tight row)
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              GestureDetector(
                onTap: () {
                  final wasVisible = _searchVisible;
                  final hadQuery = _searchQuery.isNotEmpty;
                  _searchDebounce?.cancel();
                  _searchCtrl.clear();
                  _searchQuery = '';
                  setState(() => _searchVisible = !_searchVisible);
                  if (wasVisible && hadQuery) {
                    // _allProposals currently holds a search-narrowed set
                    // fetched from the server — closing search needs a real
                    // reload to bring back the full (unsearched) feed, not
                    // just a local re-filter of what's already loaded.
                    if (_selectedChip == 1) {
                      _applyFilters(searchOverride: '');
                    } else {
                      _reloadWithFilters();
                    }
                  }
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                  child: Icon(
                    _searchVisible ? Icons.search_off_rounded : Icons.search_rounded,
                    color: _searchVisible ? kPurple : kInkFaint,
                    size: 20,
                  ),
                ),
              ),
              // ── Notification bell ────────────────────────────────────────
              ListenableBuilder(
                listenable: NotificationService.instance,
                builder: (_, __) {
                  final hasUnread = NotificationService.instance.hasUnread;
                  return GestureDetector(
                    onTap: () {
                      Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const NotificationScreen()));
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                      child: Stack(clipBehavior: Clip.none, children: [
                        Icon(
                          hasUnread
                              ? Icons.notifications_rounded
                              : Icons.notifications_none_rounded,
                          color: hasUnread ? kPurple : kInkFaint,
                          size: 20,
                        ),
                        if (hasUnread)
                          Positioned(
                            right: -2, top: -2,
                            child: Container(
                              width: 7, height: 7,
                              decoration: BoxDecoration(
                                color: kRose,
                                shape: BoxShape.circle,
                                border: Border.all(color: kCardBg, width: 1.5),
                              ),
                            ),
                          ),
                      ]),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
        // Previously gated on isPaidUser alone, which meant a pending
        // (or deleted/rejected/expired) account — logged in, just not
        // fully active — had no way to ever reach their own account page,
        // since this avatar is the only entry point to it. _isPendingUser
        // covers those non-active-but-logged-in states, so combining the
        // two here means "show for anyone with a real session," not just
        // paid ones, while still hiding it entirely for a signed-out visitor.
        if (hasAccount) _buildHeaderAvatar(s),
      ],
      bottom: PreferredSize(
        preferredSize: Size.fromHeight(_searchVisible ? 68 : 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_searchVisible) _buildSearchBar(),
            const _HeaderGradientBar(),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _buildHeaderAvatar(_S s) {
    final initials = (_ownName == null || _ownName!.trim().isEmpty)
        ? '?'
        : _ownName!.trim().split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase();
    return Padding(
      padding: EdgeInsets.only(right: s.s(14), left: s.s(2)),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => widget.onOpenMyAccount?.call(context, _avatarKey),
        child: Container(
          key: _avatarKey,
          width: s.d(36), height: s.d(36),
          decoration: const BoxDecoration(shape: BoxShape.circle),
          child: ClipOval(
            child: Container(
              color: kPurple,
              child: _ownPhotoUrl != null && _ownPhotoUrl!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: _ownPhotoUrl!,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Center(child: Text(initials, style: TextStyle(color: Colors.white, fontSize: s.f(13), fontWeight: FontWeight.w800))),
                      errorWidget: (_, __, ___) => Center(child: Text(initials, style: TextStyle(color: Colors.white, fontSize: s.f(13), fontWeight: FontWeight.w800))),
                    )
                  : Center(child: Text(initials, style: TextStyle(color: Colors.white, fontSize: s.f(13), fontWeight: FontWeight.w800))),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildQuickChips() {
    final s = _S.of(context);
    return Container(
      color: kCardBg,
      padding: EdgeInsets.fromLTRB(s.s(16), s.s(10), s.s(16), s.s(10)),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: List.generate(_chipLabels.length, (i) {
            final sel = _selectedChip == i;
            return Padding(
              padding: EdgeInsets.only(right: i < _chipLabels.length - 1 ? s.s(8) : 0),
              child: GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  final previousChip = _selectedChip;
                  setState(() => _selectedChip = i);
                  if (i >= 2) {
                    // New / 1 Month / 2 Months / 3 Months — these need a
                    // fresh, server-side date-filtered fetch (see
                    // _loadFeed()'s postedAfter/postedBefore), not just a
                    // re-filter of whatever's already loaded in memory —
                    // that's what caused older date buckets to show 0
                    // results even when matching profiles genuinely
                    // existed, simply because the feed loads newest-first
                    // and those older profiles had never been paginated in.
                    _loadFeed();
                  } else if (previousChip >= 2) {
                    // Coming back to All/Saved FROM a date-filtered chip —
                    // the in-memory list was just replaced by that narrower
                    // server fetch, so a purely local re-filter would keep
                    // showing only that narrowed set. Needs a real refetch
                    // to restore the full, unfiltered feed.
                    _loadFeed();
                  } else {
                    _applyFilters(); // All <-> Saved — unchanged, purely local
                  }
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: EdgeInsets.symmetric(horizontal: s.s(14), vertical: s.s(8)),
                  decoration: BoxDecoration(
                    color: sel ? kPurple : kSurface,
                    borderRadius: BorderRadius.circular(s.s(20)),
                    border: Border.all(color: sel ? kPurple : kBorder),
                  ),
                  child: Text(_chipLabels[i], style: TextStyle(fontSize: s.f(12.5), fontWeight: sel ? FontWeight.w700 : FontWeight.w500, color: sel ? Colors.white : kInkLight)),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    final s = _S.of(context);
    return Container(
      color: kCardBg,
      padding: EdgeInsets.fromLTRB(s.s(16), s.s(8), s.s(16), s.s(8)),
      child: TextField(
        controller: _searchCtrl,
        autofocus: true,
        onChanged: (val) {
          final q = val.trim();
          setState(() => _searchQuery = q);
          // "Saved" is a local-only list, so it can keep filtering
          // instantly against what's already in memory. Every other tab
          // now matches server-side (see fetchFeedProposals' search
          // param), so it needs an actual query — debounced so a full
          // reload doesn't fire on every keystroke while typing.
          if (_selectedChip == 1) {
            _applyFilters(searchOverride: q);
            return;
          }
          _searchDebounce?.cancel();
          _searchDebounce = Timer(const Duration(milliseconds: 400), () {
            if (mounted) _reloadWithFilters();
          });
        },
        decoration: InputDecoration(
          hintText: 'Search by Name, Age, Location, Profession and more....',
          hintStyle: TextStyle(fontSize: s.f(13), color: kInkFaint),
          prefixIcon: Icon(Icons.search_rounded, color: kInkFaint, size: s.d(18)),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  icon: Icon(Icons.close_rounded, size: s.d(16), color: kInkFaint),
                  onPressed: () {
                    _searchDebounce?.cancel();
                    _searchCtrl.clear();
                    setState(() => _searchQuery = '');
                    if (_selectedChip == 1) {
                      _applyFilters(searchOverride: '');
                    } else {
                      _reloadWithFilters();
                    }
                  },
                )
              : null,
          filled: true,
          fillColor: kSurface,
          contentPadding: EdgeInsets.symmetric(horizontal: s.s(14), vertical: s.s(10)),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: BorderSide(color: kBorder)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: BorderSide(color: kBorder)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: const BorderSide(color: kPurple)),
        ),
        style: TextStyle(fontSize: s.f(13), color: kInk),
      ),
    );
  }

  Widget _buildVisitorBanner() {
    final s = _S.of(context);
    return GestureDetector(
      onTap: _openSubscriptionScreen,
      child: Container(
        margin: EdgeInsets.fromLTRB(s.s(16), s.s(8), s.s(16), s.s(8)),
        padding: EdgeInsets.symmetric(horizontal: s.s(14), vertical: s.s(10)),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: [kAmber.withOpacity(0.12), kAmberLight]),
          borderRadius: BorderRadius.circular(s.s(14)),
          border: Border.all(color: kAmber.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            Container(width: s.d(38), height: s.d(38), decoration: BoxDecoration(color: kAmberLight, borderRadius: BorderRadius.circular(s.s(10))), child: Icon(Icons.lock_outline_rounded, color: kAmber, size: s.d(20))),
            SizedBox(width: s.s(12)),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('Unlock All Profiles', style: TextStyle(fontSize: s.f(13), fontWeight: FontWeight.w800, color: kInk)),
                  SizedBox(height: s.s(2)),
                  ListenableBuilder(listenable: SupabaseService.instance, builder: (_, __) {
                    return Text(_freeMode ? "Get $_stdLabel access for Free" : "Get $_stdLabel access for Rs. $_stdPrice", style: TextStyle(fontSize: s.f(11.5), color: kInkLight));
                  }),
                ],
              ),
            ),
            Container(
              padding: EdgeInsets.symmetric(horizontal: s.s(10), vertical: s.s(6)),
              decoration: BoxDecoration(color: kAmber, borderRadius: BorderRadius.circular(s.s(8))),
              child: Text('Subscribe', style: TextStyle(fontSize: s.f(11.5), color: Colors.white, fontWeight: FontWeight.w800)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeed() {
    if (_filtered.isEmpty) return _buildEmpty();

    // Genuinely featured HERE: globally boosted, AND — if a city filter
    // is active — actually boosted for one of those specific cities
    // (not just boosted somewhere else). With no city filter, there's no
    // specific place being claimed, so the plain global flag is correct
    // on its own.
    final featured = _filters.cities.isEmpty
        ? _filtered.where((p) => p.isBoosted).toList()
        : _filtered.where((p) => p.isBoosted && _boostedForSelectedCitiesIds.contains(p.id)).toList();
    final featuredIds = featured.map((p) => p.id).toSet();
    // Everyone else — including anyone globally boosted but NOT featured
    // here (e.g. boosted for a different city than the current filter),
    // who renders as a normal card via _animatedCard's forceFeatured
    // override below, rather than being excluded from the list entirely.
    final regular = _filtered.where((p) => !featuredIds.contains(p.id)).toList();

    // Build a flat slot list so ListView.builder can lazily render any position.
    final List<Widget Function()> slots = [];

    if (featured.isNotEmpty) {
      slots.add(() => _SectionDivider(label: 'Featured Proposals', count: featured.length, isFeatured: true));
      slots.add(() => const SizedBox(height: 8));
      slots.add(() => FeaturedProposalsCarousel(
            proposals: featured,
            // Same width a regular card gets: screen width minus the
            // same 16px-each-side padding the main ListView.builder uses
            // (see its own padding a few lines below) — not a separate
            // guessed number, so Featured cards are genuinely identical
            // in size/shape to every other card, never narrower.
            //
            // No fixed cardHeight here — natural per-card sizing now
            // produces uniform heights on its own, because RishtaCard
            // itself reserves consistent space for the About/Looking For
            // section on featured cards even when a profile has none
            // (see rishta_card.dart's forceFeatured-driven placeholder),
            // rather than this carousel forcing an external guessed
            // number onto cards whose actual content doesn't need it.
            // Subtracting a few extra pixels of safety margin beyond the
            // exact screen-width-minus-padding math — without this, the
            // card's own border was getting clipped at the edge when
            // there's only a single card (static, non-scrolling mode),
            // since the exact math left zero room for the border itself
            // to render inside the available space.
            cardWidth: MediaQuery.of(context).size.width - 40,
            cardBuilder: (p, keySuffix, onDropdownStateChanged, closeDropdownSignal) => KeyedSubtree(
              key: ValueKey('featured_carousel_${p.id}_$keySuffix'),
              child: _animatedCard(p, 0, forceFeatured: true, onCarouselInteractionChanged: onDropdownStateChanged, closeDropdownSignal: closeDropdownSignal),
            ),
          ));
    }

    if (regular.isNotEmpty) {
      if (featured.isNotEmpty) slots.add(() => const SizedBox(height: 8));

      // Once the user has a search query, an active filter, or picked a chip
      // other than "All", show the actual count of matching results instead
      // of the server-side total — that total no longer reflects what's on
      // screen.
      final hasActiveFilterOrSearch =
          _searchQuery.isNotEmpty || filtersActiveCount > 0 || _selectedChip != 0;

      final regularCount = hasActiveFilterOrSearch
          ? (_serverFilteredCount ?? regular.length)
          : !_countsLoaded
              ? 0
              : _isPaidUser && !_isPendingUser
                  ? (_userGender?.toLowerCase() == 'female'
                      ? _proposalCounts['female']!
                      : _proposalCounts['male']!)
                  : _proposalCounts['total']!;
      final sectionLabel = hasActiveFilterOrSearch ? 'Results' : 'All Proposals';
      slots.add(() => _SectionDivider(label: sectionLabel, count: regularCount, isLoading: !hasActiveFilterOrSearch && !_countsLoaded, onRefresh: _loadFeed));
      slots.add(() => const SizedBox(height: 8));
      for (int i = 0; i < regular.length; i++) {
        final p = regular[i];
        final idx = i + featured.length;
        // Explicit false for anyone globally boosted-elsewhere so their
        // card styling matches how they're actually being treated here
        // (as a regular result, not Featured) — forceFeatured: null
        // would fall back to p.isBoosted, which is exactly the
        // misleading-badge bug this whole change fixes.
        slots.add(() => _animatedCard(p, idx, forceFeatured: p.isBoosted ? false : null));
      }
    }

    if (_loadingMore) {
      slots.add(() => const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: CircularProgressIndicator(color: kPurple, strokeWidth: 2)),
      ));
    } else if (!_hasMoreData && _filtered.isNotEmpty) {
      slots.add(() => const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: Center(child: Text('All proposals loaded', style: TextStyle(fontSize: 12, color: kInkFaint))),
      ));
    }

    return ListView.builder(
      cacheExtent: 1000,
      padding: EdgeInsets.fromLTRB(16, 12, 16, MediaQuery.of(context).padding.bottom + 90),
      itemCount: slots.length,
      itemBuilder: (_, i) => slots[i](),
    );
  }

  Future<void> _openEditScreen(String id) async {
    try {
      final cnic = await _db.resolveEffectiveCnic();
      if (cnic == null) return;
      final data = await Supabase.instance.client
          .rpc('fetch_own_proposal_full', params: {'p_id': id, 'p_cnic': cnic});
      if (!mounted) return;
      await Navigator.push(context, MaterialPageRoute(
        builder: (_) => EditProfileScreen(
          proposalId: id,
          currentData: data as Map<String, dynamic>,
        ),
      ));
      // This edit only refreshes this feed's own copy of the card (via the
      // realtime/refresh logic already in this screen). The Subscription
      // tab's login card is a separate, long-lived screen instance with its
      // own in-memory copy of the name — it never hears about this edit
      // unless we tell it directly.
      widget.onOwnProfileEdited?.call();
      // Also refresh the header avatar's cached name/photo directly, rather
      // than waiting on the Subscription tab to (eventually) write it back
      // to SharedPreferences.
      try {
        final refreshed = await Supabase.instance.client
            .rpc('fetch_own_proposal_full', params: {'p_id': id, 'p_cnic': cnic});
        if (mounted) {
          setState(() {
            _ownName = refreshed['name'] as String?;
            _ownPhotoUrl = refreshed['profile_photo_url'] as String?;
          });
        }
      } catch (_) {}
    } catch (_) {}
  }

  Widget _animatedCard(RishtaProposal p, int index, {bool? forceFeatured, ValueChanged<bool>? onCarouselInteractionChanged, Listenable? closeDropdownSignal}) {
    final isOwn = isPaidUser && _ownProposalId != null && p.id == _ownProposalId;
    final showAsFeatured = forceFeatured ?? p.isBoosted;
    Widget buildCard([ValueChanged<bool>? onDropdownStateChanged]) => RepaintBoundary(
      child: RishtaCard(
        key: ValueKey('${p.id}_${isPaidUser}'),
        proposal: p,
        isPaidUser: isPaidUser,
        isSelected: _selectedCardId == p.id,
        onTap: () => setState(() => _selectedCardId = _selectedCardId == p.id ? null : p.id),
        isSaved: _savedIds.contains(p.id),
        onSaveToggle: () => _toggleSave(p.id),
        isOwnProposal: isOwn,
        onEditTap: isOwn ? () => _openEditScreen(p.id) : null,
        onDropdownStateChanged: onDropdownStateChanged,
        forceFeatured: forceFeatured,
        closeDropdownSignal: closeDropdownSignal,
      ),
    );
    return showAsFeatured
        ? buildCard(onCarouselInteractionChanged)
        : _SwipeToRemoveCard(
            key: ValueKey('swipe_${p.id}'),
            id: p.id,
            onRemoveTap: (close) => _confirmNotInterested(p, close),
            childBuilder: buildCard,
          );
  }

  Future<void> _confirmNotInterested(RishtaProposal p, VoidCallback closeCard) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(children: [
          Container(width: 36, height: 36, decoration: BoxDecoration(color: kRoseLight, borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.close_rounded, color: kRose, size: 18)),
          const SizedBox(width: 12),
          const Expanded(child: Text('Hide Profile?', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: kInk))),
        ]),
        content: const Text(
          "We won't show you this profile for the next 30 days. Continue?",
          style: TextStyle(fontSize: 13, color: kInkLight, height: 1.6),
        ),
        actions: [
          TextButton(
            onPressed: () { Navigator.pop(context, false); closeCard(); },
            child: const Text('Cancel', style: TextStyle(color: kInkLight)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Continue', style: TextStyle(color: kRose, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      setState(() {
        _notInterestedIds.add(p.id);
        _allProposals.removeWhere((e) => e.id == p.id);
        _filtered.removeWhere((e) => e.id == p.id);
      });
      SharedPreferences.getInstance().then((prefs) async {
        // Store locally with 30-day expiry
        final expiry = DateTime.now().add(const Duration(days: 30)).millisecondsSinceEpoch;
        final expiryData = prefs.getString('not_interested_expiry_v2') ?? '';
        final entries = expiryData.isEmpty ? <String>[] : expiryData.split(',');
        // Remove old entry for this ID if exists, add new one
        entries.removeWhere((e) => e.startsWith('${p.id}:'));
        entries.add('${p.id}:$expiry');
        // Clean expired entries
        final now = DateTime.now().millisecondsSinceEpoch;
        final active = entries.where((e) {
          final parts = e.split(':');
          if (parts.length != 2) return false;
          final exp = int.tryParse(parts[1]);
          return exp != null && exp > now;
        }).toList();
        await prefs.setString('not_interested_expiry_v2', active.join(','));
        await prefs.setStringList('not_interested_proposals', active.map((e) => e.split(':')[0]).toList());

        // Store in DB with 30-day expiry
        final cnic = prefs.getString('user_cnic') ?? '';
        if (cnic.isNotEmpty) {
          await Supabase.instance.client.rpc('append_not_interested', params: {
            'p_cnic': cnic,
            'p_proposal_id': p.id,
            'p_expiry_ms': expiry,
          });
        }
      });
    }
  }

  Widget _buildEmpty() {
    final s = _S.of(context);
    if (_searchQuery.isNotEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: s.d(48), height: s.d(48), decoration: BoxDecoration(color: kPurpleLight, borderRadius: BorderRadius.circular(s.s(14))), child: Icon(Icons.person_search_rounded, color: kPurple, size: s.d(22))),
            SizedBox(height: s.s(10)),
            Text('No user found', style: TextStyle(fontSize: s.f(14), fontWeight: FontWeight.w800, color: kInk)),
            SizedBox(height: s.s(4)),
            Text('No matches for "$_searchQuery"', style: TextStyle(fontSize: s.f(12), color: kInkLight)),
          ],
        ),
      );
    }
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: s.d(48), height: s.d(48), decoration: BoxDecoration(color: kPurpleLight, borderRadius: BorderRadius.circular(s.s(14))), child: Icon(Icons.search_off_rounded, color: kPurple, size: s.d(22))),
          SizedBox(height: s.s(10)),
          Text('No proposals found', style: TextStyle(fontSize: s.f(14), fontWeight: FontWeight.w800, color: kInk)),
          SizedBox(height: s.s(4)),
          Text('Try adjusting your filters', style: TextStyle(fontSize: s.f(12), color: kInkLight)),
          SizedBox(height: s.s(14)),
          _ClearFiltersButton(
            onClear: () {
              setState(() { _filters = const FilterState(); _selectedChip = 0; });
              _reloadWithFilters();
              _refreshBoostedForCities();
              widget.onPaidStatusChanged?.call();
            },
          ),
          SizedBox(height: s.s(10)),
          // Distinct from "Clear Filters" above — that only resets filter
          // selections, it never re-checks anything with the server. This
          // does a full resync of the viewer's own account status (paid/
          // pending, gender lock) plus a fresh feed load, for the case
          // where the real problem is stale session state rather than an
          // overly narrow filter (e.g. admin changed this person's own
          // profile status while they were sitting on this tab).
          GestureDetector(
            onTap: () async {
              await checkAndRefresh();
              await _loadFeed();
            },
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.refresh_rounded, size: s.d(14), color: kInkLight),
              SizedBox(width: s.s(4)),
              Text('Refresh', style: TextStyle(fontSize: s.f(12.5), color: kInkLight, fontWeight: FontWeight.w600)),
            ]),
          ),
        ],
      ),
    );
  }
}

// ── Skeleton loading placeholder ────────────────────────────────────────────
// Shown instead of a bare spinner while the very first page of the feed is
// loading — purely cosmetic, self-contained, and doesn't read or touch any
// of GroupFeedScreenState's data. Big apps (Instagram, LinkedIn, etc.) use
// this exact pattern: shapes that mirror the real content's layout feel
// faster than a spinner even when the actual wait time is identical, since
// it reads as "the screen is already here, just filling in" rather than
// "nothing has happened yet."
// ── Header gradient bar ──────────────────────────────────────────────────
// Matches the website's own header accent (see app/globals.css
// .nav-gradient-bar): same 6-stop color sequence, same 4px height, same
// 3s linear infinite slide. CSS achieves the slide via a 200%-wide
// background sliding its position — the Flutter equivalent here is a
// double-width gradient (colors listed twice back-to-back) continuously
// translated left by exactly one bar-width, which loops seamlessly since
// the second copy starts on the same color the first one ends on.
class _HeaderGradientBar extends StatefulWidget {
  const _HeaderGradientBar();
  @override
  State<_HeaderGradientBar> createState() => _HeaderGradientBarState();
}

class _HeaderGradientBarState extends State<_HeaderGradientBar> {
  Timer? _timer;
  double _shift = 0;

  static const _colors = [
    Color(0xFF534AB7),
    Color(0xFF7C6FE0),
    Color(0xFF0F6E56),
    Color(0xFF2D9CDB),
    Color(0xFFE11D48),
    Color(0xFF534AB7),
  ];

  // Same overall speed as before (one full cycle every 3s), but updated in
  // discrete steps every 150ms instead of every single frame (~16ms). A
  // slow-moving gradient doesn't need 60 updates a second to read as
  // smooth motion — this cuts repaint frequency roughly 10x, which is what
  // actually matters for battery: it's not any one repaint being
  // expensive, it's that a per-frame ticker never lets the phone's
  // CPU/GPU rest for as long as this bar is on screen. Stepped updates at
  // this interval still look continuously animated, just meaningfully
  // cheaper to sustain for the entire time someone's browsing the feed.
  static const _stepInterval = Duration(milliseconds: 150);
  static const _stepsPerCycle = 3000 / 150; // cycle duration / step interval

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(_stepInterval, (_) {
      if (!mounted) return;
      setState(() => _shift = (_shift + 4.0 / _stepsPerCycle) % 4.0);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Same gradient math as before: a window twice the screen-width
    // (spreading the colors out so they don't look cramped), tiled
    // infinitely, shifted by a fraction of one full window-width each step.
    return Container(
      height: 4,
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: _colors,
          begin: Alignment(-2 + _shift, 0),
          end: Alignment(2 + _shift, 0),
          tileMode: TileMode.repeated,
        ),
      ),
    );
  }
}

class _SkeletonFeedList extends StatefulWidget {
  const _SkeletonFeedList();
  @override
  State<_SkeletonFeedList> createState() => _SkeletonFeedListState();
}

class _SkeletonFeedListState extends State<_SkeletonFeedList> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Widget _bar({double width = double.infinity, double height = 12, double radius = 6}) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(color: const Color(0xFFE8E6F5), borderRadius: BorderRadius.circular(radius)),
      );

  Widget _skeletonCard() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.all(Radius.circular(20)),
        border: Border.all(color: const Color(0xFFF0EFFA)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 52, height: 52, decoration: const BoxDecoration(color: Color(0xFFE8E6F5), shape: BoxShape.circle)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _bar(width: 140, height: 14),
              const SizedBox(height: 8),
              _bar(width: 90, height: 11),
            ]),
          ),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          _bar(width: 60, height: 24, radius: 12),
          const SizedBox(width: 8),
          _bar(width: 60, height: 24, radius: 12),
          const SizedBox(width: 8),
          _bar(width: 60, height: 24, radius: 12),
        ]),
        const SizedBox(height: 12),
        _bar(height: 10),
        const SizedBox(height: 6),
        _bar(width: 200, height: 10),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 0.4, end: 0.9).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut)),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
        physics: const NeverScrollableScrollPhysics(),
        itemCount: 5,
        itemBuilder: (_, __) => _skeletonCard(),
      ),
    );
  }
}

class _ClearFiltersButton extends StatefulWidget {
  final VoidCallback onClear;
  const _ClearFiltersButton({required this.onClear});
  @override State<_ClearFiltersButton> createState() => _ClearFiltersButtonState();
}
class _ClearFiltersButtonState extends State<_ClearFiltersButton> {
  bool _pressed = false;

  void _onTap() {
    setState(() => _pressed = true);
    Future.delayed(const Duration(milliseconds: 150), () {
      widget.onClear();
      if (mounted) setState(() => _pressed = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.94 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 100),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: _pressed ? kPurpleDeep : kPurple,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: const [
            Icon(Icons.filter_list_off_rounded, size: 13, color: Colors.white),
            SizedBox(width: 5),
            Text('Clear Filters', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
          ]),
        ),
      ),
    );
  }
}

class _TryAgainButton extends StatefulWidget {
  final VoidCallback onTap;
  const _TryAgainButton({required this.onTap});
  @override State<_TryAgainButton> createState() => _TryAgainButtonState();
}

class _TryAgainButtonState extends State<_TryAgainButton> {
  bool _pressed = false;

  void _onTap() {
    setState(() => _pressed = true);
    Future.delayed(const Duration(milliseconds: 150), () {
      widget.onTap();
      if (mounted) setState(() => _pressed = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.94 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 100),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: _pressed ? kPurpleDeep : kPurple,
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.refresh_rounded, size: 13, color: Colors.white),
            SizedBox(width: 5),
            Text('Try Again', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
          ]),
        ),
      ),
    );
  }
}

class _SectionDivider extends StatelessWidget {
  final String label;
  final int count;
  final bool isFeatured;
  final bool isLoading;
  final VoidCallback? onRefresh;
  const _SectionDivider({required this.label, required this.count, this.isFeatured = false, this.isLoading = false, this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (isFeatured) ...[const Icon(Icons.bolt_rounded, size: 16, color: Colors.orange), const SizedBox(width: 4)],
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kInkLight, letterSpacing: 0.2)),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(color: isFeatured ? Colors.orange.withOpacity(0.15) : kPurpleLight, borderRadius: BorderRadius.circular(8)),
          child: isLoading
              ? SizedBox(
                  width: 24, height: 11,
                  child: Center(
                    child: SizedBox(
                      width: 10, height: 10,
                      child: CircularProgressIndicator(strokeWidth: 1.5, color: isFeatured ? Colors.orange : kPurple),
                    ),
                  ),
                )
              : Text('$count', style: TextStyle(fontSize: 11, color: isFeatured ? Colors.orange : kPurple, fontWeight: FontWeight.w800)),
        ),
        const SizedBox(width: 8),
        const Expanded(child: Divider(color: kBorder)),
        if (onRefresh != null) ...[
          const SizedBox(width: 4),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onRefresh,
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4, vertical: 4),
              child: Icon(Icons.refresh_rounded, color: kInkFaint, size: 17),
            ),
          ),
        ],
      ],
    );
  }
}

class _BannerDelegate extends SliverPersistentHeaderDelegate {
  final Widget child;
  const _BannerDelegate({required this.child});
  @override double get minExtent => 78;
  @override double get maxExtent => 78;
  @override Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) => Container(color: kSurface, child: child);
  @override bool shouldRebuild(_BannerDelegate old) => old.child != child;
}

// ── Swipe-to-reveal Remove button ─────────────────────────────────────────────
// Tracks which card is currently swiped open — only one at a time.
final _openSwipeCard = ValueNotifier<String?>(null);

class _SwipeToRemoveCard extends StatefulWidget {
  final String id;
  final Widget Function(ValueChanged<bool> onChipExpandedChanged) childBuilder;
  final void Function(VoidCallback close) onRemoveTap;
  const _SwipeToRemoveCard({super.key, required this.id, required this.childBuilder, required this.onRemoveTap});
  @override State<_SwipeToRemoveCard> createState() => _SwipeToRemoveCardState();
}

class _SwipeToRemoveCardState extends State<_SwipeToRemoveCard>
    with SingleTickerProviderStateMixin {
  static const double _buttonWidth = 72.0;
  static const double _buttonTotalWidth = 88.0;

  late AnimationController _ctrl;
  // Direction lock — decided on first meaningful movement of each touch
  bool? _lockedHorizontal;
  Offset? _pointerStart;
  // True while a chip's dropdown is expanded inside this card — while
  // this is true, drag gestures are ignored entirely rather than treated
  // as a delete-swipe, so interacting with an open chip never
  // accidentally triggers (or fights with) the remove gesture.
  bool _chipExpanded = false;

  void _onChipExpandedChanged(bool expanded) {
    if (!mounted) return;
    setState(() => _chipExpanded = expanded);
    // If a chip opens mid-swipe (shouldn't normally happen, but safe
    // either way), snap the swipe closed rather than leaving it stuck
    // partway open underneath an expanded dropdown.
    if (expanded && _ctrl.value > 0) _close();
  }

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
      lowerBound: 0,
      upperBound: _buttonWidth,
    );
    _openSwipeCard.addListener(_onGlobalChange);
  }

  void _onGlobalChange() {
    if (_openSwipeCard.value != widget.id && _ctrl.value > 0) {
      _close();
    }
  }

  @override
  void dispose() {
    _openSwipeCard.removeListener(_onGlobalChange);
    _ctrl.dispose();
    super.dispose();
  }

  void _onPointerDown(PointerDownEvent e) {
    if (_chipExpanded) return;
    _pointerStart = e.position;
    _lockedHorizontal = null;
  }

  void _onPointerMove(PointerMoveEvent e) {
    if (_chipExpanded) return;
    if (_pointerStart == null) return;
    if (_lockedHorizontal == null) {
      final dx = (e.position.dx - _pointerStart!.dx).abs();
      final dy = (e.position.dy - _pointerStart!.dy).abs();
      if (dx < 4 && dy < 4) return;
      _lockedHorizontal = dx > dy;
    }
    if (_lockedHorizontal == true) {
      _ctrl.value = (_ctrl.value - e.delta.dx).clamp(0.0, _buttonWidth);
      if (_ctrl.value > 0) _openSwipeCard.value = widget.id;
    }
  }

  void _onPointerUp(PointerUpEvent e) {
    if (_lockedHorizontal == true) {
      if (_ctrl.value > _buttonWidth / 2) {
        _ctrl.animateTo(_buttonWidth, curve: Curves.easeOut);
      } else {
        _ctrl.animateTo(0, curve: Curves.easeOut);
      }
    }
    _lockedHorizontal = null;
    _pointerStart = null;
  }

  void _onPointerCancel(PointerCancelEvent e) {
    _ctrl.animateTo(0, curve: Curves.easeOut);
    _lockedHorizontal = null;
    _pointerStart = null;
  }

  void _close() {
    _ctrl.animateTo(0, curve: Curves.easeOut);
    if (_openSwipeCard.value == widget.id) _openSwipeCard.value = null;
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, child) {
        final offset = _ctrl.value;
        return Listener(
          onPointerDown: _onPointerDown,
          onPointerMove: _onPointerMove,
          onPointerUp: _onPointerUp,
          onPointerCancel: _onPointerCancel,
          child: GestureDetector(
          onTap: offset > 0 ? _close : null,
          child: ClipRect(
            child: Stack(
              children: [
                // Remove button — only visible when swiped
                if (offset > 0)
                  Positioned.fill(
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: GestureDetector(
                        onTap: () => widget.onRemoveTap(_close),
                        child: Container(
                          width: _buttonTotalWidth,
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: const BoxDecoration(
                            color: kRose,
                            borderRadius: BorderRadius.only(
                              topRight: Radius.circular(16),
                              bottomRight: Radius.circular(16),
                            ),
                          ),
                          child: const Padding(
                            padding: EdgeInsets.only(left: 13),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                Icon(Icons.close_rounded, color: Colors.white, size: 24),
                                SizedBox(height: 4),
                                Text('Remove', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                // Card slides left
                Transform.translate(
                  offset: Offset(-offset, 0),
                  child: child,
                ),
              ],
            ),
          ),
          ),
        );
      },
      child: widget.childBuilder(_onChipExpandedChanged),
    );
  }
}
