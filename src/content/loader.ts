import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { ConditionSchema, type Condition } from "./condition-schema";
import {
  ConditionIndexSchema,
  EmergencyChecklistSchema,
  LocationsFileSchema,
  type ConditionIndex,
  type EmergencyChecklist,
  type Location,
} from "./data-schemas";

// Server-side only: reads the YAML content shipped in the repository.
// A file that fails validation stops the app from starting rather than
// running with a half-understood rule.

const root = () => process.cwd();

export class ContentError extends Error {}

function readYaml<T extends z.ZodType>(file: string, schema: T): z.infer<T> {
  const raw = parse(fs.readFileSync(file, "utf8"));
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ContentError(`${path.relative(root(), file)} is invalid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function loadCondition(file: string): Condition {
  const condition = readYaml(file, ConditionSchema);
  const expected = path.basename(file, path.extname(file));
  if (condition.id !== expected) {
    throw new ContentError(`${path.relative(root(), file)}: id "${condition.id}" must match the file name "${expected}"`);
  }
  return condition;
}

export function loadConditions(dir = path.join(root(), "conditions")): Condition[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => loadCondition(path.join(dir, f)));
}

export function loadEmergencyChecklist(file = path.join(root(), "data", "emergency-checklist.yaml")): EmergencyChecklist {
  return readYaml(file, EmergencyChecklistSchema);
}

export function loadConditionIndex(file = path.join(root(), "data", "conditions-index.yaml")): ConditionIndex {
  return readYaml(file, ConditionIndexSchema);
}

export function loadLocations(file = path.join(root(), "data", "locations.yaml")): Location[] {
  return readYaml(file, LocationsFileSchema).locations;
}
