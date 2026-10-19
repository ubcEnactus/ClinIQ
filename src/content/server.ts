import path from "node:path";
import type { Condition } from "./condition-schema";
import type { ConditionIndex, EmergencyChecklist, Location } from "./data-schemas";
import { loadConditionIndex, loadConditions, loadEmergencyChecklist, loadLocations } from "./loader";

// Everything the patient view needs, read once on the server and handed to
// the client. Clinical content is public; nothing here is patient data.

export interface PatientContent {
  conditions: Condition[];
  checklist: EmergencyChecklist;
  index: ConditionIndex["conditions"];
  locations: Location[];
  /** Set when the directory is not data/locations.yaml, so the UI can say so. */
  locationsOverride: string | null;
}

let cached: PatientContent | null = null;

export function patientContent(): PatientContent {
  if (cached) return cached;
  // Tests point this at a fixture directory. Never set it for a demo.
  const override = process.env.CLINIQ_LOCATIONS_FILE ?? null;
  cached = {
    conditions: loadConditions(),
    checklist: loadEmergencyChecklist(),
    index: loadConditionIndex().conditions,
    locations: override ? loadLocations(path.resolve(override)) : loadLocations(),
    locationsOverride: override,
  };
  return cached;
}
