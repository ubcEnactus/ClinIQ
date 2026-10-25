import { z } from "zod";

// Appendix A. A fixed list, the same for every condition. It never gets
// shorter without written approval, and needs clinician sign-off before launch.
export const EmergencyChecklistSchema = z.strictObject({
  heading: z.string().min(1),
  instruction: z.string().min(1),
  none_label: z.string().min(1),
  items: z
    .array(z.strictObject({ id: z.string().regex(/^[a-z0-9_]+$/), label: z.string().min(1) }))
    .min(1),
});

// Appendix B. The 21 conditions plus contraception, in patient words. Only
// some have a condition file; the rest route to a physician until they do.
export const ConditionIndexSchema = z.strictObject({
  conditions: z.array(z.strictObject({ id: z.string().regex(/^[a-z0-9_]+$/), label: z.string().min(1) })).length(22),
});

const HoursRange = z
  .string()
  .regex(/^(closed|([01]\d|2[0-3]):[0-5]\d-(([01]\d|2[0-3]):[0-5]\d|24:00))$/, 'use "HH:MM-HH:MM" or "closed"')
  .refine((s) => s === "closed" || s.slice(0, 5) < s.slice(6), "closing time must be after opening time");

// Stage 1 directory: real Vancouver-area locations, entered by hand. Every
// wait is what the location actually published, with the time it was read.
// No invented numbers.
export const LocationSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1),
  // urgent_care: an Urgent and Primary Care Centre (UPCC); routed like a walk-in.
  kind: z.enum(["pharmacy", "walk_in", "urgent_care", "emergency_department"]),
  participating: z.boolean(),
  /** A fictional demo provider (data/demo-providers.yaml). Never set on a real place. */
  demo: z.boolean().optional(),
  address: z.string().min(1),
  phone: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  hours: z.strictObject({
    mon: HoursRange,
    tue: HoursRange,
    wed: HoursRange,
    thu: HoursRange,
    fri: HoursRange,
    sat: HoursRange,
    sun: HoursRange,
  }),
  wait: z
    .strictObject({
      minutes: z.number().int().nonnegative(),
      read_at: z.iso.datetime({ offset: true }),
      source: z.string().min(1),
    })
    .nullable(),
});

export const LocationsFileSchema = z.strictObject({
  locations: z.array(LocationSchema),
});

export const DemoProvidersFileSchema = z.strictObject({
  providers: z.array(LocationSchema).min(1),
});

export type EmergencyChecklist = z.infer<typeof EmergencyChecklistSchema>;
export type ConditionIndex = z.infer<typeof ConditionIndexSchema>;
export type Location = z.infer<typeof LocationSchema>;
