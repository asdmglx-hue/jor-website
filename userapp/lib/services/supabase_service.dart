import 'package:shared_preferences/shared_preferences.dart';
import 'dart:io';
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:crypto/crypto.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/rishta_proposal.dart';
import '../utils/watermark.dart';
import '../utils/theme.dart';

// ── Cloudflare R2 credentials ─────────────────────────────────────────────────
// R2 credentials — scoped "Object Read & Write" token restricted to just
// the proposal-photos bucket (not the old account-wide Admin key). If
// this ever leaks, the damage is limited to this one bucket — it can't
// touch anything else in the Cloudflare account.
const _r2AccessKeyId     = '17b39f7543a55783ca0bf60cd5f4ea0c';
const _r2SecretAccessKey = '9cc1c77e0a738779e4d2584b1319a1973a99b84bd1782772cf06eafc9428523e';
const _r2Endpoint        = 'https://27fdb7883570e5f6e97e985e183ea7b0.r2.cloudflarestorage.com';
const _r2Bucket          = 'proposal-photos';
const _r2PublicUrl       = 'https://pub-45b25e06fb4b4f448d2ee349c6f55922.r2.dev';

// ─────────────────────────────────────────────────────────────────────────────
//  SupabaseService — single source of truth for all DB operations
//  Replaces the in-memory AdminService mock entirely.
//
//  Usage (singleton):
//    final db = SupabaseService.instance;
// ─────────────────────────────────────────────────────────────────────────────

class SupabaseService extends ChangeNotifier {
  SupabaseService._();
  static final SupabaseService instance = SupabaseService._();

  final _client = Supabase.instance.client;
  Map<String, String> _cachedSettings = {};
  Set<String> overLimitCities = {};
  Map<String, String> get cachedSettings => _cachedSettings;

  static const _kCachedSettingsKey = 'cached_app_settings_json';

