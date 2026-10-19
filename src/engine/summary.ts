import { optionsFor, type Condition, type Question } from "@/content/condition-schema";
import { FREETEXT_NONE, type AnswerValue, type Answers, type FiredRule } from "./rules";

// The patient summary the clinician reads (blueprint, physician side). No
// model: every element comes out of the structured answers deterministically.
//   sentence          template with slots
//   key positives     questions marked key_positive, answered yes / selected
//   red flags cleared questions that carry a routing rule, answered, none fired
//   allergies         passed through exactly as typed
//   routing reason    the rule that fired
//   responses         every question and answer, collapsed on screen

export interface Response {
  questionId: string;
  question: string;
  answer: string;
}

export interface Summary {
  sentence: string;
  keyPositives: string[];
  redFlagsCleared: Response[];
  flags: FiredRule[];
  allergies: string;
  routingReason: string;
  responses: Response[];
}

export interface SummaryInput {
  condition: Condition;
  answers: Answers;
  fired: readonly FiredRule[];
  age: number;
  allergies: string;
  routingReason: string;
}

export function answerLabel(q: Question, value: AnswerValue): string {
  const label = (v: string) => optionsFor(q).find((o) => o.value === v)?.label ?? v;
  switch (q.type) {
    case "multi":
      return joinNatural((value as string[]).map(label));
    case "yesno":
    case "single":
      return label(value as string);
    case "freetext":
      return value === FREETEXT_NONE ? "None" : (value as string);
    case "date":
      return value as string;
  }
}

export function buildSummary(input: SummaryInput): Summary {
  const { condition, answers, fired } = input;
  const answered = condition.questions.filter((q) => answers[q.id] !== undefined);
  const responses = answered.map((q) => ({ questionId: q.id, question: q.text, answer: answerLabel(q, answers[q.id]) }));

  const keyPositives = answered.flatMap((q) => {
    if (!("key_positive" in q) || !q.key_positive) return [];
    const v = answers[q.id];
    if (q.type === "multi") return (v as string[]).map((s) => answerLabel(q, [s]));
    return v === "yes" ? [`${q.text} Yes`] : [];
  });

  const firedOn = new Set(
    fired.map((f) => condition.rules.find((r) => r.id === f.id)?.when.question).filter((id) => id !== undefined),
  );
  const guarded = new Set(condition.rules.filter((r) => r.outcome !== "flag").map((r) => r.when.question));
  const redFlagsCleared = responses.filter((r) => guarded.has(r.questionId) && !firedOn.has(r.questionId));

  return {
    sentence: fillTemplate(condition, answers, input.age),
    keyPositives,
    redFlagsCleared,
    flags: fired.filter((f) => f.outcome === "flag"),
    allergies: input.allergies,
    routingReason: input.routingReason,
    responses,
  };
}

function fillTemplate(condition: Condition, answers: Answers, age: number): string {
  const questions = new Map(condition.questions.map((q) => [q.id, q]));
  return condition.summary_template.replace(/\{([a-z0-9_]+)\}/g, (_, slot: string) => {
    if (slot === "age") return String(age);
    const q = questions.get(slot)!;
    const v = answers[slot];
    if (v === undefined) return "not answered";
    if (q.type === "multi") return joinNatural((v as string[]).map((s) => lowerFirst(answerLabel(q, [s]))));
    return lowerFirst(answerLabel(q, v));
  });
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function joinNatural(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
