import 'dart:async';
import 'dart:io';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../widgets/photo_crop_dialog.dart';
import '../services/supabase_service.dart';
import '../services/notification_service.dart';
import '../services/fcm_service.dart';
import '../utils/theme.dart';
import '../widgets/common_widgets.dart';
import '../widgets/searchable_grouped_dropdown.dart';
import '../widgets/occupation_picker.dart';
import '../utils/phone_detector.dart';
import '../utils/range_input_formatter.dart';
import '../services/analytics_service.dart';
import 'subscription_screen.dart';

// ── Phone number detection ────────────────────────────────────────────────
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

class SubmitProposalScreen extends StatefulWidget {
  final String? prefillCnic;
  final String? prefillPassword;
  final VoidCallback? onLoginTap;
  const SubmitProposalScreen({super.key, this.prefillCnic, this.prefillPassword, this.onLoginTap});
  @override
  State<SubmitProposalScreen> createState() => _SubmitProposalScreenState();
}

class _SubmitProposalScreenState extends State<SubmitProposalScreen> {
  final _db = SupabaseService.instance;
  final _picker = ImagePicker();
  final _formKey = GlobalKey<FormState>();
  int _step = 0;
  // Key of the field that failed the most recent "Next" validation attempt
  // (e.g. 'name', 'age', 'gender') — drives the red-border highlight so the
  // user can immediately see which field to fix, not just read an error
  // message and have to hunt for it.
  String? _invalidField;
  int _maxStep = 0;
  bool _submitted = false;
  bool _submitting = false;
  bool _showDraftBanner = false;

  final _nameCtrl       = TextEditingController();
  final _ageCtrl        = TextEditingController();
  final _phoneCtrl      = TextEditingController();
  final _phone2Ctrl     = TextEditingController();
  final _cnicCtrl       = TextEditingController();
  final _affiliateCtrl  = TextEditingController();
  final _couponCtrl     = TextEditingController();
  final _heightCtrl     = TextEditingController();
  final _weightCtrl     = TextEditingController();
  final _instituteCtrl   = TextEditingController();
  final _degreeTitleCtrl = TextEditingController();
  final _institute2Ctrl  = TextEditingController();
  final _degreeTitle2Ctrl = TextEditingController();
  final _institute3Ctrl  = TextEditingController();
  final _degreeTitle3Ctrl = TextEditingController();
  final _professionCustomCtrl = TextEditingController();
  final _casteCustomCtrl       = TextEditingController();
  final _fatherOccupationCustomCtrl = TextEditingController();
  final _motherOccupationCustomCtrl = TextEditingController();
  final _houseSizeCtrl  = TextEditingController();
  final _carNameCtrl    = TextEditingController();
  final _disabilityDetailsCtrl = TextEditingController();
  final _boysCtrl       = TextEditingController();
  final _girlsCtrl      = TextEditingController();
  final _brothersCtrl   = TextEditingController();
  final _sistersCtrl    = TextEditingController();
  final _aboutCtrl      = TextEditingController();
  final _lookingForCtrl = TextEditingController();
  final _adminNotesCtrl = TextEditingController();
  final _passwordCtrl       = TextEditingController();
  final _confirmPasswordCtrl = TextEditingController();

  String? _gender, _city, _caste, _sect, _education, _profession;
  String? _professionCategory;
  String? _language;
  String? _homeType;
  String? _hasKids;
  String? _hasSiblings; // 'Yes' or 'No'
  final _locationCtrl = TextEditingController();
  final _countryCtrl  = TextEditingController();
  String? _maritalStatus, _practiceLevel, _hijabOrBeard, _familyType, _marriageNumber;
  String? _openToPolygamy;
  String? _complexion, _employmentType, _hasCar, _fatherAlive, _motherAlive;
  // Father/Mother Occupation are plain free-text fields (see
  // _fatherOccupationCustomCtrl / _motherOccupationCustomCtrl below) —
  // no dropdown/category selection for these.
  String? _hasDisability, _physicallyActive, _smoker, _monthlyIncome;
  String _houseUnit = 'Marla';
  String? _hasGenerator;
  String? _hasOtherProperty;
  String? _otherProperty;
  _CountryCode _selectedCountry = _CountryCode.pakistan;
  _CountryCode _selectedCountry2 = _CountryCode.pakistan;

  // Real files for upload
  File? _profilePhotoFile, _cnicFrontFile, _cnicBackFile;
  File? _degreeCertFile, _degreeCert2File, _degreeCert3File;
  // String flags for UI
  String? _profilePhoto, _cnicFront, _cnicBack;

  static const _draftKey = 'proposal_draft_active';
  SharedPreferences? _prefs;

  @override
  void initState() {
    super.initState();
    if (widget.prefillCnic != null) _cnicCtrl.text = widget.prefillCnic!;
    if (widget.prefillPassword != null) {
      _passwordCtrl.text = widget.prefillPassword!;
      _confirmPasswordCtrl.text = widget.prefillPassword!;
    }
    // Save draft whenever any text field changes
    for (final c in [_nameCtrl, _ageCtrl, _phoneCtrl, _phone2Ctrl, _cnicCtrl, _affiliateCtrl, _couponCtrl, _heightCtrl, _weightCtrl,
      _instituteCtrl, _degreeTitleCtrl, _institute2Ctrl, _degreeTitle2Ctrl, _institute3Ctrl, _degreeTitle3Ctrl,
      _professionCustomCtrl, _casteCustomCtrl,
      _fatherOccupationCustomCtrl, _motherOccupationCustomCtrl, _houseSizeCtrl, _carNameCtrl,
      _boysCtrl, _girlsCtrl, _disabilityDetailsCtrl, _locationCtrl,
      _brothersCtrl, _sistersCtrl, _aboutCtrl, _lookingForCtrl, _adminNotesCtrl,
      _passwordCtrl, _confirmPasswordCtrl, _countryCtrl]) {
      c.addListener(_saveDraftSync);
    }
    SharedPreferences.getInstance().then((prefs) {
      _prefs = prefs;
      if (mounted) {
        _restoreDraft(prefs);
        // Flush any setState calls that happened before prefs was ready
        _saveDraftSync();
      }
    });
  }

  // Auto-save draft on every setState call
  @override
  void setState(VoidCallback fn) {
    super.setState(fn);
    _saveDraftSync();
  }

  // Synchronous save using cached prefs instance
  void _saveDraftSync() {
    final prefs = _prefs;
    if (prefs == null) {
      // Prefs not ready yet — schedule a save once it loads
      SharedPreferences.getInstance().then((p) {
        _prefs = p;
        _saveDraftSync();
      });
      return;
    }
    final data = {
      'cnic': _cnicCtrl.text, 'password': _passwordCtrl.text, 'affiliateCode': _affiliateCtrl.text, 'couponCode': _couponCtrl.text,
      'profilePhotoPath': _profilePhotoFile?.path,
      'cnicFrontPath': _cnicFrontFile?.path,
      'cnicBackPath': _cnicBackFile?.path,
      'name': _nameCtrl.text, 'age': _ageCtrl.text, 'phone': _phoneCtrl.text,
      'height': _heightCtrl.text, 'weight': _weightCtrl.text,
      'institute': _instituteCtrl.text, 'degreeTitle': _degreeTitleCtrl.text,
      'institute2': _institute2Ctrl.text, 'degreeTitle2': _degreeTitle2Ctrl.text,
      'institute3': _institute3Ctrl.text, 'degreeTitle3': _degreeTitle3Ctrl.text,
      'professionCustom': _professionCustomCtrl.text,
      'casteCustom': _casteCustomCtrl.text,
      'fatherOccupationCustom': _fatherOccupationCustomCtrl.text,
      'motherOccupationCustom': _motherOccupationCustomCtrl.text,
      'houseSize': _houseSizeCtrl.text, 'carName': _carNameCtrl.text,
      'disabilityDetails': _disabilityDetailsCtrl.text,
      'boys': _boysCtrl.text, 'girls': _girlsCtrl.text,
      'brothers': _brothersCtrl.text, 'sisters': _sistersCtrl.text,
      'about': _aboutCtrl.text, 'lookingFor': _lookingForCtrl.text, 'adminNotes': _adminNotesCtrl.text,
      'location': _locationCtrl.text, 'country': _countryCtrl.text,
      'gender': _gender, 'city': _city, 'caste': _caste, 'sect': _sect, 'language': _language ?? '',
      'education': _education, 'profession': _profession, 'professionCategory': _professionCategory,
      'homeType': _homeType, 'hasKids': _hasKids, 'hasSiblings': _hasSiblings,
      'maritalStatus': _maritalStatus, 'openToPolygamy': _openToPolygamy, 'practiceLevel': _practiceLevel,
      'hijabOrBeard': _hijabOrBeard, 'familyType': _familyType,
      'marriageNumber': _marriageNumber, 'complexion': _complexion,
      'employmentType': _employmentType, 'hasCar': _hasCar,
      'fatherAlive': _fatherAlive, 'motherAlive': _motherAlive,
      'hasDisability': _hasDisability, 'physicallyActive': _physicallyActive,
      'smoker': _smoker, 'monthlyIncome': _monthlyIncome,
      'houseUnit': _houseUnit, 'hasGenerator': _hasGenerator,
      'hasOtherProperty': _hasOtherProperty,
      'otherProperty': _otherProperty,
      'step': _step,
      'maxStep': _maxStep,
    };
    prefs?.setString(_draftKey, jsonEncode(data));
  }

