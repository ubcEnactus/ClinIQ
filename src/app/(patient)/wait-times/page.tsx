"use client";

import { useEffect, useState } from "react";
import { KIND_LABEL, WaitSource, minutes } from "@/components/location";
import { Loading, Note, Screen } from "@/components/ui";
import { rankLocations, type RankedLocation } from "@/engine/locations";
import { useIntake } from "@/store/intake-context";

// Linked from screen 1: wait times only, no triage. Open places, shortest
// published wait first.
export default function WaitTimesPage() {
  const { content } = useIntake();
  const [ranked, setRanked] = useState<RankedLocation[] | null>(null);
  useEffect(() => setRanked(rankLocations(content.locations, null, new Date())), [content.locations]);
  if (!ranked) return <Loading />;

  return (
    <Screen title="Wait times now" lead="Open now, shortest published wait first.">
      {ranked.length === 0 ? (
        <Note tone="warn">No places in our list are open right now.</Note>
      ) : (
        <ul className="flex flex-col gap-2">
          {ranked.map((r) => (
            <li key={r.location.id} className="flex flex-col rounded-xl border border-line bg-surface px-4 py-3">
              <span className="flex justify-between gap-3">
                <span className="font-medium">{r.location.name}</span>
                <span className="shrink-0 text-sm">
                  {r.waitMinutes === null ? "Not published" : minutes(r.waitMinutes)}
                </span>
              </span>
              <span className="text-sm text-muted">
                {KIND_LABEL[r.location.kind]} · {r.location.address}
              </span>
              <WaitSource location={r.location} />
            </li>
          ))}
        </ul>
      )}
      <Note>
        Not sure where to go? Start from the beginning and we&apos;ll point you to the fastest option for your problem.
      </Note>
    </Screen>
  );
}
