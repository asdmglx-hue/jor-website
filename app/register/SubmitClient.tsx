'use client';
import { useState, useEffect, useRef } from 'react';
import { submitProposal, supabase } from '@/lib/supabase';

// ── Constants ──────────────────────────────────────────────────────────────────
const CASTE_GROUPS: Record<string, string[]> = {
  'Other': ['Other'],
  'Punjab': ['Jatt','Rajput','Arain','Gujjar','Sheikh','Syed','Mughal','Malik','Awan','Bhatti','Khokhar','Dogar','Tiwana','Kamboh','Ansari','Qureshi'],
  'Sindh': ['Sindhi Syed','Soomro','Junejo','Memon','Lohana','Khuhro','Chandio','Brohi','Abbasi','Jatoi','Palijo'],
  'Balochistan': ['Bugti','Marri','Mengal','Rind','Raisani'],
  'KPK / Pashtun': ['Afridi','Yousafzai','Khattak','Shinwari','Bangash','Mohmand','Wazir','Mehsud','Tareen'],
  'Kashmir & Northern': ['Butt','Dar','Lone','Mir','Chaudhry','Raja'],
  'Urdu-speaking / Muhajir': ['Siddiqui','Farooqui','Usmani','Rizvi','Zaidi','Memon'],
};

const PROFESSION_GROUPS: Record<string, string[]> = {
  'Other': ['Other'],
  'Healthcare': ['Doctor','General Physician','Dentist','Dermatologist','Pediatrician','Orthopedic Surgeon','Surgeon','ENT Specialist','Psychiatrist','Psychologist','Radiologist','Pathologist','Nurse','Nutritionist','Physiotherapist','Lab Technician','Pharmacist'],
  'Engineering': ['Software Engineer','Civil Engineer','Mechanical Engineer','Electrical Engineer','Electronics Engineer','Chemical Engineer','Aeronautical Engineer','Computer Engineer','Telecom Engineer','Textile Engineer'],
  'IT & Tech': ['Developer','Frontend Developer','Web Developer','Web Designer','UI/UX Designer','Graphic Designer','Programmer','Data Analyst','Data Scientist','Cyber Security Expert','IT Administrator','Network Engineer','Digital Marketer','Freelancer'],
  'Education': ['Teacher','Lecturer','Professor','Principal','Home Tutor','Coach','Trainer','Qari'],
  'Finance & Law': ['Accountant','Chartered Accountant','Financial Advisor','Investment Banker','Tax Consultant','Lawyer','Advocate','Judge','CSS Officer'],
  'Business & Management': ['Business Owner','General Manager','HR Manager','Marketing Manager','Sales Executive','Bank Manager','Real Estate Agent','Trader','Consultant','Property Dealer'],
  'Government & Forces': ['Army Officer','Police Officer','Government Officer','Administrative Officer','Field Officer'],
  'Arts & Media': ['Photographer','Videographer','Video Editor','Journalist','Animator'],
  'Skilled Trades': ['Electrician','Plumber','Carpenter','Welder','Painter','Tailor','Chef','Barber','Beautician'],
  'Services & Other': ['Driver','Shopkeeper','Call Center Agent','Social Worker','Farmer','Interior Designer','Event Manager','Businessman','Housewife','Student'],
};

const CITY_GROUPS: Record<string, string[]> = {
  'Punjab': ['Lahore','Faisalabad','Rawalpindi','Multan','Gujranwala','Sialkot','Bahawalpur','Sargodha','Sheikhupura','Rahim Yar Khan','Jhelum','Gujrat','Okara','Sahiwal','Khanewal','Vehari','Kasur','Dera Ghazi Khan','Layyah','Mianwali','Bhakkar','Toba Tek Singh','Chiniot','Hafizabad','Lodhran','Muzaffargarh','Rajanpur','Bahawalnagar','Pasrur','Wazirabad','Pakpattan','Narowal','Attock','Chakwal','Murree','Jhang','Wah','Burewala','Kamoke','Sadiqabad','Muridke','Khanpur','Mandi Bahauddin','Daska','Gojra','Ahmedpur East','Chishtian','Samundri','Ferozwala','Jaranwala','Hasilpur','Kamalia','Kot Abdul Malik','Arif Wala','Jampur','Jatoi','Shujabad','Haroonabad','Jalalpur Jattan','Kot Addu','Mian Channu','Khushab','Taxila','Shakargarh','Mailsi','Dipalpur','Haveli Lakha','Lala Musa','Sambrial','Bhalwal','Taunsa','Phool Nagar','Pattoki','Jauharabad','Chichawatni','Farooqabad','Sangla Hill','Gujar Khan','Kharian','Kot Radha Kishan','Ludhewala Waraich','Renala Khurd'],
  'Sindh': ['Karachi','Hyderabad','Sukkur','Larkana','Mirpur Khas','Khairpur','Nawabshah','Badin','Thatta','Jamshoro','Sanghar','Ghotki','Jacobabad','Shikarpur','Dadu','Tando Adam','Tando Allahyar','Bholari','Umerkot','Moro','Shahdadkot','Tando Muhammad Khan','Shahdadpur','Kamber Ali Khan','Kotri'],
  'KPK': ['Peshawar','Mardan','Mingora','Abbottabad','Kohat','Dera Ismail Khan','Bannu','Chitral','Mansehra','Haripur','Swabi','Nowshera','Charsadda','Kabal','Barikot','Shabqadar'],
  'Balochistan': ['Quetta','Gwadar','Turbat','Khuzdar','Chaman','Sibi','Zhob','Hub','Panjgur','Pishin','Dera Murad Jamali'],
  'Islamabad': ['Islamabad'],
  'Gilgit Baltistan': ['Gilgit','Skardu','Hunza'],
  'Azad Kashmir': ['Muzaffarabad','Mirpur','Rawalakot','Kotli','Bagh'],
  'Other': ['Other'],
};

const SECTS = ['Sunni','Shia','Barelvi','Deobandi','Ahl-e-Hadith','Other'];
const LANGUAGES = ['Punjabi','Pashto','Sindhi','Saraiki','Balochi','Urdu','English','Other'];
const EDUCATIONS = ['Matric','FSc/FA','Diploma',"Bachelor's","Master's",'MPhil','PhD','Other'];
const PRACTICE_LEVELS = ['High','Moderate','Low'];
const COMPLEXIONS = ['Fair','Wheatish','Brown','Dark'];
const EMPLOYMENT_TYPES = ['Full-time','Part-time','Self-employed','Freelance','Not employed'];
const MONTHLY_INCOMES = ['Under 30K','30K – 60K','60K – 100K','100K – 200K','200K – 500K','500K+'];
const HOME_TYPES = ['Own House','Rented House'];
const HIJAB_OPTIONS = ['Yes','No','Sometimes'];
const BEARD_OPTIONS = ['Yes','No','Light'];
const LIFESTYLE_OPTIONS = ['Active Living','Sedentary Living','Moderately Active'];
const PROPERTY_TYPES = ['Residential','Commercial','Land','Multiple'];

