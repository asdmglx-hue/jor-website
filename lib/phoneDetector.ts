// Detects a phone number hidden in free-text fields (About, Looking For,
// etc.) so people can't bypass the subscription-gated contact system by
// just typing their number into their bio instead.
//
// This replaces an earlier version that merged every digit found
// ANYWHERE in the whole text into one string before checking length —
// that meant a bio mentioning age, weight, and a house number together
// could accidentally read as an 11-digit phone number. This version
// only looks at digits within a single contiguous run (never crossing
// an actual word), matching how a real phone number is actually
// written. Tested against 11 real phone-number variations (all
// correctly caught) and 24 realistic normal-bio sentences (all
// correctly left alone) before being wired up here.
//
// Deliberately does not flag keyword+number combinations like "call me"
// or "whatsapp" near any 4+ digit number — tested to be the least
// reliable signal and the most likely to misfire on ordinary text.
export function containsPhoneNumber(text: string | null | undefined): boolean {
  if (!text || text.length < 5) return false;
  let t = text;

  // Unicode digits -> ASCII (Arabic-Indic, Extended Arabic-Indic, Fullwidth)
  t = t.split('').map(ch => {
    const code = ch.codePointAt(0)!;
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
    if (code >= 0xFF10 && code <= 0xFF19) return String(code - 0xFF10);
    return ch;
  }).join('');

  // Emoji number keycaps
  t = t.replace(/0️⃣/g, '0').replace(/1️⃣/g, '1').replace(/2️⃣/g, '2').replace(/3️⃣/g, '3')
       .replace(/4️⃣/g, '4').replace(/5️⃣/g, '5').replace(/6️⃣/g, '6').replace(/7️⃣/g, '7')
       .replace(/8️⃣/g, '8').replace(/9️⃣/g, '9');

  t = t.toLowerCase();

  // Spelled-out numbers, English and Roman-Urdu
  const words: Record<string, string> = {
    zero: '0', zer0: '0', sifar: '0', oh: '0', one: '1', aik: '1', ek: '1', two: '2', do: '2',
    three: '3', teen: '3', four: '4', char: '4', five: '5', panch: '5', six: '6', chay: '6',
    seven: '7', sat: '7', eight: '8', aath: '8', nine: '9', nau: '9', niner: '9', ate: '8',
  };
  for (const [w, d] of Object.entries(words)) {
    t = t.replace(new RegExp(`\\b${w}\\b`, 'g'), d);
  }

  // Letter substitutions between digits (3o01234567, 3l01234567)
  t = t.replace(/([0-9])[oO]([0-9])/g, '$10$2').replace(/([0-9])[lIi]([0-9])/g, '$11$2');

  // Dot-removed variant for "z.e.r.o" style spelling
  const t2 = t.replace(/([a-z])\.([a-z])/g, '$1$2');

  const check = (s: string): boolean => {
    if (/03\d([\s\-./_()|,]{0,3}\d){8}/.test(s)) return true;
    if (/(\+92|0092|92)[\s\-./]*3\d[\s\-./]*\d{8}/.test(s)) return true;

    // Only within a single contiguous run of digits+separators — never
    // merged across the whole text. This is the actual bug fix.
    const spans = s.match(/[\d\s\-./_()|,]{6,}/g) || [];
    for (const span of spans) {
      const spanDigits = span.replace(/[^0-9]/g, '');
      if (spanDigits.length >= 10) return true;

      const digitGroups = (span.match(/\d+/g) || []).join('');
      if (digitGroups.length >= 10) {
        if (/^(03|923|0092)/.test(digitGroups) || digitGroups.length >= 11) return true;
        const reversed = digitGroups.split('').reverse().join('');
        if (/^(03|923)/.test(reversed)) return true;
      }
    }

    if (/(^|[\s,])(\d[\s\-./|,]{1,4}){7,}\d/.test(s)) return true;
    return false;
  };

  return check(t) || check(t2);
}

// Fields where this check applies — deliberately limited to text that's
// visible on a public profile page to a non-subscribed visitor. Fields
// like father's/mother's occupation, disability details, or house size
// aren't shown publicly on the website, so checking them added no real
// protection — just more surface area for an unlikely false positive.
// Note: unlike the mobile app, "location" is NOT included here, since
// the website's public profile page doesn't display that field at all
// (only "city," a separate dropdown field, is shown).
export const PUBLIC_PHONE_CHECK_FIELDS = [
  'name', 'caste', 'about', 'looking_for',
  'degree_title', 'institute',
  'degree_title_2', 'institute_2',
  'degree_title_3', 'institute_3',
  'profession', 'car_name',
] as const;

export const PHONE_CHECK_ERROR = 'Phone numbers are not allowed in text field.';