  /// Call once on app start, before runApp(), so _cachedSettings already
  /// has last-known-good values on the very first frame — without this,
  /// _cachedSettings starts as an empty map until the network fetchAppSettings()
  /// call resolves, and every getter that reads it (like _freeMode) treats
  /// missing keys as false in the meantime. That's exactly what caused the
  /// pricing banner to flash "Rs. X" for a moment before correcting itself
  /// to "Free Access" once the real settings arrived a beat later.
  Future<void> restoreCachedSettings() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kCachedSettingsKey);
      if (raw == null || raw.isEmpty) return;
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      _cachedSettings = decoded.map((k, v) => MapEntry(k, v.toString()));
    } catch (_) {}
  }

  // ── Convenience getters ───────────────────────────────────────────────────
  SupabaseClient get client => _client;

  /// Public passthrough to notifyListeners() — lets extension files (e.g. the
  /// admin-only Supabase extension) trigger rebuilds without depending on the
  /// protected notifyListeners() API directly.
  void notify() => notifyListeners();

  // ══════════════════════════════════════════════════════════════════════════
  //  Visitor tracking / public counts
  // ══════════════════════════════════════════════════════════════════════════

  /// Tracks a unique device visit — call once on app open.
  Future<void> trackAppVisit(String deviceId) async {
    try {
      await _client.from('app_visitors').upsert(
        {'device_id': deviceId, 'last_seen_at': DateTime.now().toIso8601String()},
        onConflict: 'device_id',
      );
    } catch (_) {}
  }

  /// Returns {total, male, female} counts of active proposals
  /// FIXED: Uses COUNT queries instead of fetching all rows (bypasses 1000-row limit)
  Future<Map<String, int>> fetchProposalCounts() async {
    try {
      final res = await _client.rpc('active_proposal_counts') as Map<String, dynamic>;
      return {
        'total': (res['total'] as num?)?.toInt() ?? 0,
        'male': (res['male'] as num?)?.toInt() ?? 0,
        'female': (res['female'] as num?)?.toInt() ?? 0,
      };
    } catch (_) {
      return {'total': 0, 'male': 0, 'female': 0};
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  FEED — Public proposals (group feed)
  // ══════════════════════════════════════════════════════════════════════════

  /// Fetches active proposals for the public feed.
  /// Uses the `proposals_feed` view which auto-masks phone for non-subscribers.
  // Shared filter-application logic used by both fetchFeedProposals (which
  // fetches actual rows) and fetchFeedProposalsCount (which fetches only the
  // total matching row count). Keeping this in one place means the two can
  // never drift out of sync with each other.
  dynamic _buildFeedQuery(dynamic q, FilterState? filters) {
    if (filters != null) {
      if (filters.gender != null) q = q.eq('gender', filters.gender!);
      if (filters.cities.isNotEmpty) q = q.inFilter('city', filters.cities);
      if (filters.castes.isNotEmpty) {
        // Compound castes (e.g. "Malik Awan", "Rajput Bhatti") should be
        // findable under EITHER caste, not just an exact whole-string
        // match — otherwise selecting "Malik" alone would miss "Malik
        // Awan" entirely. \y is Postgres's word-boundary regex marker
        // (like \b elsewhere), so this matches the caste name as a whole
        // word anywhere in the stored value, not as a raw substring —
        // e.g. selecting "Butt" won't accidentally match "Buttar".
        final orClauses = filters.castes
            .map((c) => 'caste.imatch.\\y${c.trim()}\\y')
            .join(',');
        q = q.or(orClauses);
      }
      if (filters.sects.isNotEmpty) q = q.inFilter('sect', filters.sects);
      if (filters.maritalStatuses.isNotEmpty) q = q.inFilter('marital_status', filters.maritalStatuses);
      if (filters.educations.isNotEmpty) q = q.inFilter('education', filters.educations);
      if (filters.professions.isNotEmpty) {
        // profession_category is now captured explicitly at registration/
        // edit time (not guessed from the profession text afterward), so
        // this is a direct, reliable match — no more expanding a
        // hand-maintained category->profession list that could drift out
        // of sync with what people can actually select. NOTE: rows saved
        // before this column existed will have profession_category = NULL
        // until a backfill runs against existing data.
        q = q.inFilter('profession_category', filters.professions);
      }
      if (filters.ageRange.start != 18 || filters.ageRange.end != 100) {
        q = q.gte('age', filters.ageRange.start.toInt()).lte('age', filters.ageRange.end.toInt());
      }
      if (filters.heightRange.start != 48 || filters.heightRange.end != 96) {
        q = q.gte('height_inches', filters.heightRange.start).lte('height_inches', filters.heightRange.end);
      }
      if (filters.locationFilter == 'local') q = q.or('country.is.null,country.ilike.%pakistan%');
      if (filters.locationFilter == 'overseas') {
        // A specific country picked (e.g. "United Kingdom") narrows further
        // than just "not Pakistan" — mirrors the website's country dropdown.
        if (filters.country != null) {
          q = q.eq('country', filters.country!);
        } else {
          q = q.not('country', 'ilike', '%pakistan%').not('country', 'is', null);
        }
      }
      if (filters.houses.isNotEmpty) q = q.inFilter('home_type', filters.houses);
      if (filters.cnicVerified == true) q = q.eq('cnic_verified', true);
    }
    return q;
  }

  // ── Cities ────────────────────────────────────────────────────────────────

  static const _kCachedCitiesKey = 'cached_cities_json_v1';

  Map<String, List<String>> _citiesGrouped = {};

  /// Returns live city map if loaded, otherwise hardcoded fallback.
  Map<String, List<String>> get citiesGrouped =>
      _citiesGrouped.isNotEmpty ? _citiesGrouped : kCitiesGrouped;

  /// Flat sorted list of all city names.
  List<String> get citiesList =>
      citiesGrouped.values.expand((v) => v).toList();

  Future<void> restoreCachedCities() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kCachedCitiesKey);
      if (raw == null || raw.isEmpty) return;
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      const provOrder = [
        'Punjab', 'Sindh', 'KPK', 'Balochistan',
        'Islamabad', 'Gilgit Baltistan', 'Azad Kashmir',
      ];
      final grouped = <String, List<String>>{};
      for (final p in provOrder) {
        if (decoded.containsKey(p)) {
          grouped[p] = (decoded[p] as List).map((e) => e.toString()).toList();
        }
      }
      for (final entry in decoded.entries) {
        if (!grouped.containsKey(entry.key)) {
          grouped[entry.key] = (entry.value as List).map((e) => e.toString()).toList();
        }
      }
      _citiesGrouped = grouped;
    } catch (_) {}
  }

  Future<void> fetchCities() async {
    try {
      final res = await _client
          .from('cities')
          .select('name, province, sort_order')
          .order('sort_order');
      final rows = res as List;
      if (rows.isEmpty) return;

      const provOrder = [
        'Punjab', 'Sindh', 'KPK', 'Balochistan',
        'Islamabad', 'Gilgit Baltistan', 'Azad Kashmir',
      ];
      final raw = <String, List<String>>{};
      for (final row in rows) {
        final prov = row['province'] as String;
        final name = row['name'] as String;
        raw.putIfAbsent(prov, () => []).add(name);
      }
      final grouped = <String, List<String>>{};
      for (final p in provOrder) {
        if (raw.containsKey(p)) grouped[p] = raw[p]!;
      }
      for (final entry in raw.entries) {
        if (!grouped.containsKey(entry.key)) grouped[entry.key] = entry.value;
      }

      _citiesGrouped = grouped;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kCachedCitiesKey,
          jsonEncode(grouped.map((k, v) => MapEntry(k, v))));
    } catch (_) {}
  }

  // ── Occupations ───────────────────────────────────────────────────────────

  static const _kCachedOccupationsKey = 'cached_occupations_json_v1';

  /// Grouped occupation map loaded from DB. Falls back to kProfessionsGrouped.
  Map<String, List<String>> _occupationsGrouped = {};

  /// Returns live occupation map if loaded, otherwise hardcoded fallback.
  Map<String, List<String>> get occupationsGrouped =>
      _occupationsGrouped.isNotEmpty ? _occupationsGrouped : kProfessionsGrouped;

  /// Flat list of all occupation categories — for the filter sheet.
  List<String> get occupationCategories =>
      occupationsGrouped.keys.where((k) => k != 'Other').toList()..add('Other');

  /// Restore cached occupations from SharedPreferences on startup.
  Future<void> restoreCachedOccupations() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kCachedOccupationsKey);
      if (raw == null || raw.isEmpty) return;
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      const catOrder = [
        'Healthcare', 'Engineering', 'IT & Tech', 'Education', 'Finance & Law',
        'Business & Management', 'Government & Forces', 'Arts & Media',
        'Skilled Trades', 'Services & Other', 'Other',
      ];
      final grouped = <String, List<String>>{};
      for (final g in catOrder) {
        if (decoded.containsKey(g)) {
          grouped[g] = (decoded[g] as List).map((e) => e.toString()).toList();
        }
      }
      for (final entry in decoded.entries) {
        if (!grouped.containsKey(entry.key)) {
          grouped[entry.key] = (entry.value as List).map((e) => e.toString()).toList();
        }
      }
      _occupationsGrouped = grouped;
    } catch (_) {}
  }

  /// Fetch latest occupation list from Supabase and cache it.
  Future<void> fetchOccupations() async {
    try {
      final res = await _client
          .from('occupations')
          .select('name, category, sort_order')
          .order('sort_order');
      final rows = res as List;
      if (rows.isEmpty) return;

      const catOrder = [
        'Healthcare', 'Engineering', 'IT & Tech', 'Education', 'Finance & Law',
        'Business & Management', 'Government & Forces', 'Arts & Media',
        'Skilled Trades', 'Services & Other', 'Other',
      ];

      // Group by category in the fixed order
      final raw = <String, List<String>>{};
      for (final row in rows) {
        final cat  = row['category'] as String;
        final name = row['name'] as String;
        raw.putIfAbsent(cat, () => []).add(name);
      }
      final grouped = <String, List<String>>{};
      for (final g in catOrder) {
        if (raw.containsKey(g)) grouped[g] = raw[g]!;
      }
      for (final entry in raw.entries) {
        if (!grouped.containsKey(entry.key)) grouped[entry.key] = entry.value;
      }

      _occupationsGrouped = grouped;

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kCachedOccupationsKey,
          jsonEncode(grouped.map((k, v) => MapEntry(k, v))));
    } catch (_) {}
  }

  // ── Castes ────────────────────────────────────────────────────────────────

  static const _kCachedCastesKey = 'cached_castes_json_v2';

  /// Grouped caste map loaded from the DB. Starts as an empty map; populated
  /// by [restoreCachedCastes] (from SharedPreferences on startup) and then
  /// refreshed by [fetchCastes] (live from Supabase). Falls back to the
  /// hardcoded [kCastesGrouped] from theme.dart whenever it's empty, so the
  /// app always has a working caste list even on first install with no network.
  Map<String, List<String>> _castesGrouped = {};

  /// Returns the live caste map if already loaded, otherwise the hardcoded
  /// fallback — call this instead of referencing kCastesGrouped directly.
  Map<String, List<String>> get castesGrouped =>
      _castesGrouped.isNotEmpty ? _castesGrouped : kCastesGrouped;

  /// Flat sorted list of all caste names — mirrors how kCastes is used in the
  /// filter sheet's options list.
  List<String> get castesList {
    final grouped = castesGrouped;
    return grouped.values.expand((v) => v).toList();
  }

  /// Call once at app startup (before runApp) to pre-populate [castesGrouped]
  /// from the last-known-good value stored in SharedPreferences. This ensures
  /// the caste list is ready on the very first frame without waiting for a
  /// network round-trip — same pattern as [restoreCachedSettings].
  Future<void> restoreCachedCastes() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kCachedCastesKey);
      if (raw == null || raw.isEmpty) return;
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      const groupOrder = [
        'Punjab', 'Sindh', 'KPK / Pashtun', 'Kashmir & Northern',
        'Balochistan', 'Urdu-speaking / Muhajir', 'General',
      ];
      final grouped = <String, List<String>>{};
      for (final g in groupOrder) {
        if (decoded.containsKey(g)) {
          grouped[g] = (decoded[g] as List).map((e) => e.toString()).toList();
        }
      }
      for (final entry in decoded.entries) {
        if (!grouped.containsKey(entry.key)) {
          grouped[entry.key] = (entry.value as List).map((e) => e.toString()).toList();
        }
      }
      _castesGrouped = grouped;
    } catch (_) {}
  }

  /// Fetches the latest caste list from Supabase and updates [castesGrouped].
  /// Persists the result to SharedPreferences so [restoreCachedCastes] can
  /// use it on the next startup. Safe to call in the background — any failure
  /// is silently ignored and the existing (fallback or previously-cached) list
  /// continues to be used.
  Future<void> fetchCastes() async {
    try {
      final res = await _client
          .from('castes')
          .select('name, group_name');
      final rows = res as List;
      if (rows.isEmpty) return;

      // Build grouped map then reorder groups into the correct fixed sequence.
      final raw = <String, List<String>>{};
      for (final row in rows) {
        final group = row['group_name'] as String;
        final name  = row['name'] as String;
        raw.putIfAbsent(group, () => []).add(name);
      }

      // Fixed group order — always Punjab first regardless of how DB returns data.
      const groupOrder = [
        'Punjab', 'Sindh', 'KPK / Pashtun', 'Kashmir & Northern',
        'Balochistan', 'Urdu-speaking / Muhajir', 'General',
      ];
      final grouped = <String, List<String>>{};
      for (final g in groupOrder) {
        if (raw.containsKey(g)) grouped[g] = raw[g]!;
      }
      // Add any groups not in the fixed list at the end
      for (final entry in raw.entries) {
        if (!grouped.containsKey(entry.key)) grouped[entry.key] = entry.value;
      }

      _castesGrouped = grouped;

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kCachedCastesKey,
          jsonEncode(grouped.map((k, v) => MapEntry(k, v))));
    } catch (_) {}
  }

  /// Returns the distinct list of overseas countries currently represented
  /// among active proposals, sorted by how common each country is — same
  /// approach and ordering as the website's fetchOverseasCountries(), so
  /// the app's country picker shows the exact same list in the exact same
  /// order.
  Future<List<String>> fetchOverseasCountries() async {
    try {
      const batchSize = 1000;
      final counts = <String, int>{};
      int from = 0;
      while (true) {
        final res = await _client
            .from('proposals_feed')
            .select('country')
            .not('country', 'is', null)
            .neq('country', '')
            .not('country', 'ilike', '%pakistan%')
            .range(from, from + batchSize - 1);
        final rows = res as List;
        for (final row in rows) {
          final c = row['country'] as String?;
          if (c == null || c.isEmpty) continue;
          counts[c] = (counts[c] ?? 0) + 1;
        }
        if (rows.length < batchSize) break;
        from += batchSize;
      }
      final countries = counts.keys.toList()
        ..sort((a, b) => counts[b]!.compareTo(counts[a]!));
      return countries;
    } catch (_) {
      return [];
    }
  }

  /// Returns the TOTAL number of proposals matching [filters] (and an
  /// optional posted-date range for the feed's "New / 1 Month / 2 Months /
  /// 3 Months" chips) — independent of pagination. Use this for displaying
  /// an accurate result count; fetchFeedProposals only returns one page at a
  /// time so its length alone understates the real total.
  Future<int> fetchFeedProposalsCount({
    FilterState? filters,
    bool isPaidUser = false,
    DateTime? postedAfter,
    DateTime? postedBefore,
  }) async {
    dynamic q;
    if (isPaidUser) {
      final cnic = await _resolveEffectiveCnic();
      // .rpc() returns a PostgrestFilterBuilder — filter methods (.eq,
      // .inFilter, .gte, .lte, etc.) must be called on it BEFORE .select(),
      // because .select() on a PostgrestFilterBuilder narrows the type to
      // PostgrestTransformBuilder, which no longer has filter methods.
      // (Confirmed via postgrest-dart's own source/changelog — this is
      // exactly backwards from the .from(table).select() pattern used in
      // the non-paid branch below, where .select() comes first because
      // it's a different overload, on PostgrestQueryBuilder, that stays
      // filterable afterward.)
      q = _client.rpc('paid_feed_proposals', params: {'p_cnic': cnic});
      q = _buildFeedQuery(q, filters);
      if (postedAfter != null) q = q.gte('posted_at', postedAfter.toIso8601String());
      if (postedBefore != null) q = q.lte('posted_at', postedBefore.toIso8601String());
      // paid_feed_proposals already filters to status='active' server-side.
      // Postgrest's exact-count-via-header mechanism (used below for the
      // table/view path) doesn't return a count for RPC-sourced resources
      // in this environment — verified directly against the live API, not
      // assumed. Counting the returned rows instead gives an exact count
      // for any realistically filtered query. range(0, 999) matches the
      // server's own row cap, so this can't silently under-fetch relative
      // to what a single request could ever return anyway; the only case
      // this under-counts is "every active proposal, no filters at all"
      // once that literal total exceeds 1000 — a cosmetic-only edge case
      // for this results-count display, not a functional break.
      final res = await q.select('id').range(0, 999);
      return (res as List).length;
    } else {
      // Uses Postgrest's exact-count-via-header mechanism (the count comes
      // from a server-side COUNT(*), independent of how many rows are
      // actually returned) — this has no 1000-row cap, unlike fetching and
      // counting rows ourselves. The earlier "always shows the grand
      // total" issue was NOT this method — it was _loadFeed() silently
      // resetting the gender filter to null right before this ran (fixed
      // separately in group_feed_screen.dart), which made this correctly
      // count against an empty filter every time.
      var qCount = _client.from('proposals_feed').select('id');
      qCount = _buildFeedQuery(qCount, filters);
      if (postedAfter != null) qCount = qCount.gte('posted_at', postedAfter.toIso8601String());
      if (postedBefore != null) qCount = qCount.lte('posted_at', postedBefore.toIso8601String());
      final res = await qCount.range(0, 0).count(CountOption.exact);
      return res.count;
    }
  }

  // Exact columns RishtaProposal.fromJson reads — kept in sync with that
  // parser deliberately. The 'proposals' table also has several large
  // columns (profile_photo_base64, cnic_front_base64, cnic_back_base64,
  // admin-only fields) that a bare select() would otherwise pull down for
  // EVERY proposal on EVERY feed page load even though the feed UI never
  // reads them — a real, avoidable chunk of the response payload and parse
  // time. Selecting explicit columns skips all of that.
  static const String _feedProposalColumns = '''
    id, name, age, gender, city, caste, sect, education,
    degree_title, institute, degree_certificate_url,
    degree_title_2, institute_2, degree_certificate_2_url,
    degree_title_3, institute_3, degree_certificate_3_url,
    profession, profession_category, employment_type, salary_start, salary_end, monthly_income,
    height_inches, weight_kg, complexion, marital_status, open_to_polygamy, boys, girls,
    practice_level, hijab, beard, family_type,
    father_alive, father_occupation, mother_alive, mother_occupation,
    sisters, brothers, home_type, location, country, disability_details,
    house_size, has_car, has_other_property, other_property, car_name,
    has_generator, has_solar, has_servant, looking_for, proposal_number,
    marriage_number, about, suggested_info, contact_phone, contact_phone_2,
    phone_verified, email_verified, cnic_verified, smokes, drinks,
    physically_active, has_disability, posted_at, approved_at, subscription_tier, is_boosted,
    is_boosted_in_general_feed,
    profile_photo_url, languages,
    proposal_photos(photo_type, storage_path)
  ''';

  Future<List<RishtaProposal>> fetchFeedProposals({
    FilterState? filters,
    bool isPaidUser = false,
    int page = 0,
    int pageSize = 15,
    DateTime? postedAfter,
    DateTime? postedBefore,
  }) async {
    final from = page * pageSize;
    final to = from + pageSize - 1;
    List<dynamic> res;

    // The "general proposal screen" is specifically the unfiltered/
    // all-Pakistan view — no specific city selected and not the overseas
    // view. That's the only place the admin-capped, hourly-rotating
    // selection (is_boosted_in_general_feed) applies; any city/overseas-
    // filtered view keeps ordering by the real is_boosted, so every one
    // of that city's genuinely paid boosts shows — that list is already
    // small thanks to the per-city cap. Mirrors the website's identical
    // logic exactly, so both platforms respect max_featured_general the
    // same way.
    final isGeneralView = filters == null ||
        (filters.cities.isEmpty && filters.locationFilter != 'overseas');
    final boostColumn = isGeneralView ? 'is_boosted_in_general_feed' : 'is_boosted';

    // Build DB-level filter query to ensure accurate pagination
    dynamic buildQuery(dynamic q) => _buildFeedQuery(q, filters);

    if (isPaidUser) {
      // Paid user — fetch via paid_feed_proposals RPC, which verifies this
      // device's cnic is actually an active subscriber (or a known admin,
      // for admin-preview mode) server-side before returning real
      // phone/photos, instead of trusting the client's local isPaidUser
      // flag the way the old direct table query implicitly did.
      //
      // Method order matters here: .rpc() returns a PostgrestFilterBuilder,
      // and filter methods inside buildQuery() (.eq, .inFilter, .gte, etc.)
      // must run BEFORE .select() — calling .select() on a
      // PostgrestFilterBuilder narrows it to PostgrestTransformBuilder,
      // which drops filter methods (confirmed against postgrest-dart's
      // source). .order()/.range() are fine after .select() since those
      // are defined on PostgrestTransformBuilder itself.
      final cnic = await _resolveEffectiveCnic();
      var q = _client.rpc('paid_feed_proposals', params: {'p_cnic': cnic});
      q = buildQuery(q);
      // Same date-range chips (New/1 Month/2 Months/3 Months) as
      // fetchFeedProposalsCount below — kept identical to that function on
      // purpose so the displayed count and the actual list of cards always
      // agree with each other.
      if (postedAfter != null) q = q.gte('posted_at', postedAfter.toIso8601String());
      if (postedBefore != null) q = q.lte('posted_at', postedBefore.toIso8601String());
      res = await q
          .select(_feedProposalColumns)
          .order(boostColumn, ascending: false)
          .order('approved_at', ascending: false)
          .range(from, to);
    } else {
      // Non-paid — use masked view
      var q = _client
          .from('proposals_feed')
          .select();
      q = buildQuery(q);
      if (postedAfter != null) q = q.gte('posted_at', postedAfter.toIso8601String());
      if (postedBefore != null) q = q.lte('posted_at', postedBefore.toIso8601String());
      res = await q
          .order(boostColumn, ascending: false)
          .order('approved_at', ascending: false)
          .range(from, to);
    }

    var list = (res as List).map((row) => RishtaProposal.fromJson(row)).toList();

    if (isGeneralView) {
      // Matches the website's current logic exactly: is_boosted directly,
      // immediately — not is_boosted_in_general_feed, which only updates
      // via an hourly background job and meant a freshly-purchased boost
      // wouldn't show here until that job's next scheduled run, even
      // though the website already showed it instantly. That older,
      // rotation-based flag may still exist for other purposes, but the
      // app's general feed should answer "who's featured" the same
      // immediate way the website does.
      list = (res).asMap().entries.map((e) {
        final row = e.value as Map<String, dynamic>;
        final isFeaturedHere = row['is_boosted'] == true;
        return isFeaturedHere ? _withBoosted(list[e.key], true) : _withBoosted(list[e.key], false);
      }).toList();
      return list;
    }

    // Get featured proposal IDs for today filtered by city (max 5 per city)
    try {
      final cityFilter = filters?.cities.isNotEmpty == true ? filters!.cities.first : null;
      final featuredRes = await _client.rpc('get_featured_today',
          params: cityFilter != null ? {'p_city': cityFilter} : <String, dynamic>{});
      final rows = featuredRes as List;
      final featuredIds = rows.map((r) => r['proposal_id'].toString()).toSet();
      // Check if any city is over limit
      overLimitCities = rows.where((r) => r['is_over_limit'] == true)
          .map((r) => r['city'].toString()).toSet();

      // get_featured_today already correctly identifies who's boosted FOR
      // this city — including someone whose own registered city is
      // completely different (they paid to be featured here specifically).
      // But it can only be used to re-order people already in `list`; if
      // a boosted profile's real city doesn't match the filter, the base
      // query above never fetched them at all, so there's nothing to
      // re-order. This fetches exactly those "missing" boosted profiles
      // — a separate, isolated query touching nothing else — and prepends
      // them, so buying "Featured in Sialkot" actually means something
      // when someone browses Sialkot, even if that's not their hometown.
      final alreadyIncludedIds = list.map((p) => p.id).toSet();
      final missingIds = featuredIds.difference(alreadyIncludedIds);
      if (missingIds.isNotEmpty && page == 0) {
        try {
          List<dynamic> extraRes;
          if (isPaidUser) {
            final cnic = await _resolveEffectiveCnic();
            extraRes = await _client.rpc('paid_feed_proposals', params: {'p_cnic': cnic})
                .inFilter('id', missingIds.toList())
                .select(_feedProposalColumns);
          } else {
            extraRes = await _client.from('proposals_feed').select()
                .inFilter('id', missingIds.toList());
          }
          final extraList = (extraRes)
              .map((row) => _withBoosted(RishtaProposal.fromJson(row), true))
              .toList();
          list = [...extraList, ...list];
        } catch (_) {
          // Never let this extra step break the main feed.
        }
      }

      if (featuredIds.isNotEmpty) {
        final boosted = list.where((p) => featuredIds.contains(p.id))
            .map((p) => _withBoosted(p, true)).toList();
        final rest = list.where((p) => !featuredIds.contains(p.id)).toList();
        list = [...boosted, ...rest];
      }
    } catch (_) {} // silently fail

    // Filters already applied at DB level above — no client-side re-filtering needed
    return list;
  }

  /// Returns a copy of [p] with isBoosted overridden
  RishtaProposal _withBoosted(RishtaProposal p, bool boosted) => p.copyWith(isBoosted: boosted);

  List<RishtaProposal> _applyFilters(
      List<RishtaProposal> list, FilterState f) {
    if (f.gender != null) {
      list = list.where((p) => p.gender.toLowerCase() == f.gender!.toLowerCase()).toList();
    }
    if (f.cities.isNotEmpty) {
      list = list.where((p) => f.cities.contains(p.city)).toList();
    }
    if (f.castes.isNotEmpty) {
      list = list.where((p) => f.castes.any(
          (c) => RegExp('\\b${RegExp.escape(c)}\\b', caseSensitive: false).hasMatch(p.caste))).toList();
    }
    if (f.sects.isNotEmpty) {
      list = list.where((p) => f.sects.contains(p.sect)).toList();
    }
    if (f.professions.isNotEmpty) {
      list = list.where((p) => f.professions.contains(p.professionCategory)).toList();
    }
    if (f.maritalStatuses.isNotEmpty) {
      list = list.where((p) => f.maritalStatuses.contains(p.maritalStatus)).toList();
    }
    if (f.educations.isNotEmpty) {
      list = list.where((p) => f.educations.contains(p.education)).toList();
    }
    if (f.cnicVerified == true) {
      list = list.where((p) => p.cnicVerified).toList();
    }
    list = list
        .where((p) => p.age >= f.ageRange.start && p.age <= f.ageRange.end)
        .toList();
    list = list
        .where((p) =>
            p.heightInches >= f.heightRange.start &&
            p.heightInches <= f.heightRange.end)
        .toList();
    return list;
  }

  /// Subscribes to realtime status changes for a specific proposal.
  RealtimeChannel subscribeToProposalStatus(String proposalId, void Function(String status, String? deletedFrom, String? subStatus) onStatusChange, {String? initialStatus, String? initialSubStatus}) {
    final channelName = 'public:proposals:id=eq.$proposalId';
    String? _lastStatus = initialStatus;
    String? _lastSubStatus = initialSubStatus;
    return _client
        .channel(channelName)
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'proposals',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'id', value: proposalId),
          callback: (payload) {
            final newStatus = payload.newRecord['status'] as String?;
            final deletedFrom = payload.newRecord['deleted_from'] as String?;
            final newSubStatus = payload.newRecord['subscription_status'] as String?;
            final newExpiry = payload.newRecord['subscription_expiry'] as String?;
            final newExpiryDate = newExpiry != null ? DateTime.tryParse(newExpiry) : null;
            final statusChanged = newStatus != null && newStatus != _lastStatus;
            final subExpired = newSubStatus == 'expired' && !statusChanged;
            // Only treat as renewal if previously expired AND new expiry is genuinely far in future (>1 day)
            final subRenewed = newSubStatus == 'active' && _lastSubStatus == 'expired' && !statusChanged &&
                newExpiryDate != null && newExpiryDate.isAfter(DateTime.now().add(const Duration(days: 1)));
            // Fire if status changed, subscription expired, or subscription genuinely renewed
            if (statusChanged || subExpired || subRenewed) {
              _lastStatus = newStatus;
              _lastSubStatus = newSubStatus;
              onStatusChange(newStatus ?? _lastStatus ?? '', deletedFrom, newSubStatus);
            } else {
              // Always update tracked subStatus even if we don't fire
              _lastSubStatus = newSubStatus;
            }
          },
        )
        .onPostgresChanges(
          // A genuinely permanent deletion (admin's "Delete Permanently")
          // removes the row entirely instead of updating its status — a
          // completely different kind of event from the soft-delete above,
          // which the update listener above can never see. Without this,
          // someone already logged in on a permanently-deleted account
          // would keep seeing their last-known cached "active" state
          // indefinitely. Reuses the same 'deleted' status string so all
          // existing screens that already know how to handle a deleted
          // account continue to work without any further changes.
          //
          // IMPORTANT: no `filter` here on purpose — Supabase Realtime does
          // not support filters on DELETE events for postgres_changes (the
          // filter is silently ignored server-side), so the event needs
          // to be matched against `proposalId` client-side instead. This
          // means every delete on the table reaches every subscribed
          // client's callback; only the id check below decides whether it
          // was actually this account's row.
          event: PostgresChangeEvent.delete,
          schema: 'public',
          table: 'proposals',
          callback: (payload) {
            final deletedId = payload.oldRecord['id'] as String?;
            if (deletedId != proposalId) return;
            _lastStatus = 'deleted';
            onStatusChange('deleted', 'permanent', null);
          },
        )
        .subscribe((status, [error]) {
        });
  }

  /// Subscribes to realtime inserts AND removals on proposals, so the feed
  /// list can both add newly-approved proposals and drop ones that stop
  /// being visible — without this second half, a proposal already loaded
  /// into someone's feed stayed there (broken avatar/photo and all) until
  /// they backgrounded and reopened the screen, however long that took,
  /// even though admin had already approved-deleted or hard-deleted it.
  /// Call this once in GroupFeedScreen.initState().
  RealtimeChannel subscribeToFeed(void Function(RishtaProposal) onNew, {void Function(String proposalId)? onRemoved}) {
    var channel = _client
        .channel('public:proposals')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'proposals',
          callback: (payload) {
            if (payload.newRecord['status'] == 'active') {
              final proposal = RishtaProposal.fromJson(payload.newRecord);
              onNew(proposal);
            }
          },
        )
        // A status change away from 'active' (paused, rejected, expired,
        // soft-deleted, etc.) makes a proposal stop qualifying for the
        // public feed just as surely as a hard delete does — treat it the
        // same way here.
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'proposals',
          callback: (payload) {
            if (payload.newRecord['status'] != 'active') {
              final id = payload.newRecord['id'] as String?;
              if (id != null) onRemoved?.call(id);
            }
          },
        );
    if (onRemoved != null) {
      channel = channel.onPostgresChanges(
        // Admin's "Delete Permanently" removes the row entirely rather
        // than updating its status, so it needs its own listener — the
        // update handler above can never see a row that no longer exists.
        event: PostgresChangeEvent.delete,
        schema: 'public',
        table: 'proposals',
        callback: (payload) {
          final id = payload.oldRecord['id'] as String?;
          if (id != null) onRemoved(id);
        },
      );
    }
    return channel.subscribe();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUBMIT PROPOSAL
  // ══════════════════════════════════════════════════════════════════════════

  /// Uploads photos to Storage and inserts a pending proposal.
  Future<String> submitProposal({
    required Map<String, dynamic> proposalData,
    File? profilePhotoFile,
    File? cnicFrontFile,
    File? cnicBackFile,
    File? degreeCertificateFile,
    File? degreeCertificate2File,
    File? degreeCertificate3File,
  }) async {
    // Ensure NOT NULL columns always have a value even if form was skipped
    final safeData = Map<String, dynamic>.from(proposalData);
    safeData['name']           = (safeData['name'] as String?)?.trim().isEmpty == true ? 'Unknown' : safeData['name'] ?? 'Unknown';
    safeData['age']            = safeData['age'] ?? 0;
    safeData['gender']         = safeData['gender'] ?? '';
    safeData['city']           = safeData['city'] ?? '';
    safeData['caste']          = safeData['caste'] ?? '';
    safeData['sect']           = safeData['sect'] ?? '';
    safeData['education']      = safeData['education'] ?? '';
    safeData['profession']     = safeData['profession'] ?? '';
    safeData['height_inches']  = safeData['height_inches'] ?? 64.0;
    safeData['marital_status'] = safeData['marital_status'] ?? 'Never married';
    safeData['contact_phone']  = safeData['contact_phone'] ?? '';
    safeData['sisters']        = safeData['sisters'] ?? 0;
    safeData['brothers']       = safeData['brothers'] ?? 0;
    
    // ✨ FIX: Convert 'language' (singular) to 'languages' (array) if present
    if (safeData.containsKey('language') && safeData['language'] != null) {
      final lang = safeData['language'] as String?;
      if (lang != null && lang.isNotEmpty) {
        safeData['languages'] = [lang];
      }
      safeData.remove('language'); // Remove the singular field
    }

    // Upload photos to Cloudflare R2
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final cnic = (safeData['cnic'] as String? ?? 'unknown').replaceAll('-', '');

    Future<String?> _uploadPhoto(File? file, String type) async {
      if (file == null) return null;
      try {
        Uint8List bytes = await file.readAsBytes();
        // Watermark only profile photos — CNIC and degree certificates
        // are identity/document uploads that must not be altered.
        if (type == 'profile') {
          bytes = await addWatermarkToPhoto(bytes);
        }
        final path = 'proposals/$cnic/${type}_$timestamp.jpg';
        final url = await _uploadToR2(bytes: bytes, path: path);
        return url;
      } catch (_) {
        return null;
      }
    }

    final profileUrl   = await _uploadPhoto(profilePhotoFile, 'profile');
    final cnicFrontUrl = await _uploadPhoto(cnicFrontFile, 'cnic_front');
    final cnicBackUrl  = await _uploadPhoto(cnicBackFile, 'cnic_back');
    final degreeCertUrl  = await _uploadPhoto(degreeCertificateFile, 'degree_certificate');
    final degreeCert2Url = await _uploadPhoto(degreeCertificate2File, 'degree_certificate_2');
    final degreeCert3Url = await _uploadPhoto(degreeCertificate3File, 'degree_certificate_3');

    // Insert row with storage URLs (no base64 in DB). Goes through a
    // security-definer RPC rather than a raw insert+select — a plain
    // INSERT ... RETURNING (which .select().single() compiles down to)
    // implicitly needs the new row to also satisfy the table's SELECT
    // policy, and pending submissions aren't visible under
    // public_view_active_proposals (status = 'active' only, by design —
    // unapproved submissions shouldn't be publicly browsable). The RPC
    // sidesteps that entirely by running as a security definer, while
    // still forcing status/tier/boost server-side so a submission can
    // never self-approve or self-feature itself.
    final inserted = await _client.rpc('submit_proposal_secure', params: {
      'p_data': {
        ...safeData,
        if (profileUrl   != null) 'profile_photo_url': profileUrl,
        if (cnicFrontUrl != null) 'cnic_front_url': cnicFrontUrl,
        if (cnicBackUrl  != null) 'cnic_back_url':  cnicBackUrl,
        if (degreeCertUrl  != null) 'degree_certificate_url': degreeCertUrl,
        if (degreeCert2Url != null) 'degree_certificate_2_url': degreeCert2Url,
        if (degreeCert3Url != null) 'degree_certificate_3_url': degreeCert3Url,
      },
    }) as Map<String, dynamic>;

    final proposalId = inserted['id'] as String;

    // Store CNIC for subscription check on feed load
    _submittedCnic = safeData['cnic'] as String?;

    // Notify the admin device (fire-and-forget) — the edge function looks up
    // the admin's registered FCM token itself, so this delivers even if the
    // admin app is fully closed, same as the existing status-change pushes.
    _client.functions.invoke('notify-status-change', body: {
      'type': 'new_order',
      'proposal_id': proposalId,
      'name': safeData['name'],
      'city': safeData['city'],
    }).then((_) {
    }).catchError((_) {
    });

    return proposalId;
  }

  // Note: profile photo URLs are always R2 URLs already stored directly on
  // the proposal row (via _uploadToR2 above) — there's no separate
  // Supabase Storage bucket in use anywhere in this app.

  // ══════════════════════════════════════════════════════════════════════════
  //  SUBSCRIPTION — Code redemption & status check
  // ══════════════════════════════════════════════════════════════════════════

  /// Checks if the current user (by proposalId) has an active subscription.
  Future<bool> hasActiveSubscription(String proposalId) async {
    final res = await _client
        .from('subscriptions')
        .select('status, expiry_date')
        .eq('user_id', proposalId)
        .maybeSingle();

    if (res == null) return false;
    if (res['status'] != 'active') return false;
    final expiry = DateTime.tryParse(res['expiry_date'] ?? '');
    return expiry != null && expiry.isAfter(DateTime.now());
  }

  /// Atomically redeems an activation code for a given proposalId.
  /// Returns a [CodeRedemptionResult] with success/error info.
  // Stored after successful CNIC activation — persisted via SharedPreferences
  String? _activatedCnic;
  String? get activatedCnic => _activatedCnic;

  void setActivatedCnic(String cnic) {
    _activatedCnic = cnic.trim();
    _submittedCnic = cnic.trim();
    _persistCnic(cnic.trim());
    notifyListeners();
  }

  void clearActivatedCnic() {
    _activatedCnic = null;
    _submittedCnic = null;
    SharedPreferences.getInstance().then((p) {
      p.remove(_kActivatedCnicKey);
      p.remove('user_cnic');
      p.remove(_kSubmittedOnlyCnicKey);
    });
  }

  // Stored after proposal submission, BEFORE any login/activation has
  // happened. Deliberately a separate key from _kActivatedCnicKey/
  // 'user_cnic' — those two represent an authenticated session (the user
  // typed CNIC+password into the login form and it was verified), while
  // this one just means "this device recently submitted a proposal with
  // this CNIC." It exists only so the notification bell and the
  // pending-status recheck can resolve a proposal before login — it must
  // NEVER be used to populate the header avatar/name or to answer "is
  // this user logged in", or submitting the form would silently look
  // identical to a completed login (see bug: avatar appearing after
  // submit-and-reopen despite never logging in).
  String? _submittedCnic;
  String? get submittedCnic => _submittedCnic;

  static const _kActivatedCnicKey = 'activated_cnic';
  static const _kSubmittedOnlyCnicKey = 'submitted_only_cnic';

  /// Call once on app start to restore persisted CNIC
  Future<void> restorePersistedCnic() async {
    final prefs = await SharedPreferences.getInstance();
    // _activatedCnic must ONLY ever come from a real login/activation —
    // no fallback to 'user_cnic' here besides the activation key itself,
    // since 'user_cnic' is also written by the real login flow (and kept
    // as a legacy mirror of _kActivatedCnicKey), but must never be
    // inferred from a mere proposal submission.
    _activatedCnic = prefs.getString(_kActivatedCnicKey);
    // _submittedCnic can fall back to the submission-only cache so
    // notifications/pending-status work pre-login, without that ever
    // being treated as an authenticated session.
    _submittedCnic = _activatedCnic ?? prefs.getString(_kSubmittedOnlyCnicKey);
    // Also ensure activated_cnic is written for future restores
    if (_activatedCnic != null) {
      await prefs.setString(_kActivatedCnicKey, _activatedCnic!);
    }
  }

  Future<void> _persistCnic(String cnic) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kActivatedCnicKey, cnic);
  }

  /// Called right after a proposal is submitted (no login involved) so the
  /// notification bell / pending-status recheck can resolve this device's
  /// proposal on the next cold start. Intentionally separate from
  /// [setActivatedCnic] — see the docs on [_submittedCnic] above.
  Future<void> setSubmittedOnlyCnic(String cnic) async {
    _submittedCnic = cnic.trim();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kSubmittedOnlyCnicKey, cnic.trim());
  }

  /// Resolves the cnic to use for server-side "am I actually a paid
  /// subscriber" checks (paid_feed_proposals RPC). Same fallback chain
  /// already used elsewhere (e.g. GroupFeedScreen._fetchUserGender):
  /// in-memory activatedCnic/submittedCnic first, then the persisted
  /// user_cnic value set by the CNIC-activation/login flow.
  Future<String?> _resolveEffectiveCnic() async {
    if (_activatedCnic != null) {
      debugPrint('[BILLING] resolveEffectiveCnic: using _activatedCnic="$_activatedCnic"');
      return _activatedCnic;
    }
    if (_submittedCnic != null) {
      debugPrint('[BILLING] resolveEffectiveCnic: using _submittedCnic="$_submittedCnic"');
      return _submittedCnic;
    }
    final prefs = await SharedPreferences.getInstance();
    final userCnic = prefs.getString('user_cnic');
    final submittedOnly = prefs.getString(_kSubmittedOnlyCnicKey);
    debugPrint('[BILLING] resolveEffectiveCnic: in-memory fields both null. '
        'prefs user_cnic="$userCnic", prefs $_kSubmittedOnlyCnicKey="$submittedOnly"');
    return userCnic ?? submittedOnly;
  }

  /// Public wrapper — screens need this same fallback chain for the
  /// self-service RPCs (edit screen, profile view, fcm token, etc.).
  Future<String?> resolveEffectiveCnic() => _resolveEffectiveCnic();

  /// Returns the gender of the proposal matching this CNIC (for filter locking)
  Future<String?> getUserGenderByCnic(String cnic) async {
    try {
      return await _client.rpc('get_user_gender_by_cnic', params: {'p_cnic': cnic.trim()}) as String?;
    } catch (_) {
      return null;
    }
  }

  Future<bool> hasActiveSubscriptionByCnic(String cnic) async {
    try {
      final res = await _client
          .from('proposals')
          .select('status')
          .eq('cnic', cnic.trim())
          .eq('status', 'active')
          .maybeSingle();
      return res != null;
    } catch (_) {
      return false;
    }
  }

  /// Returns true if a proposal with this CNIC already exists in Supabase.
  Future<bool> checkCnicExists(String cnic) async {
    try {
      // Uses the same security-definer function the website now uses —
      // a raw select here previously used too narrow a status list
      // (active/approved only) AND was invisible to a pending or paused
      // duplicate under RLS, meaning someone could submit a second
      // registration while their first was still pending review without
      // this check ever catching it.
      final result = await _client.rpc('cnic_has_active_profile', params: {'p_cnic': cnic.trim()});
      return result as bool? ?? false;
    } catch (_) {
      return false;
    }
  }

  // Note: an unused fetchProposalById(id) helper used to live here — it
  // fetched with select('*'), the same risky pattern already fixed
  // elsewhere tonight, but had zero callers anywhere in this app. Removed
  // rather than fixed in place, since dead code that touches sensitive
  // columns is a landmine even when nothing currently calls it.

  /// Fetches user status fields by CNIC for displaying status tag after login.
  Future<Map<String, dynamic>?> fetchUserStatusByCnic(String cnic) async {
    try {
      final res = await _client.rpc('fetch_user_status_by_cnic', params: {'p_cnic': cnic.trim()});
      // RPC returns SQL NULL (no such cnic) as Dart null — same "no rows"
      // meaning as the old empty-list case. Any other failure throws below
      // and is rethrown, same distinction the original relied on.
      return res == null ? null : res as Map<String, dynamic>;
    } catch (e) {
      // IMPORTANT: rethrow rather than swallowing into a `null` return.
      // A `null` here used to be indistinguishable from "no rows for this
      // CNIC" (i.e. the account was deleted), and callers on app-startup
      // treated that as "this account was deleted, log the user out."
      // That silently force-logged people out of the app on every ordinary
      // network hiccup or slow-to-connect cold start. Callers that care
      // about the deleted-account case now need to catch this separately
      // from a genuine empty result.
      rethrow;
    }
  }

  /// Returns true if the CNIC exists and password matches.
  Future<Set<String>> fetchNotInterestedIds(String cnic) async {
    try {
      final res = await _client.rpc('fetch_not_interested_ids', params: {'p_cnic': cnic.trim()});
      final ids = (res as List?)?.cast<String>() ?? [];
      return ids.toSet();
    } catch (_) {
      return {};
    }
  }

  Future<void> addNotInterestedId(String cnic, String proposalId) async {
    try {
      await _client.rpc('append_not_interested', params: {
        'p_cnic': cnic.trim(),
        'p_proposal_id': proposalId,
      });
    } catch (_) {}
  }

  Future<bool> verifyCnicPassword(String cnic, String password) async {
    try {
      return await _client.rpc('verify_cnic_password', params: {
        'p_cnic': cnic.trim(),
        'p_password': password.trim(),
      }) as bool? ?? false;
    } catch (_) {
      return false;
    }
  }

  Future<CodeRedemptionResult> activateByCnic(String cnic) async {
    try {
      final res = await _client.rpc('activate_by_cnic', params: {
        'p_cnic': cnic.trim(),
      });
      final data = res as Map<String, dynamic>;
      if (data['success'] == true) {
        _activatedCnic = cnic.trim();
        _submittedCnic = cnic.trim();
        await _persistCnic(cnic.trim());
        notifyListeners();
        return CodeRedemptionResult(
          success: true,
          tier: 'basic',
          expiry: data['expiry'] != null ? DateTime.parse(data['expiry']) : null,
        );
      } else {
        final error = data['error'] as String? ?? '';
        // Already active = treat as success, store CNIC so feed unlocks
        if (error.toLowerCase().contains('already active')) {
          _activatedCnic = cnic.trim();
          _submittedCnic = cnic.trim();
          await _persistCnic(cnic.trim());
          notifyListeners();
        }
        return CodeRedemptionResult(success: false, error: error);
      }
    } catch (e) {
      return CodeRedemptionResult(success: false, error: e.toString());
    }
  }

  Future<CodeRedemptionResult> redeemCode({
    required String proposalId,
    required String code,
  }) async {
    try {
      final res = await _client.rpc('redeem_activation_code', params: {
        'p_user_id': proposalId,
        'p_code': code.trim().toUpperCase(),
      });

      final data = res as Map<String, dynamic>;
      if (data['success'] == true) {
        notifyListeners();
        return CodeRedemptionResult(
          success: true,
          tier: data['tier'] as String?,
          expiry: data['expiry'] != null
              ? DateTime.parse(data['expiry'])
              : null,
        );
      } else {
        return CodeRedemptionResult(
          success: false,
          error: data['error'] as String? ?? 'Redemption failed',
        );
      }
    } catch (e) {
      return CodeRedemptionResult(success: false, error: e.toString());
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  App settings (pricing, free-mode flags, etc. — read by the whole app)
  // ══════════════════════════════════════════════════════════════════════════

  Future<Map<String, String>> fetchAppSettings() async {
    final res = await _client.from('app_settings').select();
    final map = <String, String>{};
    for (final row in res as List) {
      map[row['key'] as String] = row['value'] as String;
    }
    _cachedSettings = map;
    notifyListeners();
    // Fire-and-forget persist — next app start can restore this instantly
    // via restoreCachedSettings() instead of starting from an empty map.
    SharedPreferences.getInstance().then((prefs) {
      prefs.setString(_kCachedSettingsKey, jsonEncode(map));
    });
    return map;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Featured Post — per-city/date slot availability
  // ══════════════════════════════════════════════════════════════════════════

  /// Counts how many Featured slots are already taken for a given [city] on
  /// a given calendar [date] — only already-scheduled/active boosts
  /// (featured_boosts, not yet used/expired) count. A pending request that's
  /// only been sent over WhatsApp and not yet approved by admin does NOT
  /// hold a slot; and once a scheduled boost is removed (or an active one's
  /// window ends and it's marked used), it stops counting automatically
  /// since this always reads the live table.
  Future<int> featuredSlotUsage(String city, DateTime date) async {
    final dayStart = DateTime.utc(date.year, date.month, date.day);
    final dayEnd = dayStart.add(const Duration(days: 1));

    try {
      final confirmed = await _client
          .from('featured_boosts')
          .select('id')
          .eq('city', city)
          .eq('is_used', false)
          .gte('scheduled_date', dayStart.toIso8601String())
          .lt('scheduled_date', dayEnd.toIso8601String());
      return (confirmed as List).length;
    } catch (_) {
      // If this can't be read, don't block the user over it.
      return 0;
    }
  }

  /// Returns true if [city] still has an open Featured slot on [date],
  /// according to the admin-configured 'max_featured_per_city' setting
  /// (defaults to 5 if unset).
  Future<bool> isFeaturedSlotAvailable(String city, DateTime date) async {
    final max = int.tryParse(cachedSettings['max_featured_per_city'] ?? '5') ?? 5;
    final used = await featuredSlotUsage(city, date);
    return used < max;
  }

  /// Which proposals are ACTUALLY currently boosted for one of [cities] —
  /// as opposed to just checking a proposal's own isBoosted flag, which
  /// says nothing about WHICH city the boost is for. Used to avoid
  /// showing someone as "Featured" on a city filter they're not actually
  /// boosted for (e.g. boosted for Sialkot showing as Featured on a
  /// Lahore filter). Deliberately never throws — any failure returns an
  /// empty set, same as "nobody's boosted here," rather than an error the
  /// caller would need to handle specially.
  Future<Set<String>> getBoostedProposalIdsForCities(List<String> cities) async {
    if (cities.isEmpty) return {};
    try {
      final rows = await _client.rpc('get_boosted_proposal_ids_for_cities', params: {'p_cities': cities}) as List;
      return rows.map((r) => r['proposal_id'] as String).toSet();
    } catch (_) {
      return {};
    }
  }

  // ── Cloudflare R2 Upload (AWS Signature V4) ───────────────────────────────
  Future<String> _uploadToR2({required Uint8List bytes, required String path}) async {
    final uri = Uri.parse('$_r2Endpoint/$_r2Bucket/$path');
    final now = DateTime.now().toUtc();
    final dateStamp = now.year.toString() +
        now.month.toString().padLeft(2, '0') +
        now.day.toString().padLeft(2, '0');
    final amzDate = dateStamp + 'T' +
        now.hour.toString().padLeft(2, '0') +
        now.minute.toString().padLeft(2, '0') +
        now.second.toString().padLeft(2, '0') + 'Z';

    final auth = _buildR2Auth(
      method: 'PUT',
      objectPath: '/$_r2Bucket/$path',
      amzDate: amzDate,
      dateStamp: dateStamp,
    );

    final response = await http.put(uri, headers: {
      'Content-Type': 'image/jpeg',
      'x-amz-date': amzDate,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      'Authorization': auth,
    }, body: bytes);

    if (response.statusCode == 200 || response.statusCode == 201) {
      return '$_r2PublicUrl/$path';
    }
    throw Exception('R2 upload failed: \${response.statusCode} \${response.body}');
  }

  // ── Forgot-password CNIC photo upload ─────────────────────────────────────
  // Uploads to the exact same R2 bucket and forgot-password/{cnic}/ folder
  // convention the website uses, so both platforms stay consistent and an
  // admin sees the same kind of link either way. After uploading, this also
  // creates a short joronline.com/i/xxxxx link via the same `image_links`
  // table the website writes to — same reasoning as there: a long raw R2
  // URL is not something you want to hand an admin over WhatsApp. Falls
  // back to the full R2 URL if short-link creation fails for any reason,
  // so a hiccup in that step never loses the photo itself.
  // ── Affiliate registration — CNIC front/back upload ───────────────────────
  // Same R2 bucket/signing as everywhere else, under its own 'affiliates/'
  // folder. side is 'front' or 'back'. Returns the raw R2 URL directly (no
  // short-link needed here — unlike the forgot-password flow's WhatsApp
  // message, this URL is only ever stored in the affiliates table for the
  // admin app to display, never sent as visible text).
  Future<String> uploadAffiliateCnic(Uint8List bytes, {required String side}) async {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final path = 'affiliates/cnic_${side}_$timestamp.jpg';
    return _uploadToR2(bytes: bytes, path: path);
  }

  Future<String?> uploadForgotPasswordCnicPhoto(File file, String cnicDigits) async {
    try {
      final bytes = await file.readAsBytes();
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final path = 'forgot-password/$cnicDigits/cnic_front_$timestamp.jpg';
      final fullUrl = await _uploadToR2(bytes: bytes, path: path);

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
      final rng = Random.secure();
      for (int attempt = 0; attempt < 3; attempt++) {
        final code = List.generate(7, (_) => chars[rng.nextInt(chars.length)]).join();
        try {
          await _client.from('image_links').insert({'code': code, 'target_url': fullUrl});
          return 'https://joronline.com/i/$code';
        } catch (_) {
          // Extremely unlikely code collision, or a transient error —
          // just try a fresh random code rather than failing the upload.
        }
      }
      return fullUrl;
    } catch (_) {
      return null;
    }
  }

  // Deletes a single object from R2 by its exact stored path — uses the
  // exact same signing logic as the upload above, just for DELETE instead
  // of PUT. A 404 (already gone) is treated as success, since the end
  // result — the object no longer existing — is the same either way.
  Future<void> _deleteFromR2(String path) async {
    final uri = Uri.parse('$_r2Endpoint/$_r2Bucket/$path');
    final now = DateTime.now().toUtc();
    final dateStamp = now.year.toString() +
        now.month.toString().padLeft(2, '0') +
        now.day.toString().padLeft(2, '0');
    final amzDate = dateStamp + 'T' +
        now.hour.toString().padLeft(2, '0') +
        now.minute.toString().padLeft(2, '0') +
        now.second.toString().padLeft(2, '0') + 'Z';

    final auth = _buildR2Auth(
      method: 'DELETE',
      objectPath: '/$_r2Bucket/$path',
      amzDate: amzDate,
      dateStamp: dateStamp,
    );

    final response = await http.delete(uri, headers: {
      'Content-Type': 'image/jpeg',
      'x-amz-date': amzDate,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      'Authorization': auth,
    });

    if (response.statusCode != 200 && response.statusCode != 204 && response.statusCode != 404) {
      throw Exception('R2 delete failed: \${response.statusCode} \${response.body}');
    }
  }

  // Deletes whichever of a user's photos actually exist in R2. Only ever
  // called from a genuinely permanent deletion (never the soft-delete/trash
  // step), since this cannot be undone. Best-effort per file — one failed
  // delete doesn't stop the others or block the account deletion itself.
  // Only touches URLs that are actually on our own R2 bucket, as a safety
  // check against ever trying to delete something unrelated.
  Future<void> deleteR2Photos({String? profilePhoto, String? cnicFront, String? cnicBack}) async {
    final urls = [profilePhoto, cnicFront, cnicBack].whereType<String>();
    for (final url in urls) {
      if (!url.startsWith(_r2PublicUrl)) continue;
      final path = url.substring(_r2PublicUrl.length + 1);
      try {
        await _deleteFromR2(path);
      } catch (_) {}
    }
  }

  String _buildR2Auth({required String method, required String objectPath, required String amzDate, required String dateStamp}) {
    const region = 'auto';
    const service = 's3';
    final scope = '$dateStamp/$region/$service/aws4_request';
    const signedHeaders = 'content-type;x-amz-content-sha256;x-amz-date';
    const payload = 'UNSIGNED-PAYLOAD';
    final canonical = '$method\n$objectPath\n\ncontent-type:image/jpeg\nx-amz-content-sha256:$payload\nx-amz-date:$amzDate\n\n$signedHeaders\n$payload';
    final canonicalHash = _r2Sha256(utf8.encode(canonical));
    final stringToSign = 'AWS4-HMAC-SHA256\n$amzDate\n$scope\n$canonicalHash';
    final signingKey = _r2DeriveKey(dateStamp, region, service);
    final signature = _r2HmacHex(signingKey, stringToSign);
    return 'AWS4-HMAC-SHA256 Credential=$_r2AccessKeyId/$scope, SignedHeaders=$signedHeaders, Signature=$signature';
  }

  List<int> _r2DeriveKey(String date, String region, String service) {
    final kDate    = _r2Hmac(utf8.encode('AWS4$_r2SecretAccessKey'), date);
    final kRegion  = _r2Hmac(kDate, region);
    final kService = _r2Hmac(kRegion, service);
    return _r2Hmac(kService, 'aws4_request');
  }

  List<int> _r2Hmac(List<int> key, String data) =>
      Hmac(sha256, key).convert(utf8.encode(data)).bytes;

  String _r2HmacHex(List<int> key, String data) =>
      _r2Hmac(key, data).map((b) => b.toRadixString(16).padLeft(2, '0')).join();

  String _r2Sha256(List<int> data) =>
      sha256.convert(data).bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Result types
// ─────────────────────────────────────────────────────────────────────────────

class CodeRedemptionResult {
  final bool success;
  final String? tier;
  final DateTime? expiry;
  final String? error;

  CodeRedemptionResult({
    required this.success,
    this.tier,
    this.expiry,
    this.error,
  });
}


