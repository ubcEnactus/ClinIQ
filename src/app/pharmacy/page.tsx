"use client";

import { ClearDemoData, CodeLookup, DailyConfirmation, PatientList, ProviderShell, useNow } from "@/components/provider";
import { Loading } from "@/components/ui";
import { localTime } from "@/engine/clock";
import { ASSESSMENT_FEE, checkEligibility } from "@/engine/eligibility";
import type { SharedIntake } from "@/store/inbox";
import { useProviderView } from "@/store/provider-context";

// Pharmacy screen 1: today's ClinIQ patients, a large code box (most walk in
// holding a code), and the assessments counter. Each completed assessment is
// a $20 billable event, and that number is the owner's reason to keep us.
export default function PharmacyHome() {
  const { hydrated, acknowledgedToday } = useProviderView();
  if (!hydrated) return <Loading />;
  return acknowledgedToday ? <Today /> : <DailyConfirmation />;
}

function feeCovered(i: SharedIntake): boolean {
  return checkEligibility(i).feeCovered === "yes";
}

function Today() {
  const { intakes } = useProviderView();
  const now = useNow();
  const today = localTime(now).date;
  const done = intakes.filter(
    (i) =>
      (i.status === "prescribed" || i.status === "referred") &&
      i.statusAt !== null &&
      localTime(new Date(i.statusAt)).date === today,
  );
  const billable = done.filter(feeCovered).length;
  const waiting = intakes.filter((i) => i.status === "waiting" || i.status === "in_assessment").length;

  return (
    <ProviderShell>
      <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s ClinIQ patients</h1>
            <span className="text-sm text-muted">{waiting} waiting</span>
          </div>
          <PatientList now={now} />
        </section>
        <aside className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-2xl border-2 border-good bg-good-tint p-5" data-testid="assessment-counter">
            <span className="text-sm font-medium">Assessments completed today</span>
            <span className="text-5xl font-semibold tracking-tight">{done.length}</span>
            <span className="text-sm">
              {billable} × ${ASSESSMENT_FEE} PharmaCare fee ={" "}
              <span className="font-semibold">${billable * ASSESSMENT_FEE}</span>
            </span>
          </div>
          <CodeLookup />
          <ClearDemoData />
        </aside>
      </div>
    </ProviderShell>
  );
}
