"use client";

import type { Location } from "@/content/data-schemas";
import { TIME_ZONE, localTime } from "@/engine/clock";
import type { RankedLocation } from "@/engine/locations";

export const KIND_LABEL: Record<Location["kind"], string> = {
  pharmacy: "Pharmacy",
  walk_in: "Walk-in clinic",
  urgent_care: "Urgent care centre",
  emergency_department: "Emergency department",
};

const clock = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
const day = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, month: "short", day: "numeric" });

/** "2:15 p.m." today, "Oct 25, 2:15 p.m." on any other day: a stale wait must look stale. */
export function readAt(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const time = clock.format(at);
  return localTime(at).date === localTime(now).date ? time : `${day.format(at)}, ${time}`;
}

export function minutes(n: number): string {
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "About 14 min away · 20 min wait", with where the wait came from. */
export function TimeLine({ r }: { r: RankedLocation }) {
  const parts: string[] = [];
  if (r.travelMinutes !== null) parts.push(`about ${minutes(r.travelMinutes)} away`);
  parts.push(r.waitMinutes === null ? "wait not published" : `${minutes(r.waitMinutes)} wait`);
  const text = parts.join(" · ");
  return <span>{text.charAt(0).toUpperCase() + text.slice(1)}</span>;
}

export function WaitSource({ location }: { location: Location }) {
  if (!location.wait) return null;
  return (
    <span className="text-xs text-muted">
      Wait published by {location.wait.source}, read at {readAt(location.wait.read_at)}
    </span>
  );
}