type DialCode = { flag: string; name: string; code: string };
function flagToISO(flag: string): string {
  return [...flag].map(c => String.fromCharCode(c.codePointAt(0)! - 127397)).join('').toLowerCase();
}
const DIAL_CODES: DialCode[] = [
  { flag:'🇵🇰', name:'Pakistan',                code:'+92'  },
  { flag:'🇦🇫', name:'Afghanistan',             code:'+93'  },
  { flag:'🇦🇱', name:'Albania',                 code:'+355' },
  { flag:'🇩🇿', name:'Algeria',                 code:'+213' },
  { flag:'🇦🇩', name:'Andorra',                 code:'+376' },
  { flag:'🇦🇴', name:'Angola',                  code:'+244' },
  { flag:'🇦🇬', name:'Antigua & Barbuda',       code:'+1268'},
  { flag:'🇦🇷', name:'Argentina',               code:'+54'  },
  { flag:'🇦🇲', name:'Armenia',                 code:'+374' },
  { flag:'🇦🇺', name:'Australia',               code:'+61'  },
  { flag:'🇦🇹', name:'Austria',                 code:'+43'  },
  { flag:'🇦🇿', name:'Azerbaijan',              code:'+994' },
  { flag:'🇧🇸', name:'Bahamas',                 code:'+1242'},
  { flag:'🇧🇭', name:'Bahrain',                 code:'+973' },
  { flag:'🇧🇩', name:'Bangladesh',              code:'+880' },
  { flag:'🇧🇧', name:'Barbados',                code:'+1246'},
  { flag:'🇧🇾', name:'Belarus',                 code:'+375' },
  { flag:'🇧🇪', name:'Belgium',                 code:'+32'  },
  { flag:'🇧🇿', name:'Belize',                  code:'+501' },
  { flag:'🇧🇯', name:'Benin',                   code:'+229' },
  { flag:'🇧🇹', name:'Bhutan',                  code:'+975' },
  { flag:'🇧🇴', name:'Bolivia',                 code:'+591' },
  { flag:'🇧🇦', name:'Bosnia & Herzegovina',    code:'+387' },
  { flag:'🇧🇼', name:'Botswana',                code:'+267' },
  { flag:'🇧🇷', name:'Brazil',                  code:'+55'  },
  { flag:'🇧🇳', name:'Brunei',                  code:'+673' },
  { flag:'🇧🇬', name:'Bulgaria',                code:'+359' },
  { flag:'🇧🇫', name:'Burkina Faso',            code:'+226' },
  { flag:'🇧🇮', name:'Burundi',                 code:'+257' },
  { flag:'🇨🇻', name:'Cabo Verde',              code:'+238' },
  { flag:'🇰🇭', name:'Cambodia',                code:'+855' },
  { flag:'🇨🇲', name:'Cameroon',                code:'+237' },
  { flag:'🇨🇦', name:'Canada',                  code:'+1'   },
  { flag:'🇨🇫', name:'Central African Republic',code:'+236' },
  { flag:'🇹🇩', name:'Chad',                    code:'+235' },
  { flag:'🇨🇱', name:'Chile',                   code:'+56'  },
  { flag:'🇨🇳', name:'China',                   code:'+86'  },
  { flag:'🇨🇴', name:'Colombia',                code:'+57'  },
  { flag:'🇰🇲', name:'Comoros',                 code:'+269' },
  { flag:'🇨🇬', name:'Congo',                   code:'+242' },
  { flag:'🇨🇩', name:'Congo (DR)',              code:'+243' },
  { flag:'🇨🇷', name:'Costa Rica',              code:'+506' },
  { flag:'🇭🇷', name:'Croatia',                 code:'+385' },
  { flag:'🇨🇺', name:'Cuba',                    code:'+53'  },
  { flag:'🇨🇾', name:'Cyprus',                  code:'+357' },
  { flag:'🇨🇿', name:'Czech Republic',          code:'+420' },
  { flag:'🇩🇰', name:'Denmark',                 code:'+45'  },
  { flag:'🇩🇯', name:'Djibouti',                code:'+253' },
  { flag:'🇩🇲', name:'Dominica',                code:'+1767'},
  { flag:'🇩🇴', name:'Dominican Republic',      code:'+1809'},
  { flag:'🇪🇨', name:'Ecuador',                 code:'+593' },
  { flag:'🇪🇬', name:'Egypt',                   code:'+20'  },
  { flag:'🇸🇻', name:'El Salvador',             code:'+503' },
  { flag:'🇬🇶', name:'Equatorial Guinea',       code:'+240' },
  { flag:'🇪🇷', name:'Eritrea',                 code:'+291' },
  { flag:'🇪🇪', name:'Estonia',                 code:'+372' },
  { flag:'🇸🇿', name:'Eswatini',                code:'+268' },
  { flag:'🇪🇹', name:'Ethiopia',                code:'+251' },
  { flag:'🇫🇯', name:'Fiji',                    code:'+679' },
  { flag:'🇫🇮', name:'Finland',                 code:'+358' },
  { flag:'🇫🇷', name:'France',                  code:'+33'  },
  { flag:'🇬🇦', name:'Gabon',                   code:'+241' },
  { flag:'🇬🇲', name:'Gambia',                  code:'+220' },
  { flag:'🇬🇪', name:'Georgia',                 code:'+995' },
  { flag:'🇩🇪', name:'Germany',                 code:'+49'  },
  { flag:'🇬🇭', name:'Ghana',                   code:'+233' },
  { flag:'🇬🇷', name:'Greece',                  code:'+30'  },
  { flag:'🇬🇩', name:'Grenada',                 code:'+1473'},
  { flag:'🇬🇹', name:'Guatemala',               code:'+502' },
  { flag:'🇬🇳', name:'Guinea',                  code:'+224' },
  { flag:'🇬🇼', name:'Guinea-Bissau',           code:'+245' },
  { flag:'🇬🇾', name:'Guyana',                  code:'+592' },
  { flag:'🇭🇹', name:'Haiti',                   code:'+509' },
  { flag:'🇭🇳', name:'Honduras',                code:'+504' },
  { flag:'🇭🇺', name:'Hungary',                 code:'+36'  },
  { flag:'🇮🇸', name:'Iceland',                 code:'+354' },
  { flag:'🇮🇳', name:'India',                   code:'+91'  },
  { flag:'🇮🇩', name:'Indonesia',               code:'+62'  },
  { flag:'🇮🇷', name:'Iran',                    code:'+98'  },
  { flag:'🇮🇶', name:'Iraq',                    code:'+964' },
  { flag:'🇮🇪', name:'Ireland',                 code:'+353' },
  { flag:'🇮🇹', name:'Italy',                   code:'+39'  },
  { flag:'🇯🇲', name:'Jamaica',                 code:'+1876'},
  { flag:'🇯🇵', name:'Japan',                   code:'+81'  },
  { flag:'🇯🇴', name:'Jordan',                  code:'+962' },
  { flag:'🇰🇿', name:'Kazakhstan',              code:'+7'   },
  { flag:'🇰🇪', name:'Kenya',                   code:'+254' },
  { flag:'🇰🇮', name:'Kiribati',                code:'+686' },
  { flag:'🇽🇰', name:'Kosovo',                  code:'+383' },
  { flag:'🇰🇼', name:'Kuwait',                  code:'+965' },
  { flag:'🇰🇬', name:'Kyrgyzstan',              code:'+996' },
  { flag:'🇱🇦', name:'Laos',                    code:'+856' },
  { flag:'🇱🇻', name:'Latvia',                  code:'+371' },
  { flag:'🇱🇧', name:'Lebanon',                 code:'+961' },
  { flag:'🇱🇸', name:'Lesotho',                 code:'+266' },
  { flag:'🇱🇷', name:'Liberia',                 code:'+231' },
  { flag:'🇱🇾', name:'Libya',                   code:'+218' },
  { flag:'🇱🇮', name:'Liechtenstein',           code:'+423' },
  { flag:'🇱🇹', name:'Lithuania',               code:'+370' },
  { flag:'🇱🇺', name:'Luxembourg',              code:'+352' },
  { flag:'🇲🇬', name:'Madagascar',              code:'+261' },
  { flag:'🇲🇼', name:'Malawi',                  code:'+265' },
  { flag:'🇲🇾', name:'Malaysia',                code:'+60'  },
  { flag:'🇲🇻', name:'Maldives',                code:'+960' },
  { flag:'🇲🇱', name:'Mali',                    code:'+223' },
  { flag:'🇲🇹', name:'Malta',                   code:'+356' },
  { flag:'🇲🇭', name:'Marshall Islands',        code:'+692' },
  { flag:'🇲🇷', name:'Mauritania',              code:'+222' },
  { flag:'🇲🇺', name:'Mauritius',               code:'+230' },
  { flag:'🇲🇽', name:'Mexico',                  code:'+52'  },
  { flag:'🇫🇲', name:'Micronesia',              code:'+691' },
  { flag:'🇲🇩', name:'Moldova',                 code:'+373' },
  { flag:'🇲🇨', name:'Monaco',                  code:'+377' },
  { flag:'🇲🇳', name:'Mongolia',                code:'+976' },
  { flag:'🇲🇪', name:'Montenegro',              code:'+382' },
  { flag:'🇲🇦', name:'Morocco',                 code:'+212' },
  { flag:'🇲🇿', name:'Mozambique',              code:'+258' },
  { flag:'🇲🇲', name:'Myanmar',                 code:'+95'  },
  { flag:'🇳🇦', name:'Namibia',                 code:'+264' },
  { flag:'🇳🇷', name:'Nauru',                   code:'+674' },
  { flag:'🇳🇵', name:'Nepal',                   code:'+977' },
  { flag:'🇳🇱', name:'Netherlands',             code:'+31'  },
  { flag:'🇳🇿', name:'New Zealand',             code:'+64'  },
  { flag:'🇳🇮', name:'Nicaragua',               code:'+505' },
  { flag:'🇳🇪', name:'Niger',                   code:'+227' },
  { flag:'🇳🇬', name:'Nigeria',                 code:'+234' },
  { flag:'🇲🇰', name:'North Macedonia',         code:'+389' },
  { flag:'🇳🇴', name:'Norway',                  code:'+47'  },
  { flag:'🇴🇲', name:'Oman',                    code:'+968' },
  { flag:'🇵🇼', name:'Palau',                   code:'+680' },
  { flag:'🇵🇸', name:'Palestine',               code:'+970' },
  { flag:'🇵🇦', name:'Panama',                  code:'+507' },
  { flag:'🇵🇬', name:'Papua New Guinea',        code:'+675' },
  { flag:'🇵🇾', name:'Paraguay',                code:'+595' },
  { flag:'🇵🇪', name:'Peru',                    code:'+51'  },
  { flag:'🇵🇭', name:'Philippines',             code:'+63'  },
  { flag:'🇵🇱', name:'Poland',                  code:'+48'  },
  { flag:'🇵🇹', name:'Portugal',                code:'+351' },
  { flag:'🇶🇦', name:'Qatar',                   code:'+974' },
  { flag:'🇷🇴', name:'Romania',                 code:'+40'  },
  { flag:'🇷🇺', name:'Russia',                  code:'+7'   },
  { flag:'🇷🇼', name:'Rwanda',                  code:'+250' },
  { flag:'🇰🇳', name:'Saint Kitts & Nevis',     code:'+1869'},
  { flag:'🇱🇨', name:'Saint Lucia',             code:'+1758'},
  { flag:'🇻🇨', name:'Saint Vincent',           code:'+1784'},
  { flag:'🇼🇸', name:'Samoa',                   code:'+685' },
  { flag:'🇸🇲', name:'San Marino',              code:'+378' },
  { flag:'🇸🇹', name:'Sao Tome & Principe',     code:'+239' },
  { flag:'🇸🇦', name:'Saudi Arabia',            code:'+966' },
  { flag:'🇸🇳', name:'Senegal',                 code:'+221' },
  { flag:'🇷🇸', name:'Serbia',                  code:'+381' },
  { flag:'🇸🇨', name:'Seychelles',              code:'+248' },
  { flag:'🇸🇱', name:'Sierra Leone',            code:'+232' },
  { flag:'🇸🇬', name:'Singapore',               code:'+65'  },
  { flag:'🇸🇰', name:'Slovakia',                code:'+421' },
  { flag:'🇸🇮', name:'Slovenia',                code:'+386' },
  { flag:'🇸🇧', name:'Solomon Islands',         code:'+677' },
  { flag:'🇸🇴', name:'Somalia',                 code:'+252' },
  { flag:'🇿🇦', name:'South Africa',            code:'+27'  },
  { flag:'🇸🇸', name:'South Sudan',             code:'+211' },
  { flag:'🇪🇸', name:'Spain',                   code:'+34'  },
  { flag:'🇱🇰', name:'Sri Lanka',               code:'+94'  },
  { flag:'🇸🇩', name:'Sudan',                   code:'+249' },
  { flag:'🇸🇷', name:'Suriname',                code:'+597' },
  { flag:'🇸🇪', name:'Sweden',                  code:'+46'  },
  { flag:'🇨🇭', name:'Switzerland',             code:'+41'  },
  { flag:'🇸🇾', name:'Syria',                   code:'+963' },
  { flag:'🇹🇼', name:'Taiwan',                  code:'+886' },
  { flag:'🇹🇯', name:'Tajikistan',              code:'+992' },
  { flag:'🇹🇿', name:'Tanzania',                code:'+255' },
  { flag:'🇹🇭', name:'Thailand',                code:'+66'  },
  { flag:'🇹🇱', name:'Timor-Leste',             code:'+670' },
  { flag:'🇹🇬', name:'Togo',                    code:'+228' },
  { flag:'🇹🇴', name:'Tonga',                   code:'+676' },
  { flag:'🇹🇹', name:'Trinidad & Tobago',       code:'+1868'},
  { flag:'🇹🇳', name:'Tunisia',                 code:'+216' },
  { flag:'🇹🇷', name:'Turkey',                  code:'+90'  },
  { flag:'🇹🇲', name:'Turkmenistan',            code:'+993' },
  { flag:'🇹🇻', name:'Tuvalu',                  code:'+688' },
  { flag:'🇺🇬', name:'Uganda',                  code:'+256' },
  { flag:'🇺🇦', name:'Ukraine',                 code:'+380' },
  { flag:'🇦🇪', name:'UAE',                     code:'+971' },
  { flag:'🇬🇧', name:'United Kingdom',          code:'+44'  },
  { flag:'🇺🇸', name:'USA',                     code:'+1'   },
  { flag:'🇺🇾', name:'Uruguay',                 code:'+598' },
  { flag:'🇺🇿', name:'Uzbekistan',              code:'+998' },
  { flag:'🇻🇺', name:'Vanuatu',                 code:'+678' },
  { flag:'🇻🇦', name:'Vatican City',            code:'+39'  },
  { flag:'🇻🇪', name:'Venezuela',               code:'+58'  },
  { flag:'🇻🇳', name:'Vietnam',                 code:'+84'  },
  { flag:'🇾🇪', name:'Yemen',                   code:'+967' },
  { flag:'🇿🇲', name:'Zambia',                  code:'+260' },
  { flag:'🇿🇼', name:'Zimbabwe',                code:'+263' },
];

