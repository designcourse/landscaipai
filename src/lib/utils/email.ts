// Lightweight disposable-email deterrent for signups. NOT exhaustive — it blocks
// the common throwaway providers to cut casual free-tier abuse (every free signup
// gets 10 credits). Determined abuse needs more (device/IP velocity, CAPTCHA, or a
// Supabase Auth hook) — tracked as a follow-up. Pairs with email confirmation,
// which is already enforced at signup.
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.info", "guerrillamail.biz",
  "guerrillamail.net", "guerrillamail.org", "sharklasers.com", "grr.la", "spam4.me",
  "10minutemail.com", "10minutemail.net", "20minutemail.com", "tempmail.com",
  "temp-mail.org", "temp-mail.io", "tempmail.dev", "tempmailo.com", "tempr.email",
  "yopmail.com", "yopmail.net", "yopmail.fr", "throwawaymail.com", "getnada.com",
  "nada.email", "dispostable.com", "maildrop.cc", "fakeinbox.com", "mailnesia.com",
  "mintemail.com", "mohmal.com", "trashmail.com", "trashmail.de", "mailcatch.com",
  "spamgourmet.com", "discard.email", "emailondeck.com", "mailpoof.com", "moakt.com",
  "inboxkitten.com", "mailtemp.net", "cs.email", "tmpmail.org", "tmpmail.net",
  "fakemail.net", "byom.de", "1secmail.com", "1secmail.org", "1secmail.net",
]);

/** True when the email's domain is a known disposable/temporary mail provider. */
export function isDisposableEmailDomain(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at === -1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}
