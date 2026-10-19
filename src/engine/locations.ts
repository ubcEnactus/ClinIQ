import type { Location } from "@/content/data-schemas";
import { isOpen, localTime } from "./clock";

// Ranks locations by total expected time: travel plus the wait the location
// published. A clinic 6 km away with a 20 minute wait beats one 2 km away
// with a 2 hour wait.

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Stage 1 has no routing integration, so travel time is a straight-line
 * estimate at an average urban driving speed. Shown to patients as approximate.
 */
export const APPROX_TRAVEL_KMH = 25;

export interface RankedLocation {
  location: Location;
  distanceKm: number | null;
  travelMinutes: number | null;
  waitMinutes: number | null;
  /** Travel plus wait. Null when the wait is unknown; those rank last. */
  totalMinutes: number | null;
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function isOpenNow(location: Location, now: Date): boolean {
  return isOpen(location.hours[localTime(now).weekday], now);
}

export function rankLocations(locations: readonly Location[], origin: LatLng | null, now: Date): RankedLocation[] {
  return locations
    .filter((l) => isOpenNow(l, now))
    .map((location) => {
      const km = origin ? distanceKm(origin, location) : null;
      const travel = km === null ? null : Math.round((km / APPROX_TRAVEL_KMH) * 60);
      const wait = location.wait?.minutes ?? null;
      // With no origin every travel time is unknown alike, so rank on wait alone.
      const total = wait === null ? null : wait + (travel ?? 0);
      return { location, distanceKm: km, travelMinutes: travel, waitMinutes: wait, totalMinutes: total };
    })
    .sort(
      (a, b) =>
        nullsLast(a.totalMinutes, b.totalMinutes) ||
        nullsLast(a.travelMinutes, b.travelMinutes) ||
        a.location.name.localeCompare(b.location.name),
    );
}

function nullsLast(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}
