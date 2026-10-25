import { describe, expect, it } from "vitest";
import { loadConditionIndex, loadConditions } from "@/content/loader";
import { checkEligibility } from "@/engine/eligibility";
import { route } from "@/engine/routing";
import type { Answers } from "@/engine/rules";
import { newIntake, reduce, type Action, type Basics, type Consent, type IntakeState } from "@/store/flow";
import { findByCode, identityMatches, setStatus, toSharedIntake, upsert } from "@/store/inbox";
import { CLEAN, LOCATIONS, NOW, ORIGIN } from "../engine/fixtures";

const conditions = loadConditions();
const content = { index: loadConditionIndex().conditions };

const BASICS: Basics = {
  hasPhn: "yes",
  age: 34,
  inLongTermCare: false,
  livesInBC: true,
  postalCode: "V6B 1A1",
  origin: ORIGIN,
  allergies: "penicillin",
  medications: "None",
  carriedForward: true,
};

function decidedUti(answers: Answers = {}): IntakeState {
  const actions: Action[] = [
    { type: "describe", description: "it burns when I pee", suggestedCondition: "uti" },
    { type: "screen", checked: [], at: "2026-10-21T18:55:00Z" },
    { type: "basics", basics: BASICS },
    { type: "chooseCondition", conditionId: "uti" },
    ...Object.entries({ ...CLEAN.uti, ...answers }).map(
      ([questionId, value]): Action => ({ type: "answer", questionId, value }),
    ),
  ];
  const s = actions.reduce(reduce, newIntake("intake-1", NOW));
  const eligibility = checkEligibility(BASICS);
  const decision = route({
    emergencyChecked: [],
    condition: conditions.find((c) => c.id === "uti")!,
    answers: s.answers,
    eligibility,
    origin: ORIGIN,
    locations: LOCATIONS,
    now: NOW,
  });
  return reduce(s, {
    type: "decide",
    result: { decision, eligibility, code: { code: "AB3K9X", expiresAt: "2026-10-22T19:00:00.000Z" }, decidedAt: NOW.toISOString() },
  });
}

const CONSENT: Consent = {
  locationId: "demo-clinic",
  firstName: "Testy",
  dateOfBirth: "1990-01-01",
  shared: [],
  at: "2026-10-21T19:01:00Z",
};

describe("toSharedIntake", () => {
  it("carries what the clinic needs, and only to the consented provider", () => {
    const shared = toSharedIntake(decidedUti({ systemic: "yes" }), CONSENT, content);
    expect(shared).toMatchObject({
      id: "intake-1",
      providerId: "demo-clinic",
      referenceCode: "AB3K9X",
      firstName: "Testy",
      dateOfBirth: "1990-01-01",
      age: 34,
      conditionId: "uti",
      conditionLabel: "Urinary tract infection",
      description: "it burns when I pee",
      allergies: "penicillin",
      carriedForward: true,
      emergencyScreen: { checked: [], at: "2026-10-21T18:55:00Z" },
      routing: { destination: "physician", ruleId: "uti.systemic" },
      status: "waiting",
    });
    expect(shared.answers.systemic).toBe("yes");
  });

  it("refuses an incomplete intake", () => {
    expect(() => toSharedIntake(newIntake("x", NOW), CONSENT, content)).toThrow();
  });
});

describe("inbox", () => {
  const a = toSharedIntake(decidedUti(), CONSENT, content);

  it("a second share of the same intake replaces the first", () => {
    const list = upsert(upsert([], a), { ...a, routing: { ...a.routing, reason: "changed" } });
    expect(list).toHaveLength(1);
    expect(list[0].routing.reason).toBe("changed");
  });

  it("marks seen and not-our-patient with the time", () => {
    expect(setStatus([a], a.id, "not_ours", "t")[0]).toMatchObject({ status: "not_ours", statusAt: "t" });
  });

  it("finds by code only for this provider and before expiry", () => {
    expect(findByCode([a], "demo-clinic", "AB3K9X", NOW)?.id).toBe(a.id);
    expect(findByCode([a], "another-clinic", "AB3K9X", NOW)).toBeNull();
    expect(findByCode([a], "demo-clinic", "ZZZZZZ", NOW)).toBeNull();
    expect(findByCode([a], "demo-clinic", "AB3K9X", new Date("2026-10-22T19:00:00Z"))).toBeNull();
  });

  it("a code alone never opens a record: name and date of birth must match", () => {
    expect(identityMatches(a, " testy ", "1990-01-01")).toBe(true);
    expect(identityMatches(a, "Testy", "1990-01-02")).toBe(false);
    expect(identityMatches(a, "Tess", "1990-01-01")).toBe(false);
  });
});
