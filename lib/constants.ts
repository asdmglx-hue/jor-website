// ── Cities & Countries — SINGLE SOURCE OF TRUTH ────────────────────────────
// Both the registration form (app/register/SubmitClient.tsx) and the
// Featured booking modal (components/FeaturedBookModal.tsx) import CITIES/
// CITY_GROUPS/COUNTRY_GROUPS from HERE, not from a locally-duplicated copy.
// This was previously two separately hand-maintained lists that happened to
// match by coincidence — if you're adding a new city or country, add it
// here ONCE and both places pick it up automatically. Do not re-duplicate
// this list into another file.
export const CITY_GROUPS: Record<string, string[]> = {
  'Punjab': ['Lahore','Faisalabad','Rawalpindi','Multan','Gujranwala','Sialkot','Bahawalpur','Sargodha','Sheikhupura','Rahim Yar Khan','Jhelum','Gujrat','Okara','Sahiwal','Khanewal','Vehari','Kasur','Dera Ghazi Khan','Layyah','Mianwali','Bhakkar','Toba Tek Singh','Chiniot','Hafizabad','Lodhran','Muzaffargarh','Rajanpur','Bahawalnagar','Pasrur','Wazirabad','Pakpattan','Narowal','Attock','Chakwal','Murree','Jhang','Wah','Burewala','Kamoke','Sadiqabad','Muridke','Khanpur','Mandi Bahauddin','Daska','Gojra','Ahmedpur East','Chishtian','Samundri','Ferozwala','Jaranwala','Hasilpur','Kamalia','Kot Abdul Malik','Arif Wala','Jampur','Jatoi','Shujabad','Haroonabad','Jalalpur Jattan','Kot Addu','Mian Channu','Khushab','Taxila','Shakargarh','Mailsi','Dipalpur','Haveli Lakha','Lala Musa','Sambrial','Bhalwal','Taunsa','Phool Nagar','Pattoki','Jauharabad','Chichawatni','Farooqabad','Sangla Hill','Gujar Khan','Kharian','Kot Radha Kishan','Ludhewala Waraich','Renala Khurd'],
  'Sindh': ['Karachi','Hyderabad','Sukkur','Larkana','Mirpur Khas','Khairpur','Nawabshah','Badin','Thatta','Jamshoro','Sanghar','Ghotki','Jacobabad','Shikarpur','Dadu','Tando Adam','Tando Allahyar','Bholari','Umerkot','Moro','Shahdadkot','Tando Muhammad Khan','Shahdadpur','Kamber Ali Khan','Kotri'],
  'KPK': ['Peshawar','Mardan','Mingora','Abbottabad','Kohat','Dera Ismail Khan','Bannu','Chitral','Mansehra','Haripur','Swabi','Nowshera','Charsadda','Kabal','Barikot','Shabqadar'],
  'Balochistan': ['Quetta','Gwadar','Turbat','Khuzdar','Chaman','Sibi','Zhob','Hub','Panjgur','Pishin','Dera Murad Jamali'],
  'Islamabad': ['Islamabad'],
  'Gilgit Baltistan': ['Gilgit','Skardu','Hunza'],
  'Azad Kashmir': ['Muzaffarabad','Mirpur','Rawalakot','Kotli','Bagh'],
  'Other': ['Other'],
};

// Flat form kept for the many places that just need "a city list", not
// grouped-by-province (FilterBar.tsx, PaymentProofModal.tsx, app/page.tsx).
// Derived, not hand-typed, so it's structurally impossible for this to
// drift from CITY_GROUPS above.
export const CITIES = Object.values(CITY_GROUPS).flat();

