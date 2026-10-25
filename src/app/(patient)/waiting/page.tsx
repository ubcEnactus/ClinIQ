"use client";

import { useRouter } from "next/navigation";
import { KIND_LABEL } from "@/components/location";
import { Card, Loading, Screen, SecondaryButton } from "@/components/ui";
import { STEP_PATH } from "@/store/flow";
import { useGuard, useIntake } from "@/store/intake-context";

// Screen 8. What to do before the visit, the symptoms that mean stop
// waiting, and one patient-initiated re-check. ClinIQ never monitors or
// polls: continuous tracking would create a duty to respond.
export default function WaitingPage() {
  const ready = useGuard("waiting");
  const { state, content, dispatch } = useIntake();
  const router = useRouter();
  if (!ready || !state.result) return <Loading />;

  const { decision, code } = state.result;
  const place = decision.location?.location;
  const shared = typeof state.consent === "object" && state.consent !== null;

  return (
    <Screen step={8} title="While you wait" lead={place ? `Heading to ${place.name}` : decision.rule.reason}>
      <Card className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm text-muted">Reference code</span>
          <span className="font-mono text-2xl font-semibold tracking-[0.15em]">{code.code}</span>
        </div>
        {place ? (
          <div className="flex flex-col text-right text-sm">
            <span className="text-muted">{KIND_LABEL[place.kind]}</span>
            <a href={`tel:${place.phone}`} className="font-medium text-accent underline">
              {place.phone}
            </a>
          </div>
        ) : null}
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Before you go</h2>
        <ul className="list-disc pl-5 text-base">
          <li>Bring your BC Services Card or Personal Health Number.</li>
          <li>Bring your medicines, or a photo of the labels.</li>
          <li>Give your code at the counter.</li>
          {shared ? (
            <li>Your answers are on their screen, so they can read them before you arrive.</li>
          ) : null}
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border-2 border-crit bg-crit-tint p-4">
        <h2 className="text-base font-semibold">Stop waiting and call 911 if you have</h2>
        <ul className="list-disc pl-5 text-base">
          {content.checklist.items.map((i) => (
            <li key={i.id}>{i.label}</li>
          ))}
        </ul>
        <a href="tel:911" className="mt-1 font-semibold text-crit underline">
          Call 911
        </a>
      </section>

      {state.rerunUsed ? (
        <p className="text-sm text-muted">
          You&apos;ve already re-checked once. If you feel worse, call HealthLink BC at{" "}
          <a href="tel:811" className="underline">
            8-1-1
          </a>{" "}
          or 911 in an emergency.
        </p>
      ) : (
        <SecondaryButton
          onClick={() => {
            dispatch({ type: "rerun" });
            router.push(STEP_PATH.safety);
          }}
        >
          Things have changed: check again
        </SecondaryButton>
      )}
    </Screen>
  );
}