  // ── Save draft ─────────────────────────────────────────────────────────────
  // ── Restore draft ──────────────────────────────────────────────────────────
  void _restoreDraft(SharedPreferences prefs) {
    if (prefs.getBool('proposal_submitted') == true) {
      prefs.remove('proposal_submitted');
      prefs.remove('proposal_draft_active');
      return;
    }
    // If prefill CNIC differs from draft CNIC, this is a new account — skip restore
    final draftRaw = prefs.getString(_draftKey);
    if (draftRaw != null && widget.prefillCnic != null) {
      try {
        final draftData = jsonDecode(draftRaw) as Map<String, dynamic>;
        final draftCnic = (draftData['cnic'] as String? ?? '').replaceAll('-', '');
        final prefillCnic = widget.prefillCnic!.replaceAll('-', '');
        if (draftCnic.isNotEmpty && draftCnic != prefillCnic) {
          prefs.remove(_draftKey);
          return;
        }
      } catch (_) {}
    }
    final raw = prefs.getString(_draftKey);
    if (raw == null || raw.isEmpty) return;
    try {
      final data = jsonDecode(raw) as Map<String, dynamic>;
      setState(() {
        if (_cnicCtrl.text.isEmpty) _cnicCtrl.text = data['cnic'] ?? '';
        _affiliateCtrl.text = data['affiliateCode'] ?? '';
        _couponCtrl.text = data['couponCode'] ?? '';
        if (_passwordCtrl.text.isEmpty) {
          _passwordCtrl.text = data['password'] ?? '';
          _confirmPasswordCtrl.text = data['password'] ?? '';
        }
        // Restore photo files from saved paths
        final profilePath = data['profilePhotoPath'] as String?;
        final cnicFrontPath = data['cnicFrontPath'] as String?;
        final cnicBackPath = data['cnicBackPath'] as String?;
        if (profilePath != null && File(profilePath).existsSync()) {
          _profilePhotoFile = File(profilePath);
          _profilePhoto = 'selected';
        }
        if (cnicFrontPath != null && File(cnicFrontPath).existsSync()) {
          _cnicFrontFile = File(cnicFrontPath);
          _cnicFront = 'selected';
        }
        if (cnicBackPath != null && File(cnicBackPath).existsSync()) {
          _cnicBackFile = File(cnicBackPath);
          _cnicBack = 'selected';
        }
        _nameCtrl.text                     = data['name'] ?? '';
        _ageCtrl.text                      = data['age'] ?? '';
        _phoneCtrl.text                    = data['phone'] ?? '';
      _phone2Ctrl.text                   = data['phone2'] ?? '';
        _heightCtrl.text                   = data['height'] ?? '';
        _weightCtrl.text                   = data['weight'] ?? '';
        _instituteCtrl.text                = data['institute'] ?? '';
        _degreeTitleCtrl.text              = data['degreeTitle'] ?? '';
        _institute2Ctrl.text               = data['institute2'] ?? '';
        _degreeTitle2Ctrl.text             = data['degreeTitle2'] ?? '';
        _institute3Ctrl.text               = data['institute3'] ?? '';
        _degreeTitle3Ctrl.text             = data['degreeTitle3'] ?? '';
        _professionCustomCtrl.text         = data['professionCustom'] ?? '';
        _casteCustomCtrl.text              = data['casteCustom'] ?? '';
        _fatherOccupationCustomCtrl.text   = data['fatherOccupationCustom'] ?? '';
        _motherOccupationCustomCtrl.text   = data['motherOccupationCustom'] ?? '';
        _houseSizeCtrl.text                = data['houseSize'] ?? '';
        _carNameCtrl.text                  = data['carName'] ?? '';
        _disabilityDetailsCtrl.text        = data['disabilityDetails'] ?? '';
        _boysCtrl.text                     = data['boys'] ?? '';
        _girlsCtrl.text                    = data['girls'] ?? '';
        _brothersCtrl.text                 = data['brothers'] ?? '';
        _sistersCtrl.text                  = data['sisters'] ?? '';
        _aboutCtrl.text                    = data['about'] ?? '';
        _lookingForCtrl.text               = data['lookingFor'] ?? '';
        _adminNotesCtrl.text               = data['adminNotes'] ?? '';
        _locationCtrl.text                 = data['location'] ?? '';
        _countryCtrl.text                  = data['country'] ?? '';
        _gender           = data['gender'];
        _city             = data['city'];
        _caste            = data['caste'];
        _sect             = data['sect'];
        _language         = (data['language'] as String?)?.isNotEmpty == true ? data['language'] : null;
        _education        = data['education'];
        _profession       = data['profession'];
        _professionCategory = data['professionCategory'];
        _homeType         = data['homeType'];
        _hasKids          = data['hasKids'];
        _hasSiblings      = data['hasSiblings'];
        _maritalStatus    = data['maritalStatus'];
        _openToPolygamy   = data['openToPolygamy'];
        _familyType       = data['familyType'];
        _practiceLevel    = data['practiceLevel'];
        _hijabOrBeard     = data['hijabOrBeard'];
        _marriageNumber   = data['marriageNumber'];
        _complexion       = data['complexion'];
        _employmentType   = data['employmentType'];
        _hasCar           = data['hasCar'];
        _fatherAlive      = data['fatherAlive'];
        _motherAlive      = data['motherAlive'];
        _hasDisability    = data['hasDisability'];
        _physicallyActive = data['physicallyActive'];
        _smoker           = data['smoker'];
        _monthlyIncome    = data['monthlyIncome'];
        _houseUnit        = data['houseUnit'] ?? 'Marla';
        _hasGenerator     = data['hasGenerator'];
        _hasOtherProperty = data['hasOtherProperty'];
        _otherProperty    = data['otherProperty'];
        final restoredStep = data['step'] ?? 0;
        _maxStep          = data['maxStep'] ?? restoredStep;
        // If photo file is gone, go back to step 0 so user re-uploads
        _step = restoredStep;
        _showDraftBanner  = true;
      });
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) setState(() => _showDraftBanner = false);
      });
    } catch (_) {}
  }

  // ── Clear draft ────────────────────────────────────────────────────────────
  Future<void> _clearDraft() async {
    final prefs = _prefs ?? await SharedPreferences.getInstance();
    await prefs.remove('proposal_draft_active');
    await prefs.remove('sheet_draft_cnic');
    await prefs.remove('sheet_draft_password');
    await prefs.remove('sheet_draft_confirm');
    await prefs.remove('user_name');
    await prefs.remove('user_cnic');
    await prefs.remove('user_expiry');
    await prefs.remove('user_tier');
    await prefs.remove('user_status');
    await prefs.setBool('proposal_submitted', true);
  }

  @override
  void dispose() {
    for (final c in [_nameCtrl, _ageCtrl, _phoneCtrl, _phone2Ctrl, _cnicCtrl, _affiliateCtrl, _couponCtrl, _heightCtrl, _weightCtrl,
      _instituteCtrl, _degreeTitleCtrl, _institute2Ctrl, _degreeTitle2Ctrl, _institute3Ctrl, _degreeTitle3Ctrl,
      _professionCustomCtrl, _casteCustomCtrl,
      _fatherOccupationCustomCtrl, _motherOccupationCustomCtrl, _houseSizeCtrl, _carNameCtrl, _boysCtrl, _girlsCtrl,
      _disabilityDetailsCtrl,
      _locationCtrl,
      _brothersCtrl, _sistersCtrl, _aboutCtrl, _lookingForCtrl, _adminNotesCtrl, _passwordCtrl, _confirmPasswordCtrl]) c.dispose();
    super.dispose();
  }

  final _steps = const ['Basic Info', 'Additional Info', 'Verification', 'Submit'];

  Future<File?> _pickImage(String source, {bool crop = false}) async {
    final picked = await _picker.pickImage(
      source: source == 'camera' ? ImageSource.camera : ImageSource.gallery,
      imageQuality: 75, maxWidth: 600,
    );
    if (picked == null) return null;
    if (crop && mounted) {
      final bytes = await File(picked.path).readAsBytes();
      final cropped = await showPhotoCropDialog(context, bytes);
      if (cropped == null) return null;
      // Write cropped bytes to a temp file
      final tmpPath = picked.path + '_cropped.png';
      await File(tmpPath).writeAsBytes(cropped);
      return File(tmpPath);
    }
    return File(picked.path);
  }

  // ── VALIDATION ────────────────────────────────────────────────────────────
  String? _validateStep0() {
    if (_nameCtrl.text.trim().isEmpty) { _invalidField = 'name'; return 'Full Name is required'; }
    if (_ageCtrl.text.trim().isEmpty) { _invalidField = 'age'; return 'Age is required'; }
    final age = int.tryParse(_ageCtrl.text);
    if (age == null) { _invalidField = 'age'; return 'Age must be a number'; }
    if (age < 18 || age > 99) { _invalidField = 'age'; return 'Age must be between 18 and 99'; }
    if (_gender == null) { _invalidField = 'gender'; return 'Please select Gender'; }
    if (_phoneCtrl.text.trim().isEmpty) { _invalidField = 'phone'; return 'Phone is required'; }
    if (_phone2Ctrl.text.trim().isNotEmpty) {
      final p2digits = _phone2Ctrl.text.replaceAll(RegExp(r'[^\d]'), '');
      if (_selectedCountry2.dialCode == '+92') {
        final p2required = p2digits.startsWith('0') ? 11 : 10;
        if (p2digits.length < p2required) { _invalidField = 'phone2'; return 'Enter a valid Pakistani number for the second phone ($p2required digits)'; }
      } else if (p2digits.length > 12) {
        _invalidField = 'phone2'; return 'Second phone cannot exceed 12 digits';
      }
    }
    // Pakistani number: strip space before checking digit count
    if (_selectedCountry.dialCode == '+92') {
      final digits = _phoneCtrl.text.replaceAll(RegExp(r'[^\d]'), '');
      final required = digits.startsWith('0') ? 11 : 10;
      if (digits.length < required) { _invalidField = 'phone'; return 'Enter a valid Pakistani number ($required digits)'; }
    }
    if (_heightCtrl.text.trim().isEmpty) { _invalidField = 'height'; return 'Height is required'; }
    final heightIn = _parseHeight(_heightCtrl.text);
    if (heightIn < 48 || heightIn > 96) { _invalidField = 'height'; return "Height must be between 4'0\" and 8'0\""; }
    if (_city == null) { _invalidField = 'city'; return 'Please select City'; }
    if (_homeType == null) { _invalidField = 'homeType'; return 'Please select House'; }
    // Location and House Size are optional sub-fields of House — not required.
    if (_caste == null) { _invalidField = 'caste'; return 'Please select Caste'; }
    // Check for phone numbers in text fields
    final _textFieldsToCheck = {
      'Name': _nameCtrl.text, 'Location': _locationCtrl.text,
      'About': _aboutCtrl.text, 'Looking For': _lookingForCtrl.text,
      'Institute': _instituteCtrl.text, 'Degree Title': _degreeTitleCtrl.text,
      'Institute 2': _institute2Ctrl.text, 'Degree Title 2': _degreeTitle2Ctrl.text,
      'Institute 3': _institute3Ctrl.text, 'Degree Title 3': _degreeTitle3Ctrl.text,
      'Caste': _casteCustomCtrl.text, 'Occupation': _professionCustomCtrl.text,
      'Car Name': _carNameCtrl.text,
    };
    final _textFieldKeys = {
      'Name': 'name', 'Location': 'location',
      'About': 'about', 'Looking For': 'lookingFor',
      'Institute': 'institute', 'Degree Title': 'degreeTitle',
      'Institute 2': 'institute2', 'Degree Title 2': 'degreeTitle2',
      'Institute 3': 'institute3', 'Degree Title 3': 'degreeTitle3',
      'Caste': 'casteCustom', 'Occupation': 'professionCustom',
      'Car Name': 'carName',
    };
    for (final entry in _textFieldsToCheck.entries) {
      if (containsPhoneNumber(entry.value)) {
        _invalidField = _textFieldKeys[entry.key];
        return '${entry.key} cannot contain phone numbers';
      }
    }

    if (_caste == 'Other' && _casteCustomCtrl.text.trim().isEmpty) { _invalidField = 'casteCustom'; return 'Please specify your Caste'; }
    if (_sect == null) { _invalidField = 'sect'; return 'Please select Sect'; }
    if (_professionCategory == null || _professionCategory!.isEmpty) { _invalidField = 'professionCategory'; return 'Please select an Occupation Category'; }
    if (_profession == null) { _invalidField = 'profession'; return 'Please select Occupation'; }
    if (_profession == 'Other' && _professionCustomCtrl.text.trim().isEmpty) { _invalidField = 'professionCustom'; return 'Please specify your Occupation'; }
    if (_maritalStatus == null) { _invalidField = 'maritalStatus'; return 'Please select Marital Status'; }
    _invalidField = null;
    return null;
  }

  String? _validateStep1() {
    if (_degreeCertFile != null && _degreeTitleCtrl.text.trim().isEmpty) {
      _invalidField = 'degreeTitle';
      return 'Please enter the Degree title for the certificate you uploaded';
    }
    if (_degreeCert2File != null && _degreeTitle2Ctrl.text.trim().isEmpty) {
      _invalidField = 'degreeTitle2';
      return 'Please enter the Degree 2 title for the certificate you uploaded';
    }
    if (_degreeCert3File != null && _degreeTitle3Ctrl.text.trim().isEmpty) {
      _invalidField = 'degreeTitle3';
      return 'Please enter the Degree 3 title for the certificate you uploaded';
    }
    _invalidField = null;
    return null;
  }

  String? _validateStep2() {
    // Note: CNIC number and password are captured earlier in the Create
    // Account bottom sheet, before this multi-step form even starts — they
    // aren't shown anywhere on this screen. Re-validating them here was
    // producing confusing errors about fields the user can't see or edit
    // on this step, so this only checks what's actually on this screen.
    if (_cnicFront == null) { _invalidField = 'cnicFront'; return 'CNIC Front photo is required'; }
    if (_cnicBack == null) { _invalidField = 'cnicBack'; return 'CNIC Back photo is required'; }
    _invalidField = null;
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return PopScope(
      onPopInvokedWithResult: (didPop, result) async {
        _saveDraftSync();
      },
      child: Scaffold(
      backgroundColor: kSurface,
      appBar: AppBar(
        backgroundColor: kCardBg, elevation: 0,
        leading: IconButton(onPressed: () async { _saveDraftSync(); if (context.mounted) Navigator.pop(context); }, icon: const Icon(Icons.arrow_back_rounded, color: kInk)),
        title: Text('Proposal Form', style: TextStyle(fontSize: s.f(17), fontWeight: FontWeight.w800, color: kInk)),
        bottom: PreferredSize(preferredSize: const Size.fromHeight(1), child: Container(height: 1, color: kBorder)),
      ),
      body: Column(
        children: [
          _buildStepIndicator(),
          Expanded(child: Form(key: _formKey, child: AnimatedSwitcher(duration: const Duration(milliseconds: 250), child: _buildStep(_step)))),
          _buildNavButtons(),
        ],
      ),
    ),
    );
  }

  Widget _buildStepIndicator() {
    final s = _S.of(context);
    return Container(
      color: kCardBg,
      padding: EdgeInsets.symmetric(horizontal: s.s(20), vertical: s.s(14)),
      child: Row(
        children: _steps.asMap().entries.map((e) {
          final active = _step == e.key;
          final done = _maxStep > e.key;
          final reachable = e.key <= _maxStep && !active;
          return Expanded(child: Row(children: [
            Expanded(child: GestureDetector(
              onTap: reachable ? () => setState(() => _step = e.key) : null,
              child: Column(children: [
                AnimatedContainer(duration: const Duration(milliseconds: 200), height: s.d(4),
                  decoration: BoxDecoration(color: e.key <= _step ? kPurple : kBorder, borderRadius: BorderRadius.circular(s.s(2)))),
                SizedBox(height: s.s(5)),
                Text(e.value, style: TextStyle(fontSize: s.f(10.5), fontWeight: active ? FontWeight.w800 : FontWeight.w500, color: active ? kPurple : (done ? kGreen : kInkFaint))),
              ]),
            )),
            if (e.key < _steps.length - 1) SizedBox(width: s.s(4)),
          ]));
        }).toList(),
      ),
    );
  }

  Widget _buildStep(int step) {
    switch (step) {
      case 0: return _BasicInfoStep(
        key: const ValueKey(0),
        nameCtrl: _nameCtrl, ageCtrl: _ageCtrl, phoneCtrl: _phoneCtrl, phone2Ctrl: _phone2Ctrl,
        heightCtrl: _heightCtrl, boysCtrl: _boysCtrl, girlsCtrl: _girlsCtrl, aboutCtrl: _aboutCtrl, lookingForCtrl: _lookingForCtrl,
        gender: _gender, city: _city, caste: _caste, maritalStatus: _maritalStatus,
        sect: _sect, language: _language, profession: _profession,
        professionCategory: _professionCategory,
        selectedCountry: _selectedCountry,
        selectedCountry2: _selectedCountry2,
        profilePhotoFile: _profilePhotoFile,
        profilePhoto: _profilePhoto,
        onGenderChanged: (v) => setState(() { _gender = v; if (v?.toLowerCase() == 'female' && _maritalStatus == 'Married') _maritalStatus = null; if (v?.toLowerCase() == 'male' && _maritalStatus == 'Khula') _maritalStatus = null; }),
        onCityChanged: (v) => setState(() => _city = v),
        hasKids: _hasKids,
        onHasKidsChanged: (v) => setState(() => _hasKids = v),
        homeType: _homeType,
        onHomeTypeChanged: (v) => setState(() => _homeType = v),
        countryCtrl: _countryCtrl,
        locationCtrl: _locationCtrl,
        houseSizeCtrl: _houseSizeCtrl,
        houseUnit: _houseUnit,
        onHouseUnitChanged: (v) => setState(() => _houseUnit = v),
        onCasteChanged: (v) => setState(() { _caste = v; if (v != 'Other') _casteCustomCtrl.clear(); }),
        casteCustomCtrl: _casteCustomCtrl,
        onMaritalChanged: (v) => setState(() { _maritalStatus = v; if (v != 'Married') _marriageNumber = null; }),
        openToPolygamy: _openToPolygamy,
        onPolygamyChanged: (v) => setState(() => _openToPolygamy = v),
        marriageNumber: _marriageNumber,
        onMarriageNumberChanged: (v) => setState(() => _marriageNumber = v),
        onSectChanged: (v) => setState(() => _sect = v),
        onLanguageChanged: (v) => setState(() => _language = v),
        onOccupationSelected: (category, prof) => setState(() {
          _professionCategory = category;
          _profession = prof;
          if (prof != 'Other') _professionCustomCtrl.clear();
        }),
        onProfessionCategoryChanged: (v) => setState(() => _professionCategory = v),
        professionCustomCtrl: _professionCustomCtrl,
        onCountryChanged: (v) => setState(() => _selectedCountry = v),
        onCountryChanged2: (v) => setState(() => _selectedCountry2 = v),
        onCountryNameChanged: (v) => setState(() { _countryCtrl.text = v ?? ''; }),
        onProfilePhotoTap: (source) async {
          final f = await _pickImage(source, crop: true);
          if (f != null) setState(() { _profilePhotoFile = f; _profilePhoto = 'selected'; });
        },
        onProfilePhotoRemove: () => setState(() { _profilePhotoFile = null; _profilePhoto = null; }),
        invalidField: _invalidField,
      );
      case 1: return _AdditionalInfoStep(
        key: const ValueKey(1),
        onSkip: () => setState(() { _step++; if (_step > _maxStep) _maxStep = _step; }),
        gender: _gender, maritalStatus: _maritalStatus,
        weightCtrl: _weightCtrl, complexion: _complexion, practiceLevel: _practiceLevel,
        hijabOrBeard: _hijabOrBeard, monthlyIncome: _monthlyIncome, employmentType: _employmentType,
        education: _education, instituteCtrl: _instituteCtrl, degreeTitleCtrl: _degreeTitleCtrl,
        institute2Ctrl: _institute2Ctrl, degreeTitle2Ctrl: _degreeTitle2Ctrl,
        institute3Ctrl: _institute3Ctrl, degreeTitle3Ctrl: _degreeTitle3Ctrl,
        onDegreeCert1Picked: (f) => setState(() => _degreeCertFile = f),
        onDegreeCert2Picked: (f) => setState(() => _degreeCert2File = f),
        onDegreeCert3Picked: (f) => setState(() => _degreeCert3File = f),
        boysCtrl: _boysCtrl, girlsCtrl: _girlsCtrl,
        houseSizeCtrl: _houseSizeCtrl, hasCar: _hasCar, carNameCtrl: _carNameCtrl,
        houseUnit: _houseUnit,
        hasGenerator: _hasGenerator,
        hasOtherProperty: _hasOtherProperty,
        otherProperty: _otherProperty,
        fatherAlive: _fatherAlive, motherAlive: _motherAlive,
        familyType: _familyType,
        onFamilyTypeChanged: (v) => setState(() => _familyType = v),
        fatherOccupationCustomCtrl: _fatherOccupationCustomCtrl,
        motherOccupationCustomCtrl: _motherOccupationCustomCtrl,
        brothersCtrl: _brothersCtrl, sistersCtrl: _sistersCtrl,
        hasSiblings: _hasSiblings,
        onHasSiblingsChanged: (v) => setState(() => _hasSiblings = v),
        hasDisability: _hasDisability, physicallyActive: _physicallyActive, smoker: _smoker,
        disabilityDetailsCtrl: _disabilityDetailsCtrl,
        onComplexionChanged: (v) => setState(() => _complexion = v),
        onPracticeChanged: (v) => setState(() => _practiceLevel = v),
        onHijabBeardChanged: (v) => setState(() => _hijabOrBeard = v),
        onMonthlyIncomeChanged: (v) => setState(() => _monthlyIncome = v),
        onEmploymentTypeChanged: (v) => setState(() => _employmentType = v),
        onEducationChanged: (v) => setState(() => _education = v),
        onHasCarChanged: (v) => setState(() => _hasCar = v),
        onHasOtherPropertyChanged: (v) => setState(() { _hasOtherProperty = v; if (v == 'No') _otherProperty = null; }),
        onOtherPropertyChanged: (v) => setState(() => _otherProperty = v),
        onHouseUnitChanged: (v) => setState(() => _houseUnit = v),
        onHasGeneratorChanged: (v) => setState(() => _hasGenerator = v),
        onFatherAliveChanged: (v) => setState(() => _fatherAlive = v),
        onMotherAliveChanged: (v) => setState(() => _motherAlive = v),
        onHasDisabilityChanged: (v) => setState(() => _hasDisability = v),
        onPhysicallyActiveChanged: (v) => setState(() => _physicallyActive = v),
        onSmokerChanged: (v) => setState(() => _smoker = v),
        invalidField: _invalidField,
      );
      case 2: return _VerificationStep(
        key: const ValueKey(2),
        cnicCtrl: _cnicCtrl,
        passwordCtrl: _passwordCtrl,
        confirmPasswordCtrl: _confirmPasswordCtrl,
        affiliateCtrl: _affiliateCtrl,
        cnicFrontFile: _cnicFrontFile, cnicBackFile: _cnicBackFile,
        cnicFront: _cnicFront, cnicBack: _cnicBack,
        onCnicFrontTap: (source) async {
          final f = await _pickImage(source);
          if (f != null) setState(() { _cnicFrontFile = f; _cnicFront = 'selected'; });
        },
        onCnicBackTap: (source) async {
          final f = await _pickImage(source);
          if (f != null) setState(() { _cnicBackFile = f; _cnicBack = 'selected'; });
        },
        invalidField: _invalidField,
      );
      case 3: return _ReviewStep(
        key: const ValueKey(2),
        name: _nameCtrl.text, age: _ageCtrl.text, phone: _phoneCtrl.text,
        height: _heightCtrl.text, weight: _weightCtrl.text,
        language: _language,
        gender: _gender, city: _city, caste: _caste, sect: _sect,
        education: _education, profession: _profession, maritalStatus: _maritalStatus,
        practiceLevel: _practiceLevel, hijabOrBeard: _hijabOrBeard, monthlyIncome: _monthlyIncome,
        employmentType: _employmentType, complexion: _complexion,
        fatherAlive: _fatherAlive, motherAlive: _motherAlive,
        fatherOccupation: _fatherOccupationCustomCtrl.text.trim().isEmpty ? null : _fatherOccupationCustomCtrl.text.trim(),
        motherOccupation: _motherOccupationCustomCtrl.text.trim().isEmpty ? null : _motherOccupationCustomCtrl.text.trim(),
        brothers: _brothersCtrl.text, sisters: _sistersCtrl.text,
        hasCar: _hasCar, houseSize: _houseSizeCtrl.text,
        hasDisability: _hasDisability, physicallyActive: _physicallyActive, smoker: _smoker,
        hasKids: _hasKids, hasSiblings: _hasSiblings,
        disabilityDetails: _disabilityDetailsCtrl.text.trim().isEmpty ? null : _disabilityDetailsCtrl.text.trim(),
        institute: _instituteCtrl.text,
        degreeTitle: _degreeTitleCtrl.text.trim().isEmpty ? null : _degreeTitleCtrl.text.trim(),
        institute2: _institute2Ctrl.text.trim().isEmpty ? null : _institute2Ctrl.text.trim(),
        degreeTitle2: _degreeTitle2Ctrl.text.trim().isEmpty ? null : _degreeTitle2Ctrl.text.trim(),
        institute3: _institute3Ctrl.text.trim().isEmpty ? null : _institute3Ctrl.text.trim(),
        degreeTitle3: _degreeTitle3Ctrl.text.trim().isEmpty ? null : _degreeTitle3Ctrl.text.trim(),
        about: _aboutCtrl.text,
        lookingFor: _lookingForCtrl.text,
        country: _countryCtrl.text,
        homeType: _homeType,
        location: _locationCtrl.text,
        cnic: _cnicCtrl.text,
        carName: _carNameCtrl.text,
        hasOtherProperty: _hasOtherProperty,
        otherProperty: _otherProperty,
        professionCustom: _profession == 'Other' ? _professionCustomCtrl.text.trim() : null,
        adminNotesCtrl: _adminNotesCtrl,
        affiliateCtrl: _affiliateCtrl,
        couponCtrl: _couponCtrl,
        profilePhotoFile: _profilePhotoFile,
        cnicFrontFile: _cnicFrontFile,
        cnicBackFile: _cnicBackFile,
        degreeCertFile: _degreeCertFile,
        degreeCert2File: _degreeCert2File,
        degreeCert3File: _degreeCert3File,
      );
      default: return const SizedBox.shrink();
    }
  }

  Widget _buildNavButtons() {
    final s = _S.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (_showDraftBanner)
          GestureDetector(
            onTap: () => setState(() => _showDraftBanner = false),
            child: Container(
              width: double.infinity,
              padding: EdgeInsets.symmetric(horizontal: s.s(20), vertical: s.s(10)),
              color: kPurple.withOpacity(0.1),
              child: Row(children: [
                Icon(Icons.restore_rounded, size: s.d(15), color: kPurple),
                SizedBox(width: s.s(8)),
                Expanded(child: Text('Draft restored — your previous progress has been loaded', style: TextStyle(fontSize: s.f(12), color: kPurple, fontWeight: FontWeight.w600))),
                Icon(Icons.close_rounded, size: s.d(14), color: kPurple),
              ]),
            ),
          ),
        Container(
          color: kCardBg,
          padding: EdgeInsets.fromLTRB(s.s(20), s.s(12), s.s(20), MediaQuery.of(context).padding.bottom + s.s(16)),
          child: Row(
            children: [
              if (_step > 0) ...[
                Expanded(
                  child: PressButton(
                    onTap: _submitting ? () {} : () => setState(() => _step--),
                    child: Container(
                      padding: EdgeInsets.symmetric(vertical: s.s(14)),
                      decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(s.s(14)), border: Border.all(color: kBorder)),
                      child: Center(child: Text('Back', style: TextStyle(color: kInkLight, fontWeight: FontWeight.w700, fontSize: s.f(15)))),
                    ),
                  ),
                ),
                SizedBox(width: s.s(12)),
              ],
              Expanded(
                flex: 2,
                child: _submitting
                    ? Container(
                        padding: EdgeInsets.symmetric(vertical: s.s(16)),
                        decoration: BoxDecoration(gradient: const LinearGradient(colors: [kPurple, kPurpleDeep]), borderRadius: BorderRadius.circular(s.s(14))),
                        child: const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))),
                      )
                    : GradientButton(
                        label: _step == _steps.length - 1 ? 'Submit' : 'Next',
                        onTap: _onNext,
                        icon: _step == _steps.length - 1 ? Icons.send_rounded : Icons.arrow_forward_rounded,
                      ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _onNext() {
    String? error;
    setState(() {
      error = _step == 0 ? _validateStep0() : _step == 1 ? _validateStep1() : _step == 2 ? _validateStep2() : null;
    });
    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Row(children: [
          const Icon(Icons.info_outline_rounded, color: Colors.white, size: 18),
          const SizedBox(width: 10),
          Expanded(child: Text(error!, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600))),
        ]),
        backgroundColor: const Color(0xFFE05C5C),
        behavior: SnackBarBehavior.floating,
        margin: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.of(context).padding.bottom + 50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        elevation: 4,
      ));
      return;
    }
    if (_step < _steps.length - 1) {
      setState(() { _step++; if (_step > _maxStep) _maxStep = _step; });
      _saveDraftSync();
    } else {
      _submitProposal();
    }
  }

  Future<void> _submitProposal() async {
    if (_cnicFrontFile == null || _cnicBackFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Please go back and upload CNIC photos.'),
        backgroundColor: Color(0xFFE05C5C), behavior: SnackBarBehavior.floating,
      ));
      return;
    }
    setState(() => _submitting = true);
    try {
      final proposalData = {
        'name': _nameCtrl.text.trim(),
        'age': int.tryParse(_ageCtrl.text) ?? 0,
        'gender': _gender ?? '',
        'city': _city ?? '',
        'caste': _caste == 'Other' && _casteCustomCtrl.text.trim().isNotEmpty ? _casteCustomCtrl.text.trim() : (_caste ?? ''),
        'sect': _sect ?? '',
        'languages': _language != null && _language!.isNotEmpty ? [_language] : [],
        'education': _education ?? '',
        'institute': _instituteCtrl.text.trim().isEmpty ? null : _instituteCtrl.text.trim(),
        'degree_title': _degreeTitleCtrl.text.trim().isEmpty ? null : _degreeTitleCtrl.text.trim(),
        'institute_2': _institute2Ctrl.text.trim().isEmpty ? null : _institute2Ctrl.text.trim(),
        'degree_title_2': _degreeTitle2Ctrl.text.trim().isEmpty ? null : _degreeTitle2Ctrl.text.trim(),
        'institute_3': _institute3Ctrl.text.trim().isEmpty ? null : _institute3Ctrl.text.trim(),
        'degree_title_3': _degreeTitle3Ctrl.text.trim().isEmpty ? null : _degreeTitle3Ctrl.text.trim(),
        'profession': (_profession == 'Other' && _professionCustomCtrl.text.trim().isNotEmpty) ? _professionCustomCtrl.text.trim() : (_profession ?? ''),
        'profession_category': _professionCategory ?? '',
        'employment_type': _employmentType,
        'height_inches': _parseHeight(_heightCtrl.text),
        'weight_kg': double.tryParse(_weightCtrl.text),
        'complexion': _complexion,
        'marital_status': _maritalStatus ?? 'Never married',
        'open_to_polygamy': _openToPolygamy,
        'family_type': _familyType,
        'marriage_number': _marriageNumber,
        'boys': _hasKids == 'Yes' ? int.tryParse(_boysCtrl.text) : null,
        'girls': _hasKids == 'Yes' ? int.tryParse(_girlsCtrl.text) : null,
        'practice_level': _practiceLevel,
        'hijab': _gender?.toLowerCase() == 'female' ? _hijabOrBeard : null,
        'beard': _gender?.toLowerCase() == 'male' ? _hijabOrBeard : null,
        'father_alive': _fatherAlive == null ? null : _fatherAlive == 'Alive',
        'mother_alive': _motherAlive == null ? null : _motherAlive == 'Alive',
        'father_occupation': _fatherOccupationCustomCtrl.text.trim().isEmpty ? null : _fatherOccupationCustomCtrl.text.trim(),
        'mother_occupation': _motherOccupationCustomCtrl.text.trim().isEmpty ? null : _motherOccupationCustomCtrl.text.trim(),
        'sisters': _hasSiblings == 'Yes' && _sistersCtrl.text.trim().isNotEmpty ? int.tryParse(_sistersCtrl.text) : (_hasSiblings == 'No' ? null : null),
        'brothers': _hasSiblings == 'Yes' && _brothersCtrl.text.trim().isNotEmpty ? int.tryParse(_brothersCtrl.text) : (_hasSiblings == 'No' ? null : null),
        'home_type': _homeType,
        'house_size': _houseSizeCtrl.text.trim().isEmpty ? null : '${_houseSizeCtrl.text.trim()} $_houseUnit',
        'country': _countryCtrl.text.trim().isEmpty ? null : _countryCtrl.text.trim(),
        'location': _locationCtrl.text.trim().isEmpty ? null : _locationCtrl.text.trim(),
        'has_car': _hasCar,
        'has_other_property': _hasOtherProperty,
        'other_property': _otherProperty,
        'car_name': _carNameCtrl.text.trim().isEmpty ? null : _carNameCtrl.text.trim(),
        'has_generator': _hasGenerator == null ? null : _hasGenerator == 'Yes',
        'about': _aboutCtrl.text.trim().isEmpty ? null : _aboutCtrl.text.trim(),
      'looking_for': _lookingForCtrl.text.trim().isEmpty ? null : _lookingForCtrl.text.trim(),
        'contact_phone': _formatDialedPhone(_selectedCountry.dialCode, _phoneCtrl.text),
        if (_phone2Ctrl.text.trim().isNotEmpty) 'contact_phone_2': _formatDialedPhone(_selectedCountry2.dialCode, _phone2Ctrl.text),
        'cnic': _cnicCtrl.text.trim(),
        'password': _passwordCtrl.text.trim(),
        'has_disability': _hasDisability == null ? null : _hasDisability == 'Yes',
        'disability_details': _disabilityDetailsCtrl.text.trim().isEmpty ? null : _disabilityDetailsCtrl.text.trim(),
        'has_kids': _hasKids == null ? null : _hasKids == 'Yes',
        'has_siblings': _hasSiblings == null ? null : _hasSiblings == 'Yes',
        'physically_active': _physicallyActive,
        'smokes': _smoker == null ? null : _smoker == 'Yes',
        'monthly_income': _monthlyIncome,
        'admin_notes': _adminNotesCtrl.text.trim().isEmpty ? null : _adminNotesCtrl.text.trim(),
        'cnic_verified': (_cnicFrontFile != null && _cnicBackFile != null),
        if (_affiliateCtrl.text.trim().isNotEmpty) 'affiliate_code': _affiliateCtrl.text.trim().toUpperCase(),
        if (_couponCtrl.text.trim().isNotEmpty) 'applied_coupon_code': _couponCtrl.text.trim().toUpperCase(),
      };

      final proposalId = await _db.submitProposal(
        proposalData: proposalData,
        profilePhotoFile: _profilePhotoFile,
        cnicFrontFile: _cnicFrontFile,
        cnicBackFile: _cnicBackFile,
        degreeCertificateFile: _degreeCertFile,
        degreeCertificate2File: _degreeCert2File,
        degreeCertificate3File: _degreeCert3File,
      );

      if (!mounted) return;
      _submitted = true;
      await _clearDraft();
      AnalyticsService.registerComplete();
      // Persist CNIC so group_feed_screen can resolve subscription status
      // on next app open (before the user logs in). Uses the
      // submission-only cache — NOT the shared 'user_cnic'/activated-CNIC
      // key a real login writes — so simply submitting this form is never
      // mistaken for a completed, authenticated login (that key is what
      // drives the header avatar and "logged in" state elsewhere).
      final submittedCnic = _cnicCtrl.text.trim();
      if (submittedCnic.isNotEmpty) {
        final prefs = await SharedPreferences.getInstance();
        await SupabaseService.instance.setSubmittedOnlyCnic(submittedCnic);
        // Also save the proposal id now (normally only saved on login) so
        // the notification bell has something to key off of immediately,
        // before the user ever logs in.
        await prefs.setString('user_proposal_id', proposalId);
      }
      // The proposal itself is already safely submitted at this point —
      // nothing below is something the user needs to wait for. Syncing the
      // FCM token and sending the "Profile Submitted" confirmation push
      // are both real network calls; running them in the background
      // (rather than awaiting them before showing success) is what fixes
      // the popup taking a long time to appear, especially on slow
      // connections. A failure in either is non-critical — worst case is
      // a missed confirmation push, not a lost submission — so errors are
      // swallowed quietly rather than shown to the user.
      if (submittedCnic.isNotEmpty) {
        unawaited(FCMService.instance.syncTokenToDb().catchError((e) {
          debugPrint('syncTokenToDb failed after submit (non-critical): $e');
        }));
      }
      unawaited(NotificationService.instance.notifyProposalSubmitted(proposalId).catchError((e) {
        debugPrint('notifyProposalSubmitted failed after submit (non-critical): $e');
      }));
      _showSuccessDialog();
    } catch (e) {
      if (!mounted) return;
      debugPrint('Proposal submission failed: $e');
      final msg = e.toString().toLowerCase();
      final isNoInternet = msg.contains('socket') || msg.contains('network') || msg.contains('connection');
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(isNoInternet
            ? "Couldn't submit — please check your internet connection and try again."
            : "Something went wrong while submitting your profile. Please try again, or contact support if this keeps happening."),
        backgroundColor: const Color(0xFFE05C5C),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  double _parseHeight(String raw) {
    final direct = double.tryParse(raw);
    if (direct != null) return direct;
    final match = RegExp(r"(\d+)'(\d+)").firstMatch(raw);
    if (match != null) {
      return (int.parse(match.group(1)!) * 12 + int.parse(match.group(2)!)).toDouble();
    }
    return 64;
  }

  // Combines a dial code with a locally-entered number for storage.
  // Pakistani numbers are usually typed with their trunk-prefix "0" (e.g.
  // 0300 1234567) — that 0 must never be kept when it's prefixed with the
  // +92 country code (should read "+92 300 1234567", not "+92 0300
  // 1234567"). Matches the same fix on the website's registration form.
  String _formatDialedPhone(String dialCode, String number) {
    final trimmed = number.replaceAll(' ', '').trim();
    final local = dialCode == '+92' ? trimmed.replaceFirst(RegExp(r'^0+'), '') : trimmed;
    return '$dialCode $local';
  }

  void _showSuccessDialog() {
    final s = _S.of(context);
    showDialog(
      context: context, barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(s.s(20))),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: s.d(64), height: s.d(64), decoration: BoxDecoration(color: kGreenLight, borderRadius: BorderRadius.circular(s.s(18))), child: Icon(Icons.check_circle_rounded, color: kGreen, size: s.d(36))),
          SizedBox(height: s.s(16)),
          Text('Profile Submitted!', style: TextStyle(fontSize: s.f(18), fontWeight: FontWeight.w800, color: kInk)),
          SizedBox(height: s.s(8)),
          Text('Thank you for submitting your profile! Please allow up to 24 hours for review.', textAlign: TextAlign.center, style: TextStyle(fontSize: s.f(13), color: kInkLight, height: 1.55)),
          SizedBox(height: s.s(16)),
          GradientButton(label: 'Login', onTap: () {
            Navigator.pop(ctx);
            Navigator.pop(context);
            widget.onLoginTap?.call();
          }),
        ]),
      ),
    );
  }
}

