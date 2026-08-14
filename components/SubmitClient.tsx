'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase, fetchCastes, fetchOccupations, fetchCities } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import { COUNTRY_GROUPS } from '@/lib/constants';
import PhoneInput from '@/components/PhoneInput';
import { containsPhoneNumber } from '@/lib/phoneDetector';
import SearchableSelect from '@/components/SearchableSelect';
import OccupationSelect from '@/components/OccupationSelect';
// Moved server-side — see lib/actions/proposal-actions.ts and
// lib/actions/revalidate-write.ts for why.
import { submitProposalAction as submitProposal } from '@/lib/actions/proposal-actions';
import PasswordInput from '@/components/PasswordInput';
import { compressImage } from '@/lib/compressImage';
import { addWatermark } from '@/lib/watermarkImage';

// ── Constants ──────────────────────────────────────────────────────────────────
const CASTE_GROUPS: Record<string, string[]> = {
  'Punjab': ['Jatt','Rajput','Arain','Gujjar','Sheikh','Syed','Mughal','Malik','Awan','Bhatti','Khokhar','Dogar','Tiwana','Kamboh','Ansari','Qureshi','Kayani','Chohan','Janjua','Randhawa','Rana','Warraich','Ghumman','Gondal','Toor','Satti','Bajwa','Chattha','Hanjra','Wattoo','Sipra','Siyal','Gakhar','Ranjha'],
  'Sindh': ['Sindhi Syed','Soomro','Junejo','Memon','Lohana','Khuhro','Chandio','Brohi','Abbasi','Jatoi','Palijo'],
  'KPK / Pashtun': ['Afridi','Yousafzai','Khattak','Shinwari','Bangash','Mohmand','Wazir','Mehsud','Tareen','Pathan','Pashtun','Khan','Niazi','Kakazai','Tanoli'],
  'Kashmir & Northern': ['Butt','Dar','Lone','Mir','Chaudhry','Raja','Kashmiri','Khawaja'],
  'Balochistan': ['Bugti','Marri','Mengal','Rind','Raisani','Lashari','Baloch'],
  'Urdu-speaking / Muhajir': ['Siddiqui','Farooqui','Usmani','Rizvi','Zaidi','Hashmi','Rehmani','Paracha','Alvi','Pirzada'],
  'General': ['Ghauri','Mirza','Baig','Chughtai','Qazi','Sherwani','Other'],
};

const PROFESSION_GROUPS: Record<string, string[]> = {
  'Healthcare': ['Doctor','General Physician','Dentist','Dermatologist','Pediatrician','Orthopedic Surgeon','Surgeon','ENT Specialist','Psychiatrist','Psychologist','Radiologist','Pathologist','Nurse','Nutritionist','Physiotherapist','Dental Assistant','Lab Technician','Pharmacist','Ultrasound Technician','Medical Representative','Optician','Microbiologist','Biochemist','Biomedical Engineer','Genetic Engineer','Chemist','X-Ray Technician','Laboratory Scientist','Other'],
  'Engineering': ['Software Engineer','Civil Engineer','Mechanical Engineer','Electrical Engineer','Electronics Engineer','Chemical Engineer','Aeronautical Engineer','Agricultural Engineer','Automobile Engineer','Computer Engineer','Telecom Engineer','Textile Engineer','Industrial Engineer','Flight Engineer','Robotics Engineer','Hardware Engineer','Network Engineer','Cloud Engineer','Food Technologist','Quantity Surveyor','Architect','Other'],
  'IT & Tech': ['Developer','Frontend Developer','Java Developer','Web Developer','Web Designer','UI Designer','UI/UX Designer','Graphic Designer','Programmer','Data Analyst','Data Scientist','Cyber Security Expert','Information Security Analyst','IT Administrator','IT Support Specialist','Network Administrator','SEO Expert','Digital Marketer','Social Media Manager','Blogger','Content Creator','Copywriter','Freelancer','YouTuber','QA Engineer','Drone Operator','Media Buyer','Other'],
  'Education': ['Teacher','School Teacher','Lecturer','Professor','University Professor','Principal','Headmaster','Home Tutor','Coach','Trainer','Qari','Imam','Research Scientist','Research Assistant','Other'],
  'Finance & Law': ['Accountant','Chartered Accountant','Financial Advisor','Investment Banker','Tax Consultant','Insurance Agent','Economist','Business Analyst','Lawyer','Advocate','Judge','CSS Officer','Other'],
  'Business & Management': ['Business Owner','General Manager','Operation Manager','Product Manager','Project Manager','HR Manager','Human Resource Officer','Marketing Manager','Sales Executive','Bank Manager','Hotel Manager','Construction Manager','Logistic Manager','Warehouse Manager','Import Export Agent','Property Dealer','Real Estate Agent','Trader','Consultant','Office Assistant','Clerk','Other'],
  'Government & Forces': ['Army Officer','Police Officer','Traffic Police Officer','Government Officer','Administrative Officer','Agriculture Officer','Field Officer','Railway Officer','Naib Qasid','Security Guard','Firefighter','Politician','Other'],
  'Arts & Media': ['Photographer','Videographer','Video Editor','Cameraman','Actor','Fashion Model','Model','Television Host','Journalist','Editor','Multimedia Specialist','Animator','Sound Engineer','Music Teacher','Influencer','Artist','Other'],
  'Skilled Trades': ['Electrician','Plumber','Carpenter','Mason','Brick Mason','Welder','Painter','Auto Electrician','Mobile Repair Technician','Solar Technician','Technician','Lab Technician','Machine Operator','Tailor','Embroidery Worker','Baker','Chef','Barber','Beautician','Builder','Other'],
  'Services & Other': ['Driver','Truck Driver','Rider','Delivery Rider','Courier Rider','Food Panda Rider','Waiter','Receptionist','Cashier','Shopkeeper','JazzCash Agent','Call Center Agent','Dispatcher','Tour Guide','Social Worker','Veterinarian','Farmer','Livestock Farmer','Fisherman','Florist','Decorator','Interior Designer','Event Manager','Sports Coach','Athlete','Stenographer','Librarian','Interpreter','Translator','Virtual Assistant','Janitor','Kitchen Helper','Kitchen Supervisor','Safety Officer','Surveyor','Public Relations Officer','Zoologist','Scientist','Freelance Writer','Writer','Fashion Designer','Textile Designer','Makeup Artist','Designer','Businessman','Housewife','Gardener','Butcher','Cobbler','Pilot','Airline Pilot','Air Hostess','Other'],
  'Other': ['Other'],
};

// Returns which profession_category a given job title belongs to.
// Used to auto-populate profession_category at registration without an
// extra manual step — same category mapping the filter uses.
function getProfessionCategory(profession: string): string {
  if (!profession || profession === 'Other') return 'Other';
  for (const [cat, profs] of Object.entries(PROFESSION_GROUPS)) {
    if (cat === 'Other') continue;
    if (profs.includes(profession)) return cat;
  }
  return 'Other';
}

// CITY_GROUPS moved to lib/constants.ts (shared single source with
// FeaturedBookModal.tsx — see that file's comment for why).

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
const FAMILY_TYPE_OPTIONS = ['Joint family','Separated Family'];
const POLYGAMY_OPTIONS = ['Yes','No'];
const LIFESTYLE_OPTIONS = ['Active Living','Sedentary Living','Moderately Active'];
const PROPERTY_TYPES = ['Residential','Commercial','Land','Multiple'];


