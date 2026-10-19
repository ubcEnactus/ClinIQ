import { z } from "zod";

// A condition file is clinical content: questions, routing rules and the
// pharmacist's regulatory scope. It is data, not code, and every rule in it
// must be readable by a clinician. See Appendix C, D and I.

const slug = z.string().regex(/^[a-z0-9_]+$/, "lowercase letters, digits and underscores only");

export const OptionSchema = z.strictObject({
  value: slug,
  label: z.string().min(1),
});

const base = {
  id: slug,
  text: z.string().min(1),
};

export const QuestionSchema = z.discriminatedUnion("type", [
  // Yes / No. Options are implied: yes, no.
  z.strictObject({ ...base, type: z.literal("yesno"), key_positive: z.boolean().default(false) }),
  z.strictObject({
    ...base,
    type: z.literal("single"),
    options: z.array(OptionSchema).min(2),
    key_positive: z.boolean().default(false),
  }),
  z.strictObject({
    ...base,
    type: z.literal("multi"),
    options: z.array(OptionSchema).min(2),
    key_positive: z.boolean().default(false),
  }),
  // Answer is a calendar date, YYYY-MM-DD.
  z.strictObject({ ...base, type: z.literal("date") }),
  // Answer is passed forward exactly as typed, never interpreted.
  z.strictObject({ ...base, type: z.literal("freetext"), none_option: z.boolean().default(false) }),
]);

// One test per rule, one question per test. No scoring and no weights.
export const WhenSchema = z.union([
  // single / yesno: the answer is this value. multi: this value was selected.
  z.strictObject({ question: slug, equals: slug }),
  // single / yesno: the answer is one of these. multi: any of these was selected.
  z.strictObject({ question: slug, any_of: z.array(slug).min(1) }),
  // date: the date is at least this many calendar days before today (Vancouver time).
  z.strictObject({ question: slug, at_least_days_ago: z.number().int().positive() }),
]);

// What a rule does when it fires. Severity order: emergency > urgent_physician > physician.
// A flag never changes the destination; it is shown to the clinician.
export const OutcomeSchema = z.enum(["emergency", "urgent_physician", "physician", "flag"]);

export const RuleSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9_]+\.[a-z0-9_]+$/, "rule ids look like <condition>.<name>"),
  when: WhenSchema,
  outcome: OutcomeSchema,
  reason: z.string().min(1),
});

const ReviewStatus = z.enum(["pending", "approved"]);

export const ConditionSchema = z
  .strictObject({
    id: slug,
    version: z.number().int().positive(),
    name: z.string().min(1),
    // Fills screen 4: "It sounds like this might be {patient_phrase}. Is that right?"
    patient_phrase: z.string().min(1),
    // Keyword matching for screen 1. Lowercase phrases a patient might type.
    synonyms: z.array(z.string().min(1)).min(1),
    // Clinician sign-off on the questions and rules in this file.
    review: z.strictObject({
      status: ReviewStatus,
      by: z.string().optional(),
      date: z.string().optional(),
    }),
    questions: z.array(QuestionSchema).min(1),
    rules: z.array(RuleSchema),
    // Slots: {age}, or any question id. See summary.ts.
    summary_template: z.string().min(1),
    // Required on every condition: a condition cannot be added without it.
    pharmacist_scope: z.strictObject({
      status: ReviewStatus,
      can_prescribe: z.string().min(1),
      cannot_prescribe: z.string().optional(),
      source: z.string().min(1),
    }),
  })
  .superRefine((c, ctx) => {
    const questions = new Map<string, Question>();
    c.questions.forEach((q, i) => {
      if (questions.has(q.id)) {
        ctx.addIssue({ code: "custom", path: ["questions", i, "id"], message: `duplicate question id "${q.id}"` });
      }
      questions.set(q.id, q);
    });

    const ruleIds = new Set<string>();
    c.rules.forEach((r, i) => {
      const at = ["rules", i];
      if (!r.id.startsWith(`${c.id}.`)) {
        ctx.addIssue({ code: "custom", path: [...at, "id"], message: `rule id must start with "${c.id}."` });
      }
      if (ruleIds.has(r.id)) {
        ctx.addIssue({ code: "custom", path: [...at, "id"], message: `duplicate rule id "${r.id}"` });
      }
      ruleIds.add(r.id);

      const q = questions.get(r.when.question);
      if (!q) {
        ctx.addIssue({ code: "custom", path: [...at, "when", "question"], message: `unknown question "${r.when.question}"` });
        return;
      }
      if ("at_least_days_ago" in r.when) {
        if (q.type !== "date") {
          ctx.addIssue({ code: "custom", path: [...at, "when"], message: `at_least_days_ago needs a date question` });
        }
        return;
      }
      const allowed = optionsFor(q).map((o) => o.value);
      if (allowed.length === 0) {
        ctx.addIssue({ code: "custom", path: [...at, "when"], message: `"${q.id}" has no options to match against` });
        return;
      }
      const values = "equals" in r.when ? [r.when.equals] : r.when.any_of;
      for (const v of values) {
        if (!allowed.includes(v)) {
          ctx.addIssue({
            code: "custom",
            path: [...at, "when"],
            message: `"${v}" is not an option of "${q.id}" (options: ${allowed.join(", ")})`,
          });
        }
      }
    });

    for (const [, slot] of c.summary_template.matchAll(/\{([a-z0-9_]+)\}/g)) {
      if (slot !== "age" && !questions.has(slot)) {
        ctx.addIssue({ code: "custom", path: ["summary_template"], message: `unknown slot "{${slot}}"` });
      }
    }
  });

export type Option = z.infer<typeof OptionSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type When = z.infer<typeof WhenSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type Condition = z.infer<typeof ConditionSchema>;

const YES_NO: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export function optionsFor(q: Question): Option[] {
  switch (q.type) {
    case "yesno":
      return YES_NO;
    case "single":
    case "multi":
      return q.options;
    default:
      return [];
  }
}