// ── Step 1: Basic Information ─────────────────────────────────────────────────
class _BasicInfoStep extends StatelessWidget {
  final TextEditingController nameCtrl, ageCtrl, phoneCtrl, heightCtrl, boysCtrl, girlsCtrl, aboutCtrl, lookingForCtrl;
  final TextEditingController phone2Ctrl;
  final TextEditingController locationCtrl, houseSizeCtrl, countryCtrl;
  final String? gender, city, caste, maritalStatus, sect, profession;
  final String? professionCategory;
  final String? openToPolygamy;
  final String? language;
  final String? homeType, houseUnit, hasKids;
  final String? profilePhoto;
  final File? profilePhotoFile;
  final _CountryCode selectedCountry;
  final _CountryCode selectedCountry2;
  final TextEditingController professionCustomCtrl;
  final TextEditingController casteCustomCtrl;
  final String? marriageNumber;
  final ValueChanged<String?>? onMarriageNumberChanged;
  final ValueChanged<String?> onGenderChanged, onCityChanged, onCasteChanged, onMaritalChanged, onSectChanged;
  final void Function(String category, String profession) onOccupationSelected;
  final ValueChanged<String?> onProfessionCategoryChanged;
  final ValueChanged<String?> onPolygamyChanged;
  final ValueChanged<String?> onLanguageChanged;
  final ValueChanged<String?> onHomeTypeChanged, onHasKidsChanged;
  final ValueChanged<_CountryCode> onCountryChanged;
  final ValueChanged<_CountryCode> onCountryChanged2;
  final ValueChanged<String?> onCountryNameChanged;
  final ValueChanged<String> onHouseUnitChanged;
  final ValueChanged<String> onProfilePhotoTap;
  final VoidCallback onProfilePhotoRemove;
  final String? invalidField;

  const _BasicInfoStep({
    super.key,
    required this.nameCtrl, required this.ageCtrl, required this.phoneCtrl, required this.phone2Ctrl,
    required this.heightCtrl, required this.boysCtrl, required this.girlsCtrl, required this.aboutCtrl, required this.lookingForCtrl,
    required this.countryCtrl, required this.locationCtrl, required this.houseSizeCtrl,
    this.language,
    this.gender, this.city, this.caste, this.maritalStatus, this.sect, this.profession,
    this.professionCategory,
    this.openToPolygamy,
    this.homeType, this.houseUnit,
    this.profilePhoto,
    this.profilePhotoFile,
    required this.selectedCountry,
    required this.selectedCountry2,
    required this.onGenderChanged, required this.onCityChanged, required this.onCasteChanged,
    required this.professionCustomCtrl,
    required this.casteCustomCtrl,
    required this.onMaritalChanged, required this.onSectChanged,
    required this.onOccupationSelected,
    required this.onProfessionCategoryChanged,
    required this.onPolygamyChanged,
    required this.onLanguageChanged,
    required this.onHomeTypeChanged,
    required this.onCountryChanged, required this.onCountryChanged2, required this.onCountryNameChanged, required this.onHouseUnitChanged,
    required this.onProfilePhotoTap,
    required this.onProfilePhotoRemove,
    this.hasKids,
    required this.onHasKidsChanged,
    this.marriageNumber,
    this.onMarriageNumberChanged,
    this.invalidField,
  });

  bool get _showKids {
    final s = maritalStatus?.toLowerCase() ?? '';
    return s == 'divorced' || s == 'khula' || s == 'widowed';
  }

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return ListView(padding: EdgeInsets.all(s.s(20)), children: [
      _FormTitle(title: 'Basic Information', subtitle: 'Fields marked with * are required', icon: Icons.person_outline_rounded),
      SizedBox(height: s.s(28)),
      _ProfilePhotoRow(file: profilePhotoFile, selected: profilePhoto != null, onSourceSelected: onProfilePhotoTap, onRemove: onProfilePhotoRemove),
      SizedBox(height: s.s(16)),
      _AppTextField(controller: nameCtrl, label: 'Full Name *', hint: 'e.g. Fatima Rehman', isInvalid: invalidField == 'name'),
      SizedBox(height: s.s(12)),
      Row(children: [
        Expanded(child: _AgeField(controller: ageCtrl, isInvalid: invalidField == 'age')),
        SizedBox(width: s.s(12)),
        Expanded(child: _DropdownField(label: 'Gender *', value: gender, options: const ['Male', 'Female'], onChanged: onGenderChanged, isInvalid: invalidField == 'gender')),
      ]),
      SizedBox(height: s.s(12)),
      _PhoneField(controller: phoneCtrl, selectedCountry: selectedCountry, onCountryChanged: onCountryChanged, isInvalid: invalidField == 'phone'),
      _Phone2Field(phone2Ctrl: phone2Ctrl, s: s, selectedCountry: selectedCountry2, onCountryChanged: onCountryChanged2, isInvalid: invalidField == 'phone2'),
      SizedBox(height: s.s(12)),
      _HeightDropdowns(controller: heightCtrl, required: true, isInvalid: invalidField == 'height'),
      SizedBox(height: s.s(12)),
      SearchableGroupedDropdown(label: 'Country (for overseas)', value: countryCtrl.text.isEmpty ? null : countryCtrl.text, groups: kCountriesGrouped, onChanged: onCountryNameChanged, icon: Icons.public_rounded),
      SizedBox(height: s.s(12)),
      SearchableGroupedDropdown(label: 'City *', value: city, groups: SupabaseService.instance.citiesGrouped, onChanged: onCityChanged, icon: Icons.location_on_outlined, isInvalid: invalidField == 'city'),
      SizedBox(height: s.s(12)),
      _DropdownField(label: 'House *', value: homeType, options: const ['Own House', 'Rented House'], onChanged: onHomeTypeChanged, isInvalid: invalidField == 'homeType'),
      if (homeType != null) ...[
        Container(
          margin: EdgeInsets.only(top: s.s(8), left: s.s(16)),
          padding: EdgeInsets.all(s.s(12)),
          decoration: BoxDecoration(
            color: const Color(0xFFF8F7FF),
            borderRadius: BorderRadius.circular(s.s(12)),
            border: Border.all(color: const Color(0xFFE8E6F5)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _AppTextField(controller: locationCtrl, label: 'Location', hint: 'e.g. DHA Phase 5, Gulberg', isInvalid: invalidField == 'location'),
            SizedBox(height: s.s(10)),
            _HouseSizeField(controller: houseSizeCtrl, unit: houseUnit ?? 'Marla', onUnitChanged: onHouseUnitChanged, label: 'Size', isInvalid: invalidField == 'houseSize'),
          ]),
        ),
      ],
      SizedBox(height: s.s(12)),
      SearchableGroupedDropdown(label: 'Caste *', value: caste, groups: SupabaseService.instance.castesGrouped, onChanged: onCasteChanged, icon: Icons.people_outline_rounded, isInvalid: invalidField == 'caste'),
      if (caste == 'Other') ...[
        Container(
          margin: EdgeInsets.only(top: s.s(8), left: s.s(16)),
          padding: EdgeInsets.all(s.s(12)),
          decoration: BoxDecoration(
            color: const Color(0xFFF8F7FF),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE8E6F5)),
          ),
          child: _AppTextField(controller: casteCustomCtrl, label: 'Specify Caste', hint: 'e.g. Wattoo, Kashmiri', isInvalid: invalidField == 'casteCustom'),
        ),
      ],
      SizedBox(height: s.s(12)),
      _DropdownField(label: 'Sect / Maslak *', value: sect, options: kSects, onChanged: onSectChanged, isInvalid: invalidField == 'sect'),
      SizedBox(height: s.s(12)),
      _DropdownField(label: 'Native Language', value: language, options: kLanguages, onChanged: onLanguageChanged),
      SizedBox(height: s.s(12)),
      // ── Occupation — search by job title across every category at once;
      // picking a result sets the category and the specific job together
      // in one tap, so the category is always exactly correct without
      // making anyone guess it first. Each category's own 'Other' stays
      // unambiguous since results are always shown as "Other — <Category>".
      OccupationPicker(
        label: 'Occupation *',
        category: professionCategory,
        profession: profession,
        onSelect: onOccupationSelected,
        isInvalid: invalidField == 'profession' || invalidField == 'professionCategory',
      ),
      if (profession == 'Other') ...[
        Container(
          margin: EdgeInsets.only(top: s.s(8), left: s.s(16)),
          padding: EdgeInsets.all(s.s(12)),
          decoration: BoxDecoration(
            color: const Color(0xFFF8F7FF),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE8E6F5)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _AppTextField(controller: professionCustomCtrl, label: 'Specify Occupation', hint: 'e.g. Calligrapher, Gemologist', maxLength: 30, showCounter: false, isInvalid: invalidField == 'professionCustom'),
            if (profession == 'Other') ...[
              SizedBox(height: s.s(10)),
              _DropdownField(
                label: 'Occupation Category',
                value: (professionCategory != null && professionCategory!.isNotEmpty) ? professionCategory : null,
                // A real category is still required even for a custom job
                // title — 'Other' itself is excluded here since the whole
                // point is picking which actual field the job belongs to.
                options: SupabaseService.instance.occupationsGrouped.keys.where((k) => k != 'Other').toList(),
                onChanged: onProfessionCategoryChanged,
                isInvalid: invalidField == 'professionCategory',
              ),
            ],
          ]),
        ),
      ],
      const SizedBox(height: 12),
      _DropdownField(label: 'Marital Status *', value: maritalStatus, options: gender?.toLowerCase() == 'female' ? const ['Never married', 'Divorced', 'Khula', 'Widowed'] : gender?.toLowerCase() == 'male' ? const ['Never married', 'Married', 'Divorced', 'Widowed'] : const ['Never married', 'Married', 'Divorced', 'Khula', 'Widowed'], onChanged: onMaritalChanged, isInvalid: invalidField == 'maritalStatus'),
      if (maritalStatus == 'Married') ...[
        Container(
          margin: const EdgeInsets.only(top: 8, left: 16),
          child: _DropdownField(
            label: 'Looking for',
            value: marriageNumber,
            options: const ['Second marriage', 'Third marriage', 'Fourth marriage'],
            onChanged: onMarriageNumberChanged ?? (_) {},
          ),
        ),
      ],
      if (_showKids) ...[
        Container(
          margin: const EdgeInsets.only(top: 8, left: 16),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF8F7FF),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE8E6F5)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _DropdownField(label: 'Do you have kids?', value: hasKids, options: const ['Yes', 'No'], onChanged: onHasKidsChanged),
            if (hasKids == 'Yes') ...[
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: _AppTextField(controller: boysCtrl, label: 'Sons', hint: '0', isNumber: true, maxLength: 2, showCounter: false)),
                const SizedBox(width: 12),
                Expanded(child: _AppTextField(controller: girlsCtrl, label: 'Daughters', hint: '0', isNumber: true, maxLength: 2, showCounter: false)),
              ]),
            ],
          ]),
        ),
      ],
      const SizedBox(height: 12),
      _DropdownField(
        label: 'Open to Polygamy?',
        value: openToPolygamy,
        options: const ['Yes', 'No'],
        onChanged: onPolygamyChanged,
        infoText: 'Polygamy means marrying more than one woman (for men) or marrying a man who already has a wife (for women).',
      ),
      const SizedBox(height: 12),
      _AppTextField(controller: aboutCtrl, label: 'About Yourself', hint: 'Brief about yourself...', maxLines: 3, maxLength: 200, isInvalid: invalidField == 'about'),
      const SizedBox(height: 12),
      _AppTextField(controller: lookingForCtrl, label: 'Looking For', hint: 'What are you looking for in a partner...', maxLines: 3, maxLength: 200, isInvalid: invalidField == 'lookingFor'),
    ]);
  }
}

