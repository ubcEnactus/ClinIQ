import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConditionSchema } from "@/content/condition-schema";
import { loadConditionIndex, loadConditions, loadEmergencyChecklist, loadLocations } from "@/content/loader";

const conditions = loadConditions();
const uti = structuredClone(conditions.find((c) => c.id === "uti")!);

describe("shipped content", () => {
  it("loads the three stage 1 conditions", () => {
    expect(conditions.map((c) => c.id)).toEqual(["headache", "shingles", "uti"]);
  });

  it("loads the emergency checklist from Appendix A", () => {
    expect(loadEmergencyChecklist().items).toHaveLength(8);
  });

  it("lists the 21 conditions plus contraception, including every condition file", () => {
    const ids = loadConditionIndex().conditions.map((c) => c.id);
    expect(ids).toHaveLength(22);
    for (const c of conditions) expect(ids).toContain(c.id);
  });

  it("loads the real location directory: ten places, no fake customers, every wait sourced", () => {
    const locations = loadLocations();
    expect(locations).toHaveLength(10);
    expect(new Set(locations.map((l) => l.id)).size).toBe(10);
    expect(locations.filter((l) => l.participating)).toEqual([]);
    for (const l of locations) {
      if (l.wait) expect(l.wait.source).not.toMatch(/test|fixture/i);
      // Greater Vancouver, so a typo in the coordinates can't send someone to the ocean.
      expect(l.lat).toBeGreaterThan(49.1);
      expect(l.lat).toBeLessThan(49.4);
      expect(l.lng).toBeGreaterThan(-123.3);
      expect(l.lng).toBeLessThan(-122.9);
    }
    expect(new Set(locations.map((l) => l.kind))).toEqual(
      new Set(["pharmacy", "walk_in", "urgent_care", "emergency_department"]),
    );
  });

  it("fails loudly when the conditions directory is missing", () => {
    expect(() => loadConditions(path.join(__dirname, "no-such-dir"))).toThrow();
  });
});

describe("condition schema rejects", () => {
  const broken = (mutate: (c: typeof uti) => void) => {
    const c = structuredClone(uti);
    mutate(c);
    return ConditionSchema.safeParse(c);
  };

  it("a rule on an unknown question", () => {
    expect(broken((c) => (c.rules[0].when = { question: "nope", equals: "yes" })).success).toBe(false);
  });

  it("a rule on an option the question does not have", () => {
    expect(broken((c) => (c.rules[0].when = { question: "duration", equals: "a_month" })).success).toBe(false);
  });

  it("a date test on a non-date question", () => {
    expect(broken((c) => (c.rules[0].when = { question: "duration", at_least_days_ago: 3 })).success).toBe(false);
  });

  it("a rule id without the condition prefix", () => {
    expect(broken((c) => (c.rules[0].id = "shingles.over_a_week")).success).toBe(false);
  });

  it("duplicate question ids", () => {
    expect(broken((c) => c.questions.push(structuredClone(c.questions[0]))).success).toBe(false);
  });

  it("an unknown summary slot", () => {
    expect(broken((c) => (c.summary_template = "{nope}")).success).toBe(false);
  });

  it("a condition without pharmacist scope", () => {
    expect(broken((c) => delete (c as Partial<typeof uti>).pharmacist_scope).success).toBe(false);
  });
});
