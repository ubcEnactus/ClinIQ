"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { KIND_LABEL, TimeLine, WaitSource, minutes } from "@/components/location";
import { Card, Loading, Note, PrimaryButton, Screen } from "@/components/ui";
import { checkEligibility } from "@/engine/eligibility";
import { issueReferenceCode } from "@/engine/reference-code";
import { route, type Destination } from "@/engine/routing";
import { CALL_911_PATH, STEP_PATH, conditionFor } from "@/store/flow";
import { useGuard, useIntake } from "@/store/intake-context";

const HEADLINE: Record<Exclude<Destination, "emergency">, string> = {
  pharmacy: "Go to a pharmacy",
  physician: "See a doctor at a walk-in clinic",
  urgent_physician: "See a doctor today",
};

// Screen 6. One destination named large, the reason underneath,
// alternatives ranked by total time, and the reference code.
export default function DestinationPage() {
  const ready = useGuard("destination");
  const { state, content, dispatch } = useIntake();
  const router = useRouter();

  // Decide once per intake; changing an earlier answer clears the result.
  useEffect(() => {
    if (!ready || state.result || !state.basics) return;
    const now = new Date();
    const eligibility = checkEligibility(state.basics);
    const decision = route({
      emergencyChecked: state.emergencyScreen?.checked ?? [],
      condition: conditionFor(state, content),
      answers: state.answers,
      eligibility,
      origin: state.basics.origin,
      locations: content.locations,
      now,
    });
    if (decision.destination === "emergency") {
      // The questions screen stops on an emergency answer, so this is a safety net.
      dispatch({ type: "emergencyLink" });
      router.replace(CALL_911_PATH);
      return;
    }
    dispatch({
      type: "decide",
      result: { decision, eligibility, code: issueReferenceCode(now), decidedAt: now.toISOString() },
    });
  }, [ready, state, content, dispatch, router]);

  if (!ready || !state.result) return <Loading />;

  const { decision, eligibility, code } = state.result;
  const destination = decision.destination as Exclude<Destination, "emergency">;
  const place = decision.location;
  const flags = decision.fired.filter((f) => f.outcome === "flag");
  const participating = place?.location.participating ?? false;

  return (
    <Screen
      step={6}
      title={HEADLINE[destination]}
      lead={decision.rule.reason}
      footer={
        <>
          <PrimaryButton onClick={() => router.push(participating ? STEP_PATH.share : STEP_PATH.waiting)}>
            {participating ? "Next" : "Done"}
          </PrimaryButton>
          {place && !participating ? (
            <button
              type="button"
              onClick={() => router.push(`${STEP_PATH.share}?preview=1`)}
              className="py-1 text-sm text-muted underline"
            >
              Demo: see how sharing works with a ClinIQ pharmacy
            </button>
          ) : null}
        </>
      }
    >
      {place ? (
        <Card highlight className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">{KIND_LABEL[place.location.kind]}</span>
          <span className="text-xl font-semibold">{place.location.name}</span>
          <span className="text-sm text-muted">{place.location.address}</span>
          <span className="mt-2 text-base">
            <TimeLine r={place} />
          </span>
          <WaitSource location={place.location} />
          <a href={`tel:${place.location.phone}`} className="mt-2 text-sm font-medium text-accent underline">
            Call {place.location.phone}
          </a>
        </Card>
      ) : (
        <Note tone="warn">
          We don&apos;t have a {destination === "pharmacy" ? "pharmacy" : "clinic"} in our list that&apos;s open right
          now. For advice, call HealthLink BC at{" "}
          <a href="tel:811" className="font-semibold underline">
            8-1-1
          </a>
          .
        </Note>
      )}

      {destination === "pharmacy" && place && !participating ? (
        <Note tone="info">
          This pharmacy doesn&apos;t use ClinIQ yet. Ask for a minor ailment assessment and tell the pharmacist what you
          told us.
        </Note>
      ) : null}
      {destination === "pharmacy" && eligibility.notes.length ? (
        <Note tone="info">{eligibility.notes.join(". ")}.</Note>
      ) : null}
      {destination === "pharmacy" && eligibility.feeCovered === "yes" && !eligibility.notes.length ? (
        <Note tone="good">The pharmacist&apos;s assessment is free with your BC Personal Health Number.</Note>
      ) : null}
      {flags.map((f) => (
        <Note key={f.id} tone="warn">
          {f.reason}. Go soon.
        </Note>
      ))}

      <Card className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm text-muted">Your reference code</span>
        <span className="font-mono text-4xl font-semibold tracking-[0.2em]" data-testid="reference-code">
          {code.code}
        </span>
        <span className="text-sm text-muted">Show this at the counter. It works for 24 hours.</span>
      </Card>

      {decision.alternatives.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">Other options, fastest first</h2>
          <ul className="flex flex-col gap-2">
            {decision.alternatives.slice(0, 4).map((a) => (
              <li key={a.location.id} className="flex flex-col rounded-xl border border-line bg-surface px-4 py-3">
                <span className="flex justify-between gap-3">
                  <span className="font-medium">{a.location.name}</span>
                  <span className="shrink-0 text-sm text-muted">
                    {a.totalMinutes === null ? "—" : `~${minutes(a.totalMinutes)}`}
                  </span>
                </span>
                <span className="text-sm text-muted">
                  {KIND_LABEL[a.location.kind]} · <TimeLine r={a} />
                </span>
              </li>
            ))}
          </ul>
          {!state.basics?.origin ? (
            <p className="text-xs text-muted">Ranked by published wait. Share your location to include travel time.</p>
          ) : (
            <p className="text-xs text-muted">Travel times are straight-line estimates.</p>
          )}
        </section>
      ) : null}
    </Screen>
  );
}