// ── Step 2: Additional Information ───────────────────────────────────────────
class _AdditionalInfoStep extends StatelessWidget {
  final String? gender, maritalStatus, complexion, practiceLevel, hijabOrBeard;
  final String? monthlyIncome, employmentType, education, hasCar, fatherAlive, motherAlive;
  final String? familyType;
  final TextEditingController fatherOccupationCustomCtrl, motherOccupationCustomCtrl;
  final String? hasDisability, physicallyActive, smoker, hasSiblings, hasOtherProperty, otherProperty;
  final String? hasGenerator;
  final String houseUnit;
  final TextEditingController weightCtrl, instituteCtrl, degreeTitleCtrl, boysCtrl, girlsCtrl;
  final TextEditingController institute2Ctrl, degreeTitle2Ctrl, institute3Ctrl, degreeTitle3Ctrl;
  final TextEditingController houseSizeCtrl, carNameCtrl, brothersCtrl, sistersCtrl, disabilityDetailsCtrl;
  final ValueChanged<String?> onComplexionChanged, onPracticeChanged, onHijabBeardChanged;
  final ValueChanged<String?> onMonthlyIncomeChanged, onEmploymentTypeChanged, onEducationChanged;
  final ValueChanged<String?> onHasCarChanged, onHasOtherPropertyChanged, onOtherPropertyChanged, onFatherAliveChanged, onMotherAliveChanged;
  final ValueChanged<String?> onFamilyTypeChanged;
  final ValueChanged<String?> onHasDisabilityChanged, onPhysicallyActiveChanged, onSmokerChanged, onHasSiblingsChanged;
  final ValueChanged<String> onHouseUnitChanged;
  final ValueChanged<String?> onHasGeneratorChanged;
  final VoidCallback onSkip;
  final ValueChanged<File?> onDegreeCert1Picked, onDegreeCert2Picked, onDegreeCert3Picked;
  final String? invalidField;

  const _AdditionalInfoStep({
    super.key,
    this.gender, this.maritalStatus, this.complexion, this.practiceLevel, this.hijabOrBeard,
    this.monthlyIncome, this.employmentType, this.education, this.hasCar, this.hasOtherProperty, this.otherProperty, this.fatherAlive,
    this.motherAlive, this.hasDisability, this.physicallyActive, this.smoker, this.hasSiblings,
    this.hasGenerator,
    this.familyType,
    required this.houseUnit,
    required this.weightCtrl, required this.instituteCtrl, required this.degreeTitleCtrl, required this.boysCtrl,
    required this.girlsCtrl, required this.houseSizeCtrl, required this.carNameCtrl,
    required this.institute2Ctrl, required this.degreeTitle2Ctrl,
    required this.institute3Ctrl, required this.degreeTitle3Ctrl,
    required this.brothersCtrl, required this.sistersCtrl, required this.disabilityDetailsCtrl,
    required this.onHasSiblingsChanged,
    required this.onComplexionChanged, required this.onPracticeChanged, required this.onHijabBeardChanged,
    required this.onMonthlyIncomeChanged, required this.onEmploymentTypeChanged, required this.onEducationChanged,
    required this.onHasCarChanged, required this.onHasOtherPropertyChanged, required this.onOtherPropertyChanged, required this.onFatherAliveChanged, required this.onMotherAliveChanged,
    required this.onFamilyTypeChanged,
    required this.fatherOccupationCustomCtrl, required this.motherOccupationCustomCtrl,
    required this.onDegreeCert1Picked, required this.onDegreeCert2Picked, required this.onDegreeCert3Picked,
    required this.onHasDisabilityChanged, required this.onPhysicallyActiveChanged, required this.onSmokerChanged,
    required this.onHouseUnitChanged,
    required this.onHasGeneratorChanged,
    required this.onSkip,
    this.invalidField,
  });

  bool get _isDivorcedOrWidowed {
    final s = maritalStatus?.toLowerCase() ?? '';
    return s == 'divorced' || s == 'widowed' || s == 'khula';
  }

  Widget _sec(String t) => Padding(
    padding: const EdgeInsets.only(top: 28, bottom: 10),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(t, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kInkFaint, letterSpacing: 0.8)),
      const SizedBox(height: 6),
      Divider(height: 1, color: kBorder),
    ]),
  );

  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(20), children: [
      Row(children: [
        Expanded(child: _FormTitle(title: 'Additional Information', subtitle: 'All fields below are optional', icon: Icons.info_outline_rounded, iconColor: kPurple, iconBg: kPurpleLight)),
        GestureDetector(
          onTap: onSkip,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(color: kPurpleLight, borderRadius: BorderRadius.circular(8), border: Border.all(color: kPurple.withOpacity(0.25))),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Text('Skip', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kPurple)),
              const SizedBox(width: 3),
              const Icon(Icons.skip_next_rounded, size: 15, color: kPurple),
            ]),
          ),
        ),
      ]),
      _sec('FAMILY'),
      _DropdownField(label: 'Family Type', value: familyType, options: const ['Joint family', 'Separated Family'], onChanged: onFamilyTypeChanged),
      const SizedBox(height: 12),
      Row(children: [
        Expanded(child: _DropdownField(label: 'Father', value: fatherAlive, options: const ['Alive', 'Deceased'], onChanged: onFatherAliveChanged)),
        const SizedBox(width: 12),
        Expanded(child: _DropdownField(label: 'Mother', value: motherAlive, options: const ['Alive', 'Deceased'], onChanged: onMotherAliveChanged)),
      ]),
      const SizedBox(height: 12),
      _AppTextField(controller: fatherOccupationCustomCtrl, label: 'Father Occupation', hint: 'e.g. Farmer, Contractor', isInvalid: invalidField == 'fatherOccupationCustom'),
      const SizedBox(height: 12),
      _AppTextField(controller: motherOccupationCustomCtrl, label: 'Mother Occupation', hint: 'e.g. Housewife, Tailor', isInvalid: invalidField == 'motherOccupationCustom'),
      const SizedBox(height: 12),
      _DropdownField(label: 'Do you have siblings?', value: hasSiblings, options: const ['Yes', 'No'], onChanged: onHasSiblingsChanged),
      if (hasSiblings == 'Yes') ...[
        Container(
          margin: const EdgeInsets.only(top: 8, left: 16),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF8F7FF),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE8E6F5)),
          ),
          child: Row(children: [
            Expanded(child: _AppTextField(controller: brothersCtrl, label: 'Brothers', hint: '0', isNumber: true, maxLength: 2, showCounter: false)),
            const SizedBox(width: 12),
            Expanded(child: _AppTextField(controller: sistersCtrl, label: 'Sisters', hint: '0', isNumber: true, maxLength: 2, showCounter: false)),
          ]),
        ),
      ],
      _sec('EDUCATION'),
      _DropdownField(label: 'Education Level (Highest)', value: education, options: kEducations, onChanged: onEducationChanged),
      const SizedBox(height: 12),
      _DegreeFields(
        degreeTitleCtrl: degreeTitleCtrl,
        instituteCtrl: instituteCtrl,
        degreeTitle2Ctrl: degreeTitle2Ctrl,
        institute2Ctrl: institute2Ctrl,
        degreeTitle3Ctrl: degreeTitle3Ctrl,
        institute3Ctrl: institute3Ctrl,
        onCert1Picked: onDegreeCert1Picked,
        onCert2Picked: onDegreeCert2Picked,
        onCert3Picked: onDegreeCert3Picked,
      ),
      _sec('CAREER'),
      _DropdownField(label: 'Monthly Income', value: monthlyIncome, options: kMonthlyIncomes, onChanged: onMonthlyIncomeChanged),
      const SizedBox(height: 12),
      _DropdownField(label: 'Employment Type', value: employmentType, options: const ['Full-time', 'Part-time', 'Self-employed', 'Freelance', 'Not employed'], onChanged: onEmploymentTypeChanged),
      _sec('PHYSICAL'),
      _WeightField(controller: weightCtrl),
      const SizedBox(height: 12),
      _DropdownField(label: 'Complexion', value: complexion, options: const ['Fair', 'Wheatish', 'Brown', 'Dark'], onChanged: onComplexionChanged),
      _sec('RELIGION'),
      _DropdownField(label: 'Religion Practice Level', value: practiceLevel, options: const ['High', 'Moderate', 'Low'], onChanged: onPracticeChanged),
      const SizedBox(height: 12),
      if (gender?.toLowerCase() == 'female')
        _DropdownField(label: 'Wears Hijab', value: hijabOrBeard, options: const ['Yes', 'No', 'Sometimes'], onChanged: onHijabBeardChanged)
      else
        _DropdownField(label: 'Have Beard', value: hijabOrBeard, options: const ['Yes', 'No', 'Light'], onChanged: onHijabBeardChanged),
      _sec('ASSETS'),
      _DropdownField(label: 'Car', value: hasCar, options: const ['Yes', 'No', 'Multiple'], onChanged: onHasCarChanged),

      const SizedBox(height: 12),
      _DropdownField(label: 'Other Property', value: hasOtherProperty, options: const ['Yes', 'No'], onChanged: onHasOtherPropertyChanged),
      if (hasOtherProperty == 'Yes') ...[
        Container(
          margin: const EdgeInsets.only(top: 8, left: 16),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF8F7FF),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE8E6F5)),
          ),
          child: _DropdownField(label: 'Property Type', value: otherProperty, options: const ['Residential', 'Commercial', 'Land', 'Multiple'], onChanged: onOtherPropertyChanged),
        ),
      ],
      _sec('HEALTH'),
      _DropdownField(label: 'Disability / Chronic Illness', value: hasDisability, options: const ['Yes', 'No'], onChanged: onHasDisabilityChanged),
      if (hasDisability == 'Yes') ...[
        Container(
          margin: const EdgeInsets.only(top: 8, left: 16),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF8F7FF),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE8E6F5)),
          ),
          child: _AppTextField(
            controller: disabilityDetailsCtrl,
            label: 'Brief Details (optional)',
            hint: 'e.g. Diabetes, managed well...',
            maxLines: 2,
            maxLength: 30,
          ),
        ),
      ],
      const SizedBox(height: 12),
      _DropdownField(label: 'Lifestyle', value: physicallyActive, options: const ['Active Living', 'Moderately Active', 'Sedentary Living'], onChanged: onPhysicallyActiveChanged),
      const SizedBox(height: 12),
      _DropdownField(label: 'Smoker', value: smoker, options: const ['Yes', 'No'], onChanged: onSmokerChanged),
      const SizedBox(height: 30),
    ]);
  }
}

// ── Step 3: Verification ──────────────────────────────────────────────────────
class _VerificationStep extends StatefulWidget {
  final TextEditingController cnicCtrl, passwordCtrl, confirmPasswordCtrl;
  final TextEditingController? affiliateCtrl;
  final File? cnicFrontFile, cnicBackFile;
  final String? cnicFront, cnicBack;
  final ValueChanged<String> onCnicFrontTap, onCnicBackTap;
  final String? invalidField;

  const _VerificationStep({
    super.key,
    required this.cnicCtrl,
    required this.passwordCtrl,
    required this.confirmPasswordCtrl,
    this.affiliateCtrl,
    this.cnicFrontFile, this.cnicBackFile,
    this.cnicFront, this.cnicBack,
    required this.onCnicFrontTap,
    required this.onCnicBackTap,
    this.invalidField,
  });

  @override
  State<_VerificationStep> createState() => _VerificationStepState();
}

class _VerificationStepState extends State<_VerificationStep> {
  bool _passwordObscure = true;
  bool _confirmPasswordObscure = true;

  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(20), children: [
      _FormTitle(
        title: 'Verification',
        subtitle: 'Your CNIC remains private and fully secured',
        icon: Icons.verified_user_outlined,
        iconColor: kPurple,
        iconBg: kPurpleLight,
      ),
      const SizedBox(height: 24),
      // CNIC Front — full width
      Row(children: [
        const Text('CNIC Front *', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kInkLight)),
        if (widget.invalidField == 'cnicFront') ...[const SizedBox(width: 6), const Icon(Icons.error_rounded, color: kRose, size: 14)],
      ]),
      const SizedBox(height: 8),
      _FullPhotoSlot(
        label: 'CNIC Front',
        file: widget.cnicFrontFile,
        selected: widget.cnicFront != null,
        onSourceSelected: widget.onCnicFrontTap,
        isInvalid: widget.invalidField == 'cnicFront',
      ),
      const SizedBox(height: 20),
      // CNIC Back — full width
      Row(children: [
        const Text('CNIC Back *', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kInkLight)),
        if (widget.invalidField == 'cnicBack') ...[const SizedBox(width: 6), const Icon(Icons.error_rounded, color: kRose, size: 14)],
      ]),
      const SizedBox(height: 8),
      _FullPhotoSlot(
        label: 'CNIC Back',
        file: widget.cnicBackFile,
        selected: widget.cnicBack != null,
        onSourceSelected: widget.onCnicBackTap,
        isInvalid: widget.invalidField == 'cnicBack',
      ),
      const SizedBox(height: 30),
    ]);
  }
}

// ── Profile photo row — circular avatar + right-side text + button ───────────
class _ProfilePhotoRow extends StatelessWidget {
  final File? file;
  final bool selected;
  final ValueChanged<String> onSourceSelected;
  final VoidCallback onRemove;
  const _ProfilePhotoRow({required this.file, required this.selected, required this.onSourceSelected, required this.onRemove});

  void _showPicker(BuildContext context) {
    showModalBottomSheet(
      context: context, backgroundColor: Colors.transparent, useSafeArea: true,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(ctx).padding.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 40, height: 4, decoration: BoxDecoration(color: kBorder, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 18),
          const Text('Profile Photo', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: kInk)),
          const SizedBox(height: 16),
          _PickerOption(icon: Icons.camera_alt_rounded, label: 'Take Photo', color: kPurple, bg: kPurpleLight, onTap: () { Navigator.pop(ctx); onSourceSelected('camera'); }),
          const SizedBox(height: 10),
          _PickerOption(icon: Icons.photo_library_rounded, label: 'Upload from Gallery', color: kPurple, bg: kPurpleLight, onTap: () { Navigator.pop(ctx); onSourceSelected('gallery'); }),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _showPicker(context),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        Container(
          width: 80, height: 80,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: selected ? kPurpleLight : const Color(0xFFFAFAFA),
            border: Border.all(color: selected ? kPurple : kBorder, width: selected ? 1.5 : 1.5, style: BorderStyle.solid),
          ),
          clipBehavior: Clip.antiAlias,
          child: file != null
              ? Image.file(file!, fit: BoxFit.cover)
              : const Icon(Icons.person_outline_rounded, size: 32, color: Color(0xFFB0ADCB)),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              selected ? '✓  Photo selected' : 'Upload Profile Photo',
              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: selected ? kPurple : kInkLight),
            ),
            const SizedBox(height: 3),
            const Text('Clear face photo · JPG or PNG', style: TextStyle(fontSize: 12, color: kInkFaint)),
            const SizedBox(height: 10),
            Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: kPurpleLight, borderRadius: BorderRadius.circular(7)),
                child: Text(
                  selected ? 'Change Photo' : 'Choose Photo',
                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: kPurple),
                ),
              ),
              if (selected) ...[
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: onRemove,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(7)),
                    child: const Text('Remove', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFFDC2626))),
                  ),
                ),
              ],
            ]),
          ]),
        ),
      ]),
    );
  }
}

// ── Photo slot — shows real image preview ────────────────────────────────────
class _PhotoSlot extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final File? file;
  final ValueChanged<String> onSourceSelected;

  const _PhotoSlot({required this.label, required this.icon, required this.selected, this.file, required this.onSourceSelected});

  void _showPicker(BuildContext context) {
    showModalBottomSheet(
      context: context, backgroundColor: Colors.transparent, useSafeArea: true,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(ctx).padding.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 40, height: 4, decoration: BoxDecoration(color: kBorder, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 18),
          Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: kInk)),
          const SizedBox(height: 16),
          _PickerOption(icon: Icons.camera_alt_rounded, label: 'Take Photo', color: kPurple, bg: kPurpleLight, onTap: () { Navigator.pop(ctx); onSourceSelected('camera'); }),
          const SizedBox(height: 10),
          _PickerOption(icon: Icons.photo_library_rounded, label: 'Upload from Gallery', color: kPurple, bg: kPurpleLight, onTap: () { Navigator.pop(ctx); onSourceSelected('gallery'); }),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return GestureDetector(
      onTap: () => _showPicker(context),
      child: Container(
        height: s.d(90),
        decoration: BoxDecoration(
          color: selected ? kPurpleLight : kSurface,
          borderRadius: BorderRadius.circular(s.s(12)),
          border: Border.all(color: selected ? kPurple : kBorder, width: selected ? 1.5 : 1),
        ),
        child: file != null
            ? ClipRRect(
                borderRadius: BorderRadius.circular(s.s(11)),
                child: Stack(fit: StackFit.expand, children: [
                  Image.file(file!, fit: BoxFit.cover),
                  Positioned(top: s.s(4), right: s.s(4),
                    child: Container(
                      width: s.d(20), height: s.d(20),
                      decoration: BoxDecoration(color: kPurple, borderRadius: BorderRadius.circular(s.s(10))),
                      child: Icon(Icons.check_rounded, color: Colors.white, size: s.d(13)),
                    ),
                  ),
                ]),
              )
            : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(icon, size: s.d(26), color: kInkFaint),
                SizedBox(height: s.s(6)),
                Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: s.f(10.5), fontWeight: FontWeight.w600, color: kInkFaint)),
              ]),
      ),
    );
  }
}

class _PickerOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color, bg;
  final VoidCallback onTap;
  const _PickerOption({required this.icon, required this.label, required this.color, required this.bg, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.symmetric(horizontal: s.s(16), vertical: s.s(14)),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(s.s(14)), border: Border.all(color: color.withOpacity(0.2))),
        child: Row(children: [
          Container(width: s.d(38), height: s.d(38), decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(s.s(10))), child: Icon(icon, color: Colors.white, size: s.d(20))),
          SizedBox(width: s.s(14)),
          Text(label, style: TextStyle(fontSize: s.f(14), fontWeight: FontWeight.w700, color: color)),
        ]),
      ),
    );
  }
}

// ── Full-width photo slot for CNIC front/back ─────────────────────────────────
class _FullPhotoSlot extends StatelessWidget {
  final String label;
  final bool selected;
  final File? file;
  final ValueChanged<String> onSourceSelected;
  final bool isInvalid;

  const _FullPhotoSlot({required this.label, required this.selected, this.file, required this.onSourceSelected, this.isInvalid = false});

  void _showPicker(BuildContext context) {
    showModalBottomSheet(
      context: context, backgroundColor: Colors.transparent, useSafeArea: true,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(ctx).padding.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 40, height: 4, decoration: BoxDecoration(color: kBorder, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 18),
          Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: kInk)),
          const SizedBox(height: 16),
          _PickerOption(icon: Icons.camera_alt_rounded, label: 'Take Photo', color: kPurple, bg: kPurpleLight, onTap: () { Navigator.pop(ctx); onSourceSelected('camera'); }),
          const SizedBox(height: 10),
          _PickerOption(icon: Icons.photo_library_rounded, label: 'Upload from Gallery', color: kPurple, bg: kPurpleLight, onTap: () { Navigator.pop(ctx); onSourceSelected('gallery'); }),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return GestureDetector(
      onTap: () => _showPicker(context),
      child: Container(
        width: double.infinity,
        height: s.d(180),
        decoration: BoxDecoration(
          color: isInvalid ? kRoseLight.withOpacity(0.3) : (selected ? kPurpleLight : kSurface),
          borderRadius: BorderRadius.circular(s.s(14)),
          border: Border.all(color: isInvalid ? kRose : (selected ? kPurple : kBorder), width: (isInvalid || selected) ? 1.5 : 1),
        ),
        child: file != null
            ? ClipRRect(
                borderRadius: BorderRadius.circular(s.s(13)),
                child: Stack(fit: StackFit.expand, children: [
                  Image.file(file!, fit: BoxFit.cover),
                  Positioned(top: s.s(8), right: s.s(8),
                    child: Container(
                      width: s.d(26), height: s.d(26),
                      decoration: BoxDecoration(color: kPurple, borderRadius: BorderRadius.circular(s.s(13))),
                      child: Icon(Icons.check_rounded, color: Colors.white, size: s.d(16)),
                    ),
                  ),
                  Positioned(bottom: 0, left: 0, right: 0,
                    child: Container(
                      padding: EdgeInsets.symmetric(vertical: s.s(8)),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.4),
                        borderRadius: BorderRadius.vertical(bottom: Radius.circular(s.s(13))),
                      ),
                      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Icon(Icons.camera_alt_rounded, color: Colors.white, size: s.d(14)),
                        SizedBox(width: s.s(6)),
                        Text('Tap to retake', style: TextStyle(color: Colors.white, fontSize: s.f(12), fontWeight: FontWeight.w600)),
                      ]),
                    ),
                  ),
                ]),
              )
            : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.credit_card_rounded, size: s.d(40), color: kInkFaint),
                SizedBox(height: s.s(10)),
                Text(label, style: TextStyle(fontSize: s.f(13), fontWeight: FontWeight.w700, color: kInkFaint)),
                SizedBox(height: s.s(4)),
                Text('Tap to upload', style: TextStyle(fontSize: s.f(11.5), color: kInkFaint)),
              ]),
      ),
    );
  }
}

