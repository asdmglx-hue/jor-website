import 'package:flutter/material.dart';
import '../models/rishta_proposal.dart';
import '../utils/theme.dart';
import '../services/supabase_service.dart';
import 'common_widgets.dart';

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

// ── Height label helper ───────────────────────────────────────────────────────
String heightLabel(double inches) {
  final ft = inches.round() ~/ 12;
  final inch = inches.round() % 12;
  return '$ft\'$inch"';
}

// kCities, kCastes, kCitiesGrouped, kCastesGrouped are imported from theme.dart as offline fallbacks.
// Castes and occupations are fetched live from Supabase via SupabaseService.instance.

// ─────────────────────────────────────────────────────────────────────────────
class FilterSheet extends StatefulWidget {
  final FilterState initial;
  final ValueChanged<FilterState> onApply;
  final String? lockedGender; // 'male' or 'female' — locked, can't be changed

  const FilterSheet({
    super.key,
    required this.initial,
    required this.onApply,
    this.lockedGender,
  });

  @override
  State<FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<FilterSheet> {
  late FilterState _f;
  final _cityCloseNotifier = ValueNotifier<bool>(false);
  final _countryCloseNotifier = ValueNotifier<bool>(false);
  List<String> _overseasCountries = [];
  bool _loadingCountries = false;

  int get _effectiveCount => _f.activeCount - (widget.lockedGender != null && _f.gender != null ? 1 : 0);

  @override
  void initState() {
    super.initState();
    _f = widget.initial;
    // Auto-lock to opposite gender
    if (widget.lockedGender != null && _f.gender != widget.lockedGender) {
      _f = _f.copyWith(gender: () => widget.lockedGender);
    }
    // Fetch the country list up front if Overseas was already active when
    // the sheet opened (e.g. reopening after a previous selection), so the
    // dropdown has options ready immediately instead of loading empty.
    if (_f.locationFilter == 'overseas') _fetchOverseasCountries();
  }

  Future<void> _fetchOverseasCountries() async {
    if (_loadingCountries || _overseasCountries.isNotEmpty) return;
    setState(() => _loadingCountries = true);
    final countries = await SupabaseService.instance.fetchOverseasCountries();
    if (!mounted) return;
    setState(() {
      _overseasCountries = countries;
      _loadingCountries = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return Container(
      height: MediaQuery.of(context).size.height * 0.92,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Handle
          SizedBox(height: s.s(10)),
          Container(
            width: s.d(40), height: s.d(4),
            decoration: BoxDecoration(
              color: const Color(0xFFE0E0E0),
              borderRadius: BorderRadius.circular(s.s(2)),
            ),
          ),
          // Header
          Padding(
            padding: EdgeInsets.fromLTRB(s.s(20), s.s(14), s.s(20), s.s(8)),
            child: Row(
              children: [
                Text(
                  'Filter Profiles',
                  style: TextStyle(
                    fontSize: s.f(18),
                    fontWeight: FontWeight.w800,
                    color: kInk,
                  ),
                ),
                const Spacer(),
                if (_effectiveCount > 0)
                  PressButton(
                    onTap: () {
                      final reset = _f.reset();
                      setState(() => _f = reset);
                      widget.onApply(reset);
                    },
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: s.s(4), vertical: s.s(4)),
                      child: Text(
                        'Reset all',
                        style: TextStyle(
                          fontSize: s.f(13),
                          color: kRose,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFF0F0F0)),
          // Scrollable content
          Expanded(
            child: ListView(
              padding: EdgeInsets.fromLTRB(s.s(20), s.s(16), s.s(20), s.s(16)),
              children: [

                // ── Looking For (gender) — locked to opposite if user is paid ──
                _SectionLabel('Looking For'),
                const SizedBox(height: 10),
                if (widget.lockedGender != null)
                  // Locked state — show only the forced gender, greyed out toggle
                  Row(children: [
                    Expanded(
                      child: Container(
                        padding: EdgeInsets.symmetric(vertical: s.s(10)),
                        decoration: BoxDecoration(
                          color: kPurple,
                          borderRadius: BorderRadius.circular(s.s(12)),
                        ),
                        child: Center(
                          child: Text(
                            widget.lockedGender == 'female' ? 'Female' : 'Male',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: s.f(13)),
                          ),
                        ),
                      ),
                    ),
                    SizedBox(width: s.s(8)),
                    Expanded(
                      child: Container(
                        padding: EdgeInsets.symmetric(vertical: s.s(10)),
                        decoration: BoxDecoration(
                          color: kBorder,
                          borderRadius: BorderRadius.circular(s.s(12)),
                          border: Border.all(color: kBorder),
                        ),
                        child: Center(
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.lock_rounded, size: s.d(13), color: kInkFaint),
                            SizedBox(width: s.s(4)),
                            Text(
                              widget.lockedGender == 'female' ? 'Male' : 'Female',
                              style: TextStyle(color: kInkFaint, fontWeight: FontWeight.w600, fontSize: s.f(13)),
                            ),
                          ]),
                        ),
                      ),
                    ),
                  ])
                else
                  _GenderToggle(
                    selected: _f.gender,
                    onToggle: (val) => setState(() => _f = _f.copyWith(
                      gender: () {
                        final picked = val == 'Male' ? 'Male' : 'Female';
                        return _f.gender == picked ? null : picked;
                      },
                    )),
                  ),
                const SizedBox(height: 20),



                // ── Location ──
                _SectionLabel('Location'),
                const SizedBox(height: 10),
                _TripleToggle(
                  options: const ['Pakistan', 'Overseas'],
                  selected: _f.locationFilter == 'local' ? 'Pakistan' : _f.locationFilter == 'overseas' ? 'Overseas' : '',
                  onToggle: (val) {
                    // Tapping the already-selected option clears it back to
                    // "Both" (no filter) — same deselect pattern as Gender.
                    final alreadySelected = (_f.locationFilter == 'local' && val == 'Pakistan') ||
                        (_f.locationFilter == 'overseas' && val == 'Overseas');
                    final next = alreadySelected ? null : (val == 'Pakistan' ? 'local' : 'overseas');
                    setState(() => _f = _f.copyWith(
                      locationFilter: () => next,
                      cities: next == 'overseas' ? [] : null,
                      country: () => null,
                    ));
                    if (next == 'overseas') {
                      _cityCloseNotifier.notifyListeners();
                      _fetchOverseasCountries();
                    } else {
                      _countryCloseNotifier.notifyListeners();
                    }
                  },
                ),
                // Specific overseas country — only shown once Overseas is
                // selected, mirroring the website's "All Countries" dropdown
                // that appears the same way.
                if (_f.locationFilter == 'overseas') ...[
                  const SizedBox(height: 10),
                  _loadingCountries
                      ? Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Row(children: [
                            SizedBox(width: s.d(14), height: s.d(14),
                              child: const CircularProgressIndicator(strokeWidth: 2)),
                            SizedBox(width: s.s(8)),
                            Text('Loading countries...', style: TextStyle(fontSize: s.f(12.5), color: kInkFaint)),
                          ]),
                        )
                      : _SearchableDropdown(
                          hint: 'All Countries',
                          icon: Icons.public_rounded,
                          options: _overseasCountries,
                          selected: _f.country != null ? [_f.country!] : const [],
                          closeNotifier: _countryCloseNotifier,
                          onToggle: (val) {
                            setState(() => _f = _f.copyWith(
                              country: () => _f.country == val ? null : val,
                            ));
                          },
                        ),
                ],
                // City — only shown once Pakistan is selected, mirroring
                // the website's city select which only appears in that mode.
                if (_f.locationFilter == 'local') ...[
                  const SizedBox(height: 10),
                  _SearchableDropdown(
                    hint: 'All Cities',
                    icon: Icons.location_on_outlined,
                    options: SupabaseService.instance.citiesList,
                    groups: SupabaseService.instance.citiesGrouped,
                    selected: _f.cities,
                    closeNotifier: _cityCloseNotifier,
                    onToggle: (val) {
                      final next = List<String>.from(_f.cities);
                      next.contains(val) ? next.remove(val) : next.add(val);
                      setState(() => _f = _f.copyWith(cities: next));
                    },
                  ),
                ],
                const SizedBox(height: 20),

                // ── Age Range ──
                _SectionLabel('Age Range'),
                const SizedBox(height: 4),
                _ThinRangeSlider(
                  values: _f.ageRange,
                  min: 18, max: 100,
                  divisions: 82,
                  minLabel: '${_f.ageRange.start.toInt()} yrs',
                  maxLabel: '${_f.ageRange.end.toInt()} yrs',
                  onChanged: (v) => setState(() => _f = _f.copyWith(ageRange: v)),
                ),
                const SizedBox(height: 20),

                // ── Height Range ──
                _SectionLabel('Height Range'),
                const SizedBox(height: 4),
                _ThinRangeSlider(
                  values: _f.heightRange,
                  min: 48, max: 96,
                  divisions: 48,
                  minLabel: heightLabel(_f.heightRange.start),
                  maxLabel: heightLabel(_f.heightRange.end),
                  onChanged: (v) => setState(() => _f = _f.copyWith(heightRange: v)),
                ),
                const SizedBox(height: 20),

                // ── Profession (grouped by category — matches website) ──
                _SectionLabel('Occupation'),
                const SizedBox(height: 10),
                _SearchableDropdown(
                  hint: 'Search profession category...',
                  icon: Icons.work_outline_rounded,
                  options: SupabaseService.instance.occupationCategories,
                  selected: _f.professions,
                  onToggle: (val) {
                    final next = List<String>.from(_f.professions);
                    next.contains(val) ? next.remove(val) : next.add(val);
                    setState(() => _f = _f.copyWith(professions: next));
                  },
                ),
                const SizedBox(height: 20),



                // ── Cast (searchable dropdown) ──
                _SectionLabel('Cast'),
                const SizedBox(height: 10),
                _SearchableDropdown(
                  hint: 'Search cast...',
                  icon: Icons.people_outline_rounded,
                  options: SupabaseService.instance.castesList,
                  groups: SupabaseService.instance.castesGrouped,
                  selected: _f.castes,
                  onToggle: (val) {
                    final next = List<String>.from(_f.castes);
                    next.contains(val) ? next.remove(val) : next.add(val);
                    setState(() => _f = _f.copyWith(castes: next));
                  },
                ),
                const SizedBox(height: 20),

                // ── Sect ──
                _SectionLabel('Sect'),
                const SizedBox(height: 10),
                _PillGroup(
                  options: const ['Sunni', 'Shia', 'Ahl-e-Hadith', 'Deobandi', 'Barelvi', 'Other'],
                  selected: _f.sects,
                  onToggle: (val) {
                    final next = List<String>.from(_f.sects);
                    next.contains(val) ? next.remove(val) : next.add(val);
                    setState(() => _f = _f.copyWith(sects: next));
                  },
                ),
                const SizedBox(height: 20),

                // ── Marital Status ──
                _SectionLabel('Marital Status'),
                const SizedBox(height: 10),
                _PillGroup(
                  options: () {
                    final effectiveGender = widget.lockedGender ?? _f.gender;
                    if (effectiveGender == 'Female') return const ['Never married', 'Divorced', 'Khula', 'Widowed'];
                    if (effectiveGender == 'Male')   return const ['Never married', 'Married', 'Divorced', 'Widowed'];
                    return const ['Never married', 'Married', 'Divorced', 'Khula', 'Widowed'];
                  }(),
                  selected: _f.maritalStatuses,
                  onToggle: (val) {
                    final next = List<String>.from(_f.maritalStatuses);
                    next.contains(val) ? next.remove(val) : next.add(val);
                    setState(() => _f = _f.copyWith(maritalStatuses: next));
                  },
                ),
                const SizedBox(height: 20),

                // ── Education ──
                _SectionLabel('Education'),
                const SizedBox(height: 10),
                _PillGroup(
                  options: const ['Matric', 'FSc/FA', 'Diploma', "Bachelor's", "Master's", 'MPhil', 'PhD', 'Other'],
                  selected: _f.educations,
                  onToggle: (val) {
                    final next = List<String>.from(_f.educations);
                    next.contains(val) ? next.remove(val) : next.add(val);
                    setState(() => _f = _f.copyWith(educations: next));
                  },
                ),
                const SizedBox(height: 20),

                // ── House ──
                _SectionLabel('House'),
                const SizedBox(height: 10),
                _PillGroup(
                  options: const ['Own House', 'Rented House'],
                  selected: _f.houses,
                  onToggle: (val) {
                    final next = List<String>.from(_f.houses);
                    next.contains(val) ? next.remove(val) : next.add(val);
                    setState(() => _f = _f.copyWith(houses: next));
                  },
                ),
                const SizedBox(height: 30),
              ],
            ),
          ),

          // ── Apply button ──
          Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: kBorder)),
            ),
            padding: EdgeInsets.fromLTRB(
                s.s(20), s.s(12), s.s(20), MediaQuery.of(context).padding.bottom + s.s(16)),
            child: GradientButton(
              label: _effectiveCount > 0 ? 'Apply Filters  ($_effectiveCount)' : 'Apply Filters',
              onTap: () {
                widget.onApply(_f);
                Navigator.pop(context);
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Section label ─────────────────────────────────────────────────────────────
class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return Text(
      text,
      style: TextStyle(
        fontSize: s.f(15),
        fontWeight: FontWeight.w800,
        color: kInk,
      ),
    );
  }
}

// ── Gender/country toggle widgets ─────────────────────────────────────────────
// ── Gender toggle with field-box corner radius ─────────────────────────────
class _TripleToggle extends StatelessWidget {
  final List<String> options;
  final String selected;
  final ValueChanged<String> onToggle;
  const _TripleToggle({required this.options, required this.selected, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return Row(
      children: options.map((opt) {
        final isSelected = selected == opt;
        return Expanded(
          child: PressButton(
            onTap: () => onToggle(opt),
            child: Container(
              margin: EdgeInsets.only(right: opt != options.last ? s.s(8) : 0),
              padding: EdgeInsets.symmetric(vertical: s.s(10)),
              decoration: BoxDecoration(
                color: isSelected ? kPurple : Colors.transparent,
                borderRadius: BorderRadius.circular(s.s(12)),
                border: Border.all(color: isSelected ? kPurple : kBorder),
              ),
              child: Center(
                child: Text(opt,
                  style: TextStyle(
                    fontSize: s.f(13),
                    fontWeight: FontWeight.w600,
                    color: isSelected ? Colors.white : kInkLight,
                  )),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _GenderToggle extends StatelessWidget {
  final String? selected; // 'Male' or 'Female' or null
  final ValueChanged<String> onToggle;
  const _GenderToggle({required this.selected, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return Row(children: [
      _box(context, s, 'Male', selected == 'Male'),
      SizedBox(width: s.s(8)),
      _box(context, s, 'Female', selected == 'Female'),
    ]);
  }

  Widget _box(BuildContext context, _S s, String label, bool sel) {
    return Expanded(
      child: PressButton(
        onTap: () => onToggle(label),
        child: Container(
          padding: EdgeInsets.symmetric(vertical: s.s(11)),
          decoration: BoxDecoration(
            color: sel ? kPurple : Colors.white,
            borderRadius: BorderRadius.circular(s.s(12)),
            border: Border.all(color: sel ? kPurple : kBorder),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: s.f(13),
                fontWeight: FontWeight.w700,
                color: sel ? Colors.white : kInkLight,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PillGroup extends StatelessWidget {
  final List<String> options;
  final List<String> selected;
  final ValueChanged<String> onToggle;

  const _PillGroup({
    required this.options,
    required this.selected,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return Wrap(
      spacing: s.s(8),
      runSpacing: s.s(8),
      children: options.map((opt) {
        final sel = selected.contains(opt);
        return PressButton(
          onTap: () => onToggle(opt),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: EdgeInsets.symmetric(horizontal: s.s(16), vertical: s.s(9)),
            decoration: BoxDecoration(
              color: sel ? kPurpleLight : Colors.white,
              borderRadius: BorderRadius.circular(s.s(30)),
              border: Border.all(
                color: sel ? kPurple : const Color(0xFFDDDDEE),
                width: sel ? 1.5 : 1,
              ),
            ),
            child: Text(
              opt,
              style: TextStyle(
                fontSize: s.f(13),
                fontWeight: sel ? FontWeight.w700 : FontWeight.w500,
                color: sel ? kPurple : kInkLight,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

// ── Searchable dropdown ───────────────────────────────────────────────────────
class _SearchableDropdown extends StatefulWidget {
  final String hint;
  final IconData icon;
  final List<String> options;
  final List<String> selected;
  final ValueChanged<String> onToggle;
  final ValueNotifier<bool>? closeNotifier;
  /// Optional grouped map — when provided, group headers are shown
  final Map<String, List<String>>? groups;

  const _SearchableDropdown({
    required this.hint,
    required this.icon,
    required this.options,
    required this.selected,
    required this.onToggle,
    this.groups,
    this.closeNotifier,
  });

  @override
  State<_SearchableDropdown> createState() => _SearchableDropdownState();
}

class _SearchableDropdownState extends State<_SearchableDropdown> {
  bool _open = false;
  String _query = '';
  final _ctrl = TextEditingController();
  // Persistent FocusNode instead of TextField's `autofocus: true`. autofocus
  // asks the framework to build the field AND grab keyboard focus in the
  // very same frame — on this screen (many sections/chips/sliders) that
  // frame is already expensive, so the keyboard request gets queued behind
  // all that layout work and shows up late/stuttery. Requesting focus
  // ourselves in a post-frame callback lets the heavy rebuild finish first,
  // then asks for the keyboard on the next frame instead.
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    widget.closeNotifier?.addListener(_onCloseNotifier);
  }

  void _onCloseNotifier() {
    if (mounted && _open) setState(() => _open = false);
  }

  void _openDropdown() {
    setState(() => _open = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focusNode.requestFocus();
    });
  }

  List<String> get _filtered => _query.isEmpty
      ? widget.options
      : widget.options
          .where((o) => o.toLowerCase().contains(_query.toLowerCase()))
          .toList();

  /// Returns filtered groups (used when widget.groups != null)
  Map<String, List<String>> get _filteredGroups {
    if (widget.groups == null) return {};
    if (_query.isEmpty) return widget.groups!;
    final q = _query.toLowerCase();
    final result = <String, List<String>>{};
    for (final entry in widget.groups!.entries) {
      final matches = entry.value.where((v) => v.toLowerCase().contains(q)).toList();
      if (matches.isNotEmpty) result[entry.key] = matches;
    }
    return result;
  }

  @override
  void dispose() {
    widget.closeNotifier?.removeListener(_onCloseNotifier);
    _ctrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Selected chips row
        if (widget.selected.isNotEmpty) ...[
          Wrap(
            spacing: s.s(6),
            runSpacing: s.s(6),
            children: widget.selected.map((sel) => PressButton(
              onTap: () => widget.onToggle(sel),
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: s.s(10), vertical: s.s(5)),
                decoration: BoxDecoration(
                  color: kPurple,
                  borderRadius: BorderRadius.circular(s.s(20)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(sel,
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: s.f(12),
                            fontWeight: FontWeight.w600)),
                    SizedBox(width: s.s(4)),
                    Icon(Icons.close_rounded, size: s.d(13), color: Colors.white),
                  ],
                ),
              ),
            )).toList(),
          ),
          SizedBox(height: s.s(8)),
        ],
        // Search field
        GestureDetector(
          onTap: () {
            if (_open) {
              setState(() => _open = false);
            } else {
              _openDropdown();
            }
          },
          child: Container(
            padding: EdgeInsets.symmetric(horizontal: s.s(14), vertical: s.s(13)),
            decoration: BoxDecoration(
              color: const Color(0xFFF5F4FC),
              borderRadius: BorderRadius.circular(s.s(14)),
              border: Border.all(
                color: _open ? kPurple : kBorder,
                width: _open ? 1.5 : 1,
              ),
            ),
            child: Row(
              children: [
                Icon(widget.icon, size: s.d(18), color: kInkFaint),
                SizedBox(width: s.s(10)),
                Expanded(
                  child: _open
                      ? TextField(
                          controller: _ctrl,
                          focusNode: _focusNode,
                          onChanged: (v) => setState(() => _query = v),
                          decoration: InputDecoration(
                            hintText: widget.hint,
                            hintStyle: TextStyle(color: kInkFaint, fontSize: s.f(14)),
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: EdgeInsets.zero,
                          ),
                          style: TextStyle(fontSize: s.f(14), color: kInk),
                        )
                      : Text(
                          widget.hint,
                          style: TextStyle(color: kInkFaint, fontSize: s.f(14)),
                        ),
                ),
                Icon(
                  _open ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                  color: kInkFaint, size: s.d(20),
                ),
              ],
            ),
          ),
        ),
        // Dropdown list
        if (_open)
          Container(
            margin: EdgeInsets.only(top: s.s(4)),
            constraints: const BoxConstraints(maxHeight: 260),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(s.s(14)),
              border: Border.all(color: kBorder),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.07),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: widget.groups != null
                ? _buildGroupedList()
                : _buildFlatList(),
          ),
      ],
    );
  }

  Widget _buildGroupedList() {
    final s = _S.of(context);
    final groups = _filteredGroups;
    if (groups.isEmpty) {
      return Padding(
        padding: EdgeInsets.all(s.s(16)),
        child: Text('No results', style: TextStyle(color: kInkFaint, fontSize: s.f(13))),
      );
    }
    final items = <Widget>[];
    for (final entry in groups.entries) {
      items.add(Container(
        padding: EdgeInsets.fromLTRB(s.s(16), s.s(10), s.s(16), s.s(4)),
        child: Text(
          entry.key,
          style: TextStyle(
            fontSize: s.f(11),
            fontWeight: FontWeight.w800,
            color: kPurple,
            letterSpacing: 0.4,
          ),
        ),
      ));
      for (final opt in entry.value) {
        final sel = widget.selected.contains(opt);
        items.add(GestureDetector(
          onTap: () {
            widget.onToggle(opt);
            setState(() {});
          },
          child: Container(
            color: sel ? kPurpleLight : Colors.transparent,
            padding: EdgeInsets.symmetric(horizontal: s.s(16), vertical: s.s(10)),
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: s.d(20), height: s.d(20),
                  decoration: BoxDecoration(
                    color: sel ? kPurple : Colors.transparent,
                    borderRadius: BorderRadius.circular(s.s(5)),
                    border: Border.all(
                      color: sel ? kPurple : const Color(0xFFCCCAE0),
                      width: 1.5,
                    ),
                  ),
                  child: sel
                      ? Icon(Icons.check_rounded, size: s.d(13), color: Colors.white)
                      : null,
                ),
                SizedBox(width: s.s(12)),
                Expanded(
                  child: Text(
                    opt,
                    style: TextStyle(
                      fontSize: s.f(13.5),
                      color: sel ? kPurple : kInk,
                      fontWeight: sel ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ));
      }
    }
    return ListView(
      shrinkWrap: true,
      padding: EdgeInsets.symmetric(vertical: s.s(4)),
      children: items,
    );
  }

  Widget _buildFlatList() {
    final s = _S.of(context);
    final filtered = _filtered;
    return ListView.builder(
      shrinkWrap: true,
      padding: EdgeInsets.symmetric(vertical: s.s(4)),
      itemCount: filtered.length,
      itemBuilder: (_, i) {
        final opt = filtered[i];
        final sel = widget.selected.contains(opt);
        return GestureDetector(
          onTap: () {
            widget.onToggle(opt);
            setState(() {});
          },
          child: Container(
            color: sel ? kPurpleLight : Colors.transparent,
            padding: EdgeInsets.symmetric(horizontal: s.s(16), vertical: s.s(11)),
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: s.d(20), height: s.d(20),
                  decoration: BoxDecoration(
                    color: sel ? kPurple : Colors.transparent,
                    borderRadius: BorderRadius.circular(s.s(5)),
                    border: Border.all(
                      color: sel ? kPurple : const Color(0xFFCCCAE0),
                      width: 1.5,
                    ),
                  ),
                  child: sel
                      ? Icon(Icons.check_rounded, size: s.d(13), color: Colors.white)
                      : null,
                ),
                SizedBox(width: s.s(12)),
                Expanded(
                  child: Text(
                    opt,
                    style: TextStyle(
                      fontSize: s.f(13.5),
                      color: sel ? kPurple : kInk,
                      fontWeight: sel ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ── Thin range slider with hollow circle thumbs ───────────────────────────────
class _ThinRangeSlider extends StatelessWidget {
  final RangeValues values;
  final double min;
  final double max;
  final int divisions;
  final String minLabel;
  final String maxLabel;
  final ValueChanged<RangeValues> onChanged;

  const _ThinRangeSlider({
    required this.values,
    required this.min,
    required this.max,
    required this.divisions,
    required this.minLabel,
    required this.maxLabel,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return Column(
      children: [
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            trackHeight: 2.5,
            activeTrackColor: kPurple,
            inactiveTrackColor: const Color(0xFFDDDBF5),
            thumbColor: Colors.white,
            thumbShape: _HollowThumbShape(
              thumbRadius: 10,
              borderColor: kPurple,
              borderWidth: 2.5,
            ),
            overlayColor: kPurple.withOpacity(0.12),
            overlayShape: const RoundSliderOverlayShape(overlayRadius: 18),
            rangeThumbShape: _HollowRangeThumbShape(
              thumbRadius: 10,
              borderColor: kPurple,
              borderWidth: 2.5,
            ),
            showValueIndicator: ShowValueIndicator.never,
          ),
          child: RangeSlider(
            values: values,
            min: min,
            max: max,
            divisions: divisions,
            onChanged: onChanged,
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(minLabel,
                  style: TextStyle(fontSize: s.f(12), color: kInkLight)),
              Text(maxLabel,
                  style: TextStyle(fontSize: s.f(12), color: kInkLight)),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Hollow circle thumb for RangeSlider ──────────────────────────────────────
class _HollowRangeThumbShape extends RangeSliderThumbShape {
  final double thumbRadius;
  final Color borderColor;
  final double borderWidth;

  const _HollowRangeThumbShape({
    required this.thumbRadius,
    required this.borderColor,
    required this.borderWidth,
  });

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) =>
      Size.fromRadius(thumbRadius);

  @override
  void paint(
    PaintingContext context,
    Offset center, {
    required Animation<double> activationAnimation,
    required Animation<double> enableAnimation,
    bool isDiscrete = false,
    bool isEnabled = true,
    bool isOnTop = false,
    required SliderThemeData sliderTheme,
    TextDirection? textDirection,
    Thumb? thumb,
    bool? isPressed,
  }) {
    final canvas = context.canvas;

    // White fill
    canvas.drawCircle(
      center,
      thumbRadius,
      Paint()..color = Colors.white,
    );

    // Colored border
    canvas.drawCircle(
      center,
      thumbRadius,
      Paint()
        ..color = borderColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = borderWidth,
    );

    // Center filled dot
    canvas.drawCircle(
      center,
      3.5,
      Paint()..color = borderColor,
    );
  }
}

// ── Hollow thumb shape (unused but kept for SliderTheme compatibility) ────────
class _HollowThumbShape extends SliderComponentShape {
  final double thumbRadius;
  final Color borderColor;
  final double borderWidth;

  const _HollowThumbShape({
    required this.thumbRadius,
    required this.borderColor,
    required this.borderWidth,
  });

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) =>
      Size.fromRadius(thumbRadius);

  @override
  void paint(
    PaintingContext context,
    Offset center, {
    required Animation<double> activationAnimation,
    required Animation<double> enableAnimation,
    required bool isDiscrete,
    required TextPainter labelPainter,
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required TextDirection textDirection,
    required double value,
    required double textScaleFactor,
    required Size sizeWithOverflow,
  }) {
    final canvas = context.canvas;
    canvas.drawCircle(center, thumbRadius, Paint()..color = Colors.white);
    canvas.drawCircle(
      center, thumbRadius,
      Paint()
        ..color = borderColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = borderWidth,
    );
    canvas.drawCircle(center, 3.5, Paint()..color = borderColor);
  }
}
