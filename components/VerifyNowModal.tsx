'use client';
import { useState, useEffect } from 'react';
import { compressImage } from '@/lib/compressImage';
import { submitCnicVerificationAction } from '@/lib/actions/proposal-actions';
import { supabase } from '@/lib/supabase';
import type { Proposal } from '@/lib/supabase';

// Same visual pattern as app/register/SubmitClient.tsx's Verification step
// (Field, SecHeader, the dashed upload box, compress-on-select, ✕-to-remove)
// — kept as separate small components here rather than imported, since
// SubmitClient's versions are internal to that file and not exported.
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B6893', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#DC2626', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function SecHeader({ title, required }: { title: string; required?: boolean }) {
  return (
    <div style={{ marginTop: 20, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#68629C', letterSpacing: 1 }}>
        {title}{required && <span style={{ color: '#DC2626', marginLeft: 3 }}>*</span>}
      </div>
      <div style={{ height: 1, background: '#E8E6F5', marginTop: 6 }} />
    </div>
  );
}

function UploadBox({ label, file, preview, compressing, onFileSelected, onRemove }: {
  label: string; file: File | null; preview: string; compressing: boolean;
  onFileSelected: (raw: File) => Promise<void>;
  onRemove: () => void;
}) {
  return (
    <Field label={label.replace(' *', '')} required={label.endsWith(' *')}>
      <label style={{ display: 'block', cursor: 'pointer' }}>
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
          const raw = e.target.files?.[0];
          if (!raw) return;
          await onFileSelected(raw);
        }} />
        <div style={{ border: `2px dashed ${file ? '#534AB7' : '#E8E6F5'}`, borderRadius: 12, background: file ? '#EEEDFE' : '#FAFAFA', overflow: 'hidden', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {preview
            ? <img src={preview} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ textAlign: 'center', color: '#68629C' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ display: 'block', margin: '0 auto 8px' }}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/><circle cx="7" cy="13" r="1"/></svg>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  Tap to upload {label.replace(' *', '')}
                </div>
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

export default function VerifyNowModal({ user, onClose, onSaved }: {
  user: Proposal;
  onClose: () => void;
  onSaved: (updates: Record<string, unknown>) => void;
}) {
  // Hide a section only if docs are uploaded AND not rejected by admin.
  // Rejected docs must be re-uploaded so they should still show.
  const dv = user.doc_verification ?? {};
  const candidateCnicAlreadyDone = !!(user.cnic_front_url && user.cnic_back_url &&
    dv['cnic_front'] !== 'rejected' && dv['cnic_back'] !== 'rejected');
  const parentsCnicAlreadyDone   = !!(user.guardian_cnic_front_url && user.guardian_cnic_back_url &&
    dv['guardian_cnic_front'] !== 'rejected' && dv['guardian_cnic_back'] !== 'rejected');
  const degreeAlreadyDone        = !!(user.education_document_url && dv['education_document'] !== 'rejected');

  const [showCandidateCnic, setShowCandidateCnic] = useState(!candidateCnicAlreadyDone);
  const [showLatestDegree,  setShowLatestDegree]  = useState(!degreeAlreadyDone);
  const [showParentsCnic,   setShowParentsCnic]   = useState(!parentsCnicAlreadyDone);

  const [compulsoryCandidateCnic, setCompulsoryCandidateCnic] = useState(true);
  const [compulsoryLatestDegree,  setCompulsoryLatestDegree]  = useState(false);
  const [compulsoryParentsCnic,   setCompulsoryParentsCnic]   = useState(true);

  useEffect(() => {
    supabase.from('app_settings').select('key, value').then(({ data }) => {
      if (!data) return;
      const map = Object.fromEntries(data.map(r => [r.key, r.value]));
      if (!candidateCnicAlreadyDone && map['verify_now_candidate_cnic'] === 'false') setShowCandidateCnic(false);
      if (!degreeAlreadyDone        && map['verify_now_latest_degree']  === 'false') setShowLatestDegree(false);
      if (!parentsCnicAlreadyDone   && map['verify_now_parents_cnic']   === 'false') setShowParentsCnic(false);
      if (map['verify_now_candidate_cnic_compulsory'] === 'false') setCompulsoryCandidateCnic(false);
      if (map['verify_now_latest_degree_compulsory']  === 'true')  setCompulsoryLatestDegree(true);
      if (map['verify_now_parents_cnic_compulsory']   === 'false') setCompulsoryParentsCnic(false);
    });
  }, []);

  const [cnicFront, setCnicFront] = useState<File | null>(null);
  const [cnicBack, setCnicBack] = useState<File | null>(null);
  const [educationDocument, setEducationDocument] = useState<File | null>(null);
  const [guardianCnicFront, setGuardianCnicFront] = useState<File | null>(null);
  const [guardianCnicBack, setGuardianCnicBack] = useState<File | null>(null);

  const [cnicFrontPreview, setCnicFrontPreview] = useState('');
  const [cnicBackPreview, setCnicBackPreview] = useState('');
  const [educationDocumentPreview, setEducationDocumentPreview] = useState('');
  const [guardianCnicFrontPreview, setGuardianCnicFrontPreview] = useState('');
  const [guardianCnicBackPreview, setGuardianCnicBackPreview] = useState('');

  const [compressingCnicFront, setCompressingCnicFront] = useState(false);
  const [compressingCnicBack, setCompressingCnicBack] = useState(false);
  const [compressingEducationDocument, setCompressingEducationDocument] = useState(false);
  const [compressingGuardianCnicFront, setCompressingGuardianCnicFront] = useState(false);
  const [compressingGuardianCnicBack, setCompressingGuardianCnicBack] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const hasAnyFile = !!(cnicFront || cnicBack || educationDocument || guardianCnicFront || guardianCnicBack);

  // Validation, upload gating and the submit call below all mirror the user
  // app's _showVerifyNowSheet (subscription_screen.dart) line for line, so the
  // two clients behave identically. Notably: the candidate CNIC is required
  // whenever its section is SHOWN — the app gates on requireCnic, not on
  // compulsoryCnic — and only sections that are shown get uploaded at all.
  const handleSubmit = async () => {
    // 1. Candidate CNIC — both sides mandatory while the section is shown.
    if (showCandidateCnic && (!cnicFront || !cnicBack)) {
      setError('Please add both CNIC Front and Back photos');
      return;
    }
    // 2. Nothing is being collected at all.
    if (!showCandidateCnic && !showLatestDegree && !showParentsCnic) {
      setError('No verification documents are currently required');
      return;
    }
    // 3. Guardian CNIC — both sides or neither.
    if ((guardianCnicFront && !guardianCnicBack) || (!guardianCnicFront && guardianCnicBack)) {
      setError('Please add both Parent/Guardian CNIC Front and Back photos');
      return;
    }
    // If all compulsory sections must be submitted together, block partial submissions.
    const missing: string[] = [];
    if (showCandidateCnic && compulsoryCandidateCnic && (!cnicFront || !cnicBack)) {
      missing.push('Candidate CNIC (front & back)');
    }
    if (showLatestDegree && compulsoryLatestDegree && !educationDocument) {
      missing.push('Recent Education Document');
    }
    if (showParentsCnic && compulsoryParentsCnic && (!guardianCnicFront || !guardianCnicBack)) {
      missing.push('Parent/Guardian CNIC (front & back)');
    }
    if (missing.length > 0) {
      setError('Please upload all required documents: ' + missing.join(', '));
      return;
    }
    if (!hasAnyFile) { setError('Upload at least one document before submitting.'); return; }

    setSubmitting(true);
    setError('');

    const digits = (user.cnic || '').replace(/\D/g, '');
    // Mirrors the local state the app refreshes after submitting, so the
    // Verify Now button and section visibility update without a reload.
    const updates: Record<string, unknown> = {};
    const nextDocVerification: Record<string, string> = { ...(user.doc_verification ?? {}) };

    try {
      if (!digits) throw new Error('Could not verify account — CNIC is missing.');

      let frontUrl: string | undefined;
      let backUrl: string | undefined;
      if (showCandidateCnic && cnicFront && cnicBack) {
        const fd = new FormData();
        fd.append('cnic', digits);
        fd.append('front', cnicFront);
        fd.append('back', cnicBack);
        const res = await fetch('/api/upload-cnic', { method: 'POST', body: fd });
        const uploaded = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(uploaded.error || 'Failed to upload CNIC photos.');
        frontUrl = uploaded.front;
        backUrl = uploaded.back;
        updates.cnic_front_url = frontUrl;
        updates.cnic_back_url = backUrl;
        nextDocVerification.cnic_front = 'pending';
        nextDocVerification.cnic_back = 'pending';
      }

      let educationUrl: string | undefined;
      if (showLatestDegree && educationDocument) {
        const fd = new FormData();
        fd.append('cnic', digits);
        fd.append('file', educationDocument);
        const res = await fetch('/api/upload-education-document', { method: 'POST', body: fd });
        const uploaded = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(uploaded.error || 'Failed to upload education document.');
        educationUrl = uploaded.url;
        updates.education_document_url = educationUrl;
        nextDocVerification.education_document = 'pending';
      }

      let guardianFrontUrl: string | undefined;
      let guardianBackUrl: string | undefined;
      if (showParentsCnic && guardianCnicFront && guardianCnicBack) {
        const fd = new FormData();
        fd.append('cnic', digits);
        fd.append('front', guardianCnicFront);
        fd.append('back', guardianCnicBack);
        const res = await fetch('/api/upload-guardian-cnic', { method: 'POST', body: fd });
        const uploaded = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(uploaded.error || 'Failed to upload guardian CNIC photos.');
        guardianFrontUrl = uploaded.front;
        guardianBackUrl = uploaded.back;
        updates.guardian_cnic_front_url = guardianFrontUrl;
        updates.guardian_cnic_back_url = guardianBackUrl;
        nextDocVerification.guardian_cnic_front = 'pending';
        nextDocVerification.guardian_cnic_back = 'pending';
      }

      if (Object.keys(updates).length === 0) {
        setError('Upload at least one document before submitting.');
        setSubmitting(false);
        return;
      }

      // Same RPC the app calls. It creates the pending
      // cnic_verification_requests row the Admin app watches, resets each
      // submitted doc to 'pending', and clears is_doc_verified.
      const { ok, error: rpcError } = await submitCnicVerificationAction({
        p_cnic: digits,
        frontUrl,
        backUrl,
        guardianFrontUrl,
        guardianBackUrl,
        educationDocumentUrl: educationUrl,
        proposalNumber: user.proposal_number,
      });

      if (!ok) throw new Error(rpcError || 'Failed to save your documents. Please try again.');

      // Reflect what the RPC just did server-side.
      updates.doc_verification = nextDocVerification;
      updates.is_doc_verified = false;

      onSaved(updates);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 20, maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 24, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#1A1830' }}>
                {'Verification'}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close"
              style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#F5F5F5', color: '#6B6893', fontSize: 15, cursor: 'pointer' }}>
              ✕
            </button>
          </div>

          <div style={{ background: '#EEEDFE', borderRadius: 12, padding: '12px 16px', marginTop: 14, marginBottom: 6, fontSize: 13, color: '#534AB7', lineHeight: 1.6 }}>
            {(showCandidateCnic && compulsoryCandidateCnic) || (showLatestDegree && compulsoryLatestDegree) || (showParentsCnic && compulsoryParentsCnic)
              ? 'The following documents are required to verify your identity.'
              : 'Submit the following documents to get your verified badge.'}
          </div>

          {showCandidateCnic && (<>
          <SecHeader title="FOR MARRIAGE-SEEKING PERSON" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <UploadBox label={`CNIC Front${showCandidateCnic && compulsoryCandidateCnic ? " *" : ""}`} file={cnicFront} preview={cnicFrontPreview} compressing={compressingCnicFront}
              onFileSelected={async raw => {
                setCompressingCnicFront(true);
                const f = await compressImage(raw);
                setCnicFront(f); setCnicFrontPreview(URL.createObjectURL(f));
                setCompressingCnicFront(false);
              }}
              onRemove={() => { setCnicFront(null); setCnicFrontPreview(''); }} />
            <UploadBox label={`CNIC Back${showCandidateCnic && compulsoryCandidateCnic ? " *" : ""}`} file={cnicBack} preview={cnicBackPreview} compressing={compressingCnicBack}
              onFileSelected={async raw => {
                setCompressingCnicBack(true);
                const f = await compressImage(raw);
                setCnicBack(f); setCnicBackPreview(URL.createObjectURL(f));
                setCompressingCnicBack(false);
              }}
              onRemove={() => { setCnicBack(null); setCnicBackPreview(''); }} />
          </div>
          </>)}

          {showLatestDegree && (<>
          {!showCandidateCnic && <SecHeader title="MARRIAGE-SEEKING CANDIDATE" />}
          <UploadBox label={`Recent Education Document${showLatestDegree && compulsoryLatestDegree ? " *" : ""}`} file={educationDocument} preview={educationDocumentPreview} compressing={compressingEducationDocument}
            onFileSelected={async raw => {
              setCompressingEducationDocument(true);
              const f = await compressImage(raw);
              setEducationDocument(f); setEducationDocumentPreview(URL.createObjectURL(f));
              setCompressingEducationDocument(false);
            }}
            onRemove={() => { setEducationDocument(null); setEducationDocumentPreview(''); }} />
          </>)}

          {showParentsCnic && (<>
          <SecHeader title="PARENT / GUARDIAN" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <UploadBox label={`CNIC Front${showParentsCnic && compulsoryParentsCnic ? " *" : ""}`} file={guardianCnicFront} preview={guardianCnicFrontPreview} compressing={compressingGuardianCnicFront}
              onFileSelected={async raw => {
                setCompressingGuardianCnicFront(true);
                const f = await compressImage(raw);
                setGuardianCnicFront(f); setGuardianCnicFrontPreview(URL.createObjectURL(f));
                setCompressingGuardianCnicFront(false);
              }}
              onRemove={() => { setGuardianCnicFront(null); setGuardianCnicFrontPreview(''); }} />
            <UploadBox label={`CNIC Back${showParentsCnic && compulsoryParentsCnic ? " *" : ""}`} file={guardianCnicBack} preview={guardianCnicBackPreview} compressing={compressingGuardianCnicBack}
              onFileSelected={async raw => {
                setCompressingGuardianCnicBack(true);
                const f = await compressImage(raw);
                setGuardianCnicBack(f); setGuardianCnicBackPreview(URL.createObjectURL(f));
                setCompressingGuardianCnicBack(false);
              }}
              onRemove={() => { setGuardianCnicBack(null); setGuardianCnicBackPreview(''); }} />
          </div>
          </>)}

          {error && (
            <div style={{ marginTop: 4, marginBottom: 8, fontSize: 12.5, fontWeight: 600, color: '#DC2626' }}>{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !hasAnyFile}
            style={{
              width: '100%', marginTop: 12, padding: '13px', borderRadius: 12, border: 'none',
              background: submitting || !hasAnyFile ? '#D4D1F7' : '#534AB7',
              color: submitting || !hasAnyFile ? '#8F8AC7' : '#fff',
              fontWeight: 800, fontSize: 15, cursor: submitting || !hasAnyFile ? 'default' : 'pointer',
            }}>
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
          <button onClick={onClose} style={{ width: '100%', marginTop: 10, padding: '13px', borderRadius: 12, border: '1px solid #E8E6F5', background: '#fff', color: '#6B6893', fontWeight: 700, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