// ── Step 3: Review — shows ALL fields ────────────────────────────────────────
class _ReviewStep extends StatelessWidget {
  final String name, age, phone, height, weight, brothers, sisters, houseSize, institute, about, lookingFor;
  final String? gender, city, caste, sect, education, profession, maritalStatus;
  final String? language;
  final String? practiceLevel, hijabOrBeard, monthlyIncome, employmentType, complexion;
  final String? fatherAlive, motherAlive, fatherOccupation, motherOccupation, hasCar, hasDisability, physicallyActive, smoker;
  final String? degreeTitle, degreeTitle2, degreeTitle3;
  final String? institute2, institute3;
  final String? hasKids, hasSiblings, disabilityDetails;
  final String? homeType, location, cnic, carName, country;
  final String? marriageNumber;
  final String? hasOtherProperty, otherProperty, professionCustom;
  final TextEditingController adminNotesCtrl;
  final TextEditingController? affiliateCtrl;
  final TextEditingController? couponCtrl;
  final File? profilePhotoFile, cnicFrontFile, cnicBackFile;
  final File? degreeCertFile, degreeCert2File, degreeCert3File;

  const _ReviewStep({
    super.key,
    required this.name, required this.age, required this.phone, required this.height,
    required this.weight, required this.brothers, required this.sisters,
    required this.houseSize, required this.institute, required this.about, required this.lookingFor,
    this.language,
    this.gender, this.city, this.caste, this.sect, this.education, this.profession, this.maritalStatus,
    this.practiceLevel, this.hijabOrBeard, this.monthlyIncome, this.employmentType, this.complexion,
    this.fatherAlive, this.motherAlive, this.fatherOccupation, this.motherOccupation, this.hasCar, this.hasDisability, this.physicallyActive, this.smoker,
    this.degreeTitle, this.degreeTitle2, this.degreeTitle3,
    this.institute2, this.institute3,
    this.hasKids, this.hasSiblings, this.disabilityDetails,
    this.homeType, this.location, this.cnic, this.carName, this.country,
    this.marriageNumber,
    this.hasOtherProperty, this.otherProperty, this.professionCustom,
    required this.adminNotesCtrl,
    this.affiliateCtrl,
    this.couponCtrl,
    this.profilePhotoFile, this.cnicFrontFile, this.cnicBackFile,
    this.degreeCertFile, this.degreeCert2File, this.degreeCert3File,
  });

  Widget _secDark(BuildContext context, String t) {
    final s = _S.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(0, s.s(20), 0, s.s(12)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(t, style: TextStyle(fontSize: s.f(12), fontWeight: FontWeight.w800, color: kInk, letterSpacing: 0.8)),
        SizedBox(height: s.s(6)),
        const Divider(color: kBorder, height: 1),
      ]),
    );
  }

  Widget _secLight(BuildContext context, String t, {bool first = false}) {
    final s = _S.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(0, first ? s.s(12) : s.s(20), 0, s.s(10)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (!first) const Divider(color: kBorder, height: 1),
        if (!first) SizedBox(height: s.s(10)),
        Text(t, style: TextStyle(fontSize: s.f(11), fontWeight: FontWeight.w700, color: kInkFaint, letterSpacing: 0.8)),
      ]),
    );
  }

  Widget _sub(BuildContext context, String label, String value, {File? file}) {
    final s = _S.of(context);
    return Padding(
      padding: EdgeInsets.only(left: s.s(16), top: s.s(2), bottom: s.s(6)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('↳ ', style: TextStyle(fontSize: s.f(11), color: kInkFaint)),
        SizedBox(width: s.d(104), child: Text(label, style: TextStyle(fontSize: s.f(12), color: kInkFaint, fontWeight: FontWeight.w500))),
        Expanded(child: Text(value, style: TextStyle(fontSize: s.f(12.5), color: kInk, fontWeight: FontWeight.w600), textAlign: TextAlign.right)),
        if (file != null) ...[
          SizedBox(width: s.s(8)),
          GestureDetector(
            onTap: () => showDialog(
              context: context,
              barrierColor: Colors.black.withOpacity(0.85),
              builder: (dialogCtx) => GestureDetector(
                onTap: () => Navigator.pop(dialogCtx),
                child: Scaffold(
                  backgroundColor: Colors.transparent,
                  body: Stack(children: [
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: GestureDetector(
                          onTap: () {},
                          child: ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.file(file, fit: BoxFit.contain)),
                        ),
                      ),
                    ),
                    Positioned(
                      top: 20, right: 20,
                      child: GestureDetector(
                        onTap: () => Navigator.pop(dialogCtx),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                          child: const Text('✕ Close', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
            child: Text('View', style: TextStyle(fontSize: s.f(12), fontWeight: FontWeight.w600, color: kPurple, decoration: TextDecoration.underline)),
          ),
        ],
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    // Whichever subsection ends up genuinely first (some get skipped
    // entirely when nothing was filled in for them) shouldn't draw its
    // own leading divider — otherwise it sits right under ADDITIONAL
    // INFO's own divider with nothing in between, looking like a stray
    // double line.
    final firstSubsection = (fatherAlive != null || motherAlive != null || hasSiblings != null)
        ? 'family'
        : (education != null || (degreeTitle != null && degreeTitle!.isNotEmpty) || institute.isNotEmpty || degreeCertFile != null ||
            (degreeTitle2 != null && degreeTitle2!.isNotEmpty) || (institute2 != null && institute2!.isNotEmpty) || degreeCert2File != null ||
            (degreeTitle3 != null && degreeTitle3!.isNotEmpty) || (institute3 != null && institute3!.isNotEmpty) || degreeCert3File != null)
            ? 'education'
            : (employmentType != null || monthlyIncome != null)
                ? 'career'
                : (weight.isNotEmpty || complexion != null)
                    ? 'physical'
                    : (practiceLevel != null || hijabOrBeard != null)
                        ? 'religion'
                        : (hasCar != null || otherProperty != null)
                            ? 'assets'
                            : (hasDisability != null || physicallyActive != null || smoker != null)
                                ? 'health'
                                : '';
    return ListView(padding: EdgeInsets.all(s.s(20)), children: [
      _FormTitle(title: 'Review Your Proposal', icon: Icons.preview_rounded),
      SizedBox(height: s.s(16)),
      Container(
        padding: EdgeInsets.all(s.s(16)),
        decoration: BoxDecoration(color: kCardBg, borderRadius: BorderRadius.circular(s.s(16)), border: Border.all(color: kBorder)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // ── BASIC INFO ──
          _secDark(context, 'BASIC INFO'),
          Padding(
            padding: EdgeInsets.symmetric(vertical: s.s(7)),
            child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
              SizedBox(width: s.d(120), child: Text('Name', style: TextStyle(color: kInkLight, fontSize: s.f(12.5)))),
              Expanded(child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                Text(name.isEmpty ? '—' : name, style: TextStyle(color: kInk, fontWeight: FontWeight.w600, fontSize: s.f(13))),
              ])),
            ]),
          ),
          if (profilePhotoFile != null)
            _R('Profile Photo', ' ', file: profilePhotoFile),
          _R('Age', age.isEmpty ? '—' : age),
          _R('Gender', gender ?? '—'),
          _R('Height', height.isEmpty ? '—' : height),
          _R('Phone', phone.isEmpty ? '—' : phone),
          if (cnic != null && cnic!.isNotEmpty) _R('CNIC', cnic!),
          if (cnicFrontFile != null) _R('CNIC Front', ' ', file: cnicFrontFile),
          if (cnicBackFile != null) _R('CNIC Back', ' ', file: cnicBackFile),
          if (country != null && country!.isNotEmpty) _R('Country', country!),
          _R('City', city ?? '—'),
          if (homeType != null) _R('Home Type', homeType!),
          if (houseSize.isNotEmpty) _sub(context, 'Size', houseSize),
          if (location != null && location!.isNotEmpty) _sub(context, 'Location', location!),
          _R('Caste', caste ?? '—'),
          _R('Sect', sect ?? '—'),
          if (language != null && language!.isNotEmpty) _R('Native Language', language!),
          _R('Occupation', profession == 'Other' && professionCustom != null && professionCustom!.isNotEmpty ? professionCustom! : (profession ?? '—')),
          _R('Marital Status', maritalStatus ?? '—'),
          if (maritalStatus == 'Married' && marriageNumber != null)
            _sub(context, 'Looking for', marriageNumber!),
          if (hasKids != null) _R('Has Kids', hasKids!),
          if (hasKids == 'Yes') ...[
            if (brothers.isNotEmpty) _sub(context, 'Sons', brothers),
            if (sisters.isNotEmpty) _sub(context, 'Daughters', sisters),
          ],
          if (about.isNotEmpty) _R('About', about),
          if (lookingFor.isNotEmpty) _R('Looking For', lookingFor),

          // ── ADDITIONAL INFO ──
          if (fatherAlive != null || motherAlive != null || hasSiblings != null ||
              education != null || (degreeTitle != null && degreeTitle!.isNotEmpty) || institute.isNotEmpty || degreeCertFile != null ||
              (degreeTitle2 != null && degreeTitle2!.isNotEmpty) || (institute2 != null && institute2!.isNotEmpty) || degreeCert2File != null ||
              (degreeTitle3 != null && degreeTitle3!.isNotEmpty) || (institute3 != null && institute3!.isNotEmpty) || degreeCert3File != null ||
              employmentType != null || monthlyIncome != null ||
              weight.isNotEmpty || complexion != null ||
              practiceLevel != null || hijabOrBeard != null ||
              hasCar != null || otherProperty != null ||
              hasDisability != null || physicallyActive != null || smoker != null)
            _secDark(context, 'ADDITIONAL INFO'),

          // ── FAMILY ──
          if (fatherAlive != null || motherAlive != null || hasSiblings != null) ...[
            _secLight(context, 'FAMILY', first: firstSubsection == 'family'),
            if (fatherAlive != null) _R('Father', fatherAlive!),
            if (fatherOccupation != null)
              _sub(context, 'Occupation', fatherOccupation!),
            if (motherAlive != null) _R('Mother', motherAlive!),
            if (motherOccupation != null)
              _sub(context, 'Occupation', motherOccupation!),
            if (hasSiblings != null) _R('Siblings', hasSiblings!),
            if (hasSiblings == 'Yes') ...[
              if (brothers.isNotEmpty) _sub(context, 'Brothers', brothers),
              if (sisters.isNotEmpty) _sub(context, 'Sisters', sisters),
            ],
          ],

          // ── EDUCATION ──
          if (education != null || (degreeTitle != null && degreeTitle!.isNotEmpty) || institute.isNotEmpty || degreeCertFile != null ||
              (degreeTitle2 != null && degreeTitle2!.isNotEmpty) || (institute2 != null && institute2!.isNotEmpty) || degreeCert2File != null ||
              (degreeTitle3 != null && degreeTitle3!.isNotEmpty) || (institute3 != null && institute3!.isNotEmpty) || degreeCert3File != null) ...[
            _secLight(context, 'EDUCATION', first: firstSubsection == 'education'),
            if (education != null) _R('Education Level (Highest)', education!, labelWidth: 175),
            if (degreeTitle != null && degreeTitle!.isNotEmpty) _sub(context, 'Degree', degreeTitle!, file: degreeCertFile),
            if (institute.isNotEmpty) _sub(context, 'Institute', institute),
            if (degreeTitle2 != null && degreeTitle2!.isNotEmpty) _sub(context, 'Degree 2', degreeTitle2!, file: degreeCert2File),
            if (institute2 != null && institute2!.isNotEmpty) _sub(context, 'Institute 2', institute2!),
            if (degreeTitle3 != null && degreeTitle3!.isNotEmpty) _sub(context, 'Degree 3', degreeTitle3!, file: degreeCert3File),
            if (institute3 != null && institute3!.isNotEmpty) _sub(context, 'Institute 3', institute3!),
          ],

          // ── CAREER ──
          if (employmentType != null || monthlyIncome != null) ...[
            _secLight(context, 'CAREER', first: firstSubsection == 'career'),
            if (employmentType != null) _R('Employment Type', employmentType!),
            if (monthlyIncome != null) _R('Monthly Income', monthlyIncome!),
          ],

          // ── PHYSICAL ──
          if (weight.isNotEmpty || complexion != null) ...[
            _secLight(context, 'PHYSICAL', first: firstSubsection == 'physical'),
            if (weight.isNotEmpty) _R('Weight', weight + ' kg'),
            if (complexion != null) _R('Complexion', complexion!),
          ],

          // ── RELIGION ──
          if (practiceLevel != null || hijabOrBeard != null) ...[
            _secLight(context, 'RELIGION', first: firstSubsection == 'religion'),
            if (practiceLevel != null) _R('Religion Practice Level', practiceLevel!),
            if (hijabOrBeard != null) _R(gender?.toLowerCase() == 'female' ? 'Hijab' : 'Beard', hijabOrBeard!),
          ],

          // ── OTHER ASSETS ──
          if (hasCar != null || otherProperty != null) ...[
            _secLight(context, 'OTHER ASSETS', first: firstSubsection == 'assets'),
            if (hasCar != null) _R('Car', hasCar!),

            if (otherProperty != null) _R('Property', otherProperty!),
          ],

          // ── HEALTH ──
          if (hasDisability != null || physicallyActive != null || smoker != null) ...[
            _secLight(context, 'HEALTH', first: firstSubsection == 'health'),
            if (hasDisability != null) _R('Disability', hasDisability!),
            if (hasDisability == 'Yes' && disabilityDetails != null && disabilityDetails!.isNotEmpty)
              _sub(context, 'Details', disabilityDetails!),
            if (physicallyActive != null) _R('Lifestyle', physicallyActive!),
            if (smoker != null) _R('Smoker', smoker!),
          ],
        ]),
      ),
      SizedBox(height: s.s(20)),
      Text('Notes', style: TextStyle(fontSize: s.f(12.5), fontWeight: FontWeight.w700, color: kInkLight)),
      SizedBox(height: s.s(4)),
      Text('Any extra information you\'d like to share', style: TextStyle(fontSize: s.f(11.5), color: kInkFaint)),
      SizedBox(height: s.s(8)),
      Container(
        decoration: BoxDecoration(color: kCardBg, borderRadius: BorderRadius.circular(s.s(12)), border: Border.all(color: kBorder)),
        child: TextField(
          controller: adminNotesCtrl, maxLines: 4,
          style: TextStyle(fontSize: s.f(13.5), color: kInk),
          decoration: InputDecoration(
            hintText: 'e.g. preferred time to call, special requirements...',
            hintStyle: TextStyle(color: kInkFaint, fontSize: s.f(13)),
            border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.all(s.s(14)),
          ),
        ),
      ),
      SizedBox(height: s.s(16)),
      // ── Coupon Code ── (entered here at submission; the admin re-checks
      // it's still valid and not expired at approval time before applying it)
      if (couponCtrl != null) ...[
        Container(
          padding: EdgeInsets.all(s.s(14)),
          decoration: BoxDecoration(color: kAmberLight, borderRadius: BorderRadius.circular(s.s(12)), border: Border.all(color: kAmber.withOpacity(0.4))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.local_offer_rounded, size: s.d(16), color: kAmber),
              SizedBox(width: s.s(6)),
              Text('Have a Coupon Code?', style: TextStyle(fontSize: s.f(13), fontWeight: FontWeight.w800, color: kAmber)),
            ]),
            SizedBox(height: s.s(4)),
            Text('Get a discount or free days on your subscription — it\'s checked when your profile is approved.', style: TextStyle(fontSize: s.f(11), color: kInkLight)),
            SizedBox(height: s.s(10)),
            TextField(
              controller: couponCtrl,
              textCapitalization: TextCapitalization.characters,
              style: TextStyle(fontSize: s.f(14), fontWeight: FontWeight.w700, color: kAmber, letterSpacing: 2),
              decoration: InputDecoration(
                hintText: 'e.g. EID2026',
                hintStyle: const TextStyle(color: kInkFaint, fontWeight: FontWeight.w400, letterSpacing: 0),
                filled: true,
                fillColor: kCardBg,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(8)), borderSide: BorderSide.none),
                contentPadding: EdgeInsets.symmetric(horizontal: s.s(12), vertical: s.s(10)),
                isDense: true,
              ),
            ),
          ]),
        ),
        SizedBox(height: s.s(20)),
      ],
      // ── Referral Code ── (hidden when referral commission is disabled by admin)
      if (SupabaseService.instance.cachedSettings['referral_enabled'] != 'false') ...[
        Container(
          padding: EdgeInsets.all(s.s(14)),
          decoration: BoxDecoration(color: kPurpleLight, borderRadius: BorderRadius.circular(s.s(12)), border: Border.all(color: kPurpleMid)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.handshake_rounded, size: s.d(16), color: kPurple),
              SizedBox(width: s.s(6)),
              Text('Have a Referral Code?', style: TextStyle(fontSize: s.f(13), fontWeight: FontWeight.w800, color: kPurple)),
            ]),
            SizedBox(height: s.s(4)),
            Text('If someone referred you to Jor, enter their code to support them.', style: TextStyle(fontSize: s.f(11), color: kInkLight)),
            SizedBox(height: s.s(10)),
            if (affiliateCtrl != null)
              TextField(
                controller: affiliateCtrl!,
                textCapitalization: TextCapitalization.characters,
                style: TextStyle(fontSize: s.f(14), fontWeight: FontWeight.w700, color: kPurple, letterSpacing: 2),
                decoration: InputDecoration(
                  hintText: 'e.g. A3K9BZ',
                  hintStyle: const TextStyle(color: kInkFaint, fontWeight: FontWeight.w400, letterSpacing: 0),
                  filled: true,
                  fillColor: kCardBg,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(8)), borderSide: BorderSide.none),
                  contentPadding: EdgeInsets.symmetric(horizontal: s.s(12), vertical: s.s(10)),
                  isDense: true,
                ),
              ),
          ]),
        ),
        SizedBox(height: s.s(20)),
      ],
    ]);
  }
}

class _R extends StatelessWidget {
  final String label, value;
  final File? file;
  final File? secondFile; // for CNIC front+back shown together
  final double? labelWidth;
  const _R(this.label, this.value, {this.file, this.secondFile, this.labelWidth});

  // Matches the website's own review-step image viewer exactly: a dark
  // 85%-opacity overlay, tap-outside-to-close, image capped at 90% of
  // screen height with rounded corners, and a translucent "✕ Close" pill
  // top-right — same interaction, same look, just the Flutter equivalent.
  void _showFilePopup(BuildContext context) {
    showDialog(
      context: context,
      barrierColor: Colors.black.withOpacity(0.85),
      builder: (dialogCtx) => GestureDetector(
        onTap: () => Navigator.pop(dialogCtx),
        child: Scaffold(
          backgroundColor: Colors.transparent,
          body: Stack(children: [
            Center(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: GestureDetector(
                  onTap: () {}, // absorb taps on the image itself
                  child: SingleChildScrollView(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      ClipRRect(borderRadius: BorderRadius.circular(12),
                        child: Image.file(file!, fit: BoxFit.contain)),
                      if (secondFile != null) ...[
                        const SizedBox(height: 8),
                        ClipRRect(borderRadius: BorderRadius.circular(12),
                          child: Image.file(secondFile!, fit: BoxFit.contain)),
                      ],
                    ]),
                  ),
                ),
              ),
            ),
            Positioned(
              top: 20, right: 20,
              child: GestureDetector(
                onTap: () => Navigator.pop(dialogCtx),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                  child: const Text('✕ Close', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return Padding(
      padding: EdgeInsets.symmetric(vertical: s.s(7)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: s.d(labelWidth ?? 120), child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: kInkLight, fontSize: s.f(12.5)))),
        Expanded(child: Text(value, style: TextStyle(color: kInk, fontWeight: FontWeight.w600, fontSize: s.f(13)), textAlign: TextAlign.right)),
        if (file != null) ...[
          SizedBox(width: s.s(8)),
          GestureDetector(
            onTap: () => _showFilePopup(context),
            child: Text('View', style: TextStyle(fontSize: s.f(13), fontWeight: FontWeight.w600, color: kPurple, decoration: TextDecoration.underline)),
          ),
        ],
      ]),
    );
  }
}

// ── Shared form widgets ───────────────────────────────────────────────────────
class _FormTitle extends StatelessWidget {
  final String title; final String? subtitle; final IconData icon;
  final Color iconColor; final Color iconBg;
  const _FormTitle({required this.title, this.subtitle, required this.icon, this.iconColor = kPurple, this.iconBg = kPurpleLight});
  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
      Container(width: s.d(40), height: s.d(40), decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(s.s(12))), child: Icon(icon, color: iconColor, size: s.d(20))),
      SizedBox(width: s.s(12)),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: TextStyle(fontSize: s.f(16), fontWeight: FontWeight.w800, color: kInk)),
        if (subtitle != null) Text(subtitle!, style: TextStyle(fontSize: s.f(12), color: kInkFaint)),
      ]),
    ]);
  }
}

