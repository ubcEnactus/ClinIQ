// Appendix D, eligibility. Decides whether the pharmacy route is available at
// all, and whether PharmaCare covers the $20 assessment, regardless of condition.

export interface EligibilityInput {
  hasPhn: "yes" | "no" | "unknown";
  age: number;
  inLongTermCare: boolean;
  livesInBC: boolean;
}

export interface Eligibility {
  pharmacyAllowed: boolean;
  /** Whether PharmaCare pays the assessment fee. */
  feeCovered: "yes" | "no" | "unknown";
  /** Under 18: a parent or guardian may need to attend if the patient cannot consent. */
  guardianMayBeNeeded: boolean;
  /** Set when the pharmacy route is ruled out. Stored as the routing rule. */
  rule: { id: string; reason: string } | null;
  notes: string[];
}

export function checkEligibility(input: EligibilityInput): Eligibility {
  const notes: string[] = [];

  if (input.inLongTermCare) {
    return {
      pharmacyAllowed: false,
      feeCovered: "no",
      guardianMayBeNeeded: false,
      rule: {
        id: "eligibility.long_term_care",
        reason: "Long-term care residents are not eligible for the pharmacy assessment",
      },
      notes,
    };
  }

  let feeCovered: Eligibility["feeCovered"] = "yes";
  if (!input.livesInBC) {
    feeCovered = "no";
    notes.push("Out-of-province patients pay the pharmacy directly");
  } else if (input.hasPhn === "no") {
    feeCovered = "no";
    notes.push("Without a BC Personal Health Number the pharmacy visit is not free");
  } else if (input.hasPhn === "unknown") {
    feeCovered = "unknown";
    notes.push("Bring your BC Personal Health Number if you have one; without it the visit is not free");
  }

  const guardianMayBeNeeded = input.age < 18;
  if (guardianMayBeNeeded) notes.push("A parent or guardian may need to attend");

  return { pharmacyAllowed: true, feeCovered, guardianMayBeNeeded, rule: null, notes };
}

/** BC postal codes start with V. */
export function isBCPostalCode(postalCode: string): boolean {
  return /^V\d[A-Z]\s?\d[A-Z]\d$/i.test(postalCode.trim());
}