const COUNTRIES_FLAT: string[] = [
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
const COUNTRY_GROUPS: Record<string, string[]> = { 'Countries': COUNTRIES_FLAT };

// ── Styles ─────────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 11, border: '1.5px solid #E8E6F5', fontSize: 14, outline: 'none', color: '#1A1830', background: '#fff', boxSizing: 'border-box' };
const sel: React.CSSProperties = { ...inp, cursor: 'pointer' };

// ── Helpers ────────────────────────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#E11D48' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function SecHeader({ title }: { title: string }) {
  return (
    <div style={{ marginTop: 28, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#B0ADCB', letterSpacing: 1 }}>{title}</div>
      <div style={{ height: 1, background: '#E8E6F5', marginTop: 6 }} />
    </div>
  );
}

function SubSection({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 8, marginLeft: 16, marginBottom: 14, padding: 12, background: '#F8F7FF', borderRadius: 12, border: '1px solid #E8E6F5' }}>
      {children}
    </div>
  );
}

function DegreePair({ degreeKey, instituteKey, form, set, inp }: {
  degreeKey: keyof FormData; instituteKey: keyof FormData;
  form: FormData; set: (k: keyof FormData, v: string) => void; inp: React.CSSProperties;
}) {
  return (
    <div style={{ padding: 12, background: '#F8F7FF', borderRadius: 12, border: '1px solid #E8E6F5' }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#9990B8', marginBottom: 4 }}>Title</div>
        <input value={form[degreeKey] as string} onChange={e => set(degreeKey, e.target.value)} style={inp} placeholder="e.g. BS Computer Science" />
      </div>
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#9990B8', marginBottom: 4 }}>Institute</div>
        <input value={form[instituteKey] as string} onChange={e => set(instituteKey, e.target.value)} style={inp} placeholder="e.g. University of Punjab" />
      </div>
    </div>
  );
}

function DegreeFields({ form, set, inp }: {
  form: FormData; set: (k: keyof FormData, v: string) => void; inp: React.CSSProperties;
}) {
  const [show2, setShow2] = useState(!!(form.degree_title_2 || form.institute_2));
  const [show3, setShow3] = useState(!!(form.degree_title_3 || form.institute_3));

  const remove2 = () => {
    set('degree_title_2', ''); set('institute_2', '');
    set('degree_title_3', ''); set('institute_3', '');
    setShow2(false); setShow3(false);
  };
  const remove3 = () => {
    set('degree_title_3', ''); set('institute_3', '');
    setShow3(false);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1830', marginBottom: 6 }}>Degree</div>
      <DegreePair degreeKey="degree_title" instituteKey="institute" form={form} set={set} inp={inp} />

      {show2 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#534AB7' }}>Degree 2</span>
            <button onClick={remove2} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
              ✕ Remove
            </button>
          </div>
          <DegreePair degreeKey="degree_title_2" instituteKey="institute_2" form={form} set={set} inp={inp} />
        </div>
      )}

      {show2 && show3 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#534AB7' }}>Degree 3</span>
            <button onClick={remove3} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
              ✕ Remove
            </button>
          </div>
          <DegreePair degreeKey="degree_title_3" instituteKey="institute_3" form={form} set={set} inp={inp} />
        </div>
      )}

      {(!show2 || (show2 && !show3)) && (
        <button onClick={() => show2 ? setShow3(true) : setShow2(true)}
          style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#534AB7', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> Add another degree
        </button>
      )}
    </div>
  );
}

function SearchableSelect({ value, onChange, groups, placeholder, hasError }: { value: string; onChange: (v: string) => void; groups: Record<string, string[]>; placeholder: string; hasError?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allItems = Object.entries(groups).flatMap(([, items]) => items);
  const filtered = query.trim()
    ? allItems.filter(item => item.toLowerCase().includes(query.toLowerCase()))
    : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => { setOpen(o => !o); setQuery(''); }} style={{
        ...sel, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: value ? '#1A1830' : '#9CA3AF',
        ...(hasError ? { border: '1.5px solid #DC2626', boxShadow: '0 0 0 2px rgba(220,38,38,0.12)' } : {}),
      }}>
        <span>{value || placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1.5px solid #E8E6F5', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4, overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #E8E6F5', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0ADCB" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1A1830', width: '100%', background: 'transparent' }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {value && (
              <div onClick={() => { onChange(''); setOpen(false); }} style={{ padding: '8px 12px', fontSize: 13, color: '#B0ADCB', cursor: 'pointer' }}>
                Clear selection
              </div>
            )}
            {filtered
              ? filtered.map(item => (
                <div key={item} onClick={() => { onChange(item); setOpen(false); setQuery(''); }}
                  style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: item === value ? '#534AB7' : '#1A1830', fontWeight: item === value ? 700 : 400, background: item === value ? '#EEEDFE' : 'transparent' }}
                  onMouseEnter={e => { if (item !== value) (e.target as HTMLElement).style.background = '#F8F7FF'; }}
                  onMouseLeave={e => { if (item !== value) (e.target as HTMLElement).style.background = 'transparent'; }}>
                  {item}
                </div>
              ))
              : Object.entries(groups).map(([group, items]) => (
                <div key={group}>
                  {Object.keys(groups).length > 1 && <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 800, color: '#B0ADCB', letterSpacing: 0.8, background: '#FAFAFA' }}>{group.toUpperCase()}</div>}
                  {items.map(item => (
                    <div key={`${group}-${item}`} onClick={() => { onChange(item); setOpen(false); setQuery(''); }}
                      style={{ padding: '8px 12px 8px 16px', fontSize: 13, cursor: 'pointer', color: item === value ? '#534AB7' : '#1A1830', fontWeight: item === value ? 700 : 400, background: item === value ? '#EEEDFE' : 'transparent' }}
                      onMouseEnter={e => { if (item !== value) (e.target as HTMLElement).style.background = '#F8F7FF'; }}
                      onMouseLeave={e => { if (item !== value) (e.target as HTMLElement).style.background = 'transparent'; }}>
                      {item}
                    </div>
                  ))}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── Profile Photo Crop Modal ───────────────────────────────────────────────────
