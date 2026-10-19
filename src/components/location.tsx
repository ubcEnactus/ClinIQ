"use client";

import type { Location } from "@/content/data-schemas";
import { TIME_ZONE } from "@/engine/clock";
import type { RankedLocation } from "@/engine/locations";

export const KIND_LABEL: Record<Location["kind"], string> = {
  pharmacy: "Pharmacy",
  walk_in: "Walk-in clinic",
  emergency_department: "Emergency department",
};

const clock = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });

export function readAt(iso: string): string {
  return clock.format(new Date(iso));
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
