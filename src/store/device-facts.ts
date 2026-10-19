// Reusable facts kept on the patient's own phone so they don't retype them:
// allergies, medications, PHN status, age, long-term care. Never symptoms,
// never consent. ClinIQ holds no central copy. Storage can be missing or
// blocked (private mode), so every access is guarded and the flow works without it.

const KEY = "cliniq.device-facts.v1";

export interface DeviceFacts {
  hasPhn: "yes" | "no" | "unknown";
  age: number;
  inLongTermCare: boolean;
  livesInBC: boolean;
  allergies: string;
  medications: string;
  savedAt: string;
}

export function readDeviceFacts(): DeviceFacts | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DeviceFacts) : null;
  } catch {
    return null;
  }
}

export function saveDeviceFacts(facts: DeviceFacts): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(facts));
  } catch {
    // Not remembered this time; nothing else depends on it.
  }
}

export function forgetDeviceFacts(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