// ── Degree fields — expandable like phone 2 ───────────────────────────────────
class _DegreeFields extends StatefulWidget {
  final TextEditingController degreeTitleCtrl, instituteCtrl;
  final TextEditingController degreeTitle2Ctrl, institute2Ctrl;
  final TextEditingController degreeTitle3Ctrl, institute3Ctrl;
  final ValueChanged<File?> onCert1Picked, onCert2Picked, onCert3Picked;
  const _DegreeFields({
    required this.degreeTitleCtrl, required this.instituteCtrl,
    required this.degreeTitle2Ctrl, required this.institute2Ctrl,
    required this.degreeTitle3Ctrl, required this.institute3Ctrl,
    required this.onCert1Picked, required this.onCert2Picked, required this.onCert3Picked,
  });
  @override State<_DegreeFields> createState() => _DegreeFieldsState();
}
class _DegreeFieldsState extends State<_DegreeFields> {
  bool _show2 = false;
  bool _show3 = false;
  File? _cert1, _cert2, _cert3;

  @override
  void initState() {
    super.initState();
    if (widget.degreeTitle2Ctrl.text.isNotEmpty || widget.institute2Ctrl.text.isNotEmpty) _show2 = true;
    if (widget.degreeTitle3Ctrl.text.isNotEmpty || widget.institute3Ctrl.text.isNotEmpty) _show3 = true;
  }

  Future<void> _pickCert(int slot) async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85, maxWidth: 1600);
    if (picked == null) return;
    final file = File(picked.path);
    setState(() {
      if (slot == 1) { _cert1 = file; widget.onCert1Picked(file); }
      if (slot == 2) { _cert2 = file; widget.onCert2Picked(file); }
      if (slot == 3) { _cert3 = file; widget.onCert3Picked(file); }
    });
  }

  void _removeCert(int slot) {
    setState(() {
      if (slot == 1) { _cert1 = null; widget.onCert1Picked(null); }
      if (slot == 2) { _cert2 = null; widget.onCert2Picked(null); }
      if (slot == 3) { _cert3 = null; widget.onCert3Picked(null); }
    });
  }

  Widget _certButton(int slot, File? file) => Padding(
    padding: const EdgeInsets.only(top: 4, bottom: 4),
    child: Row(children: [
      Expanded(
        child: GestureDetector(
          onTap: () => _pickCert(slot),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(file != null ? Icons.check_circle_rounded : Icons.upload_rounded, size: 15, color: kPurple),
            const SizedBox(width: 6),
            Flexible(child: Text(file != null ? 'Certificate selected — tap to change' : 'Upload Degree Certificate (optional)',
              style: TextStyle(fontSize: 12.5, color: kPurple.withOpacity(0.85), fontWeight: FontWeight.w500))),
          ]),
        ),
      ),
      if (file != null) ...[
        const SizedBox(width: 10),
        GestureDetector(
          onTap: () => _showLocalCertPopup(file),
          child: Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(color: kPurpleLight, borderRadius: BorderRadius.circular(6)),
            child: const Icon(Icons.remove_red_eye_outlined, size: 14, color: kPurple),
          ),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: () => _removeCert(slot),
          child: Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(color: Colors.red.withOpacity(0.08), borderRadius: BorderRadius.circular(6)),
            child: Icon(Icons.close_rounded, size: 14, color: Colors.red.withOpacity(0.7)),
          ),
        ),
      ],
    ]),
  );

  // Same dark-overlay, tap-outside-to-close popup pattern used everywhere
  // else — previews the just-picked local file before it's even uploaded.
  void _showLocalCertPopup(File file) {
    showDialog(
      context: context,
      barrierColor: Colors.black.withOpacity(0.85),
      builder: (dialogCtx) => GestureDetector(
        onTap: () => Navigator.pop(dialogCtx),
        child: Scaffold(
          backgroundColor: Colors.transparent,
          body: Stack(children: [
            Center(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: GestureDetector(
                  onTap: () {},
                  child: ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.file(file, fit: BoxFit.contain)),
                ),
              ),
            ),
            Positioned(
              top: 20, right: 20,
              child: GestureDetector(
                onTap: () => Navigator.pop(dialogCtx),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                  child: const Text('✕ Close', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  void _remove2() {
    widget.degreeTitle2Ctrl.clear();
    widget.institute2Ctrl.clear();
    widget.degreeTitle3Ctrl.clear();
    widget.institute3Ctrl.clear();
    setState(() { _show2 = false; _show3 = false; _cert2 = null; _cert3 = null; });
    widget.onCert2Picked(null);
    widget.onCert3Picked(null);
  }

  void _remove3() {
    widget.degreeTitle3Ctrl.clear();
    widget.institute3Ctrl.clear();
    setState(() { _show3 = false; _cert3 = null; });
    widget.onCert3Picked(null);
  }

  Widget _pair(TextEditingController degCtrl, TextEditingController instCtrl, Widget certButton) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: const Color(0xFFF8F7FF),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: const Color(0xFFE8E6F5)),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _AppTextField(controller: degCtrl, label: 'Title', hint: 'e.g. BS Computer Science'),
      const SizedBox(height: 8),
      _AppTextField(controller: instCtrl, label: 'Institute', hint: 'e.g. University of Punjab'),
      const SizedBox(height: 14),
      certButton,
    ]),
  );

  Widget _addMore(String label, VoidCallback onTap) => GestureDetector(
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(children: [
        Icon(Icons.add_circle_outline_rounded, size: 15, color: kPurple.withOpacity(0.7)),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(fontSize: 13, color: kPurple.withOpacity(0.8), fontWeight: FontWeight.w500)),
      ]),
    ),
  );

  Widget _header(String label, VoidCallback onRemove) => Row(children: [
    Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kInkLight)),
    const Spacer(),
    InkWell(
      onTap: onRemove,
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.close_rounded, size: 14, color: Colors.redAccent.withOpacity(0.7)),
          const SizedBox(width: 3),
          Text('Remove', style: TextStyle(fontSize: 12, color: Colors.redAccent.withOpacity(0.7))),
        ]),
      ),
    ),
  ]);

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Degree', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kInkLight)),
      const SizedBox(height: 6),
      _pair(widget.degreeTitleCtrl, widget.instituteCtrl, _certButton(1, _cert1)),
      if (_show2) ...[
        const SizedBox(height: 10),
        _header('Degree 2', _remove2),
        const SizedBox(height: 6),
        _pair(widget.degreeTitle2Ctrl, widget.institute2Ctrl, _certButton(2, _cert2)),
      ],
      if (_show2 && _show3) ...[
        const SizedBox(height: 10),
        _header('Degree 3', _remove3),
        const SizedBox(height: 6),
        _pair(widget.degreeTitle3Ctrl, widget.institute3Ctrl, _certButton(3, _cert3)),
      ],
      if (!_show2) ...[
        const SizedBox(height: 12),
        _addMore('Add another degree', () => setState(() => _show2 = true)),
      ],
      if (_show2 && !_show3) ...[
        const SizedBox(height: 12),
        _addMore('Add another degree', () => setState(() => _show3 = true)),
      ],
    ]);
  }
}

class _AppTextField extends StatefulWidget {
  final TextEditingController controller;
  final String label, hint;
  final bool isNumber;
  final int maxLines;
  final int? maxLength;
  final bool showCounter;
  final bool isInvalid;
  const _AppTextField({required this.controller, required this.label, required this.hint, this.isNumber = false, this.maxLines = 1, this.maxLength, this.showCounter = true, this.isInvalid = false});
  @override State<_AppTextField> createState() => _AppTextFieldState();
}
class _AppTextFieldState extends State<_AppTextField> {
  int _charCount = 0;
  @override void initState() { super.initState(); _charCount = widget.controller.text.length; widget.controller.addListener(_onChanged); }
  void _onChanged() { if (widget.maxLength != null) setState(() => _charCount = widget.controller.text.length); }
  @override void dispose() { widget.controller.removeListener(_onChanged); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    final borderColor = widget.isInvalid ? kRose : kBorder;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text(widget.label, style: TextStyle(fontSize: s.f(12.5), fontWeight: FontWeight.w700, color: kInkLight)),
        if (widget.isInvalid) ...[
          SizedBox(width: s.s(6)),
          Icon(Icons.error_rounded, color: kRose, size: s.d(14)),
        ],
      ]),
      SizedBox(height: s.s(6)),
      Stack(children: [
        TextFormField(
          controller: widget.controller, maxLines: widget.maxLines, maxLength: widget.maxLength,
          maxLengthEnforcement: widget.maxLength != null ? MaxLengthEnforcement.enforced : null,
          keyboardType: widget.isNumber ? TextInputType.number : TextInputType.text,
          style: TextStyle(fontSize: s.f(14), color: kInk, fontWeight: FontWeight.w500),
          decoration: InputDecoration(
            hintText: widget.hint, hintStyle: TextStyle(color: kInkFaint, fontSize: s.f(13.5)),
            filled: true, fillColor: widget.isInvalid ? kRoseLight.withOpacity(0.3) : kCardBg, counterText: '', isDense: true,
            contentPadding: EdgeInsets.fromLTRB(s.s(14), s.s(12), s.s(14), s.s(12)),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: BorderSide(color: borderColor, width: widget.isInvalid ? 1.5 : 1)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: BorderSide(color: borderColor, width: widget.isInvalid ? 1.5 : 1)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: BorderSide(color: widget.isInvalid ? kRose : kPurple, width: 1.5)),
          ),
        ),
        if (widget.maxLength != null && widget.showCounter)
          Positioned(bottom: s.s(8), right: s.s(12),
            child: Text('$_charCount/${widget.maxLength}', style: TextStyle(fontSize: s.f(11), color: _charCount == widget.maxLength ? kRose : kInkFaint))),
      ]),
    ]);
  }
}


// ── Multi-Select Field ────────────────────────────────────────────────────────
class _MultiSelectField extends StatelessWidget {
  final String label;
  final List<String> selected;
  final List<String> options;
  final ValueChanged<List<String>> onChanged;

  const _MultiSelectField({
    required this.label,
    required this.selected,
    required this.options,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: s.f(12), fontWeight: FontWeight.w600, color: const Color(0xFF3D2B6B))),
        SizedBox(height: s.s(8)),
        Wrap(
          spacing: s.s(8),
          runSpacing: s.s(8),
          children: options.map((opt) {
            final sel = selected.contains(opt);
            return GestureDetector(
              onTap: () {
                final updated = List<String>.from(selected);
                if (sel) updated.remove(opt); else updated.add(opt);
                onChanged(updated);
              },
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
                child: Text(opt, style: TextStyle(
                  fontSize: s.f(13),
                  fontWeight: sel ? FontWeight.w700 : FontWeight.w500,
                  color: sel ? kPurple : kInkLight,
                )),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

class _DropdownField extends StatelessWidget {
  final String label; final String? value; final List<String> options; final ValueChanged<String?> onChanged;
  final bool isInvalid;
  final String? infoText;
  const _DropdownField({required this.label, this.value, required this.options, required this.onChanged, this.isInvalid = false, this.infoText});

  void _showInfo(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: kInk)),
        content: Text(infoText ?? '', style: const TextStyle(fontSize: 13.5, color: kInkLight, height: 1.5)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Got it', style: TextStyle(color: kPurple, fontWeight: FontWeight.w700))),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    final borderColor = isInvalid ? kRose : kBorder;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text(label, style: TextStyle(fontSize: s.f(12.5), fontWeight: FontWeight.w700, color: kInkLight)),
        if (infoText != null) ...[
          SizedBox(width: s.s(5)),
          GestureDetector(
            onTap: () => _showInfo(context),
            behavior: HitTestBehavior.opaque,
            child: Icon(Icons.info_outline_rounded, color: kInkFaint, size: s.d(15)),
          ),
        ],
        if (isInvalid) ...[
          SizedBox(width: s.s(6)),
          Icon(Icons.error_rounded, color: kRose, size: s.d(14)),
        ],
      ]),
      SizedBox(height: s.s(6)),
      DropdownButtonFormField<String>(
        value: value,
        hint: Text('Select $label', style: TextStyle(color: kInkFaint, fontSize: s.f(13.5))),
        items: [
          DropdownMenuItem<String>(value: null, child: Text('— Clear —', style: TextStyle(color: kInkFaint, fontSize: s.f(13.5)))),
          ...options.map((o) => DropdownMenuItem(value: o, child: Text(o))),
        ],
        onChanged: onChanged,
        style: TextStyle(fontSize: s.f(14), color: kInk, fontWeight: FontWeight.w500),
        decoration: InputDecoration(
          filled: true, fillColor: isInvalid ? kRoseLight.withOpacity(0.3) : kCardBg,
          contentPadding: EdgeInsets.symmetric(horizontal: s.s(14), vertical: s.s(12)),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: BorderSide(color: borderColor, width: isInvalid ? 1.5 : 1)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: BorderSide(color: borderColor, width: isInvalid ? 1.5 : 1)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: BorderSide(color: isInvalid ? kRose : kPurple, width: 1.5)),
        ),
        dropdownColor: kCardBg, borderRadius: BorderRadius.circular(s.s(12)),
        icon: const Icon(Icons.keyboard_arrow_down_rounded, color: kInkLight),
      ),
    ]);
  }
}

// ── SearchableGroupedDropdown (unchanged) ─────────────────────────────────────
// All world countries grouped alphabetically (for country dropdown)
Map<String, List<String>> get kCountriesGrouped {
  final map = <String, List<String>>{};
  for (final c in _CountryCode.all) {
    if (c.name == 'Pakistan') continue; // Pakistan = local, not overseas
    final key = c.name[0].toUpperCase();
    map.putIfAbsent(key, () => []).add(c.name);
  }
  return Map.fromEntries(map.entries.toList()..sort((a, b) => a.key.compareTo(b.key)));
}

class _PI extends StatelessWidget {
  final String label; final bool selected; final VoidCallback onTap;
  const _PI({required this.label, required this.selected, required this.onTap});
  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return GestureDetector(onTap: onTap,
      child: Container(color: selected ? kPurpleLight : Colors.transparent,
        padding: EdgeInsets.symmetric(horizontal: s.s(20), vertical: s.s(13)),
        child: Row(children: [
          Expanded(child: Text(label, style: TextStyle(fontSize: s.f(14), color: selected ? kPurple : kInk, fontWeight: selected ? FontWeight.w700 : FontWeight.w500))),
          if (selected) Icon(Icons.check_rounded, size: s.d(18), color: kPurple),
        ])));
  }
}

// ── CNIC field with auto-hyphen (XXXXX-XXXXXXX-X) ────────────────────────────
class _CnicField extends StatefulWidget {
  final TextEditingController controller;
  const _CnicField({required this.controller});
  @override State<_CnicField> createState() => _CnicFieldState();
}
class _CnicFieldState extends State<_CnicField> {
  int _digits = 0;
  @override void initState() { super.initState(); widget.controller.addListener(_update); }
  void _update() => setState(() => _digits = widget.controller.text.replaceAll('-', '').length);
  @override void dispose() { widget.controller.removeListener(_update); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    final complete = _digits == 13;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('CNIC *', style: TextStyle(fontSize: s.f(12.5), fontWeight: FontWeight.w700, color: kInkLight)),
      SizedBox(height: s.s(6)),
      Stack(children: [
        TextFormField(
          controller: widget.controller,
          keyboardType: TextInputType.number,
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[\d-]')),
            _CnicFormatter(),
          ],
          style: TextStyle(fontSize: s.f(14), color: kInk, fontWeight: FontWeight.w500),
          decoration: InputDecoration(
            hintText: '35202-1234567-1',
            hintStyle: TextStyle(color: kInkFaint, fontSize: s.f(13.5)),
            filled: true, fillColor: kCardBg, isDense: true,
            contentPadding: EdgeInsets.fromLTRB(s.s(14), s.s(12), s.s(48), s.s(12)),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: const BorderSide(color: kBorder)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: const BorderSide(color: kBorder)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: const BorderSide(color: kPurple, width: 1.5)),
          ),
        ),
        Positioned(right: s.s(10), top: 0, bottom: 0,
          child: Center(child: _digits == 0
            ? const SizedBox.shrink()
            : complete
              ? Icon(Icons.check_circle_rounded, size: s.d(18), color: kGreen)
              : Text('$_digits/13', style: TextStyle(fontSize: s.f(11), color: _digits > 0 ? kInkFaint : kRose, fontWeight: FontWeight.w600)),
          ),
        ),
      ]),
    ]);
  }
}

class _CnicFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    // Strip everything except digits
    final digits = newValue.text.replaceAll('-', '');
    if (digits.length > 13) {
      // Don't allow more than 13 digits total
      return oldValue;
    }

    // Build formatted string: XXXXX-XXXXXXX-X
    final buf = StringBuffer();
    for (int i = 0; i < digits.length; i++) {
      if (i == 5 || i == 12) buf.write('-');
      buf.write(digits[i]);
    }

    final formatted = buf.toString();
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

// ── Country code model ────────────────────────────────────────────────────────
class _CountryCode {
  final String flag, name, dialCode;
  const _CountryCode({required this.flag, required this.name, required this.dialCode});

  static const pakistan     = _CountryCode(flag: '🇵🇰', name: 'Pakistan',             dialCode: '+92');

