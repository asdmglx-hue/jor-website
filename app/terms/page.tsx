import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | Jor – Pakistan\'s Trusted Matrimonial Platform',
  description: 'Read the terms and conditions for using Jor, Pakistan\'s trusted rishta and matrimonial platform.',
  robots: { index: true, follow: true },
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 32 }}>
    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A1830', marginBottom: 10 }}>{title}</h2>
    <div style={{ fontSize: 14, color: '#4A4870', lineHeight: 1.8 }}>{children}</div>
  </div>
);

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1830', marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ fontSize: 14, color: '#6B6893' }}>Last updated: January 2026</p>
      </div>

      <div style={{ background: '#F9F8FF', border: '1px solid #E8E6F5', borderRadius: 14, padding: '16px 20px', marginBottom: 32, fontSize: 14, color: '#534AB7', lineHeight: 1.7 }}>
        By using Jor, you agree to these Terms of Service. Please read them carefully before creating an account or posting a Rishta profile.
      </div>

      <Section title="1. Acceptance of Terms">
        <p>By accessing or using Jor (available at jor.com.pk and via our mobile app), you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, please do not use our platform.</p>
      </Section>

      <Section title="2. Eligibility">
        <ul style={{ paddingLeft: 20 }}>
          <li style={{ marginBottom: 6 }}>You must be at least 18 years of age to use Jor.</li>
          <li style={{ marginBottom: 6 }}>You must be a Pakistani national or resident, or an overseas Pakistani.</li>
          <li style={{ marginBottom: 6 }}>You must provide accurate and truthful information when creating your profile.</li>
          <li style={{ marginBottom: 6 }}>Each person may only maintain one active profile on the platform.</li>
        </ul>
      </Section>

      <Section title="3. User Responsibilities">
        <p>By posting a Rishta profile, you agree to:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 6 }}>Provide accurate, honest, and up-to-date information about yourself.</li>
          <li style={{ marginBottom: 6 }}>Not impersonate another person or use someone else's photos or details.</li>
          <li style={{ marginBottom: 6 }}>Not use Jor for any commercial, fraudulent, or non-matrimonial purpose.</li>
          <li style={{ marginBottom: 6 }}>Not harass, spam, or misuse contact information obtained through the platform.</li>
          <li style={{ marginBottom: 6 }}>Promptly update or remove your profile once you are married or no longer seeking a match.</li>
        </ul>
      </Section>

      <Section title="4. Profile Verification & Moderation">
        <p>Jor reviews all submitted profiles before they appear publicly. We reserve the right to:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 6 }}>Reject or remove any profile that violates these terms.</li>
          <li style={{ marginBottom: 6 }}>Request additional verification documents (e.g. CNIC) to confirm identity.</li>
          <li style={{ marginBottom: 6 }}>Permanently ban users who misuse the platform.</li>
        </ul>
        <p style={{ marginTop: 8 }}>Profiles marked as verified have been manually reviewed by our team. Verification does not constitute an endorsement of the individual.</p>
      </Section>

      <Section title="5. Subscriptions & Payments">
        <ul style={{ paddingLeft: 20 }}>
          <li style={{ marginBottom: 6 }}>Access to contact information and photos requires a paid subscription.</li>
          <li style={{ marginBottom: 6 }}>Subscription fees are non-refundable once an activation code has been issued.</li>
          <li style={{ marginBottom: 6 }}>Jor reserves the right to change subscription pricing with prior notice.</li>
          <li style={{ marginBottom: 6 }}>Subscriptions are personal and non-transferable.</li>
        </ul>
      </Section>

      <Section title="6. Prohibited Conduct">
        <p>The following are strictly prohibited on Jor:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 6 }}>Posting false, misleading, or fabricated profile information.</li>
          <li style={{ marginBottom: 6 }}>Using contact details to solicit money, business, or anything other than marriage.</li>
          <li style={{ marginBottom: 6 }}>Sharing or reselling contact information obtained through the platform.</li>
          <li style={{ marginBottom: 6 }}>Scraping, copying, or reproducing platform content without permission.</li>
          <li style={{ marginBottom: 6 }}>Any form of harassment, abuse, or inappropriate communication.</li>
        </ul>
      </Section>

      <Section title="7. Disclaimer of Warranties">
        <p>Jor is a platform that facilitates introductions between families. We do not:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 6 }}>Guarantee the accuracy of any profile information provided by users.</li>
          <li style={{ marginBottom: 6 }}>Conduct background checks beyond basic CNIC verification.</li>
          <li style={{ marginBottom: 6 }}>Take responsibility for any outcomes resulting from connections made through the platform.</li>
        </ul>
        <p style={{ marginTop: 8 }}>Users are strongly advised to conduct their own due diligence before pursuing any matrimonial arrangement.</p>
      </Section>

      <Section title="8. Limitation of Liability">
        <p>To the maximum extent permitted by Pakistani law, Jor shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of the platform, including but not limited to damages arising from misrepresentation by other users.</p>
      </Section>

      <Section title="9. Intellectual Property">
        <p>All content on Jor — including the logo, design, and platform code — is the property of Jor and may not be copied, reproduced, or distributed without written permission. User-submitted content (photos, profile text) remains the property of the user, but a licence is granted to Jor to display it on the platform.</p>
      </Section>

      <Section title="10. Termination">
        <p>Jor may suspend or terminate your account at any time for violation of these terms. You may delete your account at any time by contacting us via WhatsApp.</p>
      </Section>

      <Section title="11. Governing Law">
        <p>These Terms are governed by the laws of the Islamic Republic of Pakistan. Any disputes shall be subject to the exclusive jurisdiction of the courts of Lahore, Pakistan.</p>
      </Section>

      <Section title="12. Changes to Terms">
        <p>We may update these Terms from time to time. Continued use of Jor after changes are posted constitutes your acceptance of the revised Terms.</p>
      </Section>

      <Section title="13. Contact Us">
        <p>For questions about these Terms, please contact us:</p>
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
