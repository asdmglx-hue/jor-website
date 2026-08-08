// lib/screens/edit_profile_screen.dart
// White-themed edit form that mirrors the admin edit screen.
// Changes are submitted to profile_edit_requests for admin approval.
// CNIC is excluded from editing.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:convert';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../utils/theme.dart';
import '../services/supabase_service.dart';
import '../widgets/photo_crop_dialog.dart';
import '../widgets/country_picker.dart';
import 'submit_proposal_screen.dart' show kCountriesGrouped;
import '../widgets/searchable_grouped_dropdown.dart';
import '../widgets/occupation_picker.dart';
import '../utils/phone_detector.dart';
import '../utils/range_input_formatter.dart';
import '../utils/watermark.dart';

// R2 upload constants (same as SupabaseService)
// R2 credentials — scoped "Object Read & Write" token restricted to just
// the proposal-photos bucket (same as SupabaseService).
const _r2AccessKeyId     = '17b39f7543a55783ca0bf60cd5f4ea0c';
const _r2SecretAccessKey = '9cc1c77e0a738779e4d2584b1319a1973a99b84bd1782772cf06eafc9428523e';
const _r2Endpoint        = 'https://27fdb7883570e5f6e97e985e183ea7b0.r2.cloudflarestorage.com';
const _r2Bucket          = 'proposal-photos';
const _r2PublicUrl       = 'https://pub-45b25e06fb4b4f448d2ee349c6f55922.r2.dev';

// ── Responsive scale helper ────────────────────────────────────────────────
class _S {
  final double scale;
  const _S(this.scale);
  double f(double v) => v * scale;
  double s(double v) => v * scale;
  double d(double v) => v * scale;
  static _S of(BuildContext c) {
    final w = MediaQuery.of(c).size.width;
    return _S((w / 390.0).clamp(0.72, 1.0));
  }
}

const _kBg     = Color(0xFFF8F7FF);
const _kCard   = Colors.white;
const _kPurple = Color(0xFF534AB7);
const _kInk    = Color(0xFF1A1830);
const _kLight  = Color(0xFF6B6893);
const _kBorder = Color(0xFFE8E6F5);
const _kPurpleLight = Color(0xFFEEEDFE);

class EditProfileScreen extends StatefulWidget {
  final String proposalId;
  final Map<String, dynamic> currentData;
  const EditProfileScreen({super.key, required this.proposalId, required this.currentData});
  @override State<EditProfileScreen> createState() => _EditProfileScreenState();
}


// ── Ultra-robust phone number detection v2 ──────────────────────────────
const _kPhoneFields = ['name','location','about','looking_for','degree_title','institute','degree_title_2','institute_2','degree_title_3','institute_3','caste','profession','car_name'];
const _kPhoneError = 'Phone numbers are not allowed in text field.';

class _EditProfileScreenState extends State<EditProfileScreen> {
  bool _submitting = false;
  bool _uploadingPhoto = false;
  String? _newPhotoUrl; // set after successful R2 upload
  String? _newDegreeCertUrl;
  String? _newDegreeCert2Url;
  String? _newDegreeCert3Url;
  bool _uploadingDegreeCert = false;
  bool _uploadingDegreeCert2 = false;
  bool _uploadingDegreeCert3 = false;
  String? _invalidField;
  final _picker = ImagePicker();
  Map<String, dynamic> get _d => widget.currentData;

  // Text controllers don't trigger a rebuild on their own when the user
  // types — without this, the Submit button's enabled/disabled state
  // (which depends on _buildChanges()) would only update on the rare
  // rebuild triggered by a dropdown change, not as someone types.
  void _onFieldChanged() { if (mounted) setState(() {}); }

  // ── Controllers ────────────────────────────────────────────────────────
  late TextEditingController _nameCtrl;
  late TextEditingController _ageCtrl;
  late TextEditingController _phoneCtrl;
  late TextEditingController _phone2Ctrl;
  late TextEditingController _heightCtrl;
  late TextEditingController _weightCtrl;
  late TextEditingController _aboutCtrl;
  late TextEditingController _lookingForCtrl;
  late TextEditingController _professionCtrl;
  late TextEditingController _instCtrl;
  late TextEditingController _degreeTitleCtrl;
  late TextEditingController _inst2Ctrl;
  late TextEditingController _degreeTitle2Ctrl;
  late TextEditingController _inst3Ctrl;
  late TextEditingController _degreeTitle3Ctrl;
  late TextEditingController _brothersCtrl;
  late TextEditingController _sistersCtrl;
  late TextEditingController _locationCtrl;
  late TextEditingController _countryCtrl;
  late TextEditingController _houseSizeCtrl;
  late TextEditingController _boysCtrl;
  late TextEditingController _girlsCtrl;
  late TextEditingController _fatherOccCtrl;
  late TextEditingController _motherOccCtrl;
  late TextEditingController _disabilityDetailsCtrl;

  // ── Phone country codes (paired with _phoneCtrl/_phone2Ctrl below) ──────
  CountryCode _selectedCountry = CountryCode.pakistan;
  CountryCode _selectedCountry2 = CountryCode.pakistan;

  // ── Dropdown state ─────────────────────────────────────────────────────
  String _gender = '';
  String _city = '';
  String _caste = '';
  String _sect = '';
  String _education = '';
  String _professionCategory = '';
  String _profession = '';
  String _maritalStatus = '';
  String _openToPolygamy = '';
  String _familyType = '';
  String _practiceLevel = '';
  String _complexion = '';
  String _homeType = '';
  String _monthlyIncome = '';
  String _employmentType = '';
  String _hasCar = '';
  String _hasOtherProperty = '';
  String _otherProperty = '';
  String _fatherVal = '';
  String _motherVal = '';
  String _siblingsVal = '';
  String _disabilityVal = '';
  String _physicallyActive = '';
  String _smoker = '';
  String _hijab = '';
  String _beard = '';
  String _marriageNumber = '';
  String _hasKids = '';
  String? _language;
  bool _showDeg2 = false;
  bool _showDeg3 = false;

