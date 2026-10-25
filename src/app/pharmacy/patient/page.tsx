"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { readAt } from "@/components/location";
import { ProviderShell, Section, StatusChip, since } from "@/components/provider";
import { Loading } from "@/components/ui";
import { ASSESSMENT_FEE, checkEligibility } from "@/engine/eligibility";
import { buildSummary } from "@/engine/summary";
import { appendAudit, setStatus, type SharedIntake } from "@/store/inbox";
import { useProviderView } from "@/store/provider-context";

export default function AssessmentHelperPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AssessmentHelper />
    </Suspense>
  );
}

// Pharmacy screen 2: everything the patient already told us, so the
// pharmacist doesn't re-ask twenty minutes of questions. Top to bottom:
// header, condition, eligibility, every answer, emergency symptoms cleared,
// allergies, and what a pharmacist can prescribe for this condition.
function AssessmentHelper() {
  const { hydrated, acknowledgedToday, intakes, provider, updateInbox } = useProviderView();
  const id = useSearchParams().get("id");
  const router = useRouter();
  const intake = intakes.find((i) => i.id === id) ?? null;

  useEffect(() => {
    if (hydrated && !acknowledgedToday) router.replace("/pharmacy");
  }, [hydrated, acknowledgedToday, router]);

  // Opening a waiting patient starts their assessment. Record what was shown, once.
  const opened = useRef(false);
  useEffect(() => {
    if (!intake || !acknowledgedToday || opened.current) return;
    opened.current = true;
    const at = new Date().toISOString();
    appendAudit({ at, providerId: provider.id, intakeId: intake.id, action: "opened" });
    if (intake.status === "waiting") updateInbox((all) => setStatus(all, intake.id, "in_assessment", at));
  }, [intake, acknowledgedToday, provider.id, updateInbox]);

  if (!hydrated || !acknowledgedToday) return <Loading />;
  if (!intake) {
    return (
      <ProviderShell back>
        <p className="text-muted">
          This patient isn&apos;t in today&apos;s list.{" "}
          <Link href="/pharmacy" className="underline">
            Back to all patients
          </Link>
        </p>
      </ProviderShell>
    );
  }

  const close = (status: "prescribed" | "referred") => {
    const at = new Date().toISOString();
    updateInbox((all) => setStatus(all, intake.id, status, at));
    appendAudit({ at, providerId: provider.id, intakeId: intake.id, action: status });
    router.push("/pharmacy");
  };
  const done = intake.status === "prescribed" || intake.status === "referred";

  return (
    <ProviderShell back>
      <HelperBody intake={intake} />
      <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg/95 px-6 py-4 backdrop-blur">
        <p className="text-xs text-muted">
          Patient-entered information, not a diagnosis. Either outcome completes the ${ASSESSMENT_FEE} assessment.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={done}
            onClick={() => close("referred")}
            className="min-h-11 rounded-xl border border-line-strong bg-surface px-4 font-medium disabled:opacity-40"
          >
            Referred to a doctor
          </button>
          <button
            type="button"
            disabled={done}
            onClick={() => close("prescribed")}
            className="min-h-11 rounded-xl bg-accent px-5 font-semibold text-on-accent disabled:opacity-40"
          >
            Prescribed
          </button>
        </div>
      </div>
    </ProviderShell>
  );
}

function HelperBody({ intake }: { intake: SharedIntake }) {
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
  const eligibility = checkEligibility(intake);
  const flags = intake.routing.fired.filter((f) => f.outcome === "flag");
  const scope = condition?.pharmacist_scope ?? null;

  return (
    <>
      {/* Patient header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{intake.firstName}</h1>
            <StatusChip status={intake.status} />
          </div>
          <p className="text-muted">
            {intake.age} years · born {intake.dateOfBirth}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-semibold tracking-[0.15em]">{intake.referenceCode}</div>
          <div className="text-sm text-muted">Shared {since(intake.sharedAt, new Date())}</div>
        </div>
      </div>

      {/* Condition */}
      <section className="rounded-2xl border-2 border-accent bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Condition</p>
        <p className="mt-1 text-2xl font-semibold">{intake.conditionLabel}</p>
        {summary ? <p className="mt-2 text-lg">{summary.sentence}</p> : null}
        {intake.description ? (
          <p className="mt-2 text-muted">
            In their words: <q className="italic">{intake.description}</q>
          </p>
        ) : null}
      </section>

      {/* Eligibility: does the fee apply? */}
      {eligibility.feeCovered === "yes" && !eligibility.guardianMayBeNeeded ? (
        <div className="rounded-2xl border-l-4 border-good bg-good-tint px-5 py-4" data-testid="eligibility">
          <span className="font-semibold">Eligible for the ${ASSESSMENT_FEE} PharmaCare assessment fee.</span> BC
          resident with a Personal Health Number, not in long-term care.
        </div>
      ) : (
        <div className="rounded-2xl border-l-4 border-warn bg-warn-tint px-5 py-4" data-testid="eligibility">
          <span className="font-semibold">
            {eligibility.feeCovered === "yes"
              ? `Eligible for the $${ASSESSMENT_FEE} PharmaCare assessment fee.`
              : eligibility.feeCovered === "no"
                ? "Not covered by PharmaCare: the patient pays."
                : "Coverage unknown: check for a Personal Health Number."}
          </span>{" "}
          {eligibility.notes.join(". ")}.
        </div>
      )}

      {flags.length ? (
        <Section title="Flagged" tone="warn">
          <ul className="list-disc pl-5">
            {flags.map((f) => (
              <li key={f.id}>{f.reason}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
        {/* Every question and answer */}
        <Section title="Their answers">
          {summary ? (
            <dl className="flex flex-col divide-y divide-line">
              {summary.responses.map((r) => (
                <div key={r.questionId} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted">{r.question}</dt>
                  <dd className="text-right font-medium">{r.answer}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-muted">No condition questions for this problem.</p>
          )}
        </Section>

        <div className="flex flex-col gap-6">
          {/* Emergency symptoms cleared */}
          <Section title="Emergency symptoms">
            <p>
              None of {content.checklist.items.length} reported, screened at {readAt(intake.emergencyScreen.at)}
            </p>
          </Section>

          {/* Allergies */}
          <Section title="Allergies and medications">
            <dl className="grid grid-cols-[7rem_1fr] gap-y-1">
              <dt className="text-muted">Allergies</dt>
              <dd className="font-semibold">{intake.allergies}</dd>
              <dt className="text-muted">Medications</dt>
              <dd>{intake.medications}</dd>
            </dl>
            <p className="mt-2 text-xs text-muted">
              {intake.carriedForward
                ? "Carried forward from a past visit and confirmed by the patient today."
                : "Entered by the patient today."}{" "}
              In the patient&apos;s own words.
            </p>
          </Section>
        </div>
      </div>

      {/* What a pharmacist can prescribe: required on every condition file */}
      {scope ? (
        <Section title="What you can prescribe for this condition">
          {scope.status === "pending" ? (
            <p className="mb-2 inline-block rounded-full bg-warn-tint px-2.5 py-0.5 text-xs font-medium text-warn">
              Awaiting sign-off
            </p>
          ) : null}
          <p>{scope.can_prescribe}</p>
          {scope.cannot_prescribe ? (
            <p className="mt-2">
              <span className="font-semibold">Not permitted:</span> {scope.cannot_prescribe}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted">Source: {scope.source}</p>
        </Section>
      ) : null}
    </>
  );
}
