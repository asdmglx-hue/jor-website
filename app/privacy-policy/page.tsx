import type { Metadata } from 'next';
import FooterWhatsAppLink from '@/components/FooterWhatsAppLink';

export const metadata: Metadata = {
  title: 'Privacy Policy | Jor – Pakistan\'s Trusted Matrimonial Platform',
  description: 'Learn how Jor collects, uses, and protects your personal information on Pakistan\'s trusted rishta platform.',
  alternates: { canonical: 'https://joronline.com/privacy-policy' },
  robots: { index: true, follow: true },
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 32 }}>
    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A1830', marginBottom: 10 }}>{title}</h2>
    <div style={{ fontSize: 14, color: '#4A4870', lineHeight: 1.8 }}>{children}</div>
  </div>
);

export default function PrivacyPolicyPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1830', marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ fontSize: 14, color: '#6B6893' }}>Last updated: January 2026</p>
      </div>

      <div style={{ background: '#F9F8FF', border: '1px solid #E8E6F5', borderRadius: 14, padding: '16px 20px', marginBottom: 32, fontSize: 14, color: '#534AB7', lineHeight: 1.7 }}>
        Jor is committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights as a user of our matrimonial platform.
      </div>

      <Section title="1. Information We Collect">
        <p>When you create a Rishta profile on Jor, we collect:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 6 }}><strong>Personal details:</strong> Name, age, gender, city, education, profession, and other profile information you provide.</li>
          <li style={{ marginBottom: 6 }}><strong>Contact information:</strong> Phone number(s) used for account verification and proposal contact.</li>
          <li style={{ marginBottom: 6 }}><strong>Identity verification:</strong> CNIC number, used solely for account authentication — never shared publicly.</li>
          <li style={{ marginBottom: 6 }}><strong>Photos:</strong> Profile photos you upload, displayed to subscribed users.</li>
          <li style={{ marginBottom: 6 }}><strong>Usage data:</strong> Browsing activity, filters used, and pages visited — used to improve the platform.</li>
        </ul>
      </Section>

      <Section title="2. How We Use Your Information">
        <ul style={{ paddingLeft: 20 }}>
          <li style={{ marginBottom: 6 }}>To display your Rishta profile to other verified users.</li>
          <li style={{ marginBottom: 6 }}>To verify your identity and prevent fraudulent accounts.</li>
          <li style={{ marginBottom: 6 }}>To process subscription payments and send activation codes.</li>
          <li style={{ marginBottom: 6 }}>To send important updates about your account or matches.</li>
          <li style={{ marginBottom: 6 }}>To improve our platform through anonymised analytics.</li>
        </ul>
      </Section>

      <Section title="3. Who Can See Your Information">
        <p><strong>Public information</strong> (visible to all visitors): Age, city, education, profession, caste, and general profile details.</p>
        <p style={{ marginTop: 8 }}><strong>Subscribed users only:</strong> Contact phone numbers, photos, and detailed profile information.</p>
        <p style={{ marginTop: 8 }}><strong>Private (never shared):</strong> CNIC number, password, exact address, and payment details.</p>
      </Section>

      <Section title="4. Data Storage & Security">
        <p>Your data is stored securely on Supabase (PostgreSQL), hosted in compliance with international data security standards. We use encryption in transit (HTTPS) and at rest. Passwords are stored in hashed form and are never visible to our team.</p>
      </Section>

      <Section title="5. Data Sharing">
        <p>We do <strong>not</strong> sell, rent, or share your personal data with third parties for marketing purposes. We may share data only:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 6 }}>When required by Pakistani law or a court order.</li>
          <li style={{ marginBottom: 6 }}>With payment processors, solely to process your subscription.</li>
        </ul>
      </Section>

      <Section title="6. Your Rights">
        <ul style={{ paddingLeft: 20 }}>
          <li style={{ marginBottom: 6 }}><strong>Access:</strong> Request a copy of the data we hold about you.</li>
          <li style={{ marginBottom: 6 }}><strong>Correction:</strong> Update your profile information at any time through your account.</li>
          <li style={{ marginBottom: 6 }}><strong>Deletion:</strong> Request deletion of your account and all associated data.</li>
          <li style={{ marginBottom: 6 }}><strong>Pause:</strong> Temporarily hide your profile without deleting it.</li>
        </ul>
        <p style={{ marginTop: 10 }}>To exercise any of these rights, contact us via WhatsApp.</p>
      </Section>

      <Section title="7. Cookies">
        <p>Jor uses minimal cookies to maintain your login session and remember preferences. We do not use advertising or tracking cookies. You can clear cookies at any time through your browser settings.</p>
      </Section>

      <Section title="8. Children's Privacy">
        <p>Jor is strictly for users aged 18 and above. We do not knowingly collect data from minors. If we discover an underage account, it will be immediately removed.</p>
      </Section>

      <Section title="9. Changes to This Policy">
        <p>We may update this Privacy Policy from time to time. We will notify users of significant changes via the app or website. Continued use of Jor after changes constitutes acceptance of the updated policy.</p>
      </Section>

      <Section title="10. Contact Us">
        <p>For privacy concerns, data requests, or any questions about this policy, please contact us:</p>
        <FooterWhatsAppLink>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, color: '#25D366', fontWeight: 700 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Contact us on WhatsApp
          </span>
        </FooterWhatsAppLink>
      </Section>
    </div>
  );
}