function PhotoCropModal({ src, onDone, onCancel }: { src: string; onDone: (blob: Blob) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const [cropping, setCropping] = useState(false);
  const SIZE = 300;

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const s = Math.max(SIZE / img.width, SIZE / img.height);
      setScale(s);
      setOffset({ x: 0, y: 0 });
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, SIZE / 2 - w / 2 + offset.x, SIZE / 2 - h / 2 + offset.y, w, h);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }, [scale, offset, imgRef.current]);

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({ x: dragStart.current.ox + e.clientX - dragStart.current.mx, y: dragStart.current.oy + e.clientY - dragStart.current.my });
  };
  const onMouseUp = () => setDragging(false);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setDragging(true);
    dragStart.current = { mx: t.clientX, my: t.clientY, ox: offset.x, oy: offset.y };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const t = e.touches[0];
    setOffset({ x: dragStart.current.ox + t.clientX - dragStart.current.mx, y: dragStart.current.oy + t.clientY - dragStart.current.my });
  };

  const handleCrop = async () => {
    setCropping(true);
    const canvas = canvasRef.current!;
    canvas.toBlob(blob => { if (blob) onDone(blob); }, 'image/jpeg', 0.9);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: SIZE, marginBottom: 16 }}>
        <button onClick={onCancel} style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
        <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Adjust Photo</span>
        <button onClick={handleCrop} disabled={cropping} style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7C5CFA,#5A3FD6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {cropping ? '...' : 'Use Photo'}
        </button>
      </div>
      <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ borderRadius: SIZE / 2, cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp} />
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <input type="range" min={0.2} max={4} step={0.05} value={scale}
          onChange={e => setScale(+e.target.value)}
          style={{ width: SIZE, accentColor: '#7C5CFA' }} />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Drag to reposition · Slider to zoom</span>
      </div>
    </div>
  );
}

