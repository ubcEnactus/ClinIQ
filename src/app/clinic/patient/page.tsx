"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { ProviderShell, Section, StatusChip, since } from "@/components/provider";
import { readAt } from "@/components/location";
import { Loading } from "@/components/ui";
import { buildSummary } from "@/engine/summary";
import { useProviderView } from "@/store/provider-context";
import { appendAudit, setStatus, type SharedIntake } from "@/store/inbox";

export default function PatientSummaryPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PatientSummary />
    </Suspense>
  );
}

// Clinic screen 3: what the physician actually reads. A clinical read first,
// the raw answers collapsed underneath. No model: every line is a template
// fill or a pass-through of the structured answers (summary.ts).
function PatientSummary() {
  const { hydrated, acknowledgedToday, intakes, provider, updateInbox } = useProviderView();
  const id = useSearchParams().get("id");
  const router = useRouter();
  const intake = intakes.find((i) => i.id === id) ?? null;

  useEffect(() => {
    if (hydrated && !acknowledgedToday) router.replace("/clinic");
  }, [hydrated, acknowledgedToday, router]);

  // Record what was shown, once per open.
  const logged = useRef(false);
  useEffect(() => {
    if (intake && acknowledgedToday && !logged.current) {
      logged.current = true;
      appendAudit({ at: new Date().toISOString(), providerId: provider.id, intakeId: intake.id, action: "opened" });
    }
  }, [intake, acknowledgedToday, provider.id]);

  if (!hydrated || !acknowledgedToday) return <Loading />;
  if (!intake) {
    return (
      <ProviderShell back>
        <p className="text-muted">
          This patient isn&apos;t in today&apos;s list. <Link href="/clinic" className="underline">Back to all patients</Link>
        </p>
      </ProviderShell>
    );
  }

  const mark = (status: "seen" | "not_ours") => {
    const at = new Date().toISOString();
    updateInbox((all) => setStatus(all, intake.id, status, at));
    appendAudit({ at, providerId: provider.id, intakeId: intake.id, action: status });
    router.push("/clinic");
  };

  return (
    <ProviderShell back>
      <SummaryBody intake={intake} />
      <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg/95 px-6 py-4 backdrop-blur">
        <p className="text-xs text-muted">Patient-entered information, not a diagnosis. Any decision is yours.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => mark("not_ours")}
            className="min-h-11 rounded-xl border border-line-strong bg-surface px-4 font-medium"
          >
            Not our patient
          </button>
          <button
            type="button"
            onClick={() => mark("seen")}
            className="min-h-11 rounded-xl bg-accent px-5 font-semibold text-on-accent"
          >
            Seen
          </button>
        </div>
      </div>
    </ProviderShell>
  );
}

function SummaryBody({ intake }: { intake: SharedIntake }) {
  const { content } = useProviderView();
  const condition = content.conditions.find((c) => c.id === intake.conditionId) ?? null;
  const summary = condition
    ? buildSummary({
        condition,
        answers: intake.answers,
        fired: intake.routing.fired,
        age: intake.age,
        allergies: intake.allergies,
        routingReason: intake.routing.reason,
      })
    : null;
  const flags = intake.routing.fired.filter((f) => f.outcome === "flag");
  const checklistCount = content.checklist.items.length;
  const screenedAt = readAt(intake.emergencyScreen.at);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{intake.firstName}</h1>
            <StatusChip status={intake.status} />
          </div>
          <p className="text-muted">
            {intake.age} years · born {intake.dateOfBirth} · BC PHN:{" "}
            {intake.hasPhn === "yes" ? "yes" : intake.hasPhn === "no" ? "no" : "not sure"}
            {intake.inLongTermCare ? " · lives in long-term care" : ""}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-semibold tracking-[0.15em]">{intake.referenceCode}</div>
          <div className="text-sm text-muted">Shared {since(intake.sharedAt, new Date())}</div>
        </div>
      </div>

      {/* 1. The clinical read */}
      <section className="rounded-2xl border-2 border-accent bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{intake.conditionLabel}</p>
        <p className="mt-2 text-2xl leading-snug">
          {summary ? summary.sentence : `${intake.age}-year-old. ${intake.conditionLabel}.`}
        </p>
        {intake.description ? (
          <p className="mt-3 text-base text-muted">
            In their words: <q className="italic">{intake.description}</q>
          </p>
        ) : null}
      </section>

      {flags.length ? (
        <Section title="Flagged" tone="warn">
          <ul className="list-disc pl-5">
            {flags.map((f) => (
              <li key={f.id}>{f.reason}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {/* 2. Key positives */}
        <Section title="Key positives">
          {summary && summary.keyPositives.length ? (
            <ul className="flex flex-wrap gap-2">
              {summary.keyPositives.map((k) => (
                <li key={k} className="rounded-full bg-accent-tint px-3 py-1 text-sm">
                  {k}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">None recorded.</p>
          )}
        </Section>

        {/* 3. Red flags cleared, with the time */}
        <Section title="Red flags cleared">
          <p>
            No emergency symptoms ({checklistCount} checked), screened at {screenedAt}
          </p>
          {summary && summary.redFlagsCleared.length ? (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {summary.redFlagsCleared.map((r) => (
                <li key={r.questionId}>
                  <span className="text-muted">{r.question}</span> {r.answer}
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        {/* 4. Allergies and medications */}
        <Section title="Allergies and medications">
          <dl className="grid grid-cols-[7rem_1fr] gap-y-1">
            <dt className="text-muted">Allergies</dt>
            <dd className="font-medium">{intake.allergies}</dd>
            <dt className="text-muted">Medications</dt>
            <dd>{intake.medications}</dd>
          </dl>
          <p className="mt-2 text-xs text-muted">
            {intake.carriedForward
              ? "Carried forward from a past visit and confirmed by the patient today."
              : "Entered by the patient today."}{" "}
            Patient&apos;s own words, not matched to a drug list.
          </p>
        </Section>

        {/* 5. Why here, not a pharmacy */}
        <Section title="Why they came here, not a pharmacy">
          <p>{intake.routing.reason}</p>
          <p className="mt-1 text-xs text-muted">Routing rule: {intake.routing.ruleId}</p>
        </Section>
      </div>

      {/* 6. Full responses, collapsed */}
      <details className="rounded-2xl border border-line bg-surface p-5">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">
          Full responses ({summary ? summary.responses.length : 0})
        </summary>
        {summary ? (
          <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[1fr_1fr]">
            {summary.responses.map((r) => (
              <div key={r.questionId} className="contents">
                <dt className="text-muted">{r.question}</dt>
                <dd>{r.answer}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-muted">No condition questions: ClinIQ doesn&apos;t cover this problem yet.</p>
        )}
      </details>
    </>
  );
}