// Combines a dial code with a locally-entered number for storage/display.
// Pakistani numbers are usually typed with their trunk-prefix "0" (e.g.
// 0300 1234567) — that 0 must never be kept when it's prefixed with the
// +92 country code (should read "+92 300 1234567", not "+92 0300 1234567").
function formatDialedPhone(dialCode: string, number: string): string {
  const trimmed = number.trim();
  const local = dialCode === '+92' ? trimmed.replace(/^0+/, '') : trimmed;
  return `${dialCode} ${local}`;
}

// COUNTRIES_FLAT / COUNTRY_GROUPS moved to lib/constants.ts (shared single
// source with FeaturedBookModal.tsx).

// ── Styles ─────────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 11, border: '1.5px solid #E8E6F5', fontSize: 14, outline: 'none', color: '#1A1830', background: '#fff', boxSizing: 'border-box' };
const sel: React.CSSProperties = { ...inp, cursor: 'pointer' };

// ── Helpers ────────────────────────────────────────────────────────────────────
function Field({ label, required, labelExtra, labelRight, children }: { label: string; required?: boolean; labelExtra?: React.ReactNode; labelRight?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>
        <span>{label}{required && <span style={{ color: '#E11D48' }}> *</span>}{labelExtra}</span>
        {labelRight}
      </label>
      {children}
    </div>
  );
}

// Small click-to-open info popover — icon opens a short explanatory box,
// closes when clicking the icon again or anywhere else on the page.
function InfoPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 6 }}>
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid #68629C', background: '#fff', color: '#6B6893', fontSize: 10.5, fontWeight: 700, lineHeight: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
        aria-label="More info">i</button>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 22, left: 0, zIndex: 30, width: 230, background: '#40359F', color: '#fff', fontSize: 12, fontWeight: 500, lineHeight: 1.5, textTransform: 'none', letterSpacing: 'normal', borderRadius: 10, padding: '10px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
          {text}
        </div>
      )}
    </span>
  );
}