  @override
  void initState() {
    super.initState();
    final d = _d;
    _nameCtrl    = TextEditingController(text: d['name'] ?? '');
    _ageCtrl     = TextEditingController(text: d['age']?.toString() ?? '');
    // Phone numbers are stored as "{dialCode} {digits}" (see
    // formatDialedPhone() in country_picker.dart) — split that back into a
    // country + local number so the country selector shows the right flag
    // instead of defaulting to Pakistan for every existing profile.
    final phoneRaw = (d['contact_phone'] as String? ?? '').trim();
    final phoneSpace = phoneRaw.indexOf(' ');
    if (phoneSpace > 0) {
      final matched = countryCodeForDial(phoneRaw.substring(0, phoneSpace));
      if (matched != null) _selectedCountry = matched;
      _phoneCtrl = TextEditingController(text: phoneRaw.substring(phoneSpace + 1).trim());
    } else {
      _phoneCtrl = TextEditingController(text: phoneRaw);
    }
    final phone2Raw = (d['contact_phone_2'] as String? ?? '').trim();
    final phone2Space = phone2Raw.indexOf(' ');
    if (phone2Space > 0) {
      final matched2 = countryCodeForDial(phone2Raw.substring(0, phone2Space));
      if (matched2 != null) _selectedCountry2 = matched2;
      _phone2Ctrl = TextEditingController(text: phone2Raw.substring(phone2Space + 1).trim());
    } else {
      _phone2Ctrl = TextEditingController(text: phone2Raw);
    }
    // Height: convert inches to feet'inches"
    final hi = (d['height_inches'] as num?)?.toDouble() ?? 0;
    final ft = hi ~/ 12; final inch = (hi % 12).round();
    _heightCtrl  = TextEditingController(text: hi > 0 ? '$ft\'$inch"' : '');
    _weightCtrl  = TextEditingController(text: d['weight_kg']?.toString() ?? '');
    _aboutCtrl   = TextEditingController(text: d['about'] ?? '');
    _lookingForCtrl = TextEditingController(text: d['looking_for'] ?? '');
    _professionCtrl = TextEditingController(text: d['profession'] ?? '');
    _instCtrl    = TextEditingController(text: d['institute'] ?? '');
    _degreeTitleCtrl = TextEditingController(text: d['degree_title'] ?? '');
    _inst2Ctrl   = TextEditingController(text: d['institute_2'] ?? '');
    _degreeTitle2Ctrl = TextEditingController(text: d['degree_title_2'] ?? '');
    _inst3Ctrl   = TextEditingController(text: d['institute_3'] ?? '');
    _degreeTitle3Ctrl = TextEditingController(text: d['degree_title_3'] ?? '');
    if ((d['degree_title_2'] ?? '').isNotEmpty || (d['institute_2'] ?? '').isNotEmpty) _showDeg2 = true;
    if ((d['degree_title_3'] ?? '').isNotEmpty || (d['institute_3'] ?? '').isNotEmpty) _showDeg3 = true;
    _brothersCtrl = TextEditingController(text: d['brothers']?.toString() ?? '');
    _sistersCtrl  = TextEditingController(text: d['sisters']?.toString() ?? '');
    _locationCtrl = TextEditingController(text: d['location'] ?? '');
    _countryCtrl  = TextEditingController(text: d['country'] ?? '');
    _houseSizeCtrl = TextEditingController(text: d['house_size'] ?? '');
    _boysCtrl    = TextEditingController(text: d['boys']?.toString() ?? '');
    _girlsCtrl   = TextEditingController(text: d['girls']?.toString() ?? '');
    _fatherOccCtrl  = TextEditingController(text: d['father_occupation'] ?? '');
    _motherOccCtrl  = TextEditingController(text: d['mother_occupation'] ?? '');
    _disabilityDetailsCtrl = TextEditingController(text: d['disability_details'] ?? '');

    _gender        = d['gender'] ?? '';
    _city          = d['city'] ?? '';
    _caste         = d['caste'] ?? '';
    _sect          = d['sect'] ?? '';
    _education     = d['education'] ?? '';

    // ── Occupation: category + specific profession ──────────────────────
    // Rows saved before the category column existed have no
    // profession_category value yet — for those, best-effort reverse-
    // lookup which category the saved profession text belongs to, using
    // the exact same map the registration form uses, so existing profiles
    // don't show up with a blank/invalid category. If nothing matches at
    // all, the occupation falls back to 'Other' (with the original text
    // restored into the custom field) and the category is left blank for
    // the person to pick a real one from the dropdown.
    final _savedProfession = (d['profession'] as String?) ?? '';
    final _savedCategory = d['profession_category'] as String?;
    final _realCategoryMatch = _savedCategory != null &&
        _savedCategory.isNotEmpty &&
        SupabaseService.instance.occupationsGrouped.containsKey(_savedCategory) &&
        _savedCategory != 'Other';

    if (_realCategoryMatch) {
      _professionCategory = _savedCategory!;
      if ((SupabaseService.instance.occupationsGrouped[_savedCategory] ?? const []).contains(_savedProfession)) {
        _profession = _savedProfession;
        _professionCtrl.text = '';
      } else {
        _profession = 'Other';
        _professionCtrl.text = _savedProfession;
      }
    } else {
      String? _matchedCategory;
      for (final entry in SupabaseService.instance.occupationsGrouped.entries) {
        if (entry.value.contains(_savedProfession)) { _matchedCategory = entry.key; break; }
      }
      if (_matchedCategory != null) {
        _professionCategory = _matchedCategory;
        _profession = _savedProfession;
        _professionCtrl.text = '';
      } else {
        // Genuinely unmatched on both sides — leave the category blank
        // for the person to pick a real one from the dropdown.
        _professionCategory = '';
        _profession = 'Other';
        _professionCtrl.text = _savedProfession;
      }
    }

    _maritalStatus = d['marital_status'] ?? '';
    _openToPolygamy = d['open_to_polygamy'] ?? '';
    _familyType = d['family_type'] ?? '';
    _practiceLevel = d['practice_level'] ?? '';
    _complexion    = d['complexion'] ?? '';
    _homeType      = d['home_type'] ?? '';
    _monthlyIncome = d['monthly_income'] ?? '';
    _employmentType = d['employment_type'] ?? '';
    _hasCar        = d['has_car'] ?? '';
    _hasOtherProperty = d['has_other_property'] ?? '';
    _otherProperty = d['other_property'] ?? '';
    _physicallyActive = d['physically_active'] ?? '';
    _smoker        = d['smokes'] == true ? 'Yes' : (d['smokes'] == false ? 'No' : '');
    _hijab         = d['hijab'] ?? '';
    _beard         = d['beard'] ?? '';
    _marriageNumber = d['marriage_number'] ?? '';
    _hasKids       = d['has_kids'] == true ? 'Yes' : (d['has_kids'] == false ? 'No' : '');
    _fatherVal     = d['father_alive'] == true ? 'Alive' : (d['father_alive'] == false ? 'Deceased' : '');
    _motherVal     = d['mother_alive'] == true ? 'Alive' : (d['mother_alive'] == false ? 'Deceased' : '');
    _siblingsVal   = d['has_siblings'] == true ? 'Yes' : (d['has_siblings'] == false ? 'No' : '');
    _disabilityVal = d['has_disability'] == true ? 'Yes' : (d['has_disability'] == false ? 'No' : (d['has_disability'] ?? ''));
    _language      = (d['languages'] as List?)?.isNotEmpty == true ? (d['languages'] as List).first as String? : null;

    for (final c in [_nameCtrl, _ageCtrl, _phoneCtrl, _phone2Ctrl, _heightCtrl, _weightCtrl,
      _aboutCtrl, _lookingForCtrl, _professionCtrl, _instCtrl, _degreeTitleCtrl,
      _inst2Ctrl, _degreeTitle2Ctrl, _inst3Ctrl, _degreeTitle3Ctrl,
      _brothersCtrl, _sistersCtrl, _locationCtrl, _countryCtrl,
      _houseSizeCtrl, _boysCtrl, _girlsCtrl, _fatherOccCtrl, _motherOccCtrl,
      _disabilityDetailsCtrl]) { c.addListener(_onFieldChanged); }
  }

  @override
  void dispose() {
    for (final c in [_nameCtrl, _ageCtrl, _phoneCtrl, _phone2Ctrl, _heightCtrl, _weightCtrl,
      _aboutCtrl, _lookingForCtrl, _professionCtrl, _instCtrl, _degreeTitleCtrl,
      _inst2Ctrl, _degreeTitle2Ctrl, _inst3Ctrl, _degreeTitle3Ctrl,
      _brothersCtrl, _sistersCtrl, _locationCtrl, _countryCtrl,
      _houseSizeCtrl, _boysCtrl, _girlsCtrl, _fatherOccCtrl, _motherOccCtrl,
      _disabilityDetailsCtrl]) { c.removeListener(_onFieldChanged); c.dispose(); }
    super.dispose();
  }

  bool get _showKids {
    final s = _maritalStatus.toLowerCase();
    return s == 'divorced' || s == 'khula' || s == 'widowed';
  }

  // Convert feet'inches" → total inches
  double _parseHeight(String t) {
    final m = RegExp(r"(\d+)'(\d+)").firstMatch(t);
    if (m != null) return double.parse(m.group(1)!) * 12 + double.parse(m.group(2)!);
    return double.tryParse(t) ?? (_d['height_inches'] as num?)?.toDouble() ?? 0;
  }

