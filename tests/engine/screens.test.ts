import { describe, expect, it } from "vitest";
import { loadConditions, loadEmergencyChecklist } from "@/content/loader";
import { daysAgo, isOpen, localTime } from "@/engine/clock";
import { checkEligibility, isBCPostalCode } from "@/engine/eligibility";
import { screenEmergency } from "@/engine/emergency";
import { bestMatch, matchConditions } from "@/engine/matching";
import { CODE_ALPHABET, generateCode, isExpired, issueReferenceCode, normalizeCode } from "@/engine/reference-code";
import { evaluateRules } from "@/engine/rules";
import { buildSummary } from "@/engine/summary";
import { CLEAN, NOW } from "./fixtures";

const conditions = loadConditions();
const byId = (id: string) => conditions.find((c) => c.id === id)!;

describe("emergency screen", () => {
  const checklist = loadEmergencyChecklist();

  it("nothing checked is not an emergency", () => {
    expect(screenEmergency(checklist, []).emergency).toBe(false);
  });

  it.each(checklist.items.map((i) => i.id))("%s alone is an emergency", (id) => {
    expect(screenEmergency(checklist, [id]).emergency).toBe(true);
  });

  it("an unknown item id throws", () => {
    expect(() => screenEmergency(checklist, ["chest_pain", "typo"])).toThrow();
  });
});

describe("eligibility", () => {
  const base = { hasPhn: "yes", age: 34, inLongTermCare: false, livesInBC: true } as const;

  it("a BC resident with a PHN is covered", () => {
    expect(checkEligibility(base)).toMatchObject({ pharmacyAllowed: true, feeCovered: "yes", guardianMayBeNeeded: false });
  });

  it("long-term care rules out the pharmacy", () => {
    expect(checkEligibility({ ...base, inLongTermCare: true })).toMatchObject({
      pharmacyAllowed: false,
      rule: { id: "eligibility.long_term_care" },
    });
  });

  it("no PHN: pharmacy allowed, fee not covered", () => {
    expect(checkEligibility({ ...base, hasPhn: "no" })).toMatchObject({ pharmacyAllowed: true, feeCovered: "no" });
  });

  it("unknown PHN: coverage unknown", () => {
    expect(checkEligibility({ ...base, hasPhn: "unknown" }).feeCovered).toBe("unknown");
  });

  it("out of province: pharmacy allowed, patient pays", () => {
    expect(checkEligibility({ ...base, livesInBC: false })).toMatchObject({ pharmacyAllowed: true, feeCovered: "no" });
  });

  it("under 18 may need a guardian", () => {
    expect(checkEligibility({ ...base, age: 16 }).guardianMayBeNeeded).toBe(true);
  });

  it("recognises BC postal codes", () => {
    expect(isBCPostalCode("V6B 1A1")).toBe(true);
    expect(isBCPostalCode("v6b1a1")).toBe(true);
    expect(isBCPostalCode("M5V 2T6")).toBe(false);
  });
});

describe("condition matching", () => {
  it.each([
    ["it burns when I pee", "uti"],
    ["My head hurts so much", "headache"],
    ["I have a painful rash on one side of my back", "shingles"],
    ["Headache, and also burning when I pee", "uti"],
  ])("%s → %s", (text, id) => {
    expect(bestMatch(text, conditions)?.id).toBe(id);
  });

  it("no keyword means no match", () => {
    expect(bestMatch("sore throat", conditions)).toBeNull();
  });

  it("a tie means no match, so the patient picks from the list", () => {
    expect(matchConditions("uti or shingles", conditions)).toHaveLength(2);
    expect(bestMatch("uti or shingles", conditions)).toBeNull();
  });

  it("matches whole words only", () => {
    expect(bestMatch("cutie", conditions)).toBeNull();
  });
});