function PhoneInput({ value, onChange, dialCode, onDialChange, required, hasError }: { value: string; onChange: (v: string) => void; dialCode: string; onDialChange: (v: string) => void; required?: boolean; hasError?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const selected = DIAL_CODES.find(d => d.code === dialCode) ?? DIAL_CODES[0];
  const filtered = query.trim() ? DIAL_CODES.filter(d => d.name.toLowerCase().includes(query.toLowerCase()) || d.code.includes(query)) : DIAL_CODES;
  const isPK = dialCode === '+92';
  const placeholder = isPK ? '0300 0000000' : 'Phone number';

  const handlePhoneChange = (raw: string) => {
    if (isPK) {
      const digits = raw.replace(/\D/g, '');
      const maxDigits = digits.startsWith('0') || digits.length === 0 ? 11 : 10;
      const capped = digits.slice(0, maxDigits);
      const breakAt = capped.startsWith('0') ? 4 : 3;
      const formatted = capped.length > breakAt ? `${capped.slice(0, breakAt)} ${capped.slice(breakAt)}` : capped;
      onChange(formatted);
    } else {
      onChange(raw.slice(0, 12));
    }
  };

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
        <button type="button" onClick={() => { setOpen(o => !o); setQuery(''); }}
          style={{ height: 44, padding: '0 10px', borderRadius: 11, border: '1.5px solid #E8E6F5', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: '#1A1830', whiteSpace: 'nowrap' }}>
          <img src={`https://flagcdn.com/20x15/${flagToISO(selected.flag)}.png`} width={20} height={15} alt="" style={{ borderRadius: 2, flexShrink: 0 }} />
          <span style={{ fontWeight: 700 }}>{selected.code}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {open && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: '#fff', border: '1.5px solid #E8E6F5', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4, width: 240, overflow: 'hidden' }}>
            <div style={{ padding: '8px 10px', borderBottom: '1px solid #E8E6F5', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B0ADCB" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search country..." style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1A1830', width: '100%', background: 'transparent' }} />
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {filtered.map(d => (
                <div key={d.name} onClick={() => { onDialChange(d.code); setOpen(false); setQuery(''); }}
                  style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: d.code === dialCode ? '#EEEDFE' : 'transparent', color: d.code === dialCode ? '#534AB7' : '#1A1830', fontWeight: d.code === dialCode ? 700 : 400 }}
                  onMouseEnter={e => { if (d.code !== dialCode) (e.currentTarget as HTMLElement).style.background = '#F8F7FF'; }}
                  onMouseLeave={e => { if (d.code !== dialCode) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <img src={`https://flagcdn.com/20x15/${flagToISO(d.flag)}.png`} width={20} height={15} alt="" style={{ borderRadius: 2, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{d.name}</span>
                  <span style={{ color: '#B0ADCB', fontSize: 12 }}>{d.code}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <input value={value} onChange={e => handlePhoneChange(e.target.value)} style={{ ...inp, flex: 1, ...(hasError ? { border: '1.5px solid #DC2626', boxShadow: '0 0 0 2px rgba(220,38,38,0.12)' } : {}) }} placeholder={placeholder} type="tel" />
    </div>
  );
}

function Sel({ value, onChange, options, placeholder, hasError }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string; hasError?: boolean }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...sel, ...(hasError ? { border: '1.5px solid #DC2626', boxShadow: '0 0 0 2px rgba(220,38,38,0.12)' } : {}) }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ── Form state ─────────────────────────────────────────────────────────────────
type FormData = {
  name: string; gender: string; age: string; phone: string; phone2: string;
  height_feet: string; height_inches_extra: string;
  country: string; city: string;
  home_type: string; location: string; house_size: string; house_size_unit: string;
  caste: string; caste_custom: string;
  sect: string; language: string;
  profession: string; profession_custom: string;
  marital_status: string; marriage_number: string;
  has_kids: string; boys: string; girls: string;
  about: string; looking_for: string;
  // Step 2
  father_alive: string; mother_alive: string;
  father_occupation: string; father_occupation_custom: string;
  mother_occupation: string; mother_occupation_custom: string;
  has_siblings: string; brothers: string; sisters: string;
  education: string; degree_title: string; institute: string;
  degree_title_2: string; institute_2: string;
  degree_title_3: string; institute_3: string;
  monthly_income: string; employment_type: string;
  weight_kg: string; complexion: string;
  practice_level: string; hijab_or_beard: string;
  has_car: string; has_other_property: string; other_property: string;
  has_disability: string; disability_details: string;
  lifestyle: string; smoker: string;
  phone_dial_code: string; phone2_dial_code: string;
  // Step 3
  cnic: string; password: string; confirm_password: string;
  // Step 5 (Review)
  affiliate: string;
};

const EMPTY: FormData = {
  name: '', gender: '', age: '', phone: '', phone2: '',
  height_feet: '', height_inches_extra: '',
  country: '', city: '',
  home_type: '', location: '', house_size: '', house_size_unit: 'Marla',
  caste: '', caste_custom: '',
  sect: '', language: '',
  profession: '', profession_custom: '',
  marital_status: '', marriage_number: '',
  has_kids: '', boys: '', girls: '',
  about: '', looking_for: '',
  father_alive: '', mother_alive: '',
  father_occupation: '', father_occupation_custom: '',
  mother_occupation: '', mother_occupation_custom: '',
  has_siblings: '', brothers: '', sisters: '',
  education: '', degree_title: '', institute: '',
  degree_title_2: '', institute_2: '',
  degree_title_3: '', institute_3: '',
  monthly_income: '', employment_type: '',
  weight_kg: '', complexion: '',
  practice_level: '', hijab_or_beard: '',
  has_car: '', has_other_property: '', other_property: '',
  has_disability: '', disability_details: '',
  lifestyle: '', smoker: '',
  phone_dial_code: '+92', phone2_dial_code: '+92',
  cnic: '', password: '', confirm_password: '',
  affiliate: '',
};

const DRAFT_KEY = 'jor_submit_draft';
const STEP_KEY  = 'jor_submit_step';

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SubmitClient() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [maxStep, setMaxStep] = useState<number>(1);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState('');
  const [cropSrc, setCropSrc] = useState('');
  const [viewImg, setViewImg] = useState('');
  const [cnicFront, setCnicFront] = useState<File | null>(null);
  const [cnicBack, setCnicBack] = useState<File | null>(null);
  const [cnicFrontPreview, setCnicFrontPreview] = useState('');
  const [cnicBackPreview, setCnicBackPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState('');

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    try {
      const savedStep = Number(localStorage.getItem(STEP_KEY)) || 1;
      const savedForm = (() => {
        const s = localStorage.getItem(DRAFT_KEY);
        return s ? { ...EMPTY, ...JSON.parse(s) } : EMPTY;
      })();
      setStep(savedStep as 1 | 2 | 3 | 4 | 5);
      setMaxStep(savedStep);
      setForm(savedForm);
    } catch {}
    setMounted(true);
  }, []);
  useEffect(() => { if (mounted) localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); }, [form, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem(STEP_KEY, String(step)); }, [step, mounted]);

  // handleSubmit is only called from step 4

  const set = (key: keyof FormData, val: string) => { setErrorField(''); setForm(f => ({ ...f, [key]: val })); };
  const err = (field: string): React.CSSProperties => errorField === field ? { border: '1.5px solid #DC2626', boxShadow: '0 0 0 2px rgba(220,38,38,0.12)' } : {};

  const maritalOptions = form.gender === 'Female'
    ? ['Never married','Divorced','Khula','Widowed']
    : form.gender === 'Male'
      ? ['Never married','Married','Divorced','Widowed']
      : ['Never married','Married','Divorced','Khula','Widowed'];

  const showKids = ['divorced','khula','widowed'].includes(form.marital_status.toLowerCase());
  const showDegreeTitle = ["Bachelor's","Master's",'MPhil','PhD','Other'].includes(form.education);

  const validateStep = (): { msg: string; field: string } => {
    const fail = (msg: string, field: string) => ({ msg, field });
    if (step === 1) {
      const cnicDigits = form.cnic.replace(/\D/g, '');
      if (!cnicDigits) return fail('CNIC number is required', 'cnic');
      if (cnicDigits.length !== 13) return fail('Enter a complete 13-digit CNIC number', 'cnic');
      if (!form.password.trim() || form.password.length < 4) return fail('Password must be at least 4 characters', 'password');
      if (form.password !== form.confirm_password) return fail('Passwords do not match', 'confirm_password');
    }
    if (step === 2) {
      if (!profilePhoto) return fail('Profile photo is required', 'profilePhoto');
      if (!form.name.trim()) return fail('Full name is required', 'name');
      if (!form.gender) return fail('Gender is required', 'gender');
      if (!form.age || +form.age < 18 || +form.age > 80) return fail('Valid age (18–80) is required', 'age');
      if (!form.phone.trim()) return fail('Phone number is required', 'phone');
      if (form.phone_dial_code === '+92') {
        const digits = form.phone.replace(/\D/g, '');
        const required = digits.startsWith('0') ? 11 : 10;
        if (digits.length !== required) return fail(`Enter a valid Pakistani number (${required} digits)`, 'phone');
      }
      if (!form.height_feet) return fail('Height is required', 'height_feet');
      if (!form.city) return fail('City is required', 'city');
      if (!form.caste) return fail('Caste is required', 'caste');
      if (form.caste === 'Other' && !form.caste_custom.trim()) return fail('Please specify your caste', 'caste_custom');
      if (!form.sect) return fail('Sect is required', 'sect');
      if (!form.profession) return fail('Profession is required', 'profession');
      if (form.profession === 'Other' && !form.profession_custom.trim()) return fail('Please specify your profession', 'profession_custom');
      if (!form.home_type) return fail('House type is required', 'home_type');
      if (!form.marital_status) return fail('Marital status is required', 'marital_status');
    }
    if (step === 4) {
      if (!cnicFront) return fail('CNIC front photo is required', 'cnicFront');
      if (!cnicBack) return fail('CNIC back photo is required', 'cnicBack');
    }
    return { msg: '', field: '' };
  };

  const next = async () => {
    const { msg: err, field } = validateStep();
    if (err) { setError(err); setErrorField(field); return; }
    if (step === 1) {
      const digits = form.cnic.replace(/-/g, '').trim();
      const hyphenated = `${digits.slice(0,5)}-${digits.slice(5,12)}-${digits.slice(12)}`;
      // DB stores CNIC in both formats — check both
      const { data } = await supabase
        .from('proposals')
        .select('id')
        .or(`cnic.eq.${digits},cnic.eq.${hyphenated}`)
        .in('status', ['active', 'approved'])
        .limit(1);
      if (data && data.length > 0) {
        setError('This CNIC is already registered. Please login instead.');
        return;
      }
    }
    setError(''); setErrorField('');
    setStep(s => { const n = (s + 1) as 1 | 2 | 3 | 4 | 5; setMaxStep(m => Math.max(m, n)); return n; });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const skip = () => {
    setError(''); setErrorField('');
    setStep(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prev = () => {
    setError(''); setErrorField('');
    setStep(s => (s - 1) as 1 | 2 | 3 | 4 | 5);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    const { msg: err, field } = validateStep();
    if (err) { setError(err); setErrorField(field); return; }
    setSubmitting(true); setError(''); setErrorField('');

    const totalInches = (+form.height_feet * 12) + (+form.height_inches_extra || 0);
    const actualProfession = form.profession === 'Other' ? form.profession_custom.trim() : form.profession;
    const actualCaste = form.caste === 'Other' ? form.caste_custom.trim() : form.caste;
    const actualFatherOcc = form.father_occupation === 'Other' ? form.father_occupation_custom.trim() : form.father_occupation;
    const actualMotherOcc = form.mother_occupation === 'Other' ? form.mother_occupation_custom.trim() : form.mother_occupation;

    // Upload profile photo
    let profilePhotoUrl: string | undefined;
    const digits = form.cnic.replace(/-/g, '').trim();
    if (profilePhoto) {
      const ext = profilePhoto.name.split('.').pop();
      const { data: pd } = await supabase.storage.from('profile-photos').upload(`${digits}/profile.${ext}`, profilePhoto, { upsert: true });
      if (pd) { const { data: url } = supabase.storage.from('profile-photos').getPublicUrl(pd.path); profilePhotoUrl = url.publicUrl; }
    }

    // Upload CNIC photos — via secure server-side R2 upload endpoint (not
    // client-side Supabase Storage), since CNIC images must go through a
    // credential-free Worker binding rather than any key exposed to the browser.
    let cnicFrontUrl: string | undefined;
    let cnicBackUrl: string | undefined;
    const cleanCnic = `${digits.slice(0,5)}-${digits.slice(5,12)}-${digits.slice(12)}`;
    if (cnicFront && cnicBack) {
      const uploadForm = new FormData();
      uploadForm.append('cnic', digits);
      uploadForm.append('front', cnicFront);
      uploadForm.append('back', cnicBack);
      try {
        const res = await fetch('/api/upload-cnic', { method: 'POST', body: uploadForm });
        const uploaded = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(uploaded.error || 'Failed to upload CNIC photos. Please try again.');
          setSubmitting(false);
          return;
        }
        cnicFrontUrl = uploaded.front;
        cnicBackUrl = uploaded.back;
      } catch {
        setError('Failed to upload CNIC photos. Please check your connection and try again.');
        setSubmitting(false);
        return;
      }
    }

    const { success, error: apiErr } = await submitProposal({
      name: form.name.trim(),
      gender: form.gender,
      age: +form.age,
      contact_phone: `${form.phone_dial_code} ${form.phone.trim()}`,
      contact_phone_2: form.phone2.trim() ? `${form.phone2_dial_code} ${form.phone2.trim()}` : undefined,
      height_inches: totalInches || undefined,
      country: form.country || undefined,
      city: form.city,
      home_type: form.home_type || undefined,
      location: form.location || undefined,
      house_size: form.house_size ? `${form.house_size} ${form.house_size_unit}` : undefined,
      caste: actualCaste,
      sect: form.sect,
      profession: actualProfession,
      marital_status: form.marital_status,
      marriage_number: form.marriage_number || undefined,
      boys: form.boys ? +form.boys : undefined,
      girls: form.girls ? +form.girls : undefined,
      about: form.about || undefined,
      looking_for: form.looking_for || undefined,
      // step 2
      father_alive: form.father_alive === 'Alive' ? true : form.father_alive === 'Deceased' ? false : undefined,
      mother_alive: form.mother_alive === 'Alive' ? true : form.mother_alive === 'Deceased' ? false : undefined,
      father_occupation: actualFatherOcc || undefined,
      mother_occupation: actualMotherOcc || undefined,
      brothers: form.brothers ? +form.brothers : undefined,
      sisters: form.sisters ? +form.sisters : undefined,
      education: form.education || undefined,
      degree_title: form.degree_title || undefined,
      institute: form.institute || undefined,
      degree_title_2: form.degree_title_2 || undefined,
      institute_2: form.institute_2 || undefined,
      degree_title_3: form.degree_title_3 || undefined,
      institute_3: form.institute_3 || undefined,
      monthly_income: form.monthly_income || undefined,
      employment_type: form.employment_type || undefined,
      weight_kg: form.weight_kg ? +form.weight_kg : undefined,
      complexion: form.complexion || undefined,
      practice_level: form.practice_level || undefined,
      hijab: form.gender === 'Female' ? form.hijab_or_beard || undefined : undefined,
      beard: form.gender === 'Male' ? form.hijab_or_beard || undefined : undefined,
      has_car: form.has_car || undefined,
      has_other_property: form.has_other_property || undefined,
      other_property: form.other_property || undefined,
      has_disability: form.has_disability === 'Yes' ? true : form.has_disability === 'No' ? false : undefined,
      disability_details: form.disability_details || undefined,
      physically_active: form.lifestyle || undefined,
      smokes: form.smoker === 'Yes' ? true : form.smoker === 'No' ? false : undefined,
      languages: form.language ? [form.language] : undefined,
      // step 3
      cnic: cleanCnic,
      password: form.password.trim(),
      profile_photo_url: profilePhotoUrl,
      cnic_front_url: cnicFrontUrl,
      cnic_back_url: cnicBackUrl,
      affiliate_code: form.affiliate.trim() ? form.affiliate.trim().toUpperCase() : undefined,
    });

    setSubmitting(false);
    if (success) {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(STEP_KEY);
      setSubmitted(true);
    } else setError(apiErr || 'Something went wrong. Please try again.');
  };

  if (cropSrc) return (
    <PhotoCropModal
      src={cropSrc}
      onDone={blob => {
        const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
        setProfilePhoto(file);
        setProfilePhotoPreview(URL.createObjectURL(blob));
        setCropSrc('');
      }}
      onCancel={() => setCropSrc('')}
    />
  );

  if (viewImg) return (
    <div onClick={() => setViewImg('')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
      <img src={viewImg} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()} />
      <button onClick={() => setViewImg('')} style={{ position: 'fixed', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>✕ Close</button>
    </div>
  );

  if (submitted) return (
    <div style={{ maxWidth: 500, margin: '80px auto 0', padding: '0 20px', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1A1830', marginBottom: 8 }}>Proposal Submitted!</h2>
      <p style={{ color: '#6B6893', marginBottom: 24, lineHeight: 1.6 }}>
        Your proposal has been received and is under review. It will be published within 24 hours once approved. If you haven't paid yet, please complete the payment.
      </p>
      <a href="/" style={{ display: 'inline-block', padding: '13px 32px', borderRadius: 12, background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>
        Back to Home
      </a>
    </div>
  );

  const steps = ['Account Setup', 'Basic Info', 'Additional Info', 'Verification', 'Review'];
  const stepsMobile = ['Account', 'Basic Info', 'Additional Info', 'Verification', 'Review'];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1830', marginBottom: 4 }}>Post Your Rishta</h1>
        <p style={{ color: '#6B6893', fontSize: 14 }}>Reaches thousands of families</p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
        {steps.map((s, i) => {
          const reachable = i + 1 !== step;
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center', cursor: reachable ? 'pointer' : 'default' }}
              onClick={() => {
                if (!reachable) return;
                const targetStep = (i + 1) as 1 | 2 | 3 | 4 | 5;
                if (targetStep > step) {
                  const { msg: err, field } = validateStep();
                  if (err) { setError(err); setErrorField(field); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
                }
                setError(''); setErrorField('');
                setStep(targetStep);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}>
              <div style={{ height: 4, borderRadius: 4, background: i + 1 <= step ? '#534AB7' : '#E8E6F5', marginBottom: 6 }} />
              <span className="step-label-desktop" style={{ fontSize: 10, fontWeight: 700, color: i + 1 <= step ? '#534AB7' : '#B0ADCB', textDecoration: reachable ? 'underline' : 'none' }}>{s}</span>
              <span className="step-label-mobile" style={{ fontSize: 10, fontWeight: 700, color: i + 1 <= step ? '#534AB7' : '#B0ADCB', textDecoration: reachable ? 'underline' : 'none' }}>{stepsMobile[i]}</span>
            </div>
          );
        })}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E8E6F5', borderRadius: 20, padding: '28px' }}>

        {/* ── Step 1: Account Setup ─────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1830' }}>Account Setup</div>
                <div style={{ fontSize: 12, color: '#B0ADCB' }}>You'll use these to login later</div>
              </div>
            </div>

            <div style={{ background: '#EEEDFE', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#534AB7', lineHeight: 1.6 }}>
              Your CNIC and password are used to login and manage your profile.
            </div>

            <Field label="CNIC Number" required>
              <input value={form.cnic} style={{ ...inp, ...err('cnic') }} onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 13);
                let formatted = digits;
                if (digits.length > 5) formatted = `${digits.slice(0, 5)}-${digits.slice(5)}`;
                if (digits.length > 12) formatted = `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
                set('cnic', formatted);
              }} placeholder="12345-1234567-1" maxLength={15} />
            </Field>
            {error.includes('already registered') && (
              <div style={{ marginTop: -8, marginBottom: 14, fontSize: 13 }}>
                <a href="/login" style={{ color: '#534AB7', fontWeight: 700, textDecoration: 'none' }}>→ Go to Login</a>
              </div>
            )}
            <Field label="Set Password" required>
              <input value={form.password} onChange={e => set('password', e.target.value)} style={{ ...inp, ...err('password') }} placeholder="Min 4 characters" type="password" />
            </Field>
            <Field label="Confirm Password" required>
              <input value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} style={{ ...inp, ...err('confirm_password') }} placeholder="Repeat your password" type="password" />
            </Field>
          </div>
        )}

        {/* ── Step 2: Basic Information ──────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1830' }}>Basic Information</div>
                <div style={{ fontSize: 12, color: '#B0ADCB' }}>Fields marked with * are required</div>
              </div>
            </div>

            <Field label="Profile Photo" required>
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setCropSrc(URL.createObjectURL(f));
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 80, height: 80, borderRadius: 40, border: `2px dashed ${errorField === 'profilePhoto' ? '#DC2626' : profilePhoto ? '#534AB7' : '#E8E6F5'}`, background: profilePhoto ? '#EEEDFE' : errorField === 'profilePhoto' ? '#FEF2F2' : '#FAFAFA', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {profilePhotoPreview
                      ? <img src={profilePhotoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B0ADCB" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    }
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: profilePhoto ? '#534AB7' : '#1A1830' }}>
                      {profilePhoto ? '✓ ' + profilePhoto.name : 'Upload Profile Photo'}
                    </div>
                    <div style={{ fontSize: 12, color: '#B0ADCB', marginTop: 3 }}>Clear face photo · JPG or PNG</div>
                    <div style={{ marginTop: 8, display: 'inline-block', padding: '5px 14px', borderRadius: 8, background: '#EEEDFE', fontSize: 12, fontWeight: 700, color: '#534AB7' }}>
                      {profilePhoto ? 'Change Photo' : 'Choose Photo'}
                    </div>
                  </div>
                </div>
              </label>
            </Field>

            <Field label="Full Name" required>
              <input value={form.name} onChange={e => set('name', e.target.value)} style={{ ...inp, ...err('name') }} placeholder="e.g. Fatima Rehman" />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Age" required>
                <input type="number" min={18} max={80} value={form.age} onChange={e => set('age', e.target.value)} style={{ ...inp, ...err('age') }} placeholder="e.g. 26" />
              </Field>
              <Field label="Gender" required>
                <Sel value={form.gender} onChange={v => { set('gender', v); if (v === 'Female' && form.marital_status === 'Married') set('marital_status', ''); if (v === 'Male' && form.marital_status === 'Khula') set('marital_status', ''); }} options={['Male','Female']} placeholder="Select" hasError={errorField === 'gender'} />
              </Field>
            </div>

            <Field label="Phone Number" required>
              <PhoneInput value={form.phone} onChange={v => set('phone', v)} dialCode={form.phone_dial_code} onDialChange={v => set('phone_dial_code', v)} required hasError={errorField === 'phone'} />
            </Field>
            <Field label="Second Phone Number">
              <PhoneInput value={form.phone2} onChange={v => set('phone2', v)} dialCode={form.phone2_dial_code} onDialChange={v => set('phone2_dial_code', v)} />
            </Field>

            <Field label="Height" required>
              <div style={{ display: 'flex', gap: 8 }}>
                <Sel value={form.height_feet} onChange={v => set('height_feet', v)} options={['4','5','6','7']} placeholder="Feet" hasError={errorField === 'height_feet'} />
                <Sel value={form.height_inches_extra} onChange={v => set('height_inches_extra', v)} options={['0','1','2','3','4','5','6','7','8','9','10','11']} placeholder="Inches" />
              </div>
            </Field>

            <Field label="Country (For Overseas Only)">
              <SearchableSelect value={form.country} onChange={v => set('country', v)} groups={COUNTRY_GROUPS} placeholder="Select country" />
            </Field>

            <Field label="City" required>
              <SearchableSelect value={form.city} onChange={v => set('city', v)} groups={CITY_GROUPS} placeholder="Select city" hasError={errorField === 'city'} />
            </Field>

            <Field label="House" required>
              <Sel value={form.home_type} onChange={v => set('home_type', v)} options={HOME_TYPES} placeholder="Select" hasError={errorField === 'home_type'} />
            </Field>
            {form.home_type && (
              <SubSection>
                <Field label="Location">
                  <input value={form.location} onChange={e => set('location', e.target.value)} style={inp} placeholder="e.g. DHA Phase 5, Gulberg" />
                </Field>
                <Field label="House Size">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={form.house_size || ''} onChange={e => set('house_size', e.target.value)} style={{ ...inp, flex: 1 }} placeholder="e.g. 5" type="number" min={1} />
                    <select value={form.house_size_unit} onChange={e => set('house_size_unit', e.target.value)} style={{ ...sel, width: 110, flex: 'none' }}>
                      <option value="Marla">Marla</option>
                      <option value="Kanal">Kanal</option>
                    </select>
                  </div>
                </Field>
              </SubSection>
            )}

            <Field label="Caste" required>
              <SearchableSelect value={form.caste} onChange={v => { set('caste', v); if (v !== 'Other') set('caste_custom', ''); }} groups={CASTE_GROUPS} placeholder="Select caste" hasError={errorField === 'caste'} />
            </Field>
            {form.caste === 'Other' && (
              <SubSection>
                <Field label="Specify Caste">
                  <input value={form.caste_custom} onChange={e => set('caste_custom', e.target.value)} style={{ ...inp, ...err('caste_custom') }} placeholder="e.g. Wattoo, Kashmiri" />
                </Field>
              </SubSection>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Sect / Maslak" required>
                <Sel value={form.sect} onChange={v => set('sect', v)} options={SECTS} placeholder="Select" hasError={errorField === 'sect'} />
              </Field>
              <Field label="Native Language">
                <Sel value={form.language} onChange={v => set('language', v)} options={LANGUAGES} placeholder="Select" />
              </Field>
            </div>

            <Field label="Occupation" required>
              <SearchableSelect value={form.profession} onChange={v => { set('profession', v); if (v !== 'Other') set('profession_custom', ''); }} groups={PROFESSION_GROUPS} placeholder="Select profession" hasError={errorField === 'profession'} />
            </Field>
            {form.profession === 'Other' && (
              <SubSection>
                <Field label="Specify Profession">
                  <input value={form.profession_custom} onChange={e => set('profession_custom', e.target.value)} style={{ ...inp, ...err('profession_custom') }} placeholder="e.g. Calligrapher, Gemologist" maxLength={30} />
                </Field>
              </SubSection>
            )}

            <Field label="Marital Status" required>
              <Sel value={form.marital_status} onChange={v => { set('marital_status', v); if (v !== 'Married') set('marriage_number', ''); }} options={maritalOptions} placeholder="Select" hasError={errorField === 'marital_status'} />
            </Field>
            {form.marital_status === 'Married' && (
              <SubSection>
                <Field label="Looking for">
                  <Sel value={form.marriage_number} onChange={v => set('marriage_number', v)} options={['Second marriage','Third marriage','Fourth marriage']} placeholder="Select" />
                </Field>
              </SubSection>
            )}
            {showKids && (
              <SubSection>
                <Field label="Do you have kids?">
                  <Sel value={form.has_kids} onChange={v => set('has_kids', v)} options={['Yes','No']} placeholder="Select" />
                </Field>
                {form.has_kids === 'Yes' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                    <Field label="Sons">
                      <input type="number" min={0} max={10} value={form.boys} onChange={e => set('boys', e.target.value)} style={inp} placeholder="0" />
                    </Field>
                    <Field label="Daughters">
                      <input type="number" min={0} max={10} value={form.girls} onChange={e => set('girls', e.target.value)} style={inp} placeholder="0" />
                    </Field>
                  </div>
                )}
              </SubSection>
            )}

            <Field label="About Yourself">
              <div style={{ position: 'relative' }}>
                <textarea value={form.about} onChange={e => set('about', e.target.value.slice(0, 200))} rows={3}
                  style={{ ...inp, resize: 'vertical', paddingBottom: 24 }} placeholder="Brief about yourself and your family..." />
                <span style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 11, color: form.about.length >= 200 ? '#DC2626' : '#9CA3AF' }}>{form.about.length}/200</span>
              </div>
            </Field>

            <Field label="Looking For">
              <div style={{ position: 'relative' }}>
                <textarea value={form.looking_for} onChange={e => set('looking_for', e.target.value.slice(0, 200))} rows={3}
                  style={{ ...inp, resize: 'vertical', paddingBottom: 24 }} placeholder="Qualities you're looking for in a partner..." />
                <span style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 11, color: form.looking_for.length >= 200 ? '#DC2626' : '#9CA3AF' }}>{form.looking_for.length}/200</span>
              </div>
            </Field>
          </div>
        )}

        {/* ── Step 3: Additional Information ────────────────────────────────── */}
        {step === 3 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1830' }}>Additional Information</div>
                  <div style={{ fontSize: 12, color: '#B0ADCB' }}>All fields below are optional</div>
                </div>
              </div>
              <button onClick={skip} style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #534AB733', background: '#EEEDFE', color: '#534AB7', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Skip →
              </button>
            </div>

            {/* FAMILY */}
            <SecHeader title="FAMILY" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Father">
                <Sel value={form.father_alive} onChange={v => set('father_alive', v)} options={['Alive','Deceased']} placeholder="Status" />
              </Field>
              <Field label="Mother">
                <Sel value={form.mother_alive} onChange={v => set('mother_alive', v)} options={['Alive','Deceased']} placeholder="Status" />
              </Field>
            </div>
            <Field label="Father's Occupation">
              <SearchableSelect value={form.father_occupation} onChange={v => { set('father_occupation', v); if (v !== 'Other') set('father_occupation_custom', ''); }} groups={PROFESSION_GROUPS} placeholder="Select" />
            </Field>
            {form.father_occupation === 'Other' && (
              <SubSection>
                <Field label="Specify Occupation">
                  <input value={form.father_occupation_custom} onChange={e => set('father_occupation_custom', e.target.value)} style={inp} placeholder="e.g. Farmer, Contractor" maxLength={30} />
                </Field>
              </SubSection>
            )}
            <Field label="Mother's Occupation">
              <SearchableSelect value={form.mother_occupation} onChange={v => { set('mother_occupation', v); if (v !== 'Other') set('mother_occupation_custom', ''); }} groups={PROFESSION_GROUPS} placeholder="Select" />
            </Field>
            {form.mother_occupation === 'Other' && (
              <SubSection>
                <Field label="Specify Occupation">
                  <input value={form.mother_occupation_custom} onChange={e => set('mother_occupation_custom', e.target.value)} style={inp} placeholder="e.g. Housewife, Tailor" maxLength={30} />
                </Field>
              </SubSection>
            )}
            <Field label="Do you have siblings?">
              <Sel value={form.has_siblings} onChange={v => set('has_siblings', v)} options={['Yes','No']} placeholder="Select" />
            </Field>
            {form.has_siblings === 'Yes' && (
              <SubSection>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Brothers">
                    <input type="number" min={0} value={form.brothers} onChange={e => set('brothers', e.target.value)} style={inp} placeholder="0" />
                  </Field>
                  <Field label="Sisters">
                    <input type="number" min={0} value={form.sisters} onChange={e => set('sisters', e.target.value)} style={inp} placeholder="0" />
                  </Field>
                </div>
              </SubSection>
            )}

            {/* EDUCATION */}
            <SecHeader title="EDUCATION" />
            <Field label="Education Level (Highest)">
              <Sel value={form.education} onChange={v => set('education', v)} options={['Matric','FSc/FA','Diploma',"Bachelor's","Master's",'MPhil','PhD','Other']} placeholder="Select" />
            </Field>
            <DegreeFields form={form} set={set} inp={inp} />

            {/* CAREER */}
            <SecHeader title="CAREER" />
            <Field label="Monthly Income">
              <Sel value={form.monthly_income} onChange={v => set('monthly_income', v)} options={MONTHLY_INCOMES} placeholder="Select" />
            </Field>
            <Field label="Employment Type">
              <Sel value={form.employment_type} onChange={v => set('employment_type', v)} options={EMPLOYMENT_TYPES} placeholder="Select" />
            </Field>

            {/* PHYSICAL */}
            <SecHeader title="PHYSICAL" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Weight (kg)">
                <input type="number" value={form.weight_kg} onChange={e => set('weight_kg', e.target.value)} style={inp} placeholder="e.g. 65" />
              </Field>
              <Field label="Complexion">
                <Sel value={form.complexion} onChange={v => set('complexion', v)} options={COMPLEXIONS} placeholder="Select" />
              </Field>
            </div>

            {/* RELIGION */}
            <SecHeader title="RELIGION" />
            <Field label="Practice Level">
              <Sel value={form.practice_level} onChange={v => set('practice_level', v)} options={PRACTICE_LEVELS} placeholder="Select" />
            </Field>
            {form.gender === 'Female' && (
              <Field label="Wears Hijab">
                <Sel value={form.hijab_or_beard} onChange={v => set('hijab_or_beard', v)} options={HIJAB_OPTIONS} placeholder="Select" />
              </Field>
            )}
            {form.gender === 'Male' && (
              <Field label="Have Beard">
                <Sel value={form.hijab_or_beard} onChange={v => set('hijab_or_beard', v)} options={BEARD_OPTIONS} placeholder="Select" />
              </Field>
            )}

            {/* ASSETS */}
            <SecHeader title="ASSETS" />
            <Field label="Car">
              <Sel value={form.has_car} onChange={v => set('has_car', v)} options={['Yes','No','Multiple']} placeholder="Do you have a car?" />
            </Field>
            <Field label="Other Property">
              <Sel value={form.has_other_property} onChange={v => { set('has_other_property', v); if (v === 'No') set('other_property', ''); }} options={['Yes','No']} placeholder="Do you have other property?" />
            </Field>
            {form.has_other_property === 'Yes' && (
              <SubSection>
                <Field label="Property Type">
                  <Sel value={form.other_property} onChange={v => set('other_property', v)} options={PROPERTY_TYPES} placeholder="Select" />
                </Field>
              </SubSection>
            )}

            {/* HEALTH */}
            <SecHeader title="HEALTH" />
            <Field label="Disability / Chronic Illness">
              <Sel value={form.has_disability} onChange={v => set('has_disability', v)} options={['Yes','No']} placeholder="Select" />
            </Field>
            {form.has_disability === 'Yes' && (
              <SubSection>
                <Field label="Brief Details (optional)">
                  <input value={form.disability_details} onChange={e => set('disability_details', e.target.value)} style={inp} placeholder="e.g. Diabetes, managed well..." />
                </Field>
              </SubSection>
            )}
            <Field label="Lifestyle">
              <Sel value={form.lifestyle} onChange={v => set('lifestyle', v)} options={LIFESTYLE_OPTIONS} placeholder="Select" />
            </Field>
            <Field label="Smoker">
              <Sel value={form.smoker} onChange={v => set('smoker', v)} options={['Yes','No']} placeholder="Select" />
            </Field>
          </div>
        )}

        {/* ── Step 4: Verification ──────────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1830' }}>Verification</div>
                <div style={{ fontSize: 12, color: '#B0ADCB' }}>Your CNIC remains private and fully secured</div>
              </div>
            </div>

            <div style={{ background: '#EEEDFE', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#534AB7', lineHeight: 1.6 }}>
              Upload clear photos of both sides of your CNIC. These remain private and are only used for verification.
            </div>

            <Field label="CNIC Front Photo" required>
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setCnicFront(f); setCnicFrontPreview(URL.createObjectURL(f)); }
                }} />
                <div style={{ border: `2px dashed ${cnicFront ? '#534AB7' : errorField === 'cnicFront' ? '#DC2626' : '#E8E6F5'}`, borderRadius: 12, background: cnicFront ? '#EEEDFE' : errorField === 'cnicFront' ? '#FEF2F2' : '#FAFAFA', overflow: 'hidden', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {cnicFrontPreview
                    ? <img src={cnicFrontPreview} alt="CNIC Front" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ textAlign: 'center', color: '#B0ADCB' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ display: 'block', margin: '0 auto 8px' }}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/><circle cx="7" cy="13" r="1"/></svg>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Tap to upload CNIC Front</div>
                        <div style={{ fontSize: 11, marginTop: 2 }}>JPG, PNG supported</div>
                      </div>
                  }
                  {cnicFront && (
                    <div style={{ position: 'absolute', top: 8, right: 8, background: '#534AB7', borderRadius: 20, padding: '2px 8px', fontSize: 11, color: '#fff', fontWeight: 700 }}>✓ Selected</div>
                  )}
                </div>
              </label>
            </Field>

            <Field label="CNIC Back Photo" required>
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setCnicBack(f); setCnicBackPreview(URL.createObjectURL(f)); }
                }} />
                <div style={{ border: `2px dashed ${cnicBack ? '#534AB7' : errorField === 'cnicBack' ? '#DC2626' : '#E8E6F5'}`, borderRadius: 12, background: cnicBack ? '#EEEDFE' : errorField === 'cnicBack' ? '#FEF2F2' : '#FAFAFA', overflow: 'hidden', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {cnicBackPreview
                    ? <img src={cnicBackPreview} alt="CNIC Back" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ textAlign: 'center', color: '#B0ADCB' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ display: 'block', margin: '0 auto 8px' }}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/><circle cx="7" cy="13" r="1"/></svg>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Tap to upload CNIC Back</div>
                        <div style={{ fontSize: 11, marginTop: 2 }}>JPG, PNG supported</div>
                      </div>
                  }
                  {cnicBack && (
                    <div style={{ position: 'absolute', top: 8, right: 8, background: '#534AB7', borderRadius: 20, padding: '2px 8px', fontSize: 11, color: '#fff', fontWeight: 700 }}>✓ Selected</div>
                  )}
                </div>
              </label>
            </Field>

          </div>
        )}

        {/* ── Step 5: Review ────────────────────────────────────────────────── */}
        {step === 5 && (() => {
          const R = (label: string, value?: string | number | boolean | null) => {
            if (value === undefined || value === null || value === '') return null;
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #F0EFF8' }}>
                <span style={{ fontSize: 12, color: '#9CA3AF', flex: '0 0 42%' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1830', textAlign: 'right', flex: '0 0 55%' }}>{String(value)}</span>
              </div>
            );
          };
          const heightDisplay = form.height_feet
            ? `${form.height_feet}'${form.height_inches_extra ? form.height_inches_extra + '"' : '0"'}`
            : null;
          const actualProfession = form.profession === 'Other' ? form.profession_custom : form.profession;
          const actualCaste = form.caste === 'Other' ? form.caste_custom : form.caste;
          const actualFatherOcc = form.father_occupation === 'Other' ? form.father_occupation_custom : form.father_occupation;
          const actualMotherOcc = form.mother_occupation === 'Other' ? form.mother_occupation_custom : form.mother_occupation;
          const hasAdditional = !!(form.father_alive || form.mother_alive || form.father_occupation || form.has_siblings ||
            form.education || form.monthly_income || form.employment_type ||
            form.weight_kg || form.complexion || form.practice_level || form.hijab_or_beard ||
            form.has_car || form.has_other_property || form.has_disability || form.lifestyle || form.smoker);
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1830' }}>Review Your Proposal</div>
                  <div style={{ fontSize: 12, color: '#B0ADCB' }}>Please check everything before submitting</div>
                </div>
              </div>

              <SecHeader title="BASIC INFO" />
              {profilePhotoPreview && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #F0EFF8' }}>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>Profile Photo</span>
                  <span onClick={() => setViewImg(profilePhotoPreview)} style={{ fontSize: 13, fontWeight: 600, color: '#534AB7', textDecoration: 'underline', cursor: 'pointer' }}>View</span>
                </div>
              )}
              {R('Full Name', form.name)}
              {R('Age', form.age)}
              {R('Gender', form.gender)}
              {R('Height', heightDisplay)}
              {R('Phone', form.phone ? `${form.phone_dial_code} ${form.phone}` : null)}
              {form.phone2 && R('Second Phone', `${form.phone2_dial_code} ${form.phone2}`)}
              {R('CNIC', form.cnic)}
              {form.country && R('Country', form.country)}
              {R('City', form.city)}
              {R('House Type', form.home_type)}
              {form.home_type && form.location && R('Location', form.location)}
              {form.home_type && form.house_size && R('House Size', `${form.house_size} ${form.house_size_unit}`)}
              {R('Caste', actualCaste)}
              {R('Sect', form.sect)}
              {form.language && R('Language', form.language)}
              {R('Occupation', actualProfession)}
              {R('Marital Status', form.marital_status)}
              {form.marital_status === 'Married' && form.marriage_number && R('Looking for', form.marriage_number)}
              {showKids && form.has_kids && R('Has Kids', form.has_kids)}
              {showKids && form.has_kids === 'Yes' && form.boys && R('Sons', form.boys)}
              {showKids && form.has_kids === 'Yes' && form.girls && R('Daughters', form.girls)}
              {form.about && R('About', form.about)}
              {form.looking_for && R('Looking For', form.looking_for)}

              {hasAdditional && (
                <>
                  <SecHeader title="ADDITIONAL INFO" />

                  {(form.father_alive || form.mother_alive || form.father_occupation || form.mother_occupation || form.has_siblings) && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#534AB7', marginBottom: 8, marginTop: 4 }}>FAMILY</div>
                      {form.father_alive && R('Father', form.father_alive)}
                      {form.mother_alive && R('Mother', form.mother_alive)}
                      {actualFatherOcc && R("Father's Occupation", actualFatherOcc)}
                      {actualMotherOcc && R("Mother's Occupation", actualMotherOcc)}
                      {form.has_siblings && R('Siblings', form.has_siblings)}
                      {form.has_siblings === 'Yes' && form.brothers && R('Brothers', form.brothers)}
                      {form.has_siblings === 'Yes' && form.sisters && R('Sisters', form.sisters)}
                    </>
                  )}

                  {(form.education || form.institute) && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#534AB7', marginBottom: 8, marginTop: 12 }}>EDUCATION</div>
                      {form.education && R('Education', form.education)}
                      {form.degree_title && R('Degree', form.degree_title)}
                      {form.institute && R('Institute', form.institute)}
                      {form.degree_title_2 && R('Degree 2', form.degree_title_2)}
                      {form.institute_2 && R('Institute 2', form.institute_2)}
                      {form.degree_title_3 && R('Degree 3', form.degree_title_3)}
                      {form.institute_3 && R('Institute 3', form.institute_3)}
                    </>
                  )}

                  {(form.monthly_income || form.employment_type) && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#534AB7', marginBottom: 8, marginTop: 12 }}>CAREER</div>
                      {form.employment_type && R('Employment Type', form.employment_type)}
                      {form.monthly_income && R('Monthly Income', form.monthly_income)}
                    </>
                  )}

                  {(form.weight_kg || form.complexion) && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#534AB7', marginBottom: 8, marginTop: 12 }}>PHYSICAL</div>
                      {form.weight_kg && R('Weight', `${form.weight_kg} kg`)}
                      {form.complexion && R('Complexion', form.complexion)}
                    </>
                  )}

                  {(form.practice_level || form.hijab_or_beard) && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#534AB7', marginBottom: 8, marginTop: 12 }}>RELIGION</div>
                      {form.practice_level && R('Practice Level', form.practice_level)}
                      {form.hijab_or_beard && R(form.gender === 'Female' ? 'Hijab' : 'Beard', form.hijab_or_beard)}
                    </>
                  )}

                  {(form.has_car || form.has_other_property) && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#534AB7', marginBottom: 8, marginTop: 12 }}>ASSETS</div>
                      {form.has_car && R('Car', form.has_car)}
                      {form.has_other_property && R('Other Property', form.has_other_property)}
                      {form.has_other_property === 'Yes' && form.other_property && R('Property Type', form.other_property)}
                    </>
                  )}

                  {(form.has_disability || form.lifestyle || form.smoker) && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#534AB7', marginBottom: 8, marginTop: 12 }}>HEALTH</div>
                      {form.has_disability && R('Disability', form.has_disability)}
                      {form.has_disability === 'Yes' && form.disability_details && R('Details', form.disability_details)}
                      {form.lifestyle && R('Lifestyle', form.lifestyle)}
                      {form.smoker && R('Smoker', form.smoker)}
                    </>
                  )}
                </>
              )}

              <SecHeader title="VERIFICATION" />
              {[{ label: 'CNIC Front', preview: cnicFrontPreview }, { label: 'CNIC Back', preview: cnicBackPreview }].map(({ label, preview }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #F0EFF8' }}>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>{label}</span>
                  {preview
                    ? <span onClick={() => setViewImg(preview)} style={{ fontSize: 13, fontWeight: 600, color: '#534AB7', textDecoration: 'underline', cursor: 'pointer' }}>View</span>
                    : <span style={{ fontSize: 12, color: '#B0ADCB' }}>Not uploaded</span>
                  }
                </div>
              ))}

              <SecHeader title="AFFILIATE REFERRAL" />
              <Field label="Referral Code (Optional)">
                <input
                  value={form.affiliate}
                  style={inp}
                  placeholder="Enter referral code if you have one"
                  onChange={e => set('affiliate', e.target.value.toUpperCase())}
                />
              </Field>

              <div style={{ marginTop: 16, background: '#EEEDFE', border: '1px solid #534AB733', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#534AB7', lineHeight: 1.6 }}>
                By submitting your proposal, it will be reviewed by our team and published within 24 hrs.
              </div>
            </div>
          );
        })()}

        {/* Nav buttons */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEE2E2', border: '1px solid #DC262644', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginTop: 20 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'space-between' }}>
          {step > 1
            ? <button onClick={prev} style={{ padding: '12px 24px', borderRadius: 12, border: '1.5px solid #E8E6F5', background: '#fff', color: '#6B6893', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>← Back</button>
            : <div />
          }
          {step < 5
            ? <button onClick={next} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(83,74,183,0.3)' }}>{step === 4 ? 'Review →' : 'Next →'}</button>
            : <button onClick={handleSubmit} disabled={submitting} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, boxShadow: '0 4px 14px rgba(83,74,183,0.3)' }}>
                {submitting ? 'Submitting...' : 'Submit Proposal →'}
              </button>
          }
        </div>
      </div>
    </div>
  );
}
