// Every clinical time question ClinIQ asks is about BC local time:
// "is this pharmacy open now", "how many days ago did the rash start".

export const TIME_ZONE = "America/Vancouver";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export interface LocalTime {
  date: string; // YYYY-MM-DD
  weekday: Weekday;
  time: string; // HH:MM, 24h
}

export function localTime(now: Date): LocalTime {
  const p = Object.fromEntries(formatter.formatToParts(now).map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: p.weekday.toLowerCase().slice(0, 3) as Weekday,
    time: `${p.hour}:${p.minute}`,
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whole calendar days from `date` (YYYY-MM-DD) to today in Vancouver. */
export function daysAgo(date: string, now: Date): number {
  if (!ISO_DATE.test(date) || Number.isNaN(Date.parse(date))) {
    throw new Error(`expected a YYYY-MM-DD date, got "${date}"`);
  }
  const today = Date.parse(localTime(now).date);
  return Math.round((today - Date.parse(date)) / 86_400_000);
}

/** `range` is "HH:MM-HH:MM" or "closed"; the close time may be 24:00. */
export function isOpen(range: string, now: Date): boolean {
  if (range === "closed") return false;
  const [open, close] = range.split("-");
  const { time } = localTime(now);
  return time >= open && time < close;
}
