import { describe, expect, it } from "vitest";
import type { Outcome } from "@/content/condition-schema";
import { loadConditions } from "@/content/loader";
import { checkEligibility } from "@/engine/eligibility";
import { route, type Destination, type RoutingInput } from "@/engine/routing";
import { evaluateRules } from "@/engine/rules";
import {
  CLEAN,
  CLINIC_FAR,
  CLINIC_NEAR,
  ED,
  LOCATIONS,
  NOW,
  ORIGIN,
  PHARM_A,
  PHARM_B,
  PHARM_C,
  PHARM_CLOSED,
} from "./fixtures";

const conditions = loadConditions();
const byId = (id: string) => conditions.find((c) => c.id === id)!;
const eligible = checkEligibility({ hasPhn: "yes", age: 34, inLongTermCare: false, livesInBC: true });

function input(conditionId: string | null, overrides: Partial<RoutingInput> = {}, answers = {}): RoutingInput {
  return {
    emergencyChecked: [],
    condition: conditionId ? byId(conditionId) : null,
    answers: conditionId ? { ...CLEAN[conditionId], ...answers } : {},
    eligibility: eligible,
    origin: ORIGIN,
    locations: LOCATIONS,
    now: NOW,
    ...overrides,
  };
}

// One row per rule in conditions/. The coverage test below fails if a rule is missing.
const RULE_CASES: { rule: string; answers: Record<string, string | string[]>; outcome: Outcome; destination: Destination }[] = [
  { rule: "uti.over_a_week", answers: { duration: "over_a_week" }, outcome: "physician", destination: "physician" },
  { rule: "uti.systemic", answers: { systemic: "yes" }, outcome: "physician", destination: "physician" },
  { rule: "uti.pregnant", answers: { pregnant: "yes" }, outcome: "physician", destination: "physician" },
  { rule: "uti.assigned_male", answers: { assigned_male: "yes" }, outcome: "physician", destination: "physician" },
  { rule: "uti.recurrent", answers: { recurrent: "yes" }, outcome: "physician", destination: "physician" },
  { rule: "uti.catheter_or_kidney", answers: { catheter_or_kidney: "yes" }, outcome: "physician", destination: "physician" },
  { rule: "shingles.past_72_hours", answers: { rash_started: "2026-10-18" }, outcome: "flag", destination: "pharmacy" },
  { rule: "shingles.not_one_sided", answers: { one_side: "no" }, outcome: "physician", destination: "physician" },
  { rule: "shingles.face_or_eye", answers: { face_or_eye: "yes" }, outcome: "urgent_physician", destination: "urgent_physician" },
  { rule: "shingles.immunosuppressed", answers: { immunosuppressed: "yes" }, outcome: "physician", destination: "physician" },
  { rule: "shingles.pregnant", answers: { pregnant: "yes" }, outcome: "physician", destination: "physician" },
  { rule: "headache.sudden_severe", answers: { sudden_severe: "yes" }, outcome: "emergency", destination: "emergency" },
  { rule: "headache.fever_stiff_neck", answers: { fever_stiff_neck: "yes" }, outcome: "emergency", destination: "emergency" },
  { rule: "headache.neuro_symptoms", answers: { neuro_symptoms: "yes" }, outcome: "emergency", destination: "emergency" },
  { rule: "headache.long_history", answers: { history: "months_or_years" }, outcome: "physician", destination: "physician" },
  { rule: "headache.nsaid_failed", answers: { tried_nsaid: "did_not_help" }, outcome: "physician", destination: "physician" },
];

describe("every condition rule", () => {
  it("has a test case", () => {
    const all = conditions.flatMap((c) => c.rules.map((r) => r.id)).sort();
    expect(RULE_CASES.map((c) => c.rule).sort()).toEqual(all);
  });

  it.each(Object.keys(CLEAN))("clean %s answers fire nothing and route to the pharmacy", (id) => {
    const d = route(input(id));
    expect(d.fired).toEqual([]);
    expect(d.destination).toBe("pharmacy");
    expect(d.rule.id).toBe("routing.pharmacy");
  });

  it.each(RULE_CASES)("$rule fires alone and routes to $destination", ({ rule, answers, outcome, destination }) => {
    const conditionId = rule.split(".")[0];
    const d = route(input(conditionId, {}, answers));
    expect(d.fired).toEqual([expect.objectContaining({ id: rule, outcome })]);
    expect(d.destination).toBe(destination);
    expect(d.rule.id).toBe(outcome === "flag" ? "routing.pharmacy" : rule);
  });
});