describe("reference codes", () => {
  it("are six characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateCode();
      expect(code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{6}$`));
    }
  });

  it("reject biased bytes instead of wrapping them", () => {
    const batches = [new Uint8Array([255, 254, 253, 252, 251, 250]), new Uint8Array([0, 1, 2, 3, 4, 5])];
    expect(generateCode(() => batches.shift()!)).toBe("ABCDEF");
  });

  it("expire after 24 hours", () => {
    const ref = issueReferenceCode(NOW);
    expect(isExpired(ref, new Date(NOW.getTime() + 24 * 3600_000 - 1))).toBe(false);
    expect(isExpired(ref, new Date(NOW.getTime() + 24 * 3600_000))).toBe(true);
  });

  it("normalise what staff type", () => {
    expect(normalizeCode(" ab3-k9 x ")).toBe("AB3K9X");
  });
});

describe("summary", () => {
  const uti = byId("uti");
  const summarise = (answers = CLEAN.uti) =>
    buildSummary({
      condition: uti,
      answers,
      fired: evaluateRules(uti, answers, NOW),
      age: 34,
      allergies: "penicillin (rash)",
      routingReason: "Urinary tract infection can be assessed and treated by a pharmacist",
    });

  it("fills the template from the answers", () => {
    expect(summarise().sentence).toBe("34-year-old with urinary symptoms (burning and urgency) for under 2 days.");
  });

  it("lists key positives", () => {
    expect(summarise().keyPositives).toEqual(["Burning", "Urgency"]);
  });

  it("lists red flags cleared: rule-bearing questions answered without firing", () => {
    expect(summarise().redFlagsCleared.map((r) => r.questionId)).toEqual([
      "duration",
      "systemic",
      "pregnant",
      "assigned_male",
      "recurrent",
      "catheter_or_kidney",
    ]);
    const fired = summarise({ ...CLEAN.uti, systemic: "yes" });
    expect(fired.redFlagsCleared.map((r) => r.questionId)).not.toContain("systemic");
  });

  it("passes allergies and free text through as typed", () => {
    const s = summarise();
    expect(s.allergies).toBe("penicillin (rash)");
    expect(s.responses.find((r) => r.questionId === "antibiotic_allergy")?.answer).toBe("None");
  });

  it("collects flags separately", () => {
    const shingles = byId("shingles");
    const answers = { ...CLEAN.shingles, rash_started: "2026-10-10" };
    const s = buildSummary({
      condition: shingles,
      answers,
      fired: evaluateRules(shingles, answers, NOW),
      age: 61,
      allergies: "",
      routingReason: "",
    });
    expect(s.flags.map((f) => f.id)).toEqual(["shingles.past_72_hours"]);
    expect(s.sentence).toBe("61-year-old with a rash first noticed 2026-10-10.");
  });
});

describe("Vancouver time", () => {
  it("reads local date, weekday and time", () => {
    expect(localTime(NOW)).toEqual({ date: "2026-10-21", weekday: "wed", time: "12:00" });
  });

  it("uses the local date late in the evening, when UTC is already tomorrow", () => {
    expect(localTime(new Date("2026-10-22T05:30:00Z")).date).toBe("2026-10-21");
  });

  it("follows the daylight saving change on 1 Nov 2026", () => {
    expect(localTime(new Date("2026-10-31T07:30:00Z")).time).toBe("00:30"); // PDT, UTC-7
    expect(localTime(new Date("2026-11-02T07:30:00Z"))).toMatchObject({ date: "2026-11-01", time: "23:30" }); // PST, UTC-8
  });

  it("counts calendar days ago", () => {
    expect(daysAgo("2026-10-21", NOW)).toBe(0);
    expect(daysAgo("2026-10-18", NOW)).toBe(3);
    expect(daysAgo("2026-10-28", new Date("2026-11-02T07:30:00Z"))).toBe(4);
  });

  it("knows opening hours", () => {
    expect(isOpen("08:00-22:00", NOW)).toBe(true);
    expect(isOpen("08:00-22:00", new Date("2026-10-22T05:30:00Z"))).toBe(false); // 22:30
    expect(isOpen("00:00-24:00", new Date("2026-10-22T06:59:00Z"))).toBe(true); // 23:59
    expect(isOpen("closed", NOW)).toBe(false);
  });
});
