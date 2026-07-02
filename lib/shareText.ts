import { Proposal } from './supabase';

export function buildProposalShareText(p: Proposal, useEmoji: boolean, showFullPhone: boolean): string {
  const cp = String.fromCodePoint;
  const webLink = `https://jor-share.asdmglx.workers.dev/${p.id}`;
  const hFt = Math.floor(p.height_inches / 12);
  const hIn = Math.round(p.height_inches % 12);
  const b = (emoji: number) => useEmoji ? cp(emoji) : '•';

  const maskPhone = (ph: string) => `${ph.slice(0, 4)} •••• ${ph.slice(-3)}`;
  const phone1Display = showFullPhone ? p.contact_phone : maskPhone(p.contact_phone);
  const phone2Display = p.contact_phone_2
    ? (showFullPhone ? p.contact_phone_2 : maskPhone(p.contact_phone_2))
    : null;
  const contactLines = phone2Display
    ? `*Contact 1:* ${phone1Display}\n*Contact 2:* ${phone2Display}`
    : `*Contact:* ${phone1Display}`;

  const lines: string[] = [
    useEmoji
      ? `*Rishta Proposal — Jor Matrimonial ${cp(0x1F4AB)}*\n`
      : `*Rishta Proposal — Jor Matrimonial*\n`,
    `${contactLines}\n`,
    `${b(0x1F464)} *Name:* ${p.name}`,
    `${b(0x1F382)} *Age:* ${p.age} yrs`,
  ];
  if (p.height_inches) lines.push(`${b(0x1F4CF)} *Height:* ${hFt}'${hIn}"`);
  if (p.country && p.country !== 'Pakistan') lines.push(`${b(0x1F30D)} *Lives in:* ${p.country}`);
  lines.push(`${b(0x1F4CD)} *City:* from ${p.city}`);
  if (p.home_type) lines.push(`${b(0x1F3E0)} *Home:* ${p.home_type}`);
  lines.push(`${b(0x1F4BC)} *Profession:* ${p.profession}`);
  lines.push(`${b(0x1F393)} *Education:* ${p.education}`);
  if (p.marital_status) {
    const needsKids = ['Divorced', 'Khula', 'Widowed'].includes(p.marital_status);
    const boys = p.boys ?? 0;
    const girls = p.girls ?? 0;
    const kidsStr = needsKids && (boys > 0 || girls > 0)
      ? ` (${[boys > 0 ? `${boys} boy${boys > 1 ? 's' : ''}` : '', girls > 0 ? `${girls} girl${girls > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ')})`
      : '';
    lines.push(`${b(0x1F48D)} *Marital Status:* ${p.marital_status}${kidsStr}`);
  }
  lines.push(`${b(0x1F9EC)} *Caste:* ${p.caste}`);
  lines.push(`${b(0x1F54C)} *Sect:* ${p.sect}`);
  const parentParts: string[] = [];
  if (p.father_alive != null) parentParts.push(`Father: ${p.father_alive ? 'Alive' : 'Deceased'}`);
  if (p.mother_alive != null) parentParts.push(`Mother: ${p.mother_alive ? 'Alive' : 'Deceased'}`);
  if (parentParts.length) lines.push(`${b(0x1F468)} *Parents:* ${parentParts.join(', ')}`);
  const sibParts: string[] = [];
  if (p.brothers) sibParts.push(`${p.brothers} brother${p.brothers > 1 ? 's' : ''}`);
  if (p.sisters) sibParts.push(`${p.sisters} sister${p.sisters > 1 ? 's' : ''}`);
  if (sibParts.length) lines.push(`${b(0x1F46B)} *Siblings:* ${sibParts.join(', ')}`);
  if (p.about) lines.push(`\n${b(0x1F4AC)} *About:* ${p.about.length > 120 ? p.about.slice(0, 120) + '...' : p.about}`);
  lines.push(`\n_Verified matrimonial profiles on Jor_`);
  lines.push(`${webLink}`);

  return lines.join('\n');
}