describe("routing order (Appendix D)", () => {
  it("1. an emergency tick beats everything", () => {
    const d = route(input("headache", { emergencyChecked: ["chest_pain"] }, { tried_nsaid: "did_not_help" }));
    expect(d.destination).toBe("emergency");
    expect(d.rule.id).toBe("routing.emergency_checklist");
    expect(d.location).toBeNull();
    expect(d.alternatives).toEqual([]);
  });

  it("2. the most severe rule decides: emergency over physician", () => {
    const d = route(input("headache", {}, { history: "months_or_years", neuro_symptoms: "yes" }));
    expect(d.destination).toBe("emergency");
    expect(d.rule.id).toBe("headache.neuro_symptoms");
    expect(d.fired.map((f) => f.id)).toEqual(["headache.neuro_symptoms", "headache.long_history"]);
  });

  it("2. urgent physician over physician", () => {
    const d = route(input("shingles", {}, { pregnant: "yes", face_or_eye: "yes" }));
    expect(d.destination).toBe("urgent_physician");
    expect(d.rule.id).toBe("shingles.face_or_eye");
  });

  it("2. ties go to the first rule in the file", () => {
    const d = route(input("uti", {}, { recurrent: "yes", systemic: "yes" }));
    expect(d.rule.id).toBe("uti.systemic");
  });

  it("2. a flag is recorded but never reroutes", () => {
    const d = route(input("shingles", {}, { rash_started: "2026-10-01" }));
    expect(d.destination).toBe("pharmacy");
    expect(d.fired.map((f) => f.id)).toEqual(["shingles.past_72_hours"]);
  });

  it("3. a condition without a file routes to a physician", () => {
    const d = route(input(null));
    expect(d.destination).toBe("physician");
    expect(d.rule.id).toBe("routing.condition_not_supported");
  });

  it("4. long-term care routes to a physician", () => {
    const ltc = checkEligibility({ hasPhn: "yes", age: 80, inLongTermCare: true, livesInBC: true });
    const d = route(input("uti", { eligibility: ltc }));
    expect(d.destination).toBe("physician");
    expect(d.rule.id).toBe("eligibility.long_term_care");
  });

  it("4. no PHN still routes to the pharmacy (the fee is not covered)", () => {
    const noPhn = checkEligibility({ hasPhn: "no", age: 34, inLongTermCare: false, livesInBC: true });
    expect(route(input("uti", { eligibility: noPhn })).destination).toBe("pharmacy");
  });

  it("5. with no participating pharmacy open, any open pharmacy (the patient brings the code)", () => {
    const d = route(input("uti", { locations: [PHARM_C, PHARM_CLOSED, CLINIC_FAR, CLINIC_NEAR] }));
    expect(d.destination).toBe("pharmacy");
    expect(d.location?.location.id).toBe(PHARM_C.id);
    expect(d.location?.location.participating).toBe(false);
  });

  it("5. a participating pharmacy beats a faster non-participating one", () => {
    const d = route(input("uti"));
    expect(d.location?.location.id).toBe(PHARM_A.id);
    expect(d.alternatives[0].location.id).toBe(PHARM_C.id);
  });

  it("5. no pharmacy open at all routes to a physician", () => {
    const d = route(input("uti", { locations: [PHARM_CLOSED, CLINIC_FAR, CLINIC_NEAR] }));
    expect(d.destination).toBe("physician");
    expect(d.rule.id).toBe("routing.no_open_pharmacy");
    expect(d.location?.location.id).toBe(CLINIC_FAR.id);
  });
});

describe("destinations and alternatives", () => {
  it("pharmacy: the open participating pharmacy with the lowest total time", () => {
    const d = route(input("uti"));
    expect(d.location?.location.id).toBe(PHARM_A.id);
    expect(d.location).toMatchObject({ travelMinutes: 2, waitMinutes: 10, totalMinutes: 12 });
    // Non-customer pharmacies and walk-ins are alternatives; EDs and closed locations are not.
    expect(d.alternatives.map((a) => a.location.id)).toEqual([PHARM_C.id, CLINIC_FAR.id, CLINIC_NEAR.id, PHARM_B.id]);
  });

  it("physician: a clinic 6 km away with a 20 minute wait beats one 2 km away with a 2 hour wait", () => {
    const d = route(input("uti", {}, { systemic: "yes" }));
    expect(d.location?.location.id).toBe(CLINIC_FAR.id);
    expect(d.alternatives.map((a) => a.location.id)).toEqual([CLINIC_NEAR.id]);
  });

  it("physician: urgent care centres count as walk-ins", () => {
    const upcc = { ...CLINIC_NEAR, id: "upcc", name: "upcc", kind: "urgent_care" as const, wait: { ...CLINIC_NEAR.wait!, minutes: 5 } };
    const d = route(input("uti", { locations: [...LOCATIONS, upcc] }, { systemic: "yes" }));
    expect(d.location?.location.id).toBe("upcc");
  });

  it("urgent physician: walk-ins and emergency departments", () => {
    const d = route(input("shingles", {}, { face_or_eye: "yes" }));
    expect(d.location?.location.id).toBe(CLINIC_FAR.id);
    expect(d.alternatives.map((a) => a.location.id)).toEqual([CLINIC_NEAR.id, ED.id]);
  });

  it("without the patient's location, ranks on published wait alone", () => {
    const d = route(input("uti", { origin: null }));
    expect(d.location).toMatchObject({ travelMinutes: null, totalMinutes: 10 });
    expect(d.alternatives.map((a) => a.location.id)).toEqual([PHARM_C.id, CLINIC_FAR.id, CLINIC_NEAR.id, PHARM_B.id]);
  });
});

describe("fail closed", () => {
  it("rejects an answer that is not an option", () => {
    expect(() => evaluateRules(byId("uti"), { systemic: "Yes" }, NOW)).toThrow(/expected one of/);
  });

  it("rejects an unknown question", () => {
    expect(() => evaluateRules(byId("uti"), { fever: "yes" }, NOW)).toThrow(/unknown question/);
  });

  it("rejects a single answer on a multi question", () => {
    expect(() => evaluateRules(byId("uti"), { symptoms: "burning" }, NOW)).toThrow(/expected a list/);
  });

  it("rejects a malformed date", () => {
    expect(() => evaluateRules(byId("shingles"), { rash_started: "last tuesday" }, NOW)).toThrow(/YYYY-MM-DD/);
  });

  it("unanswered questions fire nothing", () => {
    expect(evaluateRules(byId("headache"), {}, NOW)).toEqual([]);
  });
});