  static const all = <_CountryCode>[
    _CountryCode(flag: '🇵🇰', name: 'Pakistan',                dialCode: '+92'),
    _CountryCode(flag: '🇦🇫', name: 'Afghanistan',             dialCode: '+93'),
    _CountryCode(flag: '🇦🇱', name: 'Albania',                 dialCode: '+355'),
    _CountryCode(flag: '🇩🇿', name: 'Algeria',                 dialCode: '+213'),
    _CountryCode(flag: '🇦🇩', name: 'Andorra',                 dialCode: '+376'),
    _CountryCode(flag: '🇦🇴', name: 'Angola',                  dialCode: '+244'),
    _CountryCode(flag: '🇦🇬', name: 'Antigua & Barbuda',       dialCode: '+1268'),
    _CountryCode(flag: '🇦🇷', name: 'Argentina',               dialCode: '+54'),
    _CountryCode(flag: '🇦🇲', name: 'Armenia',                 dialCode: '+374'),
    _CountryCode(flag: '🇦🇺', name: 'Australia',               dialCode: '+61'),
    _CountryCode(flag: '🇦🇹', name: 'Austria',                 dialCode: '+43'),
    _CountryCode(flag: '🇦🇿', name: 'Azerbaijan',              dialCode: '+994'),
    _CountryCode(flag: '🇧🇸', name: 'Bahamas',                 dialCode: '+1242'),
    _CountryCode(flag: '🇧🇭', name: 'Bahrain',                 dialCode: '+973'),
    _CountryCode(flag: '🇧🇩', name: 'Bangladesh',              dialCode: '+880'),
    _CountryCode(flag: '🇧🇧', name: 'Barbados',                dialCode: '+1246'),
    _CountryCode(flag: '🇧🇾', name: 'Belarus',                 dialCode: '+375'),
    _CountryCode(flag: '🇧🇪', name: 'Belgium',                 dialCode: '+32'),
    _CountryCode(flag: '🇧🇿', name: 'Belize',                  dialCode: '+501'),
    _CountryCode(flag: '🇧🇯', name: 'Benin',                   dialCode: '+229'),
    _CountryCode(flag: '🇧🇹', name: 'Bhutan',                  dialCode: '+975'),
    _CountryCode(flag: '🇧🇴', name: 'Bolivia',                 dialCode: '+591'),
    _CountryCode(flag: '🇧🇦', name: 'Bosnia & Herzegovina',    dialCode: '+387'),
    _CountryCode(flag: '🇧🇼', name: 'Botswana',                dialCode: '+267'),
    _CountryCode(flag: '🇧🇷', name: 'Brazil',                  dialCode: '+55'),
    _CountryCode(flag: '🇧🇳', name: 'Brunei',                  dialCode: '+673'),
    _CountryCode(flag: '🇧🇬', name: 'Bulgaria',                dialCode: '+359'),
    _CountryCode(flag: '🇧🇫', name: 'Burkina Faso',            dialCode: '+226'),
    _CountryCode(flag: '🇧🇮', name: 'Burundi',                 dialCode: '+257'),
    _CountryCode(flag: '🇨🇻', name: 'Cabo Verde',              dialCode: '+238'),
    _CountryCode(flag: '🇰🇭', name: 'Cambodia',                dialCode: '+855'),
    _CountryCode(flag: '🇨🇲', name: 'Cameroon',                dialCode: '+237'),
    _CountryCode(flag: '🇨🇦', name: 'Canada',                  dialCode: '+1'),
    _CountryCode(flag: '🇨🇫', name: 'Central African Republic',dialCode: '+236'),
    _CountryCode(flag: '🇹🇩', name: 'Chad',                    dialCode: '+235'),
    _CountryCode(flag: '🇨🇱', name: 'Chile',                   dialCode: '+56'),
    _CountryCode(flag: '🇨🇳', name: 'China',                   dialCode: '+86'),
    _CountryCode(flag: '🇨🇴', name: 'Colombia',                dialCode: '+57'),
    _CountryCode(flag: '🇰🇲', name: 'Comoros',                 dialCode: '+269'),
    _CountryCode(flag: '🇨🇬', name: 'Congo',                   dialCode: '+242'),
    _CountryCode(flag: '🇨🇩', name: 'Congo (DR)',              dialCode: '+243'),
    _CountryCode(flag: '🇨🇷', name: 'Costa Rica',              dialCode: '+506'),
    _CountryCode(flag: '🇭🇷', name: 'Croatia',                 dialCode: '+385'),
    _CountryCode(flag: '🇨🇺', name: 'Cuba',                    dialCode: '+53'),
    _CountryCode(flag: '🇨🇾', name: 'Cyprus',                  dialCode: '+357'),
    _CountryCode(flag: '🇨🇿', name: 'Czech Republic',          dialCode: '+420'),
    _CountryCode(flag: '🇩🇰', name: 'Denmark',                 dialCode: '+45'),
    _CountryCode(flag: '🇩🇯', name: 'Djibouti',                dialCode: '+253'),
    _CountryCode(flag: '🇩🇲', name: 'Dominica',                dialCode: '+1767'),
    _CountryCode(flag: '🇩🇴', name: 'Dominican Republic',      dialCode: '+1809'),
    _CountryCode(flag: '🇪🇨', name: 'Ecuador',                 dialCode: '+593'),
    _CountryCode(flag: '🇪🇬', name: 'Egypt',                   dialCode: '+20'),
    _CountryCode(flag: '🇸🇻', name: 'El Salvador',             dialCode: '+503'),
    _CountryCode(flag: '🇬🇶', name: 'Equatorial Guinea',       dialCode: '+240'),
    _CountryCode(flag: '🇪🇷', name: 'Eritrea',                 dialCode: '+291'),
    _CountryCode(flag: '🇪🇪', name: 'Estonia',                 dialCode: '+372'),
    _CountryCode(flag: '🇸🇿', name: 'Eswatini',                dialCode: '+268'),
    _CountryCode(flag: '🇪🇹', name: 'Ethiopia',                dialCode: '+251'),
    _CountryCode(flag: '🇫🇯', name: 'Fiji',                    dialCode: '+679'),
    _CountryCode(flag: '🇫🇮', name: 'Finland',                 dialCode: '+358'),
    _CountryCode(flag: '🇫🇷', name: 'France',                  dialCode: '+33'),
    _CountryCode(flag: '🇬🇦', name: 'Gabon',                   dialCode: '+241'),
    _CountryCode(flag: '🇬🇲', name: 'Gambia',                  dialCode: '+220'),
    _CountryCode(flag: '🇬🇪', name: 'Georgia',                 dialCode: '+995'),
    _CountryCode(flag: '🇩🇪', name: 'Germany',                 dialCode: '+49'),
    _CountryCode(flag: '🇬🇭', name: 'Ghana',                   dialCode: '+233'),
    _CountryCode(flag: '🇬🇷', name: 'Greece',                  dialCode: '+30'),
    _CountryCode(flag: '🇬🇩', name: 'Grenada',                 dialCode: '+1473'),
    _CountryCode(flag: '🇬🇹', name: 'Guatemala',               dialCode: '+502'),
    _CountryCode(flag: '🇬🇳', name: 'Guinea',                  dialCode: '+224'),
    _CountryCode(flag: '🇬🇼', name: 'Guinea-Bissau',           dialCode: '+245'),
    _CountryCode(flag: '🇬🇾', name: 'Guyana',                  dialCode: '+592'),
    _CountryCode(flag: '🇭🇹', name: 'Haiti',                   dialCode: '+509'),
    _CountryCode(flag: '🇭🇳', name: 'Honduras',                dialCode: '+504'),
    _CountryCode(flag: '🇭🇺', name: 'Hungary',                 dialCode: '+36'),
    _CountryCode(flag: '🇮🇸', name: 'Iceland',                 dialCode: '+354'),
    _CountryCode(flag: '🇮🇳', name: 'India',                   dialCode: '+91'),
    _CountryCode(flag: '🇮🇩', name: 'Indonesia',               dialCode: '+62'),
    _CountryCode(flag: '🇮🇷', name: 'Iran',                    dialCode: '+98'),
    _CountryCode(flag: '🇮🇶', name: 'Iraq',                    dialCode: '+964'),
    _CountryCode(flag: '🇮🇪', name: 'Ireland',                 dialCode: '+353'),
    _CountryCode(flag: '🇮🇹', name: 'Italy',                   dialCode: '+39'),
    _CountryCode(flag: '🇯🇲', name: 'Jamaica',                 dialCode: '+1876'),
    _CountryCode(flag: '🇯🇵', name: 'Japan',                   dialCode: '+81'),
    _CountryCode(flag: '🇯🇴', name: 'Jordan',                  dialCode: '+962'),
    _CountryCode(flag: '🇰🇿', name: 'Kazakhstan',              dialCode: '+7'),
    _CountryCode(flag: '🇰🇪', name: 'Kenya',                   dialCode: '+254'),
    _CountryCode(flag: '🇰🇮', name: 'Kiribati',                dialCode: '+686'),
    _CountryCode(flag: '🇽🇰', name: 'Kosovo',                  dialCode: '+383'),
    _CountryCode(flag: '🇰🇼', name: 'Kuwait',                  dialCode: '+965'),
    _CountryCode(flag: '🇰🇬', name: 'Kyrgyzstan',              dialCode: '+996'),
    _CountryCode(flag: '🇱🇦', name: 'Laos',                    dialCode: '+856'),
    _CountryCode(flag: '🇱🇻', name: 'Latvia',                  dialCode: '+371'),
    _CountryCode(flag: '🇱🇧', name: 'Lebanon',                 dialCode: '+961'),
    _CountryCode(flag: '🇱🇸', name: 'Lesotho',                 dialCode: '+266'),
    _CountryCode(flag: '🇱🇷', name: 'Liberia',                 dialCode: '+231'),
    _CountryCode(flag: '🇱🇾', name: 'Libya',                   dialCode: '+218'),
    _CountryCode(flag: '🇱🇮', name: 'Liechtenstein',           dialCode: '+423'),
    _CountryCode(flag: '🇱🇹', name: 'Lithuania',               dialCode: '+370'),
    _CountryCode(flag: '🇱🇺', name: 'Luxembourg',              dialCode: '+352'),
    _CountryCode(flag: '🇲🇬', name: 'Madagascar',              dialCode: '+261'),
    _CountryCode(flag: '🇲🇼', name: 'Malawi',                  dialCode: '+265'),
    _CountryCode(flag: '🇲🇾', name: 'Malaysia',                dialCode: '+60'),
    _CountryCode(flag: '🇲🇻', name: 'Maldives',                dialCode: '+960'),
    _CountryCode(flag: '🇲🇱', name: 'Mali',                    dialCode: '+223'),
    _CountryCode(flag: '🇲🇹', name: 'Malta',                   dialCode: '+356'),
    _CountryCode(flag: '🇲🇭', name: 'Marshall Islands',        dialCode: '+692'),
    _CountryCode(flag: '🇲🇷', name: 'Mauritania',              dialCode: '+222'),
    _CountryCode(flag: '🇲🇺', name: 'Mauritius',               dialCode: '+230'),
    _CountryCode(flag: '🇲🇽', name: 'Mexico',                  dialCode: '+52'),
    _CountryCode(flag: '🇫🇲', name: 'Micronesia',              dialCode: '+691'),
    _CountryCode(flag: '🇲🇩', name: 'Moldova',                 dialCode: '+373'),
    _CountryCode(flag: '🇲🇨', name: 'Monaco',                  dialCode: '+377'),
    _CountryCode(flag: '🇲🇳', name: 'Mongolia',                dialCode: '+976'),
    _CountryCode(flag: '🇲🇪', name: 'Montenegro',              dialCode: '+382'),
    _CountryCode(flag: '🇲🇦', name: 'Morocco',                 dialCode: '+212'),
    _CountryCode(flag: '🇲🇿', name: 'Mozambique',              dialCode: '+258'),
    _CountryCode(flag: '🇲🇲', name: 'Myanmar',                 dialCode: '+95'),
    _CountryCode(flag: '🇳🇦', name: 'Namibia',                 dialCode: '+264'),
    _CountryCode(flag: '🇳🇷', name: 'Nauru',                   dialCode: '+674'),
    _CountryCode(flag: '🇳🇵', name: 'Nepal',                   dialCode: '+977'),
    _CountryCode(flag: '🇳🇱', name: 'Netherlands',             dialCode: '+31'),
    _CountryCode(flag: '🇳🇿', name: 'New Zealand',             dialCode: '+64'),
    _CountryCode(flag: '🇳🇮', name: 'Nicaragua',               dialCode: '+505'),
    _CountryCode(flag: '🇳🇪', name: 'Niger',                   dialCode: '+227'),
    _CountryCode(flag: '🇳🇬', name: 'Nigeria',                 dialCode: '+234'),
    _CountryCode(flag: '🇲🇰', name: 'North Macedonia',         dialCode: '+389'),
    _CountryCode(flag: '🇳🇴', name: 'Norway',                  dialCode: '+47'),
    _CountryCode(flag: '🇴🇲', name: 'Oman',                    dialCode: '+968'),
    _CountryCode(flag: '🇵🇼', name: 'Palau',                   dialCode: '+680'),
    _CountryCode(flag: '🇵🇸', name: 'Palestine',               dialCode: '+970'),
    _CountryCode(flag: '🇵🇦', name: 'Panama',                  dialCode: '+507'),
    _CountryCode(flag: '🇵🇬', name: 'Papua New Guinea',        dialCode: '+675'),
    _CountryCode(flag: '🇵🇾', name: 'Paraguay',                dialCode: '+595'),
    _CountryCode(flag: '🇵🇪', name: 'Peru',                    dialCode: '+51'),
    _CountryCode(flag: '🇵🇭', name: 'Philippines',             dialCode: '+63'),
    _CountryCode(flag: '🇵🇱', name: 'Poland',                  dialCode: '+48'),
    _CountryCode(flag: '🇵🇹', name: 'Portugal',                dialCode: '+351'),
    _CountryCode(flag: '🇶🇦', name: 'Qatar',                   dialCode: '+974'),
    _CountryCode(flag: '🇷🇴', name: 'Romania',                 dialCode: '+40'),
    _CountryCode(flag: '🇷🇺', name: 'Russia',                  dialCode: '+7'),
    _CountryCode(flag: '🇷🇼', name: 'Rwanda',                  dialCode: '+250'),
    _CountryCode(flag: '🇰🇳', name: 'Saint Kitts & Nevis',     dialCode: '+1869'),
    _CountryCode(flag: '🇱🇨', name: 'Saint Lucia',             dialCode: '+1758'),
    _CountryCode(flag: '🇻🇨', name: 'Saint Vincent',           dialCode: '+1784'),
    _CountryCode(flag: '🇼🇸', name: 'Samoa',                   dialCode: '+685'),
    _CountryCode(flag: '🇸🇲', name: 'San Marino',              dialCode: '+378'),
    _CountryCode(flag: '🇸🇹', name: 'Sao Tome & Principe',     dialCode: '+239'),
    _CountryCode(flag: '🇸🇦', name: 'Saudi Arabia',            dialCode: '+966'),
    _CountryCode(flag: '🇸🇳', name: 'Senegal',                 dialCode: '+221'),
    _CountryCode(flag: '🇷🇸', name: 'Serbia',                  dialCode: '+381'),
    _CountryCode(flag: '🇸🇨', name: 'Seychelles',              dialCode: '+248'),
    _CountryCode(flag: '🇸🇱', name: 'Sierra Leone',            dialCode: '+232'),
    _CountryCode(flag: '🇸🇬', name: 'Singapore',               dialCode: '+65'),
    _CountryCode(flag: '🇸🇰', name: 'Slovakia',                dialCode: '+421'),
    _CountryCode(flag: '🇸🇮', name: 'Slovenia',                dialCode: '+386'),
    _CountryCode(flag: '🇸🇧', name: 'Solomon Islands',         dialCode: '+677'),
    _CountryCode(flag: '🇸🇴', name: 'Somalia',                 dialCode: '+252'),
    _CountryCode(flag: '🇿🇦', name: 'South Africa',            dialCode: '+27'),
    _CountryCode(flag: '🇸🇸', name: 'South Sudan',             dialCode: '+211'),
    _CountryCode(flag: '🇪🇸', name: 'Spain',                   dialCode: '+34'),
    _CountryCode(flag: '🇱🇰', name: 'Sri Lanka',               dialCode: '+94'),
    _CountryCode(flag: '🇸🇩', name: 'Sudan',                   dialCode: '+249'),
    _CountryCode(flag: '🇸🇷', name: 'Suriname',                dialCode: '+597'),
    _CountryCode(flag: '🇸🇪', name: 'Sweden',                  dialCode: '+46'),
    _CountryCode(flag: '🇨🇭', name: 'Switzerland',             dialCode: '+41'),
    _CountryCode(flag: '🇸🇾', name: 'Syria',                   dialCode: '+963'),
    _CountryCode(flag: '🇹🇼', name: 'Taiwan',                  dialCode: '+886'),
    _CountryCode(flag: '🇹🇯', name: 'Tajikistan',              dialCode: '+992'),
    _CountryCode(flag: '🇹🇿', name: 'Tanzania',                dialCode: '+255'),
    _CountryCode(flag: '🇹🇭', name: 'Thailand',                dialCode: '+66'),
    _CountryCode(flag: '🇹🇱', name: 'Timor-Leste',             dialCode: '+670'),
    _CountryCode(flag: '🇹🇬', name: 'Togo',                    dialCode: '+228'),
    _CountryCode(flag: '🇹🇴', name: 'Tonga',                   dialCode: '+676'),
    _CountryCode(flag: '🇹🇹', name: 'Trinidad & Tobago',       dialCode: '+1868'),
    _CountryCode(flag: '🇹🇳', name: 'Tunisia',                 dialCode: '+216'),
    _CountryCode(flag: '🇹🇷', name: 'Turkey',                  dialCode: '+90'),
    _CountryCode(flag: '🇹🇲', name: 'Turkmenistan',            dialCode: '+993'),
    _CountryCode(flag: '🇹🇻', name: 'Tuvalu',                  dialCode: '+688'),
    _CountryCode(flag: '🇺🇬', name: 'Uganda',                  dialCode: '+256'),
    _CountryCode(flag: '🇺🇦', name: 'Ukraine',                 dialCode: '+380'),
    _CountryCode(flag: '🇦🇪', name: 'UAE',                     dialCode: '+971'),
    _CountryCode(flag: '🇬🇧', name: 'United Kingdom',          dialCode: '+44'),
    _CountryCode(flag: '🇺🇸', name: 'USA',                     dialCode: '+1'),
    _CountryCode(flag: '🇺🇾', name: 'Uruguay',                 dialCode: '+598'),
    _CountryCode(flag: '🇺🇿', name: 'Uzbekistan',              dialCode: '+998'),
    _CountryCode(flag: '🇻🇺', name: 'Vanuatu',                 dialCode: '+678'),
    _CountryCode(flag: '🇻🇦', name: 'Vatican City',            dialCode: '+39'),
    _CountryCode(flag: '🇻🇪', name: 'Venezuela',               dialCode: '+58'),
    _CountryCode(flag: '🇻🇳', name: 'Vietnam',                 dialCode: '+84'),
    _CountryCode(flag: '🇾🇪', name: 'Yemen',                   dialCode: '+967'),
    _CountryCode(flag: '🇿🇲', name: 'Zambia',                  dialCode: '+260'),
    _CountryCode(flag: '🇿🇼', name: 'Zimbabwe',                dialCode: '+263'),
  ];
}

// ── Second phone — tap to show ────────────────────────────────────────────────
class _Phone2Field extends StatefulWidget {
  final TextEditingController phone2Ctrl;
  final _S s;
  final _CountryCode selectedCountry;
  final ValueChanged<_CountryCode> onCountryChanged;
  final bool isInvalid;
  const _Phone2Field({required this.phone2Ctrl, required this.s, required this.selectedCountry, required this.onCountryChanged, this.isInvalid = false});
  @override State<_Phone2Field> createState() => _Phone2FieldState();
}
class _Phone2FieldState extends State<_Phone2Field> {
  bool _show = false;
  int _digits = 0;
  @override void initState() {
    super.initState();
    if (widget.phone2Ctrl.text.trim().isNotEmpty) _show = true;
    _digits = widget.phone2Ctrl.text.replaceAll(RegExp(r'[^\d]'), '').length;
    widget.phone2Ctrl.addListener(_check);
  }
  void _check() {
    final d = widget.phone2Ctrl.text.replaceAll(RegExp(r'[^\d]'), '').length;
    if (widget.phone2Ctrl.text.isNotEmpty && !_show) { setState(() { _show = true; _digits = d; }); }
    else if (d != _digits) { setState(() => _digits = d); }
  }
  @override void dispose() { widget.phone2Ctrl.removeListener(_check); super.dispose(); }

