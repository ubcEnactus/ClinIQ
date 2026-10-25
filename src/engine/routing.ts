import type { Condition } from "@/content/condition-schema";
import type { Location } from "@/content/data-schemas";
import type { Eligibility } from "./eligibility";
import { rankLocations, type LatLng, type RankedLocation } from "./locations";
import { decidingRule, evaluateRules, type Answers, type FiredRule } from "./rules";

// Appendix D. Takes the matched condition, the answers, the eligibility
// result and the location, and returns one destination plus ranked
// alternatives. The order below is the spec; do not reorder it.
// Every decision stores the rule that produced it.

export type Destination = "emergency" | "urgent_physician" | "physician" | "pharmacy";

export interface RoutingInput {
  /** Checklist item ids ticked on screen 2. */
  emergencyChecked: readonly string[];
  /** Null when the patient's problem is not a condition ClinIQ has a file for. */
  condition: Condition | null;
  answers: Answers;
  eligibility: Eligibility;
  origin: LatLng | null;
  locations: readonly Location[];
  now: Date;
}

export interface RoutingDecision {
  destination: Destination;
  rule: { id: string; reason: string };
  /** Every condition rule that fired, flags included, for the clinician. */
  fired: FiredRule[];
  /** Where to go. Null for 911, or when nothing suitable is open. */
  location: RankedLocation | null;
  alternatives: RankedLocation[];
}

export function route(input: RoutingInput): RoutingDecision {
  const fired = input.condition ? evaluateRules(input.condition, input.answers, input.now) : [];
  const ranked = rankLocations(input.locations, input.origin, input.now);
  const decide = (destination: Destination, rule: { id: string; reason: string }): RoutingDecision => ({
    destination,
    rule,
    fired,
    ...place(destination, ranked),
  });

  // 1. Any emergency symptom checked: 911. Nothing else is considered.
  if (input.emergencyChecked.length > 0) {
    return decide("emergency", { id: "routing.emergency_checklist", reason: "Emergency symptom reported" });
  }

  // 2. Any answer triggered a physician (or emergency) rule for the condition.
  const deciding = decidingRule(fired);
  if (deciding) {
    return decide(deciding.outcome as Exclude<Destination, "pharmacy">, { id: deciding.id, reason: deciding.reason });
  }

  // 3. Not one of the conditions we can route to a pharmacy.
  if (!input.condition) {
    return decide("physician", {
      id: "routing.condition_not_supported",
      reason: "Not a condition ClinIQ can route to a pharmacy yet",
    });
  }

  // 4. Eligibility rules out the pharmacy.
  if (!input.eligibility.pharmacyAllowed && input.eligibility.rule) {
    return decide("physician", input.eligibility.rule);
  }

  // 5. A pharmacy open now, shortest total time: a participating one if any is
  // open (it can receive the intake), otherwise any pharmacy, where the patient
  // hands over the reference code. The code is the route to non-customers.
  if (!ranked.some((r) => r.location.kind === "pharmacy")) {
    return decide("physician", { id: "routing.no_open_pharmacy", reason: "No pharmacy is open now" });
  }
  return decide("pharmacy", {
    id: "routing.pharmacy",
    reason: `${input.condition.name} can be assessed and treated by a pharmacist`,
  });
}

function place(destination: Destination, ranked: RankedLocation[]): Pick<RoutingDecision, "location" | "alternatives"> {
  let location: RankedLocation | null = null;
  let candidates: RankedLocation[];

  switch (destination) {
    case "emergency":
      return { location: null, alternatives: [] };
    case "urgent_physician":
      candidates = ranked.filter((r) => r.location.kind !== "pharmacy");
      location = candidates[0] ?? null;
      break;
    case "physician":
      // A participating clinic first (it gets the intake before the patient
      // arrives), otherwise the fastest. Urgent cases always take the fastest.
      candidates = ranked.filter((r) => r.location.kind === "walk_in" || r.location.kind === "urgent_care");
      location = candidates.find((r) => r.location.participating) ?? candidates[0] ?? null;
      break;
    case "pharmacy":
      location =
        ranked.find((r) => r.location.kind === "pharmacy" && r.location.participating) ??
        ranked.find((r) => r.location.kind === "pharmacy") ??
        null;
      // Any pharmacy (a non-customer still takes the code) or a walk-in.
      candidates = ranked.filter((r) => r.location.kind !== "emergency_department");
      break;
  }
  return { location, alternatives: candidates.filter((r) => r !== location) };
}