  Future<void> _pickAndUploadPhoto() async {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const SizedBox(height: 8),
        Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.black12, borderRadius: BorderRadius.circular(2))),
        const SizedBox(height: 16),
        ListTile(
          leading: const Icon(Icons.camera_alt_rounded, color: _kPurple),
          title: const Text('Take Photo', style: TextStyle(color: _kInk)),
          onTap: () { Navigator.pop(context); _doPick(ImageSource.camera); },
        ),
        ListTile(
          leading: const Icon(Icons.photo_library_rounded, color: _kPurple),
          title: const Text('Choose from Gallery', style: TextStyle(color: _kInk)),
          onTap: () { Navigator.pop(context); _doPick(ImageSource.gallery); },
        ),
        const SizedBox(height: 8),
      ])),
    );
  }

  Widget _certUploadRow(String label, String? currentUrl, String? newUrl, bool uploading, VoidCallback onTap, _S s) {
    final url = newUrl ?? currentUrl;
    return Padding(
      padding: EdgeInsets.only(bottom: s.s(10)),
      child: Row(children: [
        if (url != null && url.isNotEmpty)
          GestureDetector(
            onTap: () => _showCertPopup(url),
            child: Text('View Certificate', style: TextStyle(fontSize: s.f(12.5), fontWeight: FontWeight.w600, color: _kPurple, decoration: TextDecoration.underline)),
          )
        else
          Text('No certificate uploaded', style: TextStyle(fontSize: s.f(12), color: _kLight.withOpacity(0.6))),
        SizedBox(width: s.s(10)),
        GestureDetector(
          onTap: uploading ? null : onTap,
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (uploading)
              SizedBox(width: s.d(12), height: s.d(12), child: const CircularProgressIndicator(strokeWidth: 2, color: _kPurple))
            else
              Icon(Icons.upload_rounded, size: s.d(13), color: _kPurple),
            SizedBox(width: s.s(4)),
            Text(url != null && url.isNotEmpty ? 'Replace' : 'Upload $label', style: TextStyle(fontSize: s.f(12), fontWeight: FontWeight.w600, color: _kPurple)),
          ]),
        ),
      ]),
    );
  }

  // In-app popup — same dark-overlay, tap-outside-to-close pattern used
  // everywhere else this feature shows a certificate, instead of handing
  // off to an external browser.
  void _showCertPopup(String url) {
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
                  child: InteractiveViewer(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(
                        url,
                        fit: BoxFit.contain,
                        loadingBuilder: (context, child, progress) => progress == null
                            ? child
                            : const Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator(color: Colors.white)),
                        errorBuilder: (context, error, stack) => const Padding(
                          padding: EdgeInsets.all(40),
                          child: Text('Could not load certificate', style: TextStyle(color: Colors.white)),
                        ),
                      ),
                    ),
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

  Future<void> _doPick(ImageSource source) async {
    final picked = await _picker.pickImage(source: source, imageQuality: 80, maxWidth: 800);
    if (picked == null || !mounted) return;
    Uint8List bytes = await picked.readAsBytes();
    // Show crop dialog (same as submit screen)
    if (mounted) {
      final cropped = await showPhotoCropDialog(context, bytes);
      if (cropped == null || !mounted) return;
      bytes = cropped;
    }
    setState(() => _uploadingPhoto = true);
    try {
      // Apply watermark before upload — same as the registration flow in
      // supabase_service.dart. Graceful fallback: if watermarking fails for
      // any reason, the original cropped bytes are used instead.
      bytes = await addWatermarkToPhoto(bytes);
      final cnic = (_d['cnic'] ?? '').toString().replaceAll('-', '');
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final path = 'proposals/$cnic/profile_$timestamp.jpg';
      final url = await _uploadToR2(bytes: bytes, path: path);
      if (mounted) setState(() { _newPhotoUrl = url; _uploadingPhoto = false; });
    } catch (e) {
      if (mounted) {
        setState(() => _uploadingPhoto = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Photo upload failed: $e'),
          backgroundColor: kRose,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 72),
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
        ));
      }
    }
  }

  // Degree certificates are documents, not portrait photos — no crop step,
  // just pick and upload directly. `slot` picks which of the three
  // degree_certificate(_N)_url fields this goes to.
  Future<void> _pickDegreeCert(int slot) async {
    final picked = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85, maxWidth: 1600);
    if (picked == null || !mounted) return;
    final bytes = await picked.readAsBytes();
    setState(() {
      if (slot == 1) _uploadingDegreeCert = true;
      if (slot == 2) _uploadingDegreeCert2 = true;
      if (slot == 3) _uploadingDegreeCert3 = true;
    });
    try {
      final cnic = (_d['cnic'] ?? '').toString().replaceAll('-', '');
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final typeLabel = slot == 1 ? 'degree_certificate' : 'degree_certificate_$slot';
      final path = 'proposals/$cnic/${typeLabel}_$timestamp.jpg';
      final url = await _uploadToR2(bytes: bytes, path: path);
      if (mounted) setState(() {
        if (slot == 1) { _newDegreeCertUrl = url; _uploadingDegreeCert = false; }
        if (slot == 2) { _newDegreeCert2Url = url; _uploadingDegreeCert2 = false; }
        if (slot == 3) { _newDegreeCert3Url = url; _uploadingDegreeCert3 = false; }
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          if (slot == 1) _uploadingDegreeCert = false;
          if (slot == 2) _uploadingDegreeCert2 = false;
          if (slot == 3) _uploadingDegreeCert3 = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Certificate upload failed: $e'),
          backgroundColor: kRose,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 72),
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
        ));
      }
    }
  }

  Future<String> _uploadToR2({required Uint8List bytes, required String path}) async {
    final uri = Uri.parse('$_r2Endpoint/$_r2Bucket/$path');
    final now = DateTime.now().toUtc();
    final ds = '${now.year}${now.month.toString().padLeft(2,'0')}${now.day.toString().padLeft(2,'0')}';
    final amz = '${ds}T${now.hour.toString().padLeft(2,'0')}${now.minute.toString().padLeft(2,'0')}${now.second.toString().padLeft(2,'0')}Z';
    final auth = _buildAuth(method: 'PUT', objectPath: '/$_r2Bucket/$path', amzDate: amz, dateStamp: ds);
    final resp = await http.put(uri, headers: {
      'Content-Type': 'image/jpeg', 'x-amz-date': amz,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', 'Authorization': auth,
    }, body: bytes);
    if (resp.statusCode == 200 || resp.statusCode == 201) return '$_r2PublicUrl/$path';
    throw Exception('R2 upload failed: ${resp.statusCode}');
  }

  String _buildAuth({required String method, required String objectPath, required String amzDate, required String dateStamp}) {
    // Simplified AWS Sig V4 — matches SupabaseService._buildR2Auth
    final region = 'auto'; const service = 's3';
    final credScope = '$dateStamp/$region/$service/aws4_request';
    final headers = 'content-type;host;x-amz-content-sha256;x-amz-date';
    final host = Uri.parse(_r2Endpoint).host;
    final canonical = '$method\n$objectPath\n\ncontent-type:image/jpeg\nhost:$host\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:$amzDate\n\n$headers\nUNSIGNED-PAYLOAD';
    final toSign = 'AWS4-HMAC-SHA256\n$amzDate\n$credScope\n${_sha256hex(canonical)}';
    Uint8List sign(List<int> key, String data) {
      final hmac = Hmac(sha256, key);
      return Uint8List.fromList(hmac.convert(utf8.encode(data)).bytes);
    }
    // ignore: unused_local_variable
    final sigKey = sign(sign(sign(sign(utf8.encode('AWS4$_r2SecretAccessKey'), dateStamp), region), service), 'aws4_request');
    final signature = sign(sigKey, toSign).map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return 'AWS4-HMAC-SHA256 Credential=$_r2AccessKeyId/$credScope,SignedHeaders=$headers,Signature=$signature';
  }

  String _sha256hex(String input) {
    final digest = sha256.convert(utf8.encode(input));
    return digest.bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  Map<String, dynamic> _buildChanges() {
    final d = _d;
    final changes = <String, dynamic>{};

    void addText(String key, String val, {String? originalKey}) {
      final orig = d[originalKey ?? key]?.toString() ?? '';
      if (val.trim().isNotEmpty && val.trim() != orig) changes[originalKey ?? key] = val.trim();
    }
    void addDrop(String key, String val) {
      final orig = d[key]?.toString() ?? '';
      if (val.isNotEmpty && val != orig) changes[key] = val;
    }
    void addBool(String key, String val, String trueVal) {
      if (val.isEmpty) return;
      final newBool = val == trueVal;
      final orig = d[key];
      if (orig != newBool) changes[key] = newBool;
    }

    addText('name', _nameCtrl.text);
    if (int.tryParse(_ageCtrl.text.trim()) != null && _ageCtrl.text.trim() != d['age']?.toString()) {
      changes['age'] = int.parse(_ageCtrl.text.trim());
    }
    // Store in the same "{dialCode} {digits}" format the Submit Proposal
    // form uses (see formatDialedPhone() in country_picker.dart), so phone
    // numbers stay consistently formatted regardless of which screen
    // edited them.
    if (_phoneCtrl.text.trim().isNotEmpty) {
      final formattedPhone = formatDialedPhone(_selectedCountry.dialCode, _phoneCtrl.text);
      if (formattedPhone != (d['contact_phone']?.toString() ?? '')) changes['contact_phone'] = formattedPhone;
    }
    if (_phone2Ctrl.text.trim().isNotEmpty) {
      final formattedPhone2 = formatDialedPhone(_selectedCountry2.dialCode, _phone2Ctrl.text);
      if (formattedPhone2 != (d['contact_phone_2']?.toString() ?? '')) changes['contact_phone_2'] = formattedPhone2;
    }

    final newHeight = _parseHeight(_heightCtrl.text.trim());
    if (newHeight > 0 && newHeight != (d['height_inches'] as num?)?.toDouble()) {
      changes['height_inches'] = newHeight;
    }
    final newWeight = double.tryParse(_weightCtrl.text.trim());
    if (newWeight != null && newWeight != (d['weight_kg'] as num?)?.toDouble()) {
      changes['weight_kg'] = newWeight;
    }

    addText('about', _aboutCtrl.text);
    addText('looking_for', _lookingForCtrl.text);
    // Resolve the actual profession value to save: the specific dropdown
    // pick, or the custom-typed text when 'Other' was chosen — same
    // resolution the registration form uses, so both flows produce the
    // exact same shape of data for this column.
    final _resolvedProfession = _profession == 'Other'
        ? _professionCtrl.text.trim()
        : _profession;
    addText('profession', _resolvedProfession);
    addText('profession_category', _professionCategory);
    addText('institute', _instCtrl.text);
    addText('degree_title', _degreeTitleCtrl.text);
    addText('institute_2', _inst2Ctrl.text);
    addText('degree_title_2', _degreeTitle2Ctrl.text);
    addText('institute_3', _inst3Ctrl.text);
    addText('degree_title_3', _degreeTitle3Ctrl.text);
    addText('location', _locationCtrl.text);
    addText('country', _countryCtrl.text);
    addText('house_size', _houseSizeCtrl.text);
    addText('father_occupation', _fatherOccCtrl.text);
    addText('mother_occupation', _motherOccCtrl.text);
    addText('disability_details', _disabilityDetailsCtrl.text);

    if (int.tryParse(_brothersCtrl.text) != null && _brothersCtrl.text != d['brothers']?.toString()) {
      changes['brothers'] = int.parse(_brothersCtrl.text);
    }
    if (int.tryParse(_sistersCtrl.text) != null && _sistersCtrl.text != d['sisters']?.toString()) {
      changes['sisters'] = int.parse(_sistersCtrl.text);
    }
    if (int.tryParse(_boysCtrl.text) != null && _boysCtrl.text != d['boys']?.toString()) {
      changes['boys'] = int.parse(_boysCtrl.text);
    }
    if (int.tryParse(_girlsCtrl.text) != null && _girlsCtrl.text != d['girls']?.toString()) {
      changes['girls'] = int.parse(_girlsCtrl.text);
    }
    // Boys/Girls only make sense when the kids question is actually shown
    // (marital status is Divorced/Khula/Widowed AND Has Kids = Yes). If the
    // person changes marital status (or Has Kids) away from that, the old
    // counts must be cleared server-side too — not just hidden in the UI —
    // otherwise stale numbers stay on the record and show up in admin's
    // review screen next to a status they no longer apply to.
    final kidsFieldsRelevant = _showKids && _hasKids == 'Yes';
    if (!kidsFieldsRelevant) {
      if (d['boys'] != null) changes['boys'] = null;
      if (d['girls'] != null) changes['girls'] = null;
    }

    addDrop('city', _city);
    addDrop('caste', _caste);
    addDrop('sect', _sect);
    addDrop('education', _education);
    addDrop('marital_status', _maritalStatus);
    addDrop('open_to_polygamy', _openToPolygamy);
    addDrop('family_type', _familyType);
    addDrop('practice_level', _practiceLevel);
    addDrop('complexion', _complexion);
    addDrop('home_type', _homeType);
    addDrop('monthly_income', _monthlyIncome);
    addDrop('employment_type', _employmentType);
    addDrop('has_car', _hasCar);
    addDrop('has_other_property', _hasOtherProperty);
    addDrop('other_property', _otherProperty);
    addDrop('physically_active', _physicallyActive);
    addDrop('hijab', _hijab);
    addDrop('beard', _beard);
    addDrop('marriage_number', _marriageNumber);
    // Marriage number is only meaningful when marital status is "Married".
    // If it's changing away from Married, clear it server-side too — see
    // the boys/girls comment above for why this matters.
    if (_maritalStatus != 'Married' && (d['marriage_number']?.toString() ?? '').isNotEmpty) {
      changes['marriage_number'] = null;
    }

    addBool('father_alive', _fatherVal, 'Alive');
    addBool('mother_alive', _motherVal, 'Alive');
    addBool('has_siblings', _siblingsVal, 'Yes');
    addBool('has_kids', _hasKids, 'Yes');
    addBool('smokes', _smoker, 'Yes');
    if (_disabilityVal.isNotEmpty) {
      final newVal = _disabilityVal == 'Yes';
      if (d['has_disability'] != newVal) changes['has_disability'] = newVal;
    }

    // Language
    final origLang = (d['languages'] as List?)?.isNotEmpty == true ? (d['languages'] as List).first as String? : null;
    if (_language != origLang) changes['languages'] = _language != null ? [_language!] : [];

    // Profile photo
    if (_newPhotoUrl != null) changes['profile_photo_url'] = _newPhotoUrl;
    if (_newDegreeCertUrl != null) changes['degree_certificate_url'] = _newDegreeCertUrl;
    if (_newDegreeCert2Url != null) changes['degree_certificate_2_url'] = _newDegreeCert2Url;
    if (_newDegreeCert3Url != null) changes['degree_certificate_3_url'] = _newDegreeCert3Url;

    return changes;
  }

  bool get _hasChanges => _buildChanges().isNotEmpty;

  // Fields that were compulsory at signup (see submit_proposal_screen.dart's
  // _validateStep0) can't be cleared out during an edit — someone could
  // otherwise blank out their Name or City and save an incomplete profile.
  String? _validateRequired() {
    if (_nameCtrl.text.trim().isEmpty) { _invalidField = 'name'; return 'Full Name is required'; }
    if (_ageCtrl.text.trim().isEmpty) { _invalidField = 'age'; return 'Age is required'; }
    final _ageValue = int.tryParse(_ageCtrl.text.trim());
    if (_ageValue == null || _ageValue < 18 || _ageValue > 99) { _invalidField = 'age'; return 'Age must be between 18 and 99'; }
    if (_weightCtrl.text.trim().isNotEmpty) {
      final _weightValue = double.tryParse(_weightCtrl.text.trim());
      if (_weightValue == null || _weightValue <= 0 || _weightValue > 999) { _invalidField = 'weight'; return 'Weight must be between 1 and 999 kg'; }
    }
    if (_phoneCtrl.text.trim().isEmpty) { _invalidField = 'phone'; return 'Phone Number is required'; }
    if (_professionCategory.isEmpty) { _invalidField = 'professionCategory'; return 'Please select an Occupation Category'; }
    if (_profession.isEmpty) { _invalidField = 'profession'; return 'Occupation is required'; }
    if (_profession == 'Other' && _professionCtrl.text.trim().isEmpty) { _invalidField = 'profession'; return 'Please specify your Occupation'; }
    if (_heightCtrl.text.trim().isEmpty) { _invalidField = 'height'; return 'Height is required'; }
    if (_city.isEmpty) { _invalidField = 'city'; return 'City is required'; }
    if (_homeType.isEmpty) { _invalidField = 'homeType'; return 'Home Type is required'; }
    if (_caste.isEmpty) { _invalidField = 'caste'; return 'Caste is required'; }
    if (_sect.isEmpty) { _invalidField = 'sect'; return 'Sect / Maslak is required'; }
    if (_maritalStatus.isEmpty) { _invalidField = 'maritalStatus'; return 'Marital Status is required'; }
    _invalidField = null;
    return null;
  }

  Future<void> _submit() async {
    final changes = _buildChanges();
    if (changes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('No changes detected.'),
        backgroundColor: kPurple,
        behavior: SnackBarBehavior.floating,
        margin: EdgeInsets.fromLTRB(16, 0, 16, 72),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
      ));
      return;
    }

    final requiredError = _validateRequired();
    if (requiredError != null) {
      setState(() {}); // reflect the red border on the invalid field
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(requiredError),
        backgroundColor: kRose,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 72),
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
      ));
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Save Changes?', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: _kInk)),
        content: const Text(
          'Changes will go live instantly, and profile updates will be sent to admin for review.',
          style: TextStyle(fontSize: 13, color: _kLight, height: 1.6),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(_, false), child: const Text('Cancel', style: TextStyle(color: _kLight))),
          TextButton(onPressed: () => Navigator.pop(_, true), child: const Text('Save', style: TextStyle(color: _kPurple, fontWeight: FontWeight.w800))),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _submitting = true);
    try {
      // Check for phone numbers in text fields
      for (final key in changes.keys) {
        if (_kPhoneFields.contains(key)) {
          final val = changes[key];
          if (val is String && containsPhoneNumber(val)) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text('Phone numbers are not allowed in text field.'),
              backgroundColor: kRose, behavior: SnackBarBehavior.floating,
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 72), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ));
            setState(() => _submitting = false);
            return;
          }
        }
      }

      // Apply changes via update_own_proposal, which verifies this device's
      // cnic actually owns proposalId server-side before touching anything,
      // then writes the profile_edit_requests audit row itself (old_values
      // computed from the trusted DB row rather than the client's copy).
      await Supabase.instance.client.rpc('update_own_proposal', params: {
        'p_id': widget.proposalId,
        'p_cnic': (_d['cnic'] ?? '').toString(),
        'p_changes': changes,
      });
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Error: $e'),
          backgroundColor: kRose,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 72),
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = _S.of(context);
    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: _kInk),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Edit Profile', style: TextStyle(fontSize: s.f(16), fontWeight: FontWeight.w800, color: _kInk)),
        actions: [
          _submitting
              ? const Padding(padding: EdgeInsets.all(16), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: _kPurple, strokeWidth: 2)))
              : TextButton(
                  onPressed: _hasChanges ? _submit : null,
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: s.s(16), vertical: s.s(6)),
                    decoration: BoxDecoration(color: _hasChanges ? _kPurple : _kBorder, borderRadius: BorderRadius.circular(s.s(10))),
                    child: Text('Save', style: TextStyle(color: _hasChanges ? Colors.white : _kLight, fontWeight: FontWeight.w700, fontSize: s.f(13))),
                  ),
                ),
          SizedBox(width: s.s(8)),
        ],
        bottom: PreferredSize(preferredSize: const Size.fromHeight(1), child: Container(height: 1, color: _kBorder)),
      ),
      body: ListView(
        padding: EdgeInsets.all(s.s(16)),
        children: [
          // Profile photo
          _buildPhotoSection(s),
          SizedBox(height: s.s(16)),

          // ── BASIC INFORMATION ──────────────────────────────────────────
          _mainHeader('Basic Information', s),
          _lockedField('Gender', _gender, s),
          _lockedField('CNIC', (_d['cnic'] ?? '').toString(), s),
          _field('Full Name', _nameCtrl, s, required: true, isInvalid: _invalidField == 'name'),
          _field('Age', _ageCtrl, s, type: TextInputType.number, required: true, isInvalid: _invalidField == 'age',
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, RangeInputFormatter(min: 18, max: 99, maxDigits: 2)]),
          SearchableGroupedDropdown(
            label: 'City *',
            value: _city.isEmpty ? null : _city,
            groups: SupabaseService.instance.citiesGrouped,
            onChanged: (v) => setState(() => _city = v ?? ''),
            icon: Icons.location_on_outlined,
            isInvalid: _invalidField == 'city',
          ),
          SearchableGroupedDropdown(
            label: 'Country (for overseas)',
            value: _countryCtrl.text.isEmpty ? null : _countryCtrl.text,
            groups: kCountriesGrouped,
            onChanged: (v) => setState(() => _countryCtrl.text = v ?? ''),
            icon: Icons.public_rounded,
          ),
          _field('Weight (kg)', _weightCtrl, s, type: TextInputType.number, isInvalid: _invalidField == 'weight',
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')), LengthLimitingTextInputFormatter(6)]),
          _HeightDropdowns(controller: _heightCtrl, label: 'Height', required: true, isInvalid: _invalidField == 'height'),
          _drop('Complexion', _complexion, ['Fair', 'Wheatish', 'Brown', 'Dark'], s,
              (v) => setState(() => _complexion = v)),
          _drop('Marital Status', _maritalStatus,
              _gender == 'Male'
                  ? ['Never Married', 'Married', 'Divorced', 'Widowed']
                  : _gender == 'Female'
                      ? ['Never Married', 'Divorced', 'Khula', 'Widowed']
                      : ['Never Married', 'Married', 'Divorced', 'Khula', 'Widowed'],
              s,
              (v) => setState(() => _maritalStatus = v),
              required: true, isInvalid: _invalidField == 'maritalStatus'),
          if (_maritalStatus == 'Married')
            _subDrop('Looking for', _marriageNumber,
                ['Second marriage', 'Third marriage', 'Fourth marriage'], s,
                (v) => setState(() => _marriageNumber = v)),
          _drop('Has Kids', _hasKids, ['Yes', 'No'], s, (v) => setState(() => _hasKids = v)),
          if (_showKids && _hasKids == 'Yes')
            _row([
              _subField('Sons', _boysCtrl, s, type: TextInputType.number),
              _subField('Daughters', _girlsCtrl, s, type: TextInputType.number),
            ], s),
          _drop('Open to Polygamy?', _openToPolygamy, ['Yes', 'No'], s,
              (v) => setState(() => _openToPolygamy = v),
              infoText: 'Polygamy means marrying more than one woman (for men) or marrying a man who already has a wife (for women).'),
          SearchableGroupedDropdown(
            label: 'Caste *',
            value: _caste.isEmpty ? null : _caste,
            groups: SupabaseService.instance.castesGrouped,
            onChanged: (v) => setState(() => _caste = v ?? ''),
            icon: Icons.people_outline_rounded,
            isInvalid: _invalidField == 'caste',
          ),
          _drop('Sect / Maslak', _sect, kSects, s, (v) => setState(() => _sect = v), required: true, isInvalid: _invalidField == 'sect'),
          _drop('Religion Practice Level', _practiceLevel, ['High', 'Moderate', 'Low'], s,
              (v) => setState(() => _practiceLevel = v)),
          if (_gender == 'Female')
            _drop('Wears Hijab', _hijab, ['Yes', 'No', 'Sometimes'], s,
                (v) => setState(() => _hijab = v))
          else
            _drop('Has Beard', _beard, ['Yes', 'No', 'Trimmed'], s,
                (v) => setState(() => _beard = v)),
          _drop('Native Language', _language ?? '', kLanguages, s, (v) => setState(() => _language = v.isEmpty ? null : v)),
          _multiField('About', _aboutCtrl, s, maxLength: 200),
          const SizedBox(height: 12),
          _multiField('Looking For', _lookingForCtrl, s, maxLength: 200),

          // ── FAMILY ──
          _mainHeader('Family', s),
          _drop('Family Type', _familyType, ['Joint family', 'Separated Family'], s,
              (v) => setState(() => _familyType = v)),
          _row([
            _drop('Father Alive', _fatherVal, ['Alive', 'Deceased'], s,
                (v) => setState(() => _fatherVal = v)),
            _drop('Mother Alive', _motherVal, ['Alive', 'Deceased'], s,
                (v) => setState(() => _motherVal = v)),
          ], s),
          if (_fatherVal.isNotEmpty) _subField('Father Occupation', _fatherOccCtrl, s),
          if (_motherVal.isNotEmpty) _subField('Mother Occupation', _motherOccCtrl, s),
          _drop('Has Siblings', _siblingsVal, ['Yes', 'No'], s, (v) => setState(() => _siblingsVal = v)),
          if (_siblingsVal == 'Yes') ...[
            _subField('Brothers', _brothersCtrl, s, type: TextInputType.number),
            _subField('Sisters', _sistersCtrl, s, type: TextInputType.number),
          ],

          // ── EDUCATION & CAREER ──
          _mainHeader('Education & Career', s),
          _drop('Education Level (Highest)', _education, kEducations, s, (v) => setState(() => _education = v)),
          Text('Degree', style: TextStyle(fontSize: s.f(13), fontWeight: FontWeight.w700, color: _kLight)),
          SizedBox(height: s.s(6)),
          _DegreePairEditField(degreeTitleCtrl: _degreeTitleCtrl, instituteCtrl: _instCtrl, s: s,
            certWidget: _certUploadRow('Degree Certificate', _d['degree_certificate_url'] as String?, _newDegreeCertUrl, _uploadingDegreeCert, () => _pickDegreeCert(1), s)),
          if (!_showDeg2) ...[
            GestureDetector(
              onTap: () => setState(() => _showDeg2 = true),
              child: Padding(
                padding: EdgeInsets.fromLTRB(0, s.s(2), 0, s.s(8)),
                child: Row(children: [
                  Icon(Icons.add_circle_outline_rounded, size: s.d(15), color: kPurple.withOpacity(0.7)),
                  SizedBox(width: s.s(6)),
                  Text('Add another degree', style: TextStyle(fontSize: s.f(13), color: kPurple.withOpacity(0.8), fontWeight: FontWeight.w500)),
                ]),
              ),
            ),
            SizedBox(height: s.s(10)),
          ],
          if (_showDeg2) ...[
            SizedBox(height: s.s(4)),
            Row(children: [
              Text('Degree 2', style: TextStyle(fontSize: s.f(13), fontWeight: FontWeight.w700, color: _kLight)),
              const Spacer(),
              InkWell(
                onTap: () { _degreeTitle2Ctrl.clear(); _inst2Ctrl.clear(); _degreeTitle3Ctrl.clear(); _inst3Ctrl.clear(); setState(() { _showDeg2 = false; _showDeg3 = false; }); },
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
            _DegreePairEditField(degreeTitleCtrl: _degreeTitle2Ctrl, instituteCtrl: _inst2Ctrl, s: s,
              certWidget: _certUploadRow('Degree 2 Certificate', _d['degree_certificate_2_url'] as String?, _newDegreeCert2Url, _uploadingDegreeCert2, () => _pickDegreeCert(2), s)),
          ],
          if (_showDeg2 && !_showDeg3) ...[
            GestureDetector(
              onTap: () => setState(() => _showDeg3 = true),
              child: Padding(
                padding: EdgeInsets.fromLTRB(0, s.s(2), 0, s.s(8)),
                child: Row(children: [
                  Icon(Icons.add_circle_outline_rounded, size: s.d(15), color: kPurple.withOpacity(0.7)),
                  SizedBox(width: s.s(6)),
                  Text('Add another degree', style: TextStyle(fontSize: s.f(13), color: kPurple.withOpacity(0.8), fontWeight: FontWeight.w500)),
                ]),
              ),
            ),
            SizedBox(height: s.s(10)),
          ],
          if (_showDeg2 && _showDeg3) ...[
            SizedBox(height: s.s(4)),
            Row(children: [
              Text('Degree 3', style: TextStyle(fontSize: s.f(13), fontWeight: FontWeight.w700, color: _kLight)),
              const Spacer(),
              InkWell(
                onTap: () { _degreeTitle3Ctrl.clear(); _inst3Ctrl.clear(); setState(() => _showDeg3 = false); },
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
            _DegreePairEditField(degreeTitleCtrl: _degreeTitle3Ctrl, instituteCtrl: _inst3Ctrl, s: s,
              certWidget: _certUploadRow('Degree 3 Certificate', _d['degree_certificate_3_url'] as String?, _newDegreeCert3Url, _uploadingDegreeCert3, () => _pickDegreeCert(3), s)),
          ],
          OccupationPicker(
            label: 'Occupation',
            category: _professionCategory.isEmpty ? null : _professionCategory,
            profession: _profession.isEmpty ? null : _profession,
            onSelect: (category, prof) => setState(() {
              _professionCategory = category;
              _profession = prof;
              if (prof != 'Other') _professionCtrl.clear();
            }),
            isInvalid: _invalidField == 'profession' || _invalidField == 'professionCategory',
          ),
          if (_profession == 'Other') ...[
            _field('Specify Occupation', _professionCtrl, s, required: true, isInvalid: _invalidField == 'profession'),
            _drop('Occupation Category', _professionCategory, SupabaseService.instance.occupationsGrouped.keys.where((k) => k != 'Other').toList(), s,
                (v) => setState(() => _professionCategory = v),
                required: true, isInvalid: _invalidField == 'professionCategory'),
          ],
          _drop('Employment Type', _employmentType,
              ['Full-time', 'Part-time', 'Self-employed', 'Business', 'Freelance', 'Not employed'], s,
              (v) => setState(() => _employmentType = v)),
          _drop('Monthly Income', _monthlyIncome, kMonthlyIncomes, s,
              (v) => setState(() => _monthlyIncome = v)),

          // ── HEALTH & LIFESTYLE ──
          _mainHeader('Health & Lifestyle', s),
          _drop('Lifestyle', _physicallyActive,
              ['Active Living', 'Moderately Active', 'Sedentary Living'], s,
              (v) => setState(() => _physicallyActive = v)),
          _drop('Smoker', _smoker, ['Yes', 'No'], s,
              (v) => setState(() => _smoker = v)),
          _drop('Disability / Chronic Illness', _disabilityVal, ['Yes', 'No'], s,
              (v) => setState(() => _disabilityVal = v)),
          if (_disabilityVal == 'Yes') _subField('Details', _disabilityDetailsCtrl, s),

          // ── PROPERTY & ASSETS ──
          _mainHeader('Property & Assets', s),
          _drop('Home Type', _homeType, ['Own House', 'Rented House'], s,
              (v) => setState(() => _homeType = v), required: true, isInvalid: _invalidField == 'homeType'),
          if (_homeType.isNotEmpty) ...[
            _subField('Location (Area)', _locationCtrl, s),
            _subField('House Size', _houseSizeCtrl, s),
          ],
          _drop('Has Car', _hasCar, ['Yes', 'No', 'Multiple'], s,
              (v) => setState(() => _hasCar = v)),
          _drop('Other Property', _hasOtherProperty, ['Yes', 'No'], s,
              (v) => setState(() => _hasOtherProperty = v)),
          if (_hasOtherProperty == 'Yes')
            _subDrop('Property Type', _otherProperty,
                ['Residential', 'Commercial', 'Land', 'Multiple'], s,
                (v) => setState(() => _otherProperty = v)),

          // ── CONTACT ──
          _mainHeader('Contact', s),
          Padding(
            padding: EdgeInsets.only(bottom: s.s(10)),
            child: PhoneField(
              label: 'Phone Number',
              controller: _phoneCtrl,
              selectedCountry: _selectedCountry,
              onCountryChanged: (v) => setState(() => _selectedCountry = v),
              isInvalid: _invalidField == 'phone',
            ),
          ),
          Padding(
            padding: EdgeInsets.only(bottom: s.s(10)),
            child: PhoneField(
              label: 'Second Phone (optional)',
              required: false,
              controller: _phone2Ctrl,
              selectedCountry: _selectedCountry2,
              onCountryChanged: (v) => setState(() => _selectedCountry2 = v),
            ),
          ),

          const SizedBox(height: 40),
        ],
      ),
    );
  }

  // ── Photo section ──────────────────────────────────────────────────────
  Widget _buildPhotoSection(_S s) {
    final currentUrl = _d['profile_photo_url'] as String?;
    final displayUrl = _newPhotoUrl ?? currentUrl;
    final hasPhoto = displayUrl != null && displayUrl.isNotEmpty;

    return Center(
      child: Column(children: [
        GestureDetector(
          onTap: _pickAndUploadPhoto,
          child: Stack(clipBehavior: Clip.none, children: [
            Container(
              width: s.d(96), height: s.d(96),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _kPurpleLight,
                border: Border.all(color: _newPhotoUrl != null ? _kPurple : _kBorder, width: _newPhotoUrl != null ? 2 : 1),
                image: hasPhoto ? DecorationImage(image: NetworkImage(displayUrl), fit: BoxFit.cover) : null,
              ),
              child: _uploadingPhoto
                  ? const Center(child: CircularProgressIndicator(color: _kPurple, strokeWidth: 2))
                  : !hasPhoto
                      ? Icon(Icons.person_rounded, size: s.d(48), color: _kPurple.withOpacity(0.4))
                      : null,
            ),
            Positioned(
              bottom: 0, right: 0,
              child: Container(
                width: s.d(28), height: s.d(28),
                decoration: BoxDecoration(color: _kPurple, shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2)),
                child: Icon(Icons.camera_alt_rounded, size: s.d(14), color: Colors.white),
              ),
            ),
            if (hasPhoto && !_uploadingPhoto)
              Positioned(
                top: -4, right: -4,
                child: GestureDetector(
                  onTap: () async {
                    final confirmed = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Remove profile photo?'),
                        content: const Text('This will remove your profile photo once you save changes.'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Remove', style: TextStyle(color: Colors.red))),
                        ],
                      ),
                    );
                    if (confirmed == true) setState(() => _newPhotoUrl = '');
                  },
                  child: Container(
                    width: s.d(22), height: s.d(22),
                    decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFDC2626), border: Border.fromBorderSide(BorderSide(color: Colors.white, width: 2))),
                    child: Icon(Icons.close_rounded, size: s.d(13), color: Colors.white),
                  ),
                ),
              ),
          ]),
        ),
        SizedBox(height: s.s(8)),
        Text(
          'Tap to change photo',
          style: TextStyle(
            fontSize: s.f(12), fontWeight: FontWeight.w600,
            color: _kLight,
          ),
        ),
      ]),
    );
  }

  // ── Widget helpers ─────────────────────────────────────────────────────

  Widget _mainHeader(String title, _S s) => Padding(
    padding: EdgeInsets.only(top: s.s(8), bottom: s.s(12)),
    child: Row(children: [
      Container(width: s.d(3), height: s.d(16),
          decoration: BoxDecoration(color: _kPurple, borderRadius: BorderRadius.circular(s.s(2)))),
      SizedBox(width: s.s(10)),
      Text(title, style: TextStyle(fontSize: s.f(15), fontWeight: FontWeight.w800, color: _kInk)),
    ]),
  );

  Widget _subHeader(String title, _S s) => Padding(
    padding: EdgeInsets.only(top: s.s(20), bottom: s.s(8)),
    child: Text(title.toUpperCase(),
        style: TextStyle(fontSize: s.f(11), fontWeight: FontWeight.w700, color: _kLight, letterSpacing: 1.0)),
  );

  // Gender and CNIC are identity fields fixed at registration/verification
  // — locked everywhere, same as the website's edit page (ALWAYS_LOCKED =
  // ['gender', 'cnic']). Shown here read-only, purely for reference, so
  // someone editing their profile can still see what's on file without
  // being able to change it.
  Widget _lockedField(String label, String value, _S s) =>
    Padding(
      padding: EdgeInsets.only(bottom: s.s(10)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(label, style: TextStyle(fontSize: s.f(11.5), fontWeight: FontWeight.w600, color: _kLight)),
          SizedBox(width: s.s(5)),
          Icon(Icons.lock_outline_rounded, size: s.d(11), color: _kLight),
        ]),
        SizedBox(height: s.s(5)),
        Container(
          width: double.infinity,
          padding: EdgeInsets.symmetric(horizontal: s.s(12), vertical: s.s(12)),
          decoration: BoxDecoration(
            color: const Color(0xFFF5F5F7),
            borderRadius: BorderRadius.circular(s.s(10)),
            border: Border.all(color: const Color(0xFFE8E6F5)),
          ),
          child: Text(
            value.isNotEmpty ? value : 'Not set',
            style: TextStyle(color: value.isNotEmpty ? _kLight : _kLight.withOpacity(0.6), fontSize: s.f(13.5), fontWeight: FontWeight.w500),
          ),
        ),
      ]),
    );

  Widget _field(String label, TextEditingController ctrl, _S s, {TextInputType? type, int maxLines = 1, bool required = false, bool isInvalid = false, List<TextInputFormatter>? inputFormatters}) =>
    Padding(
      padding: EdgeInsets.only(bottom: s.s(10)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(required ? '$label *' : label, style: TextStyle(fontSize: s.f(11.5), fontWeight: FontWeight.w600, color: _kLight)),
          if (isInvalid) ...[SizedBox(width: s.s(6)), Icon(Icons.error_rounded, color: kRose, size: s.d(13))],
        ]),
        SizedBox(height: s.s(5)),
        TextField(
          controller: ctrl, keyboardType: type, maxLines: maxLines,
          inputFormatters: inputFormatters,
          style: TextStyle(color: _kInk, fontSize: s.f(13.5)),
          decoration: _inputDeco(s, isInvalid: isInvalid),
        ),
      ]),
    );

  Widget _multiField(String label, TextEditingController ctrl, _S s, {int? maxLength}) {
    return Padding(
      padding: EdgeInsets.only(bottom: s.s(10)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(fontSize: s.f(11.5), fontWeight: FontWeight.w600, color: _kLight)),
        SizedBox(height: s.s(5)),
        _EditMultiCounter(ctrl: ctrl, maxLength: maxLength, s: s, inputDeco: _inputDeco(s)),
      ]),
    );
  }

  Widget _subField(String label, TextEditingController ctrl, _S s, {TextInputType? type}) =>
    Padding(
      padding: EdgeInsets.only(left: s.s(16), bottom: s.s(10)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: EdgeInsets.only(top: s.s(30)),
            child: Text('↳ ', style: TextStyle(fontSize: s.f(12), color: _kLight, fontWeight: FontWeight.w700))),
        Expanded(child: _field(label, ctrl, s, type: type)),
      ]),
    );

  Widget _DegreePairEditField({required TextEditingController degreeTitleCtrl, required TextEditingController instituteCtrl, required _S s, required Widget certWidget}) =>
    Padding(
      padding: EdgeInsets.only(bottom: s.s(10)),
      child: Container(
        padding: EdgeInsets.all(s.s(12)),
        decoration: BoxDecoration(
          color: const Color(0xFFF8F7FF),
          borderRadius: BorderRadius.circular(s.s(10)),
          border: Border.all(color: const Color(0xFFE8E6F5)),
        ),
        child: Column(children: [
          _field('Title', degreeTitleCtrl, s),
          _field('Institute', instituteCtrl, s),
          certWidget,
        ]),
      ),
    );

  Widget _drop(String label, String value, List<String> options, _S s, ValueChanged<String> onChanged, {String? infoText, bool required = false, bool isInvalid = false}) =>
    Padding(
      padding: EdgeInsets.only(bottom: s.s(10)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(required ? '$label *' : label, style: TextStyle(fontSize: s.f(11.5), fontWeight: FontWeight.w600, color: _kLight)),
          if (isInvalid) ...[SizedBox(width: s.s(6)), Icon(Icons.error_rounded, color: kRose, size: s.d(13))],
          if (infoText != null) ...[
            SizedBox(width: s.s(5)),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
                  backgroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  title: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: _kInk)),
                  content: Text(infoText, style: const TextStyle(fontSize: 13.5, color: _kLight, height: 1.5)),
                  actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Got it'))],
                ),
              ),
              child: Icon(Icons.info_outline_rounded, color: _kLight, size: s.d(15)),
            ),
          ],
        ]),
        SizedBox(height: s.s(5)),
        DropdownButtonFormField<String>(
          value: options.contains(value) ? value : null,
          hint: Text('Select', style: TextStyle(color: _kLight.withOpacity(0.5), fontSize: s.f(13.5))),
          items: [
            DropdownMenuItem(value: '', child: Text('— Clear —', style: TextStyle(color: _kLight, fontSize: s.f(13)))),
            ...options.map((o) => DropdownMenuItem(value: o, child: Text(o, style: TextStyle(fontSize: s.f(13.5), color: _kInk)))),
          ],
          onChanged: (v) => onChanged(v ?? ''),
          style: TextStyle(fontSize: s.f(13.5), color: _kInk),
          dropdownColor: Colors.white,
          icon: Icon(Icons.expand_more_rounded, size: s.d(20), color: _kLight),
          decoration: _inputDeco(s, isInvalid: isInvalid),
        ),
      ]),
    );

  Widget _subDrop(String label, String value, List<String> options, _S s, ValueChanged<String> onChanged) =>
    Padding(
      padding: EdgeInsets.only(left: s.s(16), bottom: s.s(10)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: EdgeInsets.only(top: s.s(30)),
            child: Text('↳ ', style: TextStyle(fontSize: s.f(12), color: _kLight, fontWeight: FontWeight.w700))),
        Expanded(child: _drop(label, value, options, s, onChanged)),
      ]),
    );

  Widget _multiSelect(String label, List<String> selected, List<String> options, _S s, ValueChanged<List<String>> onChanged) =>
    Padding(
      padding: EdgeInsets.only(bottom: s.s(10)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(fontSize: s.f(11.5), fontWeight: FontWeight.w600, color: _kLight)),
        SizedBox(height: s.s(8)),
        Wrap(spacing: s.s(6), runSpacing: s.s(6), children: options.map((o) {
          final sel = selected.contains(o);
          return GestureDetector(
            onTap: () {
              final updated = List<String>.from(selected);
              if (sel) updated.remove(o); else updated.add(o);
              onChanged(updated);
            },
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: s.s(12), vertical: s.s(6)),
              decoration: BoxDecoration(
                color: sel ? _kPurple : Colors.white,
                borderRadius: BorderRadius.circular(s.s(20)),
                border: Border.all(color: sel ? _kPurple : _kBorder),
              ),
              child: Text(o, style: TextStyle(fontSize: s.f(12), fontWeight: FontWeight.w600,
                  color: sel ? Colors.white : _kInk)),
            ),
          );
        }).toList()),
      ]),
    );

  Widget _row(List<Widget> children, _S s) {
    final items = <Widget>[];
    for (int i = 0; i < children.length; i++) {
      if (i > 0) items.add(SizedBox(width: s.s(10)));
      items.add(Expanded(child: children[i]));
    }
    return Padding(
      padding: EdgeInsets.only(bottom: s.s(10)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: items),
    );
  }

  InputDecoration _inputDeco(_S s, {bool isInvalid = false}) => InputDecoration(
    filled: true,
    fillColor: Colors.white,
    contentPadding: EdgeInsets.symmetric(horizontal: s.s(14), vertical: s.s(12)),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: BorderSide(color: isInvalid ? kRose : _kBorder, width: isInvalid ? 1.5 : 1)),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: BorderSide(color: isInvalid ? kRose : _kBorder, width: isInvalid ? 1.5 : 1)),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(s.s(12)), borderSide: BorderSide(color: isInvalid ? kRose : _kPurple, width: 1.5)),
  );
}

