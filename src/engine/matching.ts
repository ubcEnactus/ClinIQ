import type { Condition } from "@/content/condition-schema";

// Patient screen 1: match "What's going on?" to a condition by keyword. The
// patient confirms on screen 4 before anything acts on the match, so a miss
// costs one "No" tap. Deterministic, and identical every time.

export interface ConditionMatch {
  condition: Condition;
  score: number;
}

/** Lowercase words separated by single spaces, padded so phrases match on word boundaries. */
function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

/** Every condition with at least one synonym in the text, best first. Longer phrases count for more. */
export function matchConditions(text: string, conditions: readonly Condition[]): ConditionMatch[] {
  const haystack = normalize(text);
  return conditions
    .map((condition) => ({
      condition,
      score: condition.synonyms
        .map(normalize)
        .filter((phrase) => haystack.includes(phrase))
        .reduce((sum, phrase) => sum + phrase.trim().split(" ").length, 0),
    }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** The single best match, or null when nothing matched or two conditions tie. */
export function bestMatch(text: string, conditions: readonly Condition[]): Condition | null {
  const [first, second] = matchConditions(text, conditions);
  if (!first || (second && second.score === first.score)) return null;
  return first.condition;
}
