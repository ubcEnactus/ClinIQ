import type { EmergencyChecklist } from "@/content/data-schemas";

// Patient screen 2. A fixed checklist, never a model, no scoring and no
// threshold: one checked item is an emergency.

export interface EmergencyScreen {
  emergency: boolean;
  checked: string[];
}

export function screenEmergency(checklist: EmergencyChecklist, checkedIds: readonly string[]): EmergencyScreen {
  const known = new Set(checklist.items.map((i) => i.id));
  for (const id of checkedIds) {
    // An id we do not recognise is a bug, and the safe failure is to stop.
    if (!known.has(id)) throw new Error(`unknown emergency checklist item "${id}"`);
  }
  return { emergency: checkedIds.length > 0, checked: [...checkedIds] };
}
