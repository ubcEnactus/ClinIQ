import type { PatientContent } from "@/content/server";
import { isExpired } from "@/engine/reference-code";
import type { Destination } from "@/engine/routing";
import type { Answers, FiredRule } from "@/engine/rules";
import { OTHER_CONDITION, type Consent, type IntakeState } from "./flow";

// The demo handoff from patient to clinic. When a patient consents on screen
// 7, their intake is written here; the clinic view (/clinic) reads it.
//
// DEMO ONLY: this lives in the browser's localStorage, so the patient and the
// clinic must be on the same device (two tabs or windows). Nothing is sent to
// a server. A real handoff needs a backend and the legal answer on what we
// may store and for how long (Appendix E).

const INBOX_KEY = "cliniq.demo.inbox.v1";
const AUDIT_KEY = "cliniq.demo.audit.v1";
const CHANGED = "cliniq-demo-inbox";

// Clinic: waiting -> seen | not_ours. Pharmacy: waiting -> in_assessment -> prescribed | referred.
export type IntakeStatus = "waiting" | "in_assessment" | "seen" | "not_ours" | "prescribed" | "referred";

/** Statuses that close the visit. A pharmacy bills the assessment fee for either of its two. */
export const DONE: readonly IntakeStatus[] = ["seen", "not_ours", "prescribed", "referred"];

/** The intake record as the receiving clinic sees it (Appendix E). */
export interface SharedIntake {
  id: string;
  providerId: string;
  referenceCode: string;
  codeExpiresAt: string;
  firstName: string;
  dateOfBirth: string;
  age: number;
  hasPhn: "yes" | "no" | "unknown";
  inLongTermCare: boolean;
  livesInBC: boolean;
  /** An id with a condition file, an index id without one, or OTHER_CONDITION. */
  conditionId: string;
  conditionLabel: string;
  /** What the patient typed on screen 1, in their own words. */
  description: string;
  answers: Answers;
  emergencyScreen: { checked: string[]; at: string };
  allergies: string;
  medications: string;
  carriedForward: boolean;
  routing: { destination: Destination; ruleId: string; reason: string; fired: FiredRule[] };
  sharedAt: string;
  status: IntakeStatus;
  statusAt: string | null;
}

export function toSharedIntake(
  state: IntakeState,
  consent: Consent,
  content: Pick<PatientContent, "index">,
): SharedIntake {
  const { basics, result, emergencyScreen, conditionId } = state;
  if (!basics || !result || !emergencyScreen || !conditionId) {
    throw new Error("cannot share an incomplete intake");
  }
  return {
    id: state.id,
    providerId: consent.locationId,
    referenceCode: result.code.code,
    codeExpiresAt: result.code.expiresAt,
    firstName: consent.firstName,
    dateOfBirth: consent.dateOfBirth,
    age: basics.age,
    hasPhn: basics.hasPhn,
    inLongTermCare: basics.inLongTermCare,
    livesInBC: basics.livesInBC,
    conditionId,
    conditionLabel:
      conditionId === OTHER_CONDITION
        ? "Something else"
        : (content.index.find((c) => c.id === conditionId)?.label ?? conditionId),
    description: state.description,
    answers: state.answers,
    emergencyScreen,
    allergies: basics.allergies,
    medications: basics.medications,
    carriedForward: basics.carriedForward,
    routing: {
      destination: result.decision.destination,
      ruleId: result.decision.rule.id,
      reason: result.decision.rule.reason,
      fired: result.decision.fired,
    },
    sharedAt: consent.at,
    status: "waiting",
    statusAt: null,
  };
}

/** Adds or replaces by intake id. A patient who re-runs and shares again replaces their old entry. */
export function upsert(list: readonly SharedIntake[], intake: SharedIntake): SharedIntake[] {
  return [intake, ...list.filter((i) => i.id !== intake.id)];
}

export function setStatus(list: readonly SharedIntake[], id: string, status: IntakeStatus, at: string): SharedIntake[] {
  return list.map((i) => (i.id === id ? { ...i, status, statusAt: at } : i));
}

/** The intake shared with this provider under this code, if the code hasn't expired. */
export function findByCode(
  list: readonly SharedIntake[],
  providerId: string,
  code: string,
  now: Date,
): SharedIntake | null {
  return (
    list.find(
      (i) =>
        i.providerId === providerId &&
        i.referenceCode === code &&
        !isExpired({ code: i.referenceCode, expiresAt: i.codeExpiresAt }, now),
    ) ?? null
  );
}

/** A code alone never opens a record: first name and date of birth must match too. */
export function identityMatches(intake: SharedIntake, firstName: string, dateOfBirth: string): boolean {
  return intake.firstName.trim().toLowerCase() === firstName.trim().toLowerCase() && intake.dateOfBirth === dateOfBirth;
}

// ---- browser storage (guarded: storage can be missing or blocked) ----

export function readInbox(): SharedIntake[] {
  try {
    const raw = window.localStorage.getItem(INBOX_KEY);
    return raw ? (JSON.parse(raw) as SharedIntake[]) : [];
  } catch {
    return [];
  }
}

export function writeInbox(list: SharedIntake[]): void {
  try {
    window.localStorage.setItem(INBOX_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(CHANGED));
  } catch {}
}

export function clearDemoData(): void {
  try {
    window.localStorage.removeItem(INBOX_KEY);
    window.localStorage.removeItem(AUDIT_KEY);
    window.dispatchEvent(new Event(CHANGED));
  } catch {}
}

/** Calls back whenever the inbox changes, in this tab or another. Returns an unsubscribe. */
export function onInboxChange(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === INBOX_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGED, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGED, callback);
  };
}

export interface AuditEntry {
  at: string;
  providerId: string;
  intakeId: string;
  action: "opened" | "seen" | "not_ours" | "prescribed" | "referred" | "code_lookup_failed";
}

/** Append-only: entries are never edited or removed (except by clearing all demo data). */
export function appendAudit(entry: AuditEntry): void {
  try {
    const raw = window.localStorage.getItem(AUDIT_KEY);
    const log = raw ? (JSON.parse(raw) as AuditEntry[]) : [];
    window.localStorage.setItem(AUDIT_KEY, JSON.stringify([...log, entry]));
  } catch {}
}