// ── Multi-line field with inline char counter (white theme) ───────────────────
class _EditMultiCounter extends StatefulWidget {
  final TextEditingController ctrl;
  final int? maxLength;
  final _S s;
  final InputDecoration inputDeco;
  const _EditMultiCounter({required this.ctrl, this.maxLength, required this.s, required this.inputDeco});
  @override State<_EditMultiCounter> createState() => _EditMultiCounterState();
}
class _EditMultiCounterState extends State<_EditMultiCounter> {
  int _count = 0;
  @override void initState() { super.initState(); _count = widget.ctrl.text.length; widget.ctrl.addListener(_update); }
  void _update() { if (widget.maxLength != null && mounted) setState(() => _count = widget.ctrl.text.length); }
  @override void dispose() { widget.ctrl.removeListener(_update); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final s = widget.s;
    return Stack(children: [
      TextField(
        controller: widget.ctrl,
        maxLines: 4,
        maxLength: widget.maxLength,
        maxLengthEnforcement: widget.maxLength != null ? MaxLengthEnforcement.enforced : null,
        style: TextStyle(color: _kInk, fontSize: s.f(13.5)),
        decoration: widget.inputDeco.copyWith(
          counterText: '',
          contentPadding: EdgeInsets.fromLTRB(s.s(14), s.s(12), s.s(14), s.s(28)),
        ),
      ),
      if (widget.maxLength != null)
        Positioned(
          bottom: s.s(8), right: s.s(12),
          child: Text(
            '$_count/${widget.maxLength}',
            style: TextStyle(
              fontSize: s.f(10.5),
              color: _count == widget.maxLength ? kRose : _kLight.withOpacity(0.5),
            ),
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
