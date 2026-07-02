import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Jor – Pakistan\'s Trusted Matrimonial Platform',
  description: 'Learn how Jor collects, uses, and protects your personal information on Pakistan\'s trusted rishta platform.',
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
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
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
        <div style={{ marginTop: 12, background: '#F9F8FF', border: '1px solid #E8E6F5', borderRadius: 12, padding: '14px 18px', fontSize: 14 }}>
          <div style={{ fontWeight: 700, color: '#1A1830', marginBottom: 4 }}>Jor Matrimonial Platform</div>
          <div style={{ color: '#6B6893' }}>Pakistan</div>
          <div style={{ marginTop: 8 }}>
            <a href="https://wa.me/923000000000" style={{ color: '#25D366', fontWeight: 700, textDecoration: 'none' }}>💬 Contact via WhatsApp</a>
          </div>
        </div>
      </Section>
    </div>
  );
}
