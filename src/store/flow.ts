import type { Condition } from "@/content/condition-schema";
import type { PatientContent } from "@/content/server";
import type { Eligibility } from "@/engine/eligibility";
import type { LatLng } from "@/engine/locations";
import type { ReferenceCode } from "@/engine/reference-code";
import type { RoutingDecision } from "@/engine/routing";
import type { AnswerValue, Answers } from "@/engine/rules";

// The in-progress intake on the patient's phone, and the rules for which
// screen they may be on. Pure: no React, no storage.

export type Step = "describe" | "safety" | "eligibility" | "confirm" | "questions" | "destination" | "share" | "waiting";

export const STEPS: Step[] = ["describe", "safety", "eligibility", "confirm", "questions", "destination", "share", "waiting"];

export const STEP_PATH: Record<Step, string> = {
  describe: "/",
  safety: "/safety",
  eligibility: "/eligibility",
  confirm: "/confirm",
  questions: "/questions",
  destination: "/destination",
  share: "/share",
  waiting: "/waiting",
};

export const CALL_911_PATH = "/call-911";

/** Not one of the 22 listed conditions. */
export const OTHER_CONDITION = "other";

export interface Basics {
  hasPhn: "yes" | "no" | "unknown";
  age: number;
  inLongTermCare: boolean;
  livesInBC: boolean;
  postalCode: string;
  origin: LatLng | null;
  allergies: string;
  medications: string;
  /** Prefilled from a past visit on this device, and confirmed today. */
  carriedForward: boolean;
}

export type EmergencySource =
  | { source: "checklist" }
  | { source: "link" }
  | { source: "answer"; questionId: string; ruleId: string; reason: string };

export interface Consent {
  locationId: string;
  firstName: string;
  dateOfBirth: string;
  shared: string[];
  at: string;
}

export interface RoutingResult {
  decision: RoutingDecision;
  eligibility: Eligibility;
  code: ReferenceCode;
  decidedAt: string;
}

export interface IntakeState {
  id: string;
  createdAt: string;
  description: string;
  /** Screen 1's keyword match, offered on screen 4. */
  suggestedCondition: string | null;
  emergencyScreen: { checked: string[]; at: string } | null;
  /** Once set, every screen but Call 911 is locked. */
  emergency: EmergencySource | null;
  basics: Basics | null;
  /** An id from the conditions index, or OTHER_CONDITION. */
  conditionId: string | null;
  answers: Answers;
  /** Answers from before a re-run, shown pre-selected so the patient can confirm or change them. */
  previousAnswers: Answers;
  questionIndex: number;
  result: RoutingResult | null;
  consent: Consent | "declined" | null;
  rerunUsed: boolean;
}

export function newIntake(id: string, now: Date): IntakeState {
  return {
    id,
    createdAt: now.toISOString(),
    description: "",
    suggestedCondition: null,
    emergencyScreen: null,
    emergency: null,
    basics: null,
    conditionId: null,
    answers: {},
    previousAnswers: {},
    questionIndex: 0,
    result: null,
    consent: null,
    rerunUsed: false,
  };
}

export type Action =
  | { type: "describe"; description: string; suggestedCondition: string | null }
  | { type: "screen"; checked: string[]; at: string }
  | { type: "emergencyLink" }
  | { type: "emergencyAnswer"; questionId: string; ruleId: string; reason: string }
  | { type: "clearEmergency" }
  | { type: "basics"; basics: Basics }
  | { type: "chooseCondition"; conditionId: string }
  | { type: "answer"; questionId: string; value: AnswerValue }
  | { type: "goToQuestion"; index: number }
  | { type: "decide"; result: RoutingResult }
  | { type: "consent"; consent: Consent | "declined" }
  | { type: "rerun" }
  | { type: "reset"; id: string; now: string };

// Anything upstream of the routing decision invalidates it.
const stale = { result: null, consent: null } as const;

export function reduce(state: IntakeState, action: Action): IntakeState {
  switch (action.type) {
    case "describe":
      return { ...state, description: action.description, suggestedCondition: action.suggestedCondition };
    case "screen":
      return {
        ...state,
        ...stale,
        emergencyScreen: { checked: action.checked, at: action.at },
        emergency: action.checked.length > 0 ? { source: "checklist" } : null,
      };
    case "emergencyLink":
      return { ...state, emergency: { source: "link" } };
    case "emergencyAnswer":
      return {
        ...state,
        ...stale,
        emergency: { source: "answer", questionId: action.questionId, ruleId: action.ruleId, reason: action.reason },
      };
    case "clearEmergency": {
      const e = state.emergency;
      if (!e) return state;
      if (e.source === "answer") {
        // Back to the question, with the answer that tripped the rule removed.
        const answers = { ...state.answers };
        delete answers[e.questionId];
        return { ...state, emergency: null, answers };
      }
      return { ...state, emergency: null, emergencyScreen: null };
    }
    case "basics":
      return { ...state, ...stale, basics: action.basics };
    case "chooseCondition":
      if (action.conditionId === state.conditionId) return state;
      return { ...state, ...stale, conditionId: action.conditionId, answers: {}, previousAnswers: {}, questionIndex: 0 };
    case "answer":
      return { ...state, ...stale, answers: { ...state.answers, [action.questionId]: action.value } };
    case "goToQuestion":
      return { ...state, questionIndex: action.index };
    case "decide":
      return { ...state, result: action.result };
    case "consent":
      return { ...state, consent: action.consent };
    case "reset":
      return newIntake(action.id, new Date(action.now));
    case "rerun":
      // Patient-initiated, once. Safety and the questions run again, with the
      // old answers offered as defaults.
      return {
        ...state,
        ...stale,
        emergencyScreen: null,
        answers: {},
        previousAnswers: state.answers,
        questionIndex: 0,
        rerunUsed: true,
      };
  }
}

export function conditionFor(state: IntakeState, content: Pick<PatientContent, "conditions">): Condition | null {
  return content.conditions.find((c) => c.id === state.conditionId) ?? null;
}

export function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined) return false;
  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
}

export function allAnswered(condition: Condition, answers: Answers): boolean {
  return condition.questions.every((q) => isAnswered(answers[q.id]));
}

/** The first screen the patient still has to complete. */
export function nextIncomplete(state: IntakeState, content: Pick<PatientContent, "conditions">): Step {
  if (!state.emergencyScreen) return "safety";
  if (!state.basics) return "eligibility";
  if (!state.conditionId) return "confirm";
  const condition = conditionFor(state, content);
  if (condition && !allAnswered(condition, state.answers)) return "questions";
  if (!state.result) return "destination";
  return "waiting";
}

/**
 * Where to send someone who opens `step`, or null if they may stay. An
 * emergency locks every screen; skipping ahead goes to the first incomplete one.
 */
export function redirectFor(
  step: Step | "call-911",
  state: IntakeState,
  content: Pick<PatientContent, "conditions">,
): string | null {
  if (step === "call-911") return null;
  if (state.emergency) return CALL_911_PATH;
  if (step === "describe") return null;

  const next = nextIncomplete(state, content);
  if (step === "questions" && !conditionFor(state, content)) {
    return STEP_PATH[STEPS.indexOf(next) < STEPS.indexOf("destination") ? next : "destination"];
  }
  if (step === "share") {
    const participating = state.result?.decision.location?.location.participating;
    return state.result && participating ? null : STEP_PATH[state.result ? "waiting" : next];
  }
  if (step === "waiting") return state.result ? null : STEP_PATH[next];
  return STEPS.indexOf(step) <= STEPS.indexOf(next) ? null : STEP_PATH[next];
}