  void _openPicker(BuildContext context) {
    showModalBottomSheet(
      context: context, isScrollControlled: true,
      backgroundColor: Colors.transparent, useSafeArea: true,
      builder: (ctx) => _CountryPickerSheet(
        selected: widget.selectedCountry,
        onSelect: (c) { widget.onCountryChanged(c); Navigator.pop(ctx); },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.s;
    final isPak = widget.selectedCountry.dialCode == '+92';
    final int? requiredLen = isPak ? (widget.phone2Ctrl.text.startsWith('0') ? 11 : 10) : null;

    if (!_show) {
      return GestureDetector(
        onTap: () => setState(() => _show = true),
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: s.s(8)),
          child: Row(children: [
            Icon(Icons.add_circle_outline_rounded, size: s.d(15), color: kPurple.withOpacity(0.7)),
            SizedBox(width: s.s(6)),
            Text('Add another phone number', style: TextStyle(fontSize: s.f(13), color: kPurple.withOpacity(0.8), fontWeight: FontWeight.w500)),
          ]),
        ),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(height: s.s(10)),
      Row(children: [
        Text('Second Phone Number', style: TextStyle(fontSize: s.f(13), fontWeight: FontWeight.w700, color: kInkLight)),
        const Spacer(),
        InkWell(
          onTap: () { widget.phone2Ctrl.clear(); setState(() => _show = false); },
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: s.s(4), vertical: s.s(4)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.close_rounded, size: s.d(14), color: Colors.redAccent.withOpacity(0.7)),
              SizedBox(width: s.s(3)),
              Text('Remove', style: TextStyle(fontSize: s.f(12), color: Colors.redAccent.withOpacity(0.7))),
            ]),
          ),
        ),
      ]),
      SizedBox(height: s.s(6)),
      // Same structure, heights, and padding as the primary phone field
      // above — kept pixel-identical on purpose so the two rows line up.
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        GestureDetector(
          onTap: () => _openPicker(context),
          child: Container(
            height: 46,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: widget.isInvalid ? kRoseLight.withOpacity(0.3) : kCardBg, borderRadius: BorderRadius.circular(12),
              border: Border.all(color: widget.isInvalid ? kRose : kBorder, width: widget.isInvalid ? 1.5 : 1),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text(widget.selectedCountry.flag, style: const TextStyle(fontSize: 20)),
              const SizedBox(width: 6),
              Text(widget.selectedCountry.dialCode, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kInk)),
              const SizedBox(width: 4),
              const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: kInkLight),
            ]),
          ),
        ),
        SizedBox(width: s.s(8)),
        Expanded(
          child: SizedBox(
            height: 46,
            child: Stack(children: [
              TextFormField(
                controller: widget.phone2Ctrl,
                keyboardType: TextInputType.phone,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  if (isPak)
                    _PakistaniPhoneFormatter()
                  else
                    LengthLimitingTextInputFormatter(12),
                ],
                style: const TextStyle(fontSize: 14, color: kInk, fontWeight: FontWeight.w500),
                decoration: InputDecoration(
                  hintText: isPak ? '03001234567' : 'Phone number',
                  hintStyle: const TextStyle(color: kInkFaint, fontSize: 13.5),
                  filled: true, fillColor: widget.isInvalid ? kRoseLight.withOpacity(0.3) : kCardBg, isDense: true,
                  contentPadding: const EdgeInsets.fromLTRB(14, 12, 48, 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: widget.isInvalid ? kRose : kBorder, width: widget.isInvalid ? 1.5 : 1)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: widget.isInvalid ? kRose : kBorder, width: widget.isInvalid ? 1.5 : 1)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: widget.isInvalid ? kRose : kPurple, width: 1.5)),
                ),
              ),
              if (isPak && _digits > 0)
                Positioned(right: 10, top: 0, bottom: 0,
                  child: Center(
                    child: Text('$_digits/$requiredLen', style: const TextStyle(fontSize: 11, color: kInkFaint, fontWeight: FontWeight.w600)),
                  ),
                ),
            ]),
          ),
        ),
      ]),
    ]);
  }
}

// ── Phone field with flag + country code picker ───────────────────────────────
class _PhoneField extends StatefulWidget {
  final TextEditingController controller;
  final _CountryCode selectedCountry;
  final ValueChanged<_CountryCode> onCountryChanged;
  final bool isInvalid;
  const _PhoneField({required this.controller, required this.selectedCountry, required this.onCountryChanged, this.isInvalid = false});
  @override State<_PhoneField> createState() => _PhoneFieldState();
}
class _PhoneFieldState extends State<_PhoneField> {
  int _digits = 0;
  @override void initState() { super.initState(); widget.controller.addListener(_update); }
  void _update() => setState(() => _digits = widget.controller.text.replaceAll(RegExp(r'[^\d]'), '').length);
  @override void dispose() { widget.controller.removeListener(_update); super.dispose(); }

  void _openPicker(BuildContext context) {
    showModalBottomSheet(
      context: context, isScrollControlled: true,
      backgroundColor: Colors.transparent, useSafeArea: true,
      builder: (ctx) => _CountryPickerSheet(
        selected: widget.selectedCountry,
        onSelect: (c) { widget.onCountryChanged(c); Navigator.pop(ctx); },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isPak = widget.selectedCountry.dialCode == '+92';
    final int? requiredLen = isPak
        ? (_digits > 0 && widget.controller.text.startsWith('0') ? 11 : 10)
        : null;
    final complete = requiredLen == null || _digits == requiredLen;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        const Text('Phone *', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kInkLight)),
        if (widget.isInvalid) ...[const SizedBox(width: 6), const Icon(Icons.error_rounded, color: kRose, size: 14)],
      ]),
      const SizedBox(height: 6),
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        GestureDetector(
          onTap: () => _openPicker(context),
          child: Container(
            height: 46,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: widget.isInvalid ? kRoseLight.withOpacity(0.3) : kCardBg, borderRadius: BorderRadius.circular(12),
              border: Border.all(color: widget.isInvalid ? kRose : kBorder, width: widget.isInvalid ? 1.5 : 1),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text(widget.selectedCountry.flag, style: const TextStyle(fontSize: 20)),
              const SizedBox(width: 6),
              Text(widget.selectedCountry.dialCode, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kInk)),
              const SizedBox(width: 4),
              const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: kInkLight),
            ]),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Stack(children: [
            TextFormField(
              controller: widget.controller,
              keyboardType: TextInputType.phone,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                if (isPak)
                  _PakistaniPhoneFormatter()
                else
                  LengthLimitingTextInputFormatter(12),
              ],
              style: const TextStyle(fontSize: 14, color: kInk, fontWeight: FontWeight.w500),
              decoration: InputDecoration(
                hintText: isPak ? '03001234567' : 'Phone number',
                hintStyle: const TextStyle(color: kInkFaint, fontSize: 13.5),
                filled: true, fillColor: widget.isInvalid ? kRoseLight.withOpacity(0.3) : kCardBg, isDense: true,
                contentPadding: const EdgeInsets.fromLTRB(14, 12, 48, 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: widget.isInvalid ? kRose : kBorder, width: widget.isInvalid ? 1.5 : 1)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: widget.isInvalid ? kRose : kBorder, width: widget.isInvalid ? 1.5 : 1)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: widget.isInvalid ? kRose : kPurple, width: 1.5)),
              ),
            ),
            if (isPak && _digits > 0)
              Positioned(right: 10, top: 0, bottom: 0,
                child: Center(
                  child: Text('$_digits/$requiredLen', style: const TextStyle(fontSize: 11, color: kInkFaint, fontWeight: FontWeight.w600)),
                ),
              ),
          ]),
        ),
      ]),
    ]);
  }
}

// ── Pakistani phone formatter: auto-space after 4 digits (0300 1234567) ───────
class _PakistaniPhoneFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    // Strip everything except digits
    final digits = newValue.text.replaceAll(RegExp(r'[^\d]'), '');
    if (digits.isEmpty) return newValue.copyWith(text: '');

    // Max digits: 11 if starts with 0 (03001234567), else 10 (3001234567)
    final maxDigits = digits.startsWith('0') ? 11 : 10;
    final trimmed = digits.length > maxDigits ? digits.substring(0, maxDigits) : digits;

    // Insert space after 4 digits if starts with 0, else after 3 digits
    final spaceAt = trimmed.startsWith('0') ? 4 : 3;
    String formatted;
    if (trimmed.length <= spaceAt) {
      formatted = trimmed;
    } else {
      formatted = '${trimmed.substring(0, spaceAt)} ${trimmed.substring(spaceAt)}';
    }

    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

class _CountryPickerSheet extends StatefulWidget {
  final _CountryCode selected;
  final ValueChanged<_CountryCode> onSelect;
  const _CountryPickerSheet({required this.selected, required this.onSelect});
  @override State<_CountryPickerSheet> createState() => _CountryPickerSheetState();
}
class _CountryPickerSheetState extends State<_CountryPickerSheet> {
  String _q = '';
  final _ctrl = TextEditingController();
  List<_CountryCode> get _filtered => _q.isEmpty
      ? _CountryCode.all
      : _CountryCode.all.where((c) => c.name.toLowerCase().contains(_q.toLowerCase()) || c.dialCode.contains(_q)).toList();

  @override void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      child: Column(children: [
        const SizedBox(height: 10),
        Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE0E0E0), borderRadius: BorderRadius.circular(2))),
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 14, 20, 0),
          child: Align(alignment: Alignment.centerLeft, child: Text('Select Country', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: kInk))),
        ),
        const SizedBox(height: 12),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
            decoration: BoxDecoration(color: const Color(0xFFF5F4FC), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE4E2F5))),
            child: Row(children: [
              const Icon(Icons.search_rounded, size: 20, color: kInkFaint), const SizedBox(width: 8),
              Expanded(child: TextField(controller: _ctrl, onChanged: (v) => setState(() => _q = v),
                decoration: const InputDecoration(hintText: 'Search country...', hintStyle: TextStyle(color: kInkFaint, fontSize: 14), border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.symmetric(vertical: 12)),
                style: const TextStyle(fontSize: 14, color: kInk))),
              if (_q.isNotEmpty) GestureDetector(onTap: () { _ctrl.clear(); setState(() => _q = ''); }, child: const Icon(Icons.close_rounded, size: 18, color: kInkFaint)),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        const Divider(height: 1, color: Color(0xFFF0F0F0)),
        Expanded(child: ListView.builder(
          padding: const EdgeInsets.only(bottom: 24),
          itemCount: _filtered.length,
          itemBuilder: (_, i) {
            final c = _filtered[i];
            final sel = c.dialCode == widget.selected.dialCode && c.name == widget.selected.name;
            return GestureDetector(
              onTap: () => widget.onSelect(c),
              child: Container(
                color: sel ? kPurpleLight : Colors.transparent,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                child: Row(children: [
                  Text(c.flag, style: const TextStyle(fontSize: 22)),
                  const SizedBox(width: 14),
                  Expanded(child: Text(c.name, style: TextStyle(fontSize: 14, color: sel ? kPurple : kInk, fontWeight: sel ? FontWeight.w700 : FontWeight.w500))),
                  Text(c.dialCode, style: TextStyle(fontSize: 13, color: sel ? kPurple : kInkLight, fontWeight: FontWeight.w600)),
                  if (sel) ...[const SizedBox(width: 8), const Icon(Icons.check_rounded, size: 18, color: kPurple)],
                ]),
              ),
            );
          },
        )),
      ]),
    );
  }
}

// ── Age field (18–99) ─────────────────────────────────────────────────────────
class _AgeField extends StatelessWidget {
  final TextEditingController controller;
  final bool isInvalid;
  const _AgeField({required this.controller, this.isInvalid = false});

  @override
  Widget build(BuildContext context) {
    final borderColor = isInvalid ? kRose : kBorder;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        const Text('Age *', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kInkLight)),
        if (isInvalid) ...[const SizedBox(width: 6), const Icon(Icons.error_rounded, color: kRose, size: 14)],
      ]),
      const SizedBox(height: 6),
      TextFormField(
        controller: controller,
        keyboardType: TextInputType.number,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          RangeInputFormatter(min: 18, max: 99, maxDigits: 2),
        ],
        style: const TextStyle(fontSize: 14, color: kInk, fontWeight: FontWeight.w500),
        decoration: InputDecoration(
          hintText: '18–99',
          hintStyle: const TextStyle(color: kInkFaint, fontSize: 13.5),
          filled: true, fillColor: isInvalid ? kRoseLight.withOpacity(0.3) : kCardBg, isDense: true,
          contentPadding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: borderColor, width: isInvalid ? 1.5 : 1)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: borderColor, width: isInvalid ? 1.5 : 1)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: isInvalid ? kRose : kPurple, width: 1.5)),
        ),
      ),
    ]);
  }
}


// ── Height picker: two dropdowns (feet + inches) ──────────────────────────────
class _HeightDropdowns extends StatefulWidget {
  final TextEditingController controller;
  final bool required;
  final bool darkTheme;
  final String label;
  final bool isInvalid;
  const _HeightDropdowns({
    required this.controller,
    this.required = false,
    this.darkTheme = false,
    this.label = 'Height',
    this.isInvalid = false,
  });
  @override State<_HeightDropdowns> createState() => _HeightDropdownsState();
}
class _HeightDropdownsState extends State<_HeightDropdowns> {
  int? _feet;
  int? _inches;

  @override
  void initState() {
    super.initState();
    _parseController();
    widget.controller.addListener(_parseController);
  }

  void _parseController() {
    final text = widget.controller.text;
    final m = RegExp(r"(\d+)'(\d+)").firstMatch(text);
    if (m != null) {
      final f = int.parse(m.group(1)!);
      final i = int.parse(m.group(2)!);
      if (f != _feet || i != _inches) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) setState(() { _feet = f; _inches = i; });
        });
      }
    }
  }

  void _update(int? feet, int? inches) {
    setState(() { _feet = feet; _inches = inches; });
    if (feet != null && inches != null) {
      final formatted = "$feet'$inches\"";
      if (widget.controller.text != formatted) widget.controller.text = formatted;
    } else {
      if (widget.controller.text.isNotEmpty) widget.controller.clear();
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_parseController);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    final labelColor = widget.darkTheme ? Colors.white.withOpacity(0.5) : const Color(0xFF6B6893);
    final textColor  = widget.darkTheme ? Colors.white : const Color(0xFF1A1830);
    final fillColor  = widget.darkTheme ? Colors.black.withOpacity(0.2) : Colors.white;
    final borderColor = widget.isInvalid ? kRose : (widget.darkTheme ? Colors.white.withOpacity(0.12) : const Color(0xFFE8E6F5));

    InputDecoration deco(String hint) => InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: labelColor, fontSize: s.f(13)),
      filled: true, fillColor: fillColor, isDense: true,
      contentPadding: EdgeInsets.symmetric(horizontal: s.s(10), vertical: s.s(10)),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(10)), borderSide: BorderSide(color: borderColor, width: widget.isInvalid ? 1.5 : 1)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(10)), borderSide: BorderSide(color: borderColor, width: widget.isInvalid ? 1.5 : 1)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(10)), borderSide: BorderSide(color: widget.isInvalid ? kRose : const Color(0xFF534AB7), width: 1.5)),
    );

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text(
          widget.required ? '${widget.label} *' : widget.label,
          style: TextStyle(fontSize: s.f(12.5), fontWeight: FontWeight.w700, color: labelColor),
        ),
        if (widget.isInvalid) ...[SizedBox(width: s.s(6)), Icon(Icons.error_rounded, color: kRose, size: s.d(14))],
      ]),
      SizedBox(height: s.s(6)),
      Row(children: [
        Expanded(
          child: DropdownButtonFormField<int>(
            value: _feet,
            hint: Text('Feet', style: TextStyle(color: labelColor, fontSize: s.f(13))),
            style: TextStyle(color: textColor, fontSize: s.f(13.5), fontWeight: FontWeight.w500),
            dropdownColor: widget.darkTheme ? const Color(0xFF1E1A33) : Colors.white,
            icon: Icon(Icons.expand_more_rounded, size: s.d(18), color: labelColor),
            decoration: deco('ft'),
            items: List.generate(4, (i) => i + 4).map((f) =>
              DropdownMenuItem(value: f, child: Text("$f ft", style: TextStyle(color: textColor, fontSize: s.f(13.5))))).toList(),
            onChanged: (v) => _update(v, _inches),
          ),
        ),
        SizedBox(width: s.s(10)),
        Expanded(
          child: DropdownButtonFormField<int>(
            value: _inches,
            hint: Text('Inches', style: TextStyle(color: labelColor, fontSize: s.f(13))),
            style: TextStyle(color: textColor, fontSize: s.f(13.5), fontWeight: FontWeight.w500),
            dropdownColor: widget.darkTheme ? const Color(0xFF1E1A33) : Colors.white,
            icon: Icon(Icons.expand_more_rounded, size: s.d(18), color: labelColor),
            decoration: deco('in'),
            items: List.generate(12, (i) => i).map((i) =>
              DropdownMenuItem(value: i, child: Text('$i in', style: TextStyle(color: textColor, fontSize: s.f(13.5))))).toList(),
            onChanged: (v) => _update(_feet, v),
          ),
        ),
      ]),
    ]);
  }
}

// ── House size field: number input + unit selector ────────────────────────────
class _HouseSizeField extends StatelessWidget {
  final TextEditingController controller;
  final String unit;
  final String label;
  final ValueChanged<String> onUnitChanged;
  final bool isInvalid;
  static const _units = ['Marla', 'Kanal'];

  const _HouseSizeField({required this.controller, required this.unit, required this.onUnitChanged, this.label = 'House Size', this.isInvalid = false});

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    final borderColor = isInvalid ? kRose : kBorder;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text(label, style: TextStyle(fontSize: s.f(12.5), fontWeight: FontWeight.w700, color: kInkLight)),
        if (isInvalid) ...[SizedBox(width: s.s(6)), Icon(Icons.error_rounded, color: kRose, size: s.d(14))],
      ]),
      SizedBox(height: s.s(6)),
      Row(children: [
        Expanded(
          child: TextFormField(
            controller: controller,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
            style: TextStyle(fontSize: s.f(14), color: kInk, fontWeight: FontWeight.w500),
            decoration: InputDecoration(
              hintText: 'e.g. 10.5',
              hintStyle: TextStyle(color: kInkFaint, fontSize: s.f(13.5)),
              filled: true, fillColor: isInvalid ? kRoseLight.withOpacity(0.3) : kCardBg, isDense: true,
              contentPadding: EdgeInsets.fromLTRB(s.s(14), s.s(12), s.s(14), s.s(12)),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: BorderSide(color: borderColor, width: isInvalid ? 1.5 : 1)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: BorderSide(color: borderColor, width: isInvalid ? 1.5 : 1)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: BorderSide(color: isInvalid ? kRose : kPurple, width: 1.5)),
            ),
          ),
        ),
        SizedBox(width: s.s(10)),
        Container(
          height: s.d(46),
          padding: EdgeInsets.symmetric(horizontal: s.s(4)),
          decoration: BoxDecoration(
            color: kCardBg, borderRadius: BorderRadius.circular(s.s(12)),
            border: Border.all(color: kBorder),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: unit,
              items: _units.map((u) => DropdownMenuItem(value: u, child: Padding(
                padding: EdgeInsets.symmetric(horizontal: s.s(6)),
                child: Text(u, style: TextStyle(fontSize: s.f(13.5), fontWeight: FontWeight.w600, color: kInk)),
              ))).toList(),
              onChanged: (v) { if (v != null) onUnitChanged(v); },
              icon: Padding(
                padding: EdgeInsets.only(right: s.s(4)),
                child: Icon(Icons.keyboard_arrow_down_rounded, size: s.d(18), color: kInkLight),
              ),
              dropdownColor: kCardBg,
              borderRadius: BorderRadius.circular(s.s(12)),
              isDense: true,
            ),
          ),
        ),
      ]),
    ]);
  }
}

// ── Weight field (40–999 kg) ──────────────────────────────────────────────────
class _WeightField extends StatefulWidget {
  final TextEditingController controller;
  const _WeightField({required this.controller});
  @override State<_WeightField> createState() => _WeightFieldState();
}
class _WeightFieldState extends State<_WeightField> {
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_onFocusChange);
  }

  void _onFocusChange() {
    if (!_focusNode.hasFocus) {
      final text = widget.controller.text;
      if (text.isEmpty) return;
      final n = int.tryParse(text);
      if (n != null && n < 30) {
        // Clamp up to minimum when user leaves the field
        widget.controller.text = '30';
        widget.controller.selection = const TextSelection.collapsed(offset: 2);
      }
    }
  }

  @override
  void dispose() {
    _focusNode.removeListener(_onFocusChange);
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Weight (kg)', style: TextStyle(fontSize: s.f(12.5), fontWeight: FontWeight.w700, color: kInkLight)),
      SizedBox(height: s.s(6)),
      TextFormField(
        controller: widget.controller,
        focusNode: _focusNode,
        keyboardType: TextInputType.number,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          RangeInputFormatter(min: 30, max: 999, maxDigits: 3),
        ],
        style: TextStyle(fontSize: s.f(14), color: kInk, fontWeight: FontWeight.w500),
        decoration: InputDecoration(
          hintText: '0',
          suffixText: 'kg',
          suffixStyle: TextStyle(fontSize: s.f(13), color: kInkLight, fontWeight: FontWeight.w600),
          hintStyle: TextStyle(color: kInkFaint, fontSize: s.f(13.5)),
          filled: true, fillColor: kCardBg, isDense: true,
          contentPadding: EdgeInsets.fromLTRB(s.s(14), s.s(12), s.s(14), s.s(12)),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: const BorderSide(color: kBorder)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: const BorderSide(color: kBorder)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: const BorderSide(color: kPurple, width: 1.5)),
        ),
      ),
    ]);
  }
}



