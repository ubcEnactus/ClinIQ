// Appendix E. The six-character code a patient carries to the counter. It
// expires after 24 hours and is never the primary key: when PharmaNet arrives
// the Personal Health Number becomes the identifier and the code a convenience.
// A code alone never opens a record; the receiving side also confirms first
// name and date of birth.

// No 0/O, 1/I/L: the code is read aloud and typed by hand.
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const CODE_TTL_MS = 24 * 60 * 60 * 1000;

export interface ReferenceCode {
  code: string;
  expiresAt: string; // ISO 8601
}

/** Uniform over the alphabet: bytes past the last whole multiple are rejected, not wrapped. */
export function generateCode(randomBytes: (n: number) => Uint8Array = cryptoBytes): string {
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let code = "";
  while (code.length < CODE_LENGTH) {
    for (const b of randomBytes(CODE_LENGTH)) {
      if (b < limit && code.length < CODE_LENGTH) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
    }
  }
  return code;
}

export function issueReferenceCode(now: Date): ReferenceCode {
  return { code: generateCode(), expiresAt: new Date(now.getTime() + CODE_TTL_MS).toISOString() };
}

export function isExpired(ref: ReferenceCode, now: Date): boolean {
  return now.getTime() >= Date.parse(ref.expiresAt);
}

/** What staff type at the counter: case, spaces and dashes don't matter. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

function cryptoBytes(n: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}
