import path from "node:path";
import type { Condition } from "./condition-schema";
import type { ConditionIndex, EmergencyChecklist, Location } from "./data-schemas";
import { loadConditionIndex, loadConditions, loadDemoProviders, loadEmergencyChecklist, loadLocations } from "./loader";

// Everything the patient view needs, read once on the server and handed to
// the client. Clinical content is public; nothing here is patient data.

export interface PatientContent {
  conditions: Condition[];
  checklist: EmergencyChecklist;
  index: ConditionIndex["conditions"];
  /** The real directory plus the fictional demo clinic and pharmacy. */
  locations: Location[];
  /** Whose screens /clinic and /pharmacy show. */
  demoProviderIds: { clinic: string; pharmacy: string };
  /** Set when the directory is not data/locations.yaml, so the UI can say so. */
  locationsOverride: string | null;
}

let cached: PatientContent | null = null;

export function patientContent(): PatientContent {
  if (cached) return cached;
  // Tests point this at a fixture directory. Never set it for a demo.
  const override = process.env.CLINIQ_LOCATIONS_FILE ?? null;
  const demo = loadDemoProviders();
  cached = {
    conditions: loadConditions(),
    checklist: loadEmergencyChecklist(),
    index: loadConditionIndex().conditions,
    locations: [...(override ? loadLocations(path.resolve(override)) : loadLocations()), demo.clinic, demo.pharmacy],
    demoProviderIds: { clinic: demo.clinic.id, pharmacy: demo.pharmacy.id },
    locationsOverride: override,
  };
  return cached;
}
