import type { Location } from "@/content/data-schemas";
import type { Answers } from "@/engine/rules";

// Test-only locations. Not real places; the real directory is data/locations.yaml.

/** Wednesday 21 Oct 2026, 12:00 in Vancouver (PDT). */
export const NOW = new Date("2026-10-21T19:00:00Z");

export const ORIGIN = { lat: 49.2827, lng: -123.1207 };
const KM = 1 / 111.195; // degrees of latitude per km

const weekdays = (range: string) => ({
  mon: range,
  tue: range,
  wed: range,
  thu: range,
  fri: range,
  sat: range,
  sun: range,
});

function loc(
  id: string,
  kind: Location["kind"],
  participating: boolean,
  km: number,
  wait: number | null,
  hours = weekdays("08:00-22:00"),
): Location {
  return {
    id,
    name: id,
    kind,
    participating,
    address: "test",
    phone: "000-000-0000",
    lat: ORIGIN.lat + km * KM,
    lng: ORIGIN.lng,
    hours,
    wait: wait === null ? null : { minutes: wait, read_at: "2026-10-21T11:30:00-07:00", source: "test" },
  };
}

// travel at 25 km/h: 0.3 km = 1 min, 1 km = 2 min, 2 km = 5 min, 3 km = 7 min, 6 km = 14 min
export const PHARM_A = loc("pharm-a", "pharmacy", true, 1, 10); // total 12
export const PHARM_B = loc("pharm-b", "pharmacy", true, 0.5, null); // wait unknown: ranks last
export const PHARM_C = loc("pharm-c", "pharmacy", false, 0.3, 0); // not a customer, total 1
export const CLINIC_NEAR = loc("clinic-near", "walk_in", false, 2, 120); // total 125
export const CLINIC_FAR = loc("clinic-far", "walk_in", false, 6, 20); // total 34
export const ED = loc("ed", "emergency_department", false, 3, 240, weekdays("00:00-24:00")); // total 247
export const PHARM_CLOSED = loc("pharm-closed", "pharmacy", true, 0.1, 0, { ...weekdays("08:00-22:00"), wed: "closed" });

export const LOCATIONS = [PHARM_A, PHARM_B, PHARM_C, CLINIC_NEAR, CLINIC_FAR, ED, PHARM_CLOSED];

/** Answers that fire no rule: a clean pharmacy case for each condition. */
export const CLEAN: Record<string, Answers> = {
  uti: {
    duration: "under_2_days",
    symptoms: ["burning", "urgency"],
    systemic: "no",
    pregnant: "no",
    assigned_male: "no",
    recurrent: "no",
    catheter_or_kidney: "no",
    antibiotic_allergy: "none",
  },
  shingles: {
    rash_started: "2026-10-20",
    one_side: "yes",
    face_or_eye: "no",
    blisters: "yes",
    immunosuppressed: "no",
    pregnant: "not_applicable",
  },
  headache: {
    sudden_severe: "no",
    fever_stiff_neck: "no",
    neuro_symptoms: "no",
    history: "a_few_weeks",
    tried_nsaid: "no",
  },
};