export const COUNTRIES_FLAT: string[] = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua & Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia & Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi',
  'Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Congo (DR)','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic',
  'Denmark','Djibouti','Dominica','Dominican Republic',
  'Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia',
  'Fiji','Finland','France',
  'Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana',
  'Haiti','Honduras','Hungary',
  'Iceland','India','Indonesia','Iran','Iraq','Ireland','Italy',
  'Jamaica','Japan','Jordan',
  'Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan',
  'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg',
  'Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar',
  'Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Macedonia','Norway',
  'Oman',
  'Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal',
  'Qatar',
  'Romania','Russia','Rwanda',
  'Saint Kitts & Nevis','Saint Lucia','Saint Vincent','Samoa','San Marino','Sao Tome & Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad & Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu',
  'UAE','Uganda','Ukraine','United Kingdom','USA','Uruguay','Uzbekistan',
  'Vanuatu','Vatican City','Venezuela','Vietnam',
  'Yemen',
  'Zambia','Zimbabwe',
];
export const COUNTRY_GROUPS: Record<string, string[]> = { 'Countries': COUNTRIES_FLAT };

export const CASTES = [
  'Jatt / Jat','Rajput','Arain','Gujjar','Sheikh','Syed','Mughal','Malik','Awan',
  'Bhatti','Khokhar','Dogar','Tiwana','Kamboh','Ansari','Qureshi',
  'Sindhi Syed','Soomro','Junejo','Memon','Lohana','Khuhro','Chandio','Brohi','Abbasi','Jatoi',
  'Bugti','Marri','Mengal','Rind','Raisani',
  'Afridi','Yousafzai','Khattak','Shinwari','Bangash','Mohmand','Wazir','Mehsud','Tareen',
  'Butt','Dar','Lone','Mir','Chaudhry','Raja',
  'Siddiqui','Farooqui','Usmani','Rizvi','Zaidi',
  'Other',
];

export const SECTS = ['Sunni','Shia','Barelvi','Deobandi','Ahl-e-Hadith','Other'];
export const EDUCATIONS = ['Matric','FSc/FA','Diploma',"Bachelor's","Master's",'MPhil','PhD','Other'];
export const MARITAL_STATUSES = ['Single','Divorced','Widowed'];
export const PRACTICE_LEVELS = ['Very Religious','Religious','Moderate','Liberal'];
export const COMPLEXIONS = ['Very Fair','Fair','Wheatish','Wheatish Brown','Brown','Dark'];
export const EMPLOYMENT_TYPES = ['Government','Private','Self-employed','Business','Freelance','Unemployed','Student'];
export const MONTHLY_INCOMES = ['Under 30K','30K – 60K','60K – 100K','100K – 200K','200K – 500K','500K+'];
export const HOME_TYPES = ['Owned','Rented','Family Home','Apartment'];
export const HIJAB_OPTIONS = ['Full Purdah','Hijab','Niqab','Scarf','No Hijab'];
export const BEARD_OPTIONS = ['Full Beard','Short Beard','Clean Shaven','Trimmed'];
export const LANGUAGES = ['Punjabi','Pashto','Sindhi','Saraiki','Balochi','Urdu','English'];

export const PROFESSIONS = [
  'Accountant','Architect','Army Officer','Banker','Business Owner',
  'Chartered Accountant','Chef','Civil Engineer','CSS Officer','Data Scientist',
  'Dentist','Doctor','Electrical Engineer','Freelancer','Government Officer',
  'Graphic Designer','HR Manager','IT Engineer','Journalist','Lawyer','Lecturer',
  'Mechanical Engineer','Nurse','Pharmacist','Police Officer','Professor',
  'Programmer','Property Dealer','Psychologist','Real Estate Agent','Software Engineer',
  'Teacher','Telecom Engineer','Trader','UI/UX Designer','Web Developer',
  'Businessman','Housewife','Student','Other',
];

// Countries aren't a fixed list like cities (they're whatever's actually
// in the data), so instead of a closed set, this normalizes known
// abbreviations to their full name — otherwise "UK" and "United Kingdom"
// silently count as two different countries anywhere this data gets
// aggregated (the homepage's country slider, the overseas SEO pages).
// Add more pairs here if the same pattern shows up for another country.
const COUNTRY_ALIASES: Record<string, string> = {
  'UK': 'United Kingdom',
  'USA': 'United States',
  'UAE': 'United Arab Emirates',
};

export function normalizeCountry(country: string): string {
  return COUNTRY_ALIASES[country] || country;
}

