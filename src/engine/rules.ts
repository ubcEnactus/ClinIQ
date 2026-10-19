import { optionsFor, type Condition, type Outcome, type When } from "@/content/condition-schema";
import { daysAgo } from "./clock";

// Evaluates a condition's routing rules against the patient's answers. The
// rules themselves live in conditions/*.yaml; this file only knows how to
// read them.

export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;

/** What a free-text question with a "none" option stores when it is tapped. */
export const FREETEXT_NONE = "none";

export interface FiredRule {
  id: string;
  outcome: Outcome;
  reason: string;
}

const SEVERITY: Record<Outcome, number> = { emergency: 3, urgent_physician: 2, physician: 1, flag: 0 };

/**
 * Rejects answers that do not fit the condition file. A mistyped option
 * value would otherwise fail to match a rule and silently route a patient
 * to the pharmacy.
 */
export function validateAnswers(condition: Condition, answers: Answers): void {
  const questions = new Map(condition.questions.map((q) => [q.id, q]));
  for (const [id, value] of Object.entries(answers)) {
    const q = questions.get(id);
    if (!q) throw new Error(`${condition.id}: unknown question "${id}"`);
    const allowed = optionsFor(q).map((o) => o.value);
    switch (q.type) {
      case "multi":
        if (!Array.isArray(value) || value.some((v) => !allowed.includes(v))) {
          throw new Error(`${condition.id}.${id}: expected a list of ${allowed.join(", ")}`);
        }
        break;
      case "yesno":
      case "single":
        if (typeof value !== "string" || !allowed.includes(value)) {
          throw new Error(`${condition.id}.${id}: expected one of ${allowed.join(", ")}`);
        }
        break;
      case "date":
      case "freetext":
        if (typeof value !== "string") throw new Error(`${condition.id}.${id}: expected text`);
        break;
    }
  }
}

function matches(when: When, answer: AnswerValue | undefined, now: Date): boolean {
  if (answer === undefined) return false;
  if ("at_least_days_ago" in when) {
    return typeof answer === "string" && daysAgo(answer, now) >= when.at_least_days_ago;
  }
  const values = "equals" in when ? [when.equals] : when.any_of;
  return Array.isArray(answer) ? answer.some((a) => values.includes(a)) : values.includes(answer);
}

/** Every rule that fires, in file order. Unanswered questions fire nothing. */
export function evaluateRules(condition: Condition, answers: Answers, now: Date): FiredRule[] {
  validateAnswers(condition, answers);
  return condition.rules
    .filter((r) => matches(r.when, answers[r.when.question], now))
    .map(({ id, outcome, reason }) => ({ id, outcome, reason }));
}

/** The rule that decides the destination: the most severe non-flag rule, first in file order on ties. */
export function decidingRule(fired: readonly FiredRule[]): FiredRule | null {
  let best: FiredRule | null = null;
  for (const r of fired) {
    if (r.outcome === "flag") continue;
    if (!best || SEVERITY[r.outcome] > SEVERITY[best.outcome]) best = r;
  }
  return best;
}

/** True once an answer means the patient should call 911. The question flow stops here. */
export function stopsFlow(fired: readonly FiredRule[]): boolean {
  return fired.some((r) => r.outcome === "emergency");
}
