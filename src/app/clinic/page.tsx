"use client";

import { ClearDemoData, CodeLookup, DailyConfirmation, PatientList, ProviderShell, useNow } from "@/components/provider";
import { Loading } from "@/components/ui";
import { localTime } from "@/engine/clock";
import { useProviderView } from "@/store/provider-context";

// Clinic screens 1 and 2: the daily confirmation, then today's incoming
// patients with a code lookup for walk-ins.
export default function ClinicHome() {
  const { hydrated, acknowledgedToday } = useProviderView();
  if (!hydrated) return <Loading />;
  return acknowledgedToday ? <Incoming /> : <DailyConfirmation />;
}

function Incoming() {
  const { intakes } = useProviderView();
  const now = useNow();
  const today = localTime(now).date;
  const seenToday = intakes.filter(
    (i) => i.status === "seen" && i.statusAt && localTime(new Date(i.statusAt)).date === today,
  ).length;
  const waiting = intakes.filter((i) => i.status === "waiting").length;

  return (
    <ProviderShell>
      <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s ClinIQ patients</h1>
            <span className="text-sm text-muted">
              {waiting} waiting · {seenToday} seen today
            </span>
          </div>
          <PatientList now={now} />
        </section>
        <aside className="flex flex-col gap-4">
          <CodeLookup />
          <ClearDemoData />
        </aside>
      </div>
    </ProviderShell>
  );
}

