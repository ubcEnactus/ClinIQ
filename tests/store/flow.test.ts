import { describe, expect, it } from "vitest";
import { loadConditions } from "@/content/loader";
import { checkEligibility } from "@/engine/eligibility";
import { route } from "@/engine/routing";
import {
  CALL_911_PATH,
  OTHER_CONDITION,
  STEPS,
  STEP_PATH,
  newIntake,
  nextIncomplete,
  reduce,
  redirectFor,
  type Action,
  type Basics,
  type IntakeState,
} from "@/store/flow";
import { CLEAN, LOCATIONS, NOW, ORIGIN, PHARM_A } from "../engine/fixtures";

const content = { conditions: loadConditions() };

const BASICS: Basics = {
  hasPhn: "yes",
  age: 34,
  inLongTermCare: false,
  livesInBC: true,
  postalCode: "V6B 1A1",
  origin: ORIGIN,
  allergies: "None",
  medications: "None",
  carriedForward: false,
};

function run(...actions: Action[]): IntakeState {
  return actions.reduce(reduce, newIntake("test", NOW));
}

function decided(state: IntakeState): IntakeState {
  const eligibility = checkEligibility(state.basics!);
  const decision = route({
    emergencyChecked: [],
    condition: content.conditions.find((c) => c.id === state.conditionId) ?? null,
    answers: state.answers,
    eligibility,
    origin: ORIGIN,
    locations: LOCATIONS,
    now: NOW,
  });
  return reduce(state, {
    type: "decide",
    result: { decision, eligibility, code: { code: "ABCDEF", expiresAt: "" }, decidedAt: NOW.toISOString() },
  });
}

const answerAll = (id: string): Action[] =>
  Object.entries(CLEAN[id]).map(([questionId, value]) => ({ type: "answer", questionId, value }));

const through = (id: string) =>
  run(
    { type: "screen", checked: [], at: "t" },
    { type: "basics", basics: BASICS },
    { type: "chooseCondition", conditionId: id },
    ...answerAll(id),
  );

describe("emergency lock", () => {
  const locked = run({ type: "screen", checked: ["chest_pain"], at: "t" });

  it.each(STEPS)("a checklist tick locks %s", (step) => {
    expect(redirectFor(step, locked, content)).toBe(CALL_911_PATH);
  });

  it("an emergency answer locks every step, including ones already done", () => {
    const s = reduce(through("headache"), {
      type: "emergencyAnswer",
      questionId: "sudden_severe",
      ruleId: "headache.sudden_severe",
      reason: "x",
    });
    for (const step of STEPS) expect(redirectFor(step, s, content)).toBe(CALL_911_PATH);
    expect(s.result).toBeNull();
  });

  it("the emergency link locks too", () => {
    expect(redirectFor("describe", run({ type: "emergencyLink" }), content)).toBe(CALL_911_PATH);
  });

  it("the Call 911 screen is never redirected", () => {
    expect(redirectFor("call-911", locked, content)).toBeNull();
  });

  it("start over is not reachable while locked", () => {
    // The only screen offering it is describe, which redirects.
    expect(redirectFor("describe", locked, content)).toBe(CALL_911_PATH);
  });

  it("'I checked this by mistake' clears the tick and requires the checklist again", () => {
    const s = reduce(locked, { type: "clearEmergency" });
    expect(s.emergency).toBeNull();
    expect(s.emergencyScreen).toBeNull();
    expect(redirectFor("eligibility", s, content)).toBe(STEP_PATH.safety);
  });

  it("'I answered this by mistake' removes only that answer", () => {
    const before = reduce(through("headache"), {
      type: "emergencyAnswer",
      questionId: "sudden_severe",
      ruleId: "headache.sudden_severe",
      reason: "x",
    });
    const s = reduce(before, { type: "clearEmergency" });
    expect(s.answers.sudden_severe).toBeUndefined();
    expect(s.answers.history).toBe("a_few_weeks");
    expect(nextIncomplete(s, content)).toBe("questions");
  });
});

describe("step order", () => {
  it("cannot skip the safety check", () => {
    const s = run({ type: "describe", description: "uti", suggestedCondition: "uti" });
    expect(redirectFor("eligibility", s, content)).toBe(STEP_PATH.safety);
    expect(redirectFor("destination", s, content)).toBe(STEP_PATH.safety);
  });

  it("may go back to any earlier step", () => {
    const s = through("uti");
    for (const step of ["describe", "safety", "eligibility", "confirm", "questions"] as const) {
      expect(redirectFor(step, s, content)).toBeNull();
    }
  });

  it("cannot reach the destination with an unanswered question", () => {
    const s = run(
      { type: "screen", checked: [], at: "t" },
      { type: "basics", basics: BASICS },
      { type: "chooseCondition", conditionId: "uti" },
      { type: "answer", questionId: "duration", value: "under_2_days" },
    );
    expect(redirectFor("destination", s, content)).toBe(STEP_PATH.questions);
  });

  it("a condition without a file skips the questions", () => {
    const s = run(
      { type: "screen", checked: [], at: "t" },
      { type: "basics", basics: BASICS },
      { type: "chooseCondition", conditionId: OTHER_CONDITION },
    );
    expect(nextIncomplete(s, content)).toBe("destination");
    expect(redirectFor("questions", s, content)).toBe(STEP_PATH.destination);
  });

  it("share needs a participating destination; waiting needs a result", () => {
    const s = through("uti");
    expect(redirectFor("share", s, content)).toBe(STEP_PATH.destination);
    expect(redirectFor("waiting", s, content)).toBe(STEP_PATH.destination);
    const d = decided(s);
    expect(d.result?.decision.location?.location.id).toBe(PHARM_A.id);
    expect(redirectFor("share", d, content)).toBeNull();
    expect(redirectFor("waiting", d, content)).toBeNull();
  });
});

describe("stale results", () => {
  it.each<Action>([
    { type: "answer", questionId: "systemic", value: "yes" },
    { type: "basics", basics: { ...BASICS, inLongTermCare: true } },
    { type: "chooseCondition", conditionId: "shingles" },
    { type: "screen", checked: [], at: "t2" },
  ])("$type clears the decision and consent", (action) => {
    const d = reduce(decided(through("uti")), { type: "consent", consent: "declined" });
    const s = reduce(d, action);
    expect(s.result).toBeNull();
    expect(s.consent).toBeNull();
  });

  it("choosing the same condition again keeps the answers", () => {
    const s = reduce(through("uti"), { type: "chooseCondition", conditionId: "uti" });
    expect(s.answers).toEqual(CLEAN.uti);
  });
});

describe("re-run", () => {
  it("is once, re-runs safety and the questions, and offers old answers as defaults", () => {
    const d = decided(through("uti"));
    const s = reduce(d, { type: "rerun" });
    expect(s.rerunUsed).toBe(true);
    expect(s.result).toBeNull();
    expect(s.answers).toEqual({});
    expect(s.previousAnswers).toEqual(CLEAN.uti);
    expect(nextIncomplete(s, content)).toBe("safety");
    const afterSafety = reduce(s, { type: "screen", checked: [], at: "t3" });
    expect(nextIncomplete(afterSafety, content)).toBe("questions");
  });
});