function SecHeader({ title }: { title: string }) {
  return (
    <div style={{ marginTop: 28, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#68629C', letterSpacing: 1 }}>{title}</div>
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

// Shared upload box for the Verification step — used for the applicant's
// CNIC front/back, the parent/guardian's CNIC front/back, and the
// applicant's education document. None of these are required anymore
// (the whole Verification step is skippable), so this never passes
// `required` to Field.
function CnicUploadBox({ label, file, preview, compressing, errorField, fieldKey, onFileSelected, onRemove }: {
  label: string; file: File | null; preview: string; compressing: boolean;
  errorField: string; fieldKey: string;
  onFileSelected: (raw: File) => Promise<void>;
  onRemove: () => void;
}) {
  return (
    <Field label={label}>
      <label style={{ display: 'block', cursor: 'pointer' }}>
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
          const raw = e.target.files?.[0];
          if (!raw) return;
          await onFileSelected(raw);
        }} />
        <div style={{ border: `2px dashed ${file ? '#534AB7' : errorField === fieldKey ? '#DC2626' : '#E8E6F5'}`, borderRadius: 12, background: file ? '#EEEDFE' : errorField === fieldKey ? '#FEF2F2' : '#FAFAFA', overflow: 'hidden', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {preview
            ? <img src={preview} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ textAlign: 'center', color: '#68629C' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ display: 'block', margin: '0 auto 8px' }}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/><circle cx="7" cy="13" r="1"/></svg>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Tap to upload {label}</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>JPG, PNG supported</div>
              </div>
          }
          {file && (
            <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
              aria-label={`Remove ${label}`}
              style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(26,24,48,0.65)', color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: '24px', textAlign: 'center', padding: 0, cursor: 'pointer' }}>
              ✕
            </button>
          )}
          {compressing && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(83,74,183,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexDirection: 'column' }}>
              <div className="spin" style={{ width: 22, height: 22, border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%' }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Processing photo…</div>
            </div>
          )}
        </div>
      </label>
    </Field>
  );
}

function DegreePair({ degreeKey, instituteKey, form, set, inp, certFile, onCertChange, setViewImg }: {
  degreeKey: keyof FormData; instituteKey: keyof FormData;
  form: FormData; set: (k: keyof FormData, v: string) => void; inp: React.CSSProperties;
  certFile: File | null; onCertChange: (f: File | null) => void; setViewImg: (url: string) => void;
}) {
  return (
    <div style={{ padding: 12, background: '#F8F7FF', borderRadius: 12, border: '1px solid #E8E6F5' }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#9990B8', marginBottom: 4 }}>Title</div>
        <input value={form[degreeKey] as string} onChange={e => set(degreeKey, e.target.value)} style={inp} placeholder="e.g. BS Computer Science" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#9990B8', marginBottom: 4 }}>Institute</div>
        <input value={form[instituteKey] as string} onChange={e => set(instituteKey, e.target.value)} style={inp} placeholder="e.g. University of Punjab" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#534AB7', background: '#EEEDFE', border: '1px dashed #C4C2D8', borderRadius: 20, padding: '3px 10px', cursor: 'pointer' }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{certFile ? '✓' : '+'}</span>
          {certFile ? 'Certificate selected — tap to change' : 'Upload Degree Certificate (optional)'}
          <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onCertChange(f); e.target.value = ''; }} />
        </label>
        {certFile && (
          <span onClick={() => setViewImg(URL.createObjectURL(certFile))} style={{ fontSize: 12, fontWeight: 600, color: '#534AB7', textDecoration: 'underline', cursor: 'pointer' }}>
            View
          </span>
        )}
        {certFile && (
          <button onClick={() => onCertChange(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 12, padding: 0 }}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function DegreeFields({ form, set, inp, degreeCert, setDegreeCert, degreeCert2, setDegreeCert2, degreeCert3, setDegreeCert3, setViewImg }: {
  form: FormData; set: (k: keyof FormData, v: string) => void; inp: React.CSSProperties;
  degreeCert: File | null; setDegreeCert: (f: File | null) => void;
  degreeCert2: File | null; setDegreeCert2: (f: File | null) => void;
  degreeCert3: File | null; setDegreeCert3: (f: File | null) => void;
  setViewImg: (url: string) => void;
}) {
  const [show2, setShow2] = useState(!!(form.degree_title_2 || form.institute_2));
  const [show3, setShow3] = useState(!!(form.degree_title_3 || form.institute_3));

  const remove2 = () => {
    set('degree_title_2', ''); set('institute_2', '');
    set('degree_title_3', ''); set('institute_3', '');
    setDegreeCert2(null); setDegreeCert3(null);
    setShow2(false); setShow3(false);
  };
  const remove3 = () => {
    set('degree_title_3', ''); set('institute_3', '');
    setDegreeCert3(null);
    setShow3(false);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1830', marginBottom: 6 }}>Degree</div>
      <DegreePair degreeKey="degree_title" instituteKey="institute" form={form} set={set} inp={inp}
        certFile={degreeCert} onCertChange={setDegreeCert} setViewImg={setViewImg} />

      {show2 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#534AB7' }}>Degree 2</span>
            <button onClick={remove2} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
              ✕ Remove
            </button>
          </div>
          <DegreePair degreeKey="degree_title_2" instituteKey="institute_2" form={form} set={set} inp={inp}
            certFile={degreeCert2} onCertChange={setDegreeCert2} setViewImg={setViewImg} />
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
          <DegreePair degreeKey="degree_title_3" instituteKey="institute_3" form={form} set={set} inp={inp}
            certFile={degreeCert3} onCertChange={setDegreeCert3} setViewImg={setViewImg} />
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

// SearchableSelect moved to components/SearchableSelect.tsx (shared with
// FeaturedBookModal.tsx).


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

  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      if (!img.width || !img.height) { setLoadFailed(true); return; }
      imgRef.current = img;
      const s = Math.max(SIZE / img.width, SIZE / img.height);
      setScale(s);
      setOffset({ x: 0, y: 0 });
    };
    img.onerror = () => setLoadFailed(true);
    img.src = src;
  }, [src]);

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, SIZE, SIZE);
    // Fill white first, everywhere — JPEG has no alpha channel, so anything
    // left transparent (e.g. corners outside the circular clip below) would
    // otherwise be flattened to solid black on export. This also matters
    // beyond the in-app circular mask: the raw square file is what gets used
    // for social-share link previews (og:image), which don't apply that mask.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#fff';
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

  // The on-screen crop UI shows a circular guide purely to help center a
  // face while framing — every avatar display on the site (ProposalCard,
  // ProfileAvatar, My Account) already applies its own shape via CSS
  // (objectFit: cover inside a container with its own borderRadius), so
  // the uploaded FILE was never supposed to need a baked-in circle. Doing
  // that anyway destroyed the corners (forced to black/white on JPEG
  // export) and meant "view full size" could only ever show a tiny circle,
  // never the actual complete photo. Export a full, uncropped square at
  // high resolution instead — the on-screen framing guide is unaffected.
  const EXPORT_SIZE = 1000;

  const handleCrop = async () => {
    const img = imgRef.current;
    if (!img) { setLoadFailed(true); return; }
    setCropping(true);
    const factor = EXPORT_SIZE / SIZE;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = EXPORT_SIZE;
    exportCanvas.height = EXPORT_SIZE;
    const ctx = exportCanvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
    const w = img.width * scale * factor;
    const h = img.height * scale * factor;
    ctx.drawImage(img, EXPORT_SIZE / 2 - w / 2 + offset.x * factor, EXPORT_SIZE / 2 - h / 2 + offset.y * factor, w, h);
    exportCanvas.toBlob(blob => { if (blob) onDone(blob); }, 'image/jpeg', 0.92);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: SIZE, marginBottom: 16 }}>
        <button onClick={onCancel} style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
        <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Adjust Photo</span>
        <button onClick={handleCrop} disabled={cropping || loadFailed} style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: loadFailed ? 'rgba(124,92,250,0.35)' : 'linear-gradient(135deg,#7C5CFA,#5A3FD6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loadFailed ? 'not-allowed' : 'pointer' }}>
          {cropping ? '...' : 'Use Photo'}
        </button>
      </div>
      {loadFailed ? (
        <div style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, background: 'rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 8 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Couldn&apos;t load this photo. Please cancel and pick another one.</span>
        </div>
      ) : (
        <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ borderRadius: SIZE / 2, cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp} />
      )}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <input type="range" min={0.2} max={4} step={0.05} value={scale}
          onChange={e => setScale(+e.target.value)}
          style={{ width: SIZE, accentColor: '#7C5CFA' }} />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Drag to reposition · Slider to zoom</span>
      </div>
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
  open_to_polygamy: string;
  about: string; looking_for: string;
  // Step 2
  family_type: string;
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
  open_to_polygamy: '',
  about: '', looking_for: '',
  family_type: '',
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
const COUPON_KEY = 'jor_submit_coupon';
const AFFILIATE_APPLIED_KEY = 'jor_submit_affiliate_applied';

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SubmitClient() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [cityGroups, setCityGroups] = useState<Record<string, string[]>>({});
  const [casteGroups, setCasteGroups] = useState<Record<string, string[]>>(CASTE_GROUPS);
  const [professionGroups, setProfessionGroups] = useState<Record<string, string[]>>(PROFESSION_GROUPS);

  useEffect(() => {
    fetchCities().then(data => { if (Object.keys(data).length > 0) setCityGroups(data); });
    fetchCastes().then(data => { if (Object.keys(data).length > 0) setCasteGroups(data); });
    fetchOccupations().then(data => { if (Object.keys(data).length > 0) setProfessionGroups(data); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [maxStep, setMaxStep] = useState<number>(1);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [showPhone2, setShowPhone2] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState('');
  const [cropSrc, setCropSrc] = useState('');
  const [viewImg, setViewImg] = useState('');
  const [cnicFront, setCnicFront] = useState<File | null>(null);
  const [cnicBack, setCnicBack] = useState<File | null>(null);
  const [guardianCnicFront, setGuardianCnicFront] = useState<File | null>(null);
  const [guardianCnicBack, setGuardianCnicBack] = useState<File | null>(null);
  const [educationDocument, setEducationDocument] = useState<File | null>(null);
  const [degreeCert, setDegreeCert] = useState<File | null>(null);
  const [degreeCert2, setDegreeCert2] = useState<File | null>(null);
  const [degreeCert3, setDegreeCert3] = useState<File | null>(null);
  const [compressingCnicFront, setCompressingCnicFront] = useState(false);
  const [compressingCnicBack, setCompressingCnicBack] = useState(false);
  const [compressingGuardianCnicFront, setCompressingGuardianCnicFront] = useState(false);
  const [compressingGuardianCnicBack, setCompressingGuardianCnicBack] = useState(false);
  const [compressingEducationDocument, setCompressingEducationDocument] = useState(false);
  const [compressingProfilePhoto, setCompressingProfilePhoto] = useState(false);
  const [cnicFrontPreview, setCnicFrontPreview] = useState('');
  const [cnicBackPreview, setCnicBackPreview] = useState('');
  const [guardianCnicFrontPreview, setGuardianCnicFrontPreview] = useState('');
  const [guardianCnicBackPreview, setGuardianCnicBackPreview] = useState('');
  const [educationDocumentPreview, setEducationDocumentPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState('');

  // Verification section toggles — synced from app_settings
  const [showCandidateCnic, setShowCandidateCnic] = useState(true);
  const [showLatestDegree, setShowLatestDegree] = useState(true);
  const [showParentsCnic, setShowParentsCnic] = useState(true);

  useEffect(() => {
    supabase.from('app_settings').select('key, value').then(({ data }) => {
      if (!data) return;
      const map = Object.fromEntries(data.map((r: {key: string; value: string}) => [r.key, r.value]));
      if (map['require_candidate_cnic'] === 'false') setShowCandidateCnic(false);
      if (map['require_latest_degree']  === 'false') setShowLatestDegree(false);
      if (map['require_parents_cnic']   === 'false') setShowParentsCnic(false);
    });
  }, []);

  // ── Coupon code (mirrors app/plans/SubscriptionClient.tsx + the admin
  // app's live re-validation on approval — same coupon_codes table, same
  // rules). Unlike the Plans page, there's no proposal row yet at this
  // point in registration, so instead of writing straight to the DB on
  // "Apply", the validated code is just held in state and sent along with
  // the rest of the form on final submit (applied_coupon_code below). The
  // admin app re-validates it live again at approval time regardless, so
  // it can't go stale between now and then.
  const [couponCode, setCouponCode] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponIsError, setCouponIsError] = useState(false);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Referral code — validated against the `affiliates` table via a
  // SECURITY DEFINER RPC (validate_affiliate_code), since that table has
  // no public SELECT policy (it holds phone numbers, password hashes,
  // commission totals — none of which should be readable by an anon
  // client). Same apply/validate pattern as the coupon above: the raw
  // text is only sent on submit once it's been confirmed to match a real,
  // non-deleted affiliate.
  const [appliedAffiliateCode, setAppliedAffiliateCode] = useState<string | null>(null);
  const [affiliateMessage, setAffiliateMessage] = useState<string | null>(null);
  const [affiliateIsError, setAffiliateIsError] = useState(false);
  const [validatingAffiliate, setValidatingAffiliate] = useState(false);

  const applyAffiliateCode = async (codeOverride?: string) => {
    const code = (codeOverride ?? form.affiliate).trim();
    if (!code) return;
    setValidatingAffiliate(true);
    setAffiliateMessage(null);
    try {
      const { data: rpcData, error: affErr } = await supabase
        .rpc('validate_affiliate_code', { p_code: code })
        .maybeSingle();
      const res = rpcData as { code: string; name: string | null } | null;

      if (affErr || !res) {
        setValidatingAffiliate(false);
        setAffiliateIsError(true);
        setAffiliateMessage('Invalid referral code');
        setAppliedAffiliateCode(null);
        return;
      }

      setValidatingAffiliate(false);
      setAffiliateIsError(false);
      setAppliedAffiliateCode(res.code.toUpperCase());
      setAffiliateMessage('Referral code applied');
    } catch (_) {
      setValidatingAffiliate(false);
      setAffiliateIsError(true);
      setAffiliateMessage('Could not verify referral code — check your connection');
      setAppliedAffiliateCode(null);
    }
  };

  const applyCoupon = async (codeOverride?: string) => {
    const code = (codeOverride ?? couponCode).trim();
    if (!code) return;
    setValidatingCoupon(true);
    setCouponMessage(null);
    try {
      const { data: res, error: couponErr } = await supabase
        .from('coupon_codes')
        .select('coupon_type, discount_percent, free_days, trial_days, active, expires_at')
        .ilike('code', code)
        .maybeSingle();

      const expired = res?.expires_at ? new Date(res.expires_at) < new Date() : false;
      if (couponErr || !res || res.active !== true || expired) {
        setValidatingCoupon(false);
        setCouponIsError(true);
        setCouponMessage(expired ? 'This coupon has expired' : 'Invalid or inactive coupon code');
        setAppliedCouponCode(null);
        return;
      }

      setValidatingCoupon(false);
      setCouponIsError(false);
      setAppliedCouponCode(code.toUpperCase());
      const type = res.coupon_type || 'percentage';
      if (type === 'free_trial' && res.trial_days) {
        setCouponMessage(`${res.trial_days}-day free trial applied successfully!`);
      } else if (type === 'free_days' && res.free_days) {
        setCouponMessage(`+${res.free_days} bonus days will be added once you subscribe!`);
      } else if (res.discount_percent) {
        setCouponMessage(`${res.discount_percent}% discount will apply once you subscribe!`);
      } else {
        setCouponMessage('Coupon applied — it will be validated again when you subscribe.');
      }
    } catch (_) {
      setValidatingCoupon(false);
      setCouponIsError(true);
      setCouponMessage('Could not verify coupon — check your connection');
      setAppliedCouponCode(null);
    }
  };


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
      if (savedForm.phone2) setShowPhone2(true);

      // Coupon code isn't part of `form` (it's validated live against
      // coupon_codes, not just typed text), so it needs its own draft
      // key — otherwise a refresh loses it while the referral code
      // (which lives in form.affiliate) survives. If a coupon had been
      // successfully applied before the refresh, re-validate it live
      // rather than trusting the stale "applied" flag, since it may
      // have been deactivated or expired since — same reasoning as the
      // admin app re-checking it again at approval time.
      const savedCoupon = localStorage.getItem(COUPON_KEY);
      if (savedCoupon) {
        const { code, applied } = JSON.parse(savedCoupon) as { code: string; applied: boolean };
        if (code) {
          setCouponCode(code);
          if (applied) applyCoupon(code);
        }
      }
      // Referral code text lives in form.affiliate (already persisted),
      // but whether it was successfully *applied* doesn't — same gap as
      // the coupon above. Re-validate live if it had been applied before
      // the refresh, so a since-removed affiliate can't silently linger.
      if (savedForm.affiliate && localStorage.getItem(AFFILIATE_APPLIED_KEY) === '1') {
        applyAffiliateCode(savedForm.affiliate);
      }
    } catch {}
    setMounted(true);
  }, []);
  useEffect(() => { if (mounted) localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); }, [form, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem(STEP_KEY, String(step)); }, [step, mounted]);
  useEffect(() => {
    if (mounted) localStorage.setItem(COUPON_KEY, JSON.stringify({ code: couponCode, applied: !!appliedCouponCode }));
  }, [couponCode, appliedCouponCode, mounted]);
  useEffect(() => {
    if (mounted) localStorage.setItem(AFFILIATE_APPLIED_KEY, appliedAffiliateCode ? '1' : '0');
  }, [appliedAffiliateCode, mounted]);

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

    // Stops someone bypassing the subscription-gated contact system by
    // just typing their phone number into a publicly-visible text field
    // instead. Runs on every step regardless of which step a given field
    // actually belongs to — a not-yet-reached field is simply empty, and
    // the detector already ignores anything under 5 characters, so this
    // is harmless to check early rather than only at final submission.
    const phoneCheckFields: { key: string; label: string }[] = [
      { key: 'name', label: 'Full name' },
      { key: form.caste === 'Other' ? 'caste_custom' : '', label: 'Caste' },
      { key: form.profession === 'Other' ? 'profession_custom' : '', label: 'Occupation' },
      { key: 'about', label: 'About' },
      { key: 'looking_for', label: 'Looking For' },
      { key: 'degree_title', label: 'Degree Title' },
      { key: 'institute', label: 'Institute' },
      { key: 'degree_title_2', label: 'Degree Title 2' },
      { key: 'institute_2', label: 'Institute 2' },
      { key: 'degree_title_3', label: 'Degree Title 3' },
      { key: 'institute_3', label: 'Institute 3' },
    ];
    for (const { key, label } of phoneCheckFields) {
      if (!key) continue;
      const value = form[key as keyof typeof form];
      if (typeof value === 'string' && containsPhoneNumber(value)) {
        return fail(`${label} cannot contain phone numbers`, key);
      }
    }

    // Weight is optional, so only validated when a value is actually
    // provided — but needs a real upper bound, since nothing currently
    // stops someone typing an enormous number that the database can't
    // store as an integer.
    if (form.weight_kg && (+form.weight_kg <= 0 || +form.weight_kg > 999)) {
      return fail('Weight must be between 1 and 999 kg', 'weight_kg');
    }

    if (step === 1) {
      const cnicDigits = form.cnic.replace(/\D/g, '');
      if (!cnicDigits) return fail('CNIC number is required', 'cnic');
      if (cnicDigits.length !== 13) return fail('Enter a complete 13-digit CNIC number', 'cnic');
      if (!form.password.trim() || form.password.length < 6) return fail('Password must be at least 6 characters', 'password');
      if (form.password !== form.confirm_password) return fail('Passwords do not match', 'confirm_password');
    }
    if (step === 2) {
      if (!form.name.trim()) return fail('Full name is required', 'name');
      if (!form.gender) return fail('Gender is required', 'gender');
      if (!form.age || +form.age < 18 || +form.age > 99) return fail('Valid age (18–99) is required', 'age');
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
    // Step 4 (Verification) is intentionally not validated here — every
    // document in it (applicant CNIC, guardian CNIC, education document)
    // is optional, so the account can be submitted and activated without
    // them and the documents added later.
    return { msg: '', field: '' };
  };

  // Shared by both the "Next →" button and the top step-tabs, so a
  // clicked-past error (like an already-registered CNIC) can't be
  // bypassed by clicking a tab instead of the button — the tab click
  // previously only ran the synchronous validateStep(), which doesn't
  // include this async database check, letting it skip straight past.
  const validateStepAsync = async (): Promise<{ msg: string; field: string } | null> => {
    const { msg: err, field } = validateStep();
    if (err) return { msg: err, field };
    if (step === 1) {
      const digits = form.cnic.replace(/-/g, '').trim();
      const { data: existingStatus } = await supabase.rpc('get_cnic_profile_status', { p_cnic: digits });
      if (existingStatus === 'pending') return { msg: 'Your profile is already submitted. Please log in to check the status.', field: 'cnic' };
      if (existingStatus) return { msg: 'This CNIC is already registered. Please login instead.', field: 'cnic' };
    }
    return null;
  };

  const next = async () => {
    const err = await validateStepAsync();
    if (err) { setError(err.msg); setErrorField(err.field); return; }
    setError(''); setErrorField('');
    setStep(s => { const n = (s + 1) as 1 | 2 | 3 | 4 | 5; setMaxStep(m => Math.max(m, n)); return n; });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const skip = (target: 4 | 5 = 4) => {
    setError(''); setErrorField('');
    setStep(target);
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

    // Upload profile photo — via the same secure server-side R2 upload
    // endpoint used for CNIC photos, not client-side Supabase Storage
    // (which was a different, unused storage system — every real profile
    // photo already live on the site is on R2, not Supabase).
    let profilePhotoUrl: string | undefined;
    const digits = form.cnic.replace(/-/g, '').trim();
    if (profilePhoto) {
      const photoForm = new FormData();
      photoForm.append('cnic', digits);
      photoForm.append('photo', profilePhoto);
      try {
        const res = await fetch('/api/upload-profile-photo', { method: 'POST', body: photoForm });
        const uploaded = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(uploaded.error || 'Failed to upload profile photo. Please try again.');
          setSubmitting(false);
          return;
        }
        profilePhotoUrl = uploaded.url;
      } catch {
        setError('Failed to upload profile photo. Please check your connection and try again.');
        setSubmitting(false);
        return;
      }
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

    // Guardian CNIC photos — optional pair, same secure server-side R2
    // upload endpoint pattern as the applicant's own CNIC photos, just a
    // separate route so the object paths stay unambiguous.
    let guardianCnicFrontUrl: string | undefined;
    let guardianCnicBackUrl: string | undefined;
    if (guardianCnicFront && guardianCnicBack) {
      const uploadForm = new FormData();
      uploadForm.append('cnic', digits);
      uploadForm.append('front', guardianCnicFront);
      uploadForm.append('back', guardianCnicBack);
      try {
        const res = await fetch('/api/upload-guardian-cnic', { method: 'POST', body: uploadForm });
        const uploaded = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(uploaded.error || 'Failed to upload guardian CNIC photos. Please try again.');
          setSubmitting(false);
          return;
        }
        guardianCnicFrontUrl = uploaded.front;
        guardianCnicBackUrl = uploaded.back;
      } catch {
        setError('Failed to upload guardian CNIC photos. Please check your connection and try again.');
        setSubmitting(false);
        return;
      }
    }

    // Most recent education document — optional single file, same
    // pattern as the degree certificate uploads below.
    let educationDocumentUrl: string | undefined;
    if (educationDocument) {
      const uploadForm = new FormData();
      uploadForm.append('cnic', digits);
      uploadForm.append('file', educationDocument);
      try {
        const res = await fetch('/api/upload-education-document', { method: 'POST', body: uploadForm });
        const uploaded = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(uploaded.error || 'Failed to upload education document. Please try again.');
          setSubmitting(false);
          return;
        }
        educationDocumentUrl = uploaded.url;
      } catch {
        setError('Failed to upload education document. Please check your connection and try again.');
        setSubmitting(false);
        return;
      }
    }

    // Degree certificates — all optional, each uploaded individually
    // through the same secure server-side R2 endpoint as CNIC photos.
    const uploadCert = async (file: File | null, slot: string): Promise<string | undefined> => {
      if (!file) return undefined;
      const uploadForm = new FormData();
      uploadForm.append('cnic', digits);
      uploadForm.append('slot', slot);
      uploadForm.append('file', file);
      const res = await fetch('/api/upload-degree-certificate', { method: 'POST', body: uploadForm });
      const uploaded = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(uploaded.error || 'Failed to upload a degree certificate.');
      return uploaded.url;
    };
    let degreeCertUrl: string | undefined;
    let degreeCert2Url: string | undefined;
    let degreeCert3Url: string | undefined;
    try {
      degreeCertUrl = await uploadCert(degreeCert, '1');
      degreeCert2Url = await uploadCert(degreeCert2, '2');
      degreeCert3Url = await uploadCert(degreeCert3, '3');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload a degree certificate. Please try again.');
      setSubmitting(false);
      return;
    }

    const { success, error: apiErr } = await submitProposal({
      name: form.name.trim(),
      gender: form.gender,
      age: +form.age,
      contact_phone: formatDialedPhone(form.phone_dial_code, form.phone),
      contact_phone_2: form.phone2.trim() ? formatDialedPhone(form.phone2_dial_code, form.phone2) : undefined,
      height_inches: totalInches || undefined,
      country: form.country || undefined,
      city: form.city,
      home_type: form.home_type || undefined,
      location: form.location || undefined,
      house_size: form.house_size ? `${form.house_size} ${form.house_size_unit}` : undefined,
      caste: actualCaste,
      sect: form.sect,
      profession: actualProfession,
      profession_category: getProfessionCategory(form.profession === 'Other' ? 'Other' : form.profession),
      marital_status: form.marital_status,
      marriage_number: form.marriage_number || undefined,
      boys: form.boys ? +form.boys : undefined,
      girls: form.girls ? +form.girls : undefined,
      open_to_polygamy: form.open_to_polygamy || undefined,
      about: form.about || undefined,
      looking_for: form.looking_for || undefined,
      // step 2
      family_type: form.family_type || undefined,
      father_alive: form.father_alive === 'Alive' ? true : form.father_alive === 'Deceased' ? false : undefined,
      mother_alive: form.mother_alive === 'Alive' ? true : form.mother_alive === 'Deceased' ? false : undefined,
      father_occupation: actualFatherOcc || undefined,
      mother_occupation: actualMotherOcc || undefined,
      brothers: form.brothers ? +form.brothers : undefined,
      sisters: form.sisters ? +form.sisters : undefined,
      education: form.education || undefined,
      degree_title: form.degree_title || undefined,
      institute: form.institute || undefined,
      degree_certificate_url: degreeCertUrl,
      degree_title_2: form.degree_title_2 || undefined,
      institute_2: form.institute_2 || undefined,
      degree_certificate_2_url: degreeCert2Url,
      degree_title_3: form.degree_title_3 || undefined,
      institute_3: form.institute_3 || undefined,
      degree_certificate_3_url: degreeCert3Url,
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
      guardian_cnic_front_url: guardianCnicFrontUrl,
      guardian_cnic_back_url: guardianCnicBackUrl,
      education_document_url: educationDocumentUrl,
      affiliate_code: appliedAffiliateCode || undefined,
      applied_coupon_code: appliedCouponCode || undefined,
    });

    setSubmitting(false);
    if (success) {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(STEP_KEY);
      localStorage.removeItem(COUPON_KEY);
      localStorage.removeItem(AFFILIATE_APPLIED_KEY);
      setSubmitted(true);
      trackEvent('register_complete');
    } else setError(apiErr || 'Something went wrong. Please try again.');
  };

  if (cropSrc) return (
    <PhotoCropModal
      src={cropSrc}
      onDone={async blob => {
        const rawFile = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
        setCropSrc('');
        setCompressingProfilePhoto(true);
        const compressed = await compressImage(rawFile);
        const file = await addWatermark(compressed);
        setProfilePhoto(file);
        setProfilePhotoPreview(URL.createObjectURL(file));
        setCompressingProfilePhoto(false);
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
      <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1A1830', marginBottom: 8 }}>Profile Submitted!</h2>
      <p style={{ color: '#6B6893', marginBottom: 24, lineHeight: 1.6 }}>
        Thank you for submitting your profile! Please allow up to 24 hours for review.
      </p>
      <Link href="/login" style={{ display: 'inline-block', padding: '13px 32px', borderRadius: 12, background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>
        Login
      </Link>
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
              onClick={async () => {
                if (!reachable) return;
                const targetStep = (i + 1) as 1 | 2 | 3 | 4 | 5;
                if (targetStep > step) {
                  const err = await validateStepAsync();
                  if (err) { setError(err.msg); setErrorField(err.field); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
                }
                setError(''); setErrorField('');
                setStep(targetStep);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}>
              <div style={{ height: 4, borderRadius: 4, background: i + 1 <= step ? '#534AB7' : '#E8E6F5', marginBottom: 6 }} />
              <span className="step-label-desktop" style={{ fontSize: 10, fontWeight: 700, color: i + 1 <= step ? '#534AB7' : '#68629C', textDecoration: reachable ? 'underline' : 'none' }}>{s}</span>
              <span className="step-label-mobile" style={{ fontSize: 10, fontWeight: 700, color: i + 1 <= step ? '#534AB7' : '#68629C', textDecoration: reachable ? 'underline' : 'none' }}>{stepsMobile[i]}</span>
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
                <div style={{ fontSize: 12, color: '#68629C' }}>You'll use these to login later</div>
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
                <Link href="/login" style={{ color: '#534AB7', fontWeight: 700, textDecoration: 'none' }}>→ Go to Login</Link>
              </div>
            )}
            <Field label="Set Password" required>
              <PasswordInput value={form.password} onChange={e => set('password', e.target.value)} style={{ ...inp, ...err('password') }} placeholder="Min 6 characters" />
            </Field>
            <Field label="Confirm Password" required>
              <PasswordInput value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} style={{ ...inp, ...err('confirm_password') }} placeholder="Repeat your password" />
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
                <div style={{ fontSize: 12, color: '#68629C' }}>Fields marked with * are required</div>
              </div>
            </div>

            <Field label="Profile Photo">
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setCropSrc(URL.createObjectURL(f));
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 80, height: 80, borderRadius: 40, border: `2px dashed ${errorField === 'profilePhoto' ? '#DC2626' : profilePhoto ? '#534AB7' : '#E8E6F5'}`, background: profilePhoto ? '#EEEDFE' : errorField === 'profilePhoto' ? '#FEF2F2' : '#FAFAFA', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {profilePhotoPreview
                      ? <img src={profilePhotoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#68629C" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    }
                    {compressingProfilePhoto && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(83,74,183,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="spin" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%' }} />
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: profilePhoto ? '#534AB7' : '#1A1830' }}>
                      {compressingProfilePhoto ? 'Processing photo…' : profilePhoto ? '✓ ' + profilePhoto.name : 'Upload Profile Photo'}
                    </div>
                    <div style={{ fontSize: 12, color: '#68629C', marginTop: 3 }}>Clear face photo · JPG or PNG</div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 8, background: '#EEEDFE', fontSize: 12, fontWeight: 700, color: '#534AB7' }}>
                        {profilePhoto ? 'Change Photo' : 'Choose Photo'}
                      </div>
                      {profilePhoto && (
                        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); setProfilePhoto(null); setProfilePhotoPreview(''); }}
                          style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 8, background: '#FEF2F2', fontSize: 12, fontWeight: 700, color: '#DC2626', cursor: 'pointer' }}>
                          Remove
                        </div>
                      )}
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
                <input type="number" min={18} max={99} maxLength={2} value={form.age} onChange={e => set('age', e.target.value.slice(0, 2))} style={{ ...inp, ...err('age') }} placeholder="e.g. 26" />
              </Field>
              <Field label="Gender" required>
                <Sel value={form.gender} onChange={v => { set('gender', v); if (v === 'Female' && form.marital_status === 'Married') set('marital_status', ''); if (v === 'Male' && form.marital_status === 'Khula') set('marital_status', ''); }} options={['Male','Female']} placeholder="Select" hasError={errorField === 'gender'} />
              </Field>
            </div>

            <Field label="Phone Number" required labelRight={<span style={{ fontSize: 11.5, fontWeight: 500, color: '#9990B8', textAlign: 'right' }}>(This number will be used for future verification)</span>}>
              <PhoneInput value={form.phone} onChange={v => set('phone', v)} dialCode={form.phone_dial_code} onDialChange={v => set('phone_dial_code', v)} required hasError={errorField === 'phone'} inputStyle={inp} />
            </Field>
            {showPhone2 ? (
              <Field label="Second Phone Number" labelRight={
                <button type="button" onClick={() => { setShowPhone2(false); set('phone2', ''); set('phone2_dial_code', '+92'); }}
                  aria-label="Remove second phone number"
                  style={{ background: 'none', border: 'none', padding: 0, color: '#9CA3AF', fontSize: 15, fontWeight: 700, lineHeight: 1, cursor: 'pointer' }}>
                  ✕
                </button>
              }>
                <PhoneInput value={form.phone2} onChange={v => set('phone2', v)} dialCode={form.phone2_dial_code} onDialChange={v => set('phone2_dial_code', v)} inputStyle={inp} />
              </Field>
            ) : (
              <button type="button" onClick={() => setShowPhone2(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24, background: 'none', border: 'none', padding: 0, color: '#534AB7', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> Add another phone number
              </button>
            )}

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
              <SearchableSelect value={form.city} onChange={v => set('city', v)} groups={cityGroups} placeholder="Select city" hasError={errorField === 'city'} />
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
              <SearchableSelect value={form.caste} onChange={v => { set('caste', v); if (v !== 'Other') set('caste_custom', ''); }} groups={casteGroups} placeholder="Select caste" hasError={errorField === 'caste'} />
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
              <OccupationSelect
                professionValue={form.profession}
                categoryValue={getProfessionCategory(form.profession)}
                customValue={form.profession_custom}
                groups={professionGroups}
                onSelect={(prof, cat) => { set('profession', prof); if (prof !== 'Other') set('profession_custom', ''); }}
                onCustomChange={v => set('profession_custom', v)}
                onCategoryChange={v => {/* category is auto-derived from profession */}}
                hasError={errorField === 'profession'}
                customHasError={errorField === 'profession_custom'}
                placeholder="Search or select occupation"
              />
            </Field>

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

            <Field label="Open to Polygamy?" labelExtra={<InfoPopover text="Select “Yes” if you are a woman willing to marry a married man, or a married man looking to marry another woman." />}>
              <Sel value={form.open_to_polygamy} onChange={v => set('open_to_polygamy', v)} options={POLYGAMY_OPTIONS} placeholder="Select" />
            </Field>

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
                  <div style={{ fontSize: 12, color: '#68629C' }}>All fields below are optional</div>
                </div>
              </div>
              <button onClick={() => skip(4)} style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #534AB733', background: '#EEEDFE', color: '#534AB7', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Skip →
              </button>
            </div>

            {/* FAMILY */}
            <SecHeader title="FAMILY" />
            <Field label="Family Type">
              <Sel value={form.family_type} onChange={v => set('family_type', v)} options={FAMILY_TYPE_OPTIONS} placeholder="Select" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Father">
                <Sel value={form.father_alive} onChange={v => set('father_alive', v)} options={['Alive','Deceased']} placeholder="Status" />
              </Field>
              <Field label="Mother">
                <Sel value={form.mother_alive} onChange={v => set('mother_alive', v)} options={['Alive','Deceased']} placeholder="Status" />
              </Field>
            </div>
            <Field label="Father's Occupation">
              <SearchableSelect value={form.father_occupation} onChange={v => { set('father_occupation', v); if (v !== 'Other') set('father_occupation_custom', ''); }} groups={professionGroups} placeholder="Select" />
            </Field>
            {form.father_occupation === 'Other' && (
              <SubSection>
                <Field label="Specify Occupation">
                  <input value={form.father_occupation_custom} onChange={e => set('father_occupation_custom', e.target.value)} style={inp} placeholder="e.g. Farmer, Contractor" maxLength={30} />
                </Field>
              </SubSection>
            )}
            <Field label="Mother's Occupation">
              <SearchableSelect value={form.mother_occupation} onChange={v => { set('mother_occupation', v); if (v !== 'Other') set('mother_occupation_custom', ''); }} groups={professionGroups} placeholder="Select" />
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
            <DegreeFields form={form} set={set} inp={inp}
              degreeCert={degreeCert} setDegreeCert={setDegreeCert}
              degreeCert2={degreeCert2} setDegreeCert2={setDegreeCert2}
              degreeCert3={degreeCert3} setDegreeCert3={setDegreeCert3}
              setViewImg={setViewImg} />

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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: -14 }}>
              <Field label="Weight (kg)">
                <input type="number" maxLength={3} value={form.weight_kg} onChange={e => set('weight_kg', e.target.value.slice(0, 3))} style={inp} placeholder="e.g. 65" />
              </Field>
              <Field label="Complexion">
                <Sel value={form.complexion} onChange={v => set('complexion', v)} options={COMPLEXIONS} placeholder="Select" />
              </Field>
            </div>

            {/* RELIGION */}
            <SecHeader title="RELIGION" />
            <Field label="Religion Practice Level">
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
                  <input value={form.disability_details} onChange={e => set('disability_details', e.target.value.slice(0, 30))} maxLength={30} style={inp} placeholder="e.g. Diabetes, managed well..." />
                  <div style={{ textAlign: 'right', fontSize: 11, color: form.disability_details.length === 30 ? '#E11D48' : '#68629C', marginTop: 4 }}>
                    {form.disability_details.length}/30
                  </div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1830' }}>Verification</div>
                  <div style={{ fontSize: 12, color: '#68629C' }}>Your documents remain private and fully secured</div>
                </div>
              </div>
              <button onClick={() => skip(5)} style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #534AB733', background: '#EEEDFE', color: '#534AB7', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Skip →
              </button>
            </div>

            <div style={{ background: '#EEEDFE', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#534AB7', lineHeight: 1.6 }}>
              Identity verification documents are required to activate your account, but you can skip this step and submit them later.
            </div>

            {showCandidateCnic && (<>
            <SecHeader title="FOR MARRIAGE-SEEKING PERSON" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <CnicUploadBox label="CNIC Front" fieldKey="cnicFront" errorField={errorField}
                file={cnicFront} preview={cnicFrontPreview} compressing={compressingCnicFront}
                onFileSelected={async raw => {
                  setCompressingCnicFront(true);
                  const f = await compressImage(raw);
                  setCnicFront(f); setCnicFrontPreview(URL.createObjectURL(f));
                  setCompressingCnicFront(false);
                }}
                onRemove={() => { setCnicFront(null); setCnicFrontPreview(''); }} />
              <CnicUploadBox label="CNIC Back" fieldKey="cnicBack" errorField={errorField}
                file={cnicBack} preview={cnicBackPreview} compressing={compressingCnicBack}
                onFileSelected={async raw => {
                  setCompressingCnicBack(true);
                  const f = await compressImage(raw);
                  setCnicBack(f); setCnicBackPreview(URL.createObjectURL(f));
                  setCompressingCnicBack(false);
                }}
                onRemove={() => { setCnicBack(null); setCnicBackPreview(''); }} />
            </div>
            </>)}

            {showLatestDegree && (
            <CnicUploadBox label="Most Recent Education Document" fieldKey="educationDocument" errorField={errorField}
              file={educationDocument} preview={educationDocumentPreview} compressing={compressingEducationDocument}
              onFileSelected={async raw => {
                setCompressingEducationDocument(true);
                const f = await compressImage(raw);
                setEducationDocument(f); setEducationDocumentPreview(URL.createObjectURL(f));
                setCompressingEducationDocument(false);
              }}
              onRemove={() => { setEducationDocument(null); setEducationDocumentPreview(''); }} />
            )}

            {showParentsCnic && (<>
            <SecHeader title="PARENT / GUARDIAN" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <CnicUploadBox label="CNIC Front" fieldKey="guardianCnicFront" errorField={errorField}
                file={guardianCnicFront} preview={guardianCnicFrontPreview} compressing={compressingGuardianCnicFront}
                onFileSelected={async raw => {
                  setCompressingGuardianCnicFront(true);
                  const f = await compressImage(raw);
                  setGuardianCnicFront(f); setGuardianCnicFrontPreview(URL.createObjectURL(f));
                  setCompressingGuardianCnicFront(false);
                }}
                onRemove={() => { setGuardianCnicFront(null); setGuardianCnicFrontPreview(''); }} />
              <CnicUploadBox label="CNIC Back" fieldKey="guardianCnicBack" errorField={errorField}
                file={guardianCnicBack} preview={guardianCnicBackPreview} compressing={compressingGuardianCnicBack}
                onFileSelected={async raw => {
                  setCompressingGuardianCnicBack(true);
                  const f = await compressImage(raw);
                  setGuardianCnicBack(f); setGuardianCnicBackPreview(URL.createObjectURL(f));
                  setCompressingGuardianCnicBack(false);
                }}
                onRemove={() => { setGuardianCnicBack(null); setGuardianCnicBackPreview(''); }} />
            </div>
            </>)}

          </div>
        )}

        {/* ── Step 5: Review ────────────────────────────────────────────────── */}
        {step === 5 && (() => {
          const R = (label: string, value?: string | number | boolean | null) => {
            if (value === undefined || value === null || value === '') return null;
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #F0EFF8' }}>
                <span style={{ fontSize: 12, color: '#9CA3AF', flex: '0 0 42%' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1830', textAlign: 'right', flex: '1 1 55%', minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{String(value)}</span>
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
          const hasAdditional = !!(form.family_type || form.father_alive || form.mother_alive || form.father_occupation || form.has_siblings ||
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
                  <div style={{ fontSize: 12, color: '#68629C' }}>Please check everything before submitting</div>
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
              {R('Phone', form.phone ? formatDialedPhone(form.phone_dial_code, form.phone) : null)}
              {form.phone2 && R('Second Phone', formatDialedPhone(form.phone2_dial_code, form.phone2))}
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
              {form.open_to_polygamy && R('Open to Polygamy', form.open_to_polygamy)}
              {form.about && R('About', form.about)}
              {form.looking_for && R('Looking For', form.looking_for)}

              {hasAdditional && (
                <>
                  <SecHeader title="ADDITIONAL INFO" />

                  {(form.family_type || form.father_alive || form.mother_alive || form.father_occupation || form.mother_occupation || form.has_siblings) && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#534AB7', marginBottom: 8, marginTop: 4 }}>FAMILY</div>
                      {form.family_type && R('Family Type', form.family_type)}
                      {form.father_alive && R('Father', form.father_alive)}
                      {form.mother_alive && R('Mother', form.mother_alive)}
                      {actualFatherOcc && R("Father's Occupation", actualFatherOcc)}
                      {actualMotherOcc && R("Mother's Occupation", actualMotherOcc)}
                      {form.has_siblings && R('Siblings', form.has_siblings)}
                      {form.has_siblings === 'Yes' && form.brothers && R('Brothers', form.brothers)}
                      {form.has_siblings === 'Yes' && form.sisters && R('Sisters', form.sisters)}
                    </>
                  )}

                  {(form.education || form.degree_title || form.institute || degreeCert ||
                    form.degree_title_2 || form.institute_2 || degreeCert2 ||
                    form.degree_title_3 || form.institute_3 || degreeCert3) && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#534AB7', marginBottom: 8, marginTop: 12 }}>EDUCATION</div>
                      {form.education && R('Education', form.education)}
                      {form.degree_title && R('Degree', form.degree_title)}
                      {form.institute && R('Institute', form.institute)}
                      {degreeCert && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #F0EFF8' }}>
                          <span style={{ fontSize: 12, color: '#9CA3AF' }}>Degree Certificate</span>
                          <span onClick={() => setViewImg(URL.createObjectURL(degreeCert))} style={{ fontSize: 13, fontWeight: 600, color: '#534AB7', textDecoration: 'underline', cursor: 'pointer' }}>View</span>
                        </div>
                      )}
                      {form.degree_title_2 && R('Degree 2', form.degree_title_2)}
                      {form.institute_2 && R('Institute 2', form.institute_2)}
                      {degreeCert2 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #F0EFF8' }}>
                          <span style={{ fontSize: 12, color: '#9CA3AF' }}>Degree 2 Certificate</span>
                          <span onClick={() => setViewImg(URL.createObjectURL(degreeCert2))} style={{ fontSize: 13, fontWeight: 600, color: '#534AB7', textDecoration: 'underline', cursor: 'pointer' }}>View</span>
                        </div>
                      )}
                      {form.degree_title_3 && R('Degree 3', form.degree_title_3)}
                      {form.institute_3 && R('Institute 3', form.institute_3)}
                      {degreeCert3 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #F0EFF8' }}>
                          <span style={{ fontSize: 12, color: '#9CA3AF' }}>Degree 3 Certificate</span>
                          <span onClick={() => setViewImg(URL.createObjectURL(degreeCert3))} style={{ fontSize: 13, fontWeight: 600, color: '#534AB7', textDecoration: 'underline', cursor: 'pointer' }}>View</span>
                        </div>
                      )}
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
                      {form.practice_level && R('Religion Practice Level', form.practice_level)}
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

              {(cnicFrontPreview || cnicBackPreview || educationDocumentPreview || guardianCnicFrontPreview || guardianCnicBackPreview) && (
                <>
                  <SecHeader title="VERIFICATION" />
                  {[
                    { label: 'CNIC Front', preview: cnicFrontPreview },
                    { label: 'CNIC Back', preview: cnicBackPreview },
                    { label: 'Education Document', preview: educationDocumentPreview },
                    { label: 'Guardian CNIC Front', preview: guardianCnicFrontPreview },
                    { label: 'Guardian CNIC Back', preview: guardianCnicBackPreview },
                  ].filter(({ preview }) => preview).map(({ label, preview }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #F0EFF8' }}>
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>{label}</span>
                      <span onClick={() => setViewImg(preview)} style={{ fontSize: 13, fontWeight: 600, color: '#534AB7', textDecoration: 'underline', cursor: 'pointer' }}>View</span>
                    </div>
                  ))}
                </>
              )}

              {/* Coupon Code — mirrors the mobile app's boxed card exactly
                  (same kAmber/kAmberLight colors from theme.dart). Entered
                  here at submission; the admin re-checks it's still valid
                  and not expired at approval time before applying it. */}
              <div style={{ padding: 14, background: '#FEEDE3', border: '1px solid #E8620A66', borderRadius: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8620A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.83Z"/>
                    <circle cx="7.5" cy="7.5" r="1.5"/>
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#E8620A' }}>Have a Coupon Code?</span>
                </div>
                <div style={{ fontSize: 11, color: '#6B6893', marginTop: 4, lineHeight: 1.5 }}>
                  Get a discount or free days on your subscription — it&apos;s checked when your profile is approved.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="e.g. EID2026"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700, color: '#E8620A', letterSpacing: 2, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => applyCoupon()}
                    disabled={validatingCoupon || !couponCode.trim()}
                    style={{
                      padding: '0 18px', borderRadius: 8, border: 'none', flexShrink: 0,
                      background: validatingCoupon || !couponCode.trim() ? '#F5D9C4' : '#E8620A',
                      color: validatingCoupon || !couponCode.trim() ? '#B98254' : '#fff',
                      fontWeight: 700, fontSize: 13, cursor: validatingCoupon || !couponCode.trim() ? 'default' : 'pointer',
                    }}>
                    {validatingCoupon ? '...' : 'Apply'}
                  </button>
                </div>
                {couponMessage && (
                  <div style={{ fontSize: 12, marginTop: 8, fontWeight: 600, color: couponIsError ? '#DC2626' : '#16A34A' }}>
                    {couponMessage}
                  </div>
                )}
              </div>

              {/* Referral Code — mirrors the mobile app's boxed card exactly
                  (same kPurple/kPurpleLight colors from theme.dart). */}
              <div style={{ padding: 14, background: '#EEEDFE', border: '1px solid #D4D1F7', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#534AB7' }}>Have a Referral Code?</span>
                </div>
                <div style={{ fontSize: 11, color: '#6B6893', marginTop: 4, lineHeight: 1.5 }}>
                  If someone referred you to Jor, enter their code to support them.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input
                    value={form.affiliate}
                    onChange={e => {
                      set('affiliate', e.target.value.toUpperCase());
                      setAppliedAffiliateCode(null);
                      setAffiliateMessage(null);
                    }}
                    placeholder="e.g. A3K9BZ"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700, color: '#534AB7', letterSpacing: 2, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => applyAffiliateCode()}
                    disabled={validatingAffiliate || !form.affiliate.trim()}
                    style={{
                      padding: '0 18px', borderRadius: 8, border: 'none', flexShrink: 0,
                      background: validatingAffiliate || !form.affiliate.trim() ? '#D4D1F7' : '#534AB7',
                      color: validatingAffiliate || !form.affiliate.trim() ? '#8F8AC7' : '#fff',
                      fontWeight: 700, fontSize: 13, cursor: validatingAffiliate || !form.affiliate.trim() ? 'default' : 'pointer',
                    }}>
                    {validatingAffiliate ? '...' : 'Apply'}
                  </button>
                </div>
                {affiliateMessage && (
                  <div style={{ fontSize: 12, marginTop: 8, fontWeight: 600, color: affiliateIsError ? '#DC2626' : '#16A34A' }}>
                    {affiliateMessage}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16, background: '#EEEDFE', border: '1px solid #534AB733', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#534AB7', lineHeight: 1.6 }}>
                Once you submit your proposal, it will be reviewed and published within 24 hours.
              </div>
            </div>
          );
        })()}

        {/* Nav buttons */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#DC2626', marginTop: 20 }}>
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
            : <button onClick={handleSubmit} disabled={submitting || compressingCnicFront || compressingCnicBack || compressingProfilePhoto} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 800, fontSize: 14, cursor: (submitting || compressingCnicFront || compressingCnicBack || compressingProfilePhoto) ? 'not-allowed' : 'pointer', opacity: (submitting || compressingCnicFront || compressingCnicBack || compressingProfilePhoto) ? 0.7 : 1, boxShadow: '0 4px 14px rgba(83,74,183,0.3)' }}>
                {submitting ? 'Submitting...' : 'Submit Proposal →'}
              </button>
          }
        </div>
      </div>
    </div>
  );
}
