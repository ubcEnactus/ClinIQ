"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { FieldLabel, Loading, Note, PrimaryButton, Screen, SecondaryButton, inputClass } from "@/components/ui";
import { STEP_PATH } from "@/store/flow";
import { useGuard, useIntake } from "@/store/intake-context";

// Screen 7. Consent to share this intake with ONE named provider. Declining
// is a real option and costs only the advance notice. Consent never carries
// forward. In Stage 1 nothing is sent; the screen records the choice.
//
// ?preview=1 shows the screen for a pharmacy that is not a ClinIQ customer,
// for demos only: it is labelled as a preview and records nothing.
export default function SharePage() {
  return (
    <Suspense fallback={<Loading />}>
      <ShareScreen />
    </Suspense>
  );
}

function ShareScreen() {
  const preview = useSearchParams().has("preview");
  const ready = useGuard(preview ? "waiting" : "share");
  const { state, content, dispatch } = useIntake();
  const router = useRouter();
  const prior = typeof state.consent === "object" ? state.consent : null;
  const [firstName, setFirstName] = useState(prior?.firstName ?? "");
  const [dob, setDob] = useState(prior?.dateOfBirth ?? "");
  if (!ready || !state.result) return <Loading />;

  const provider = state.result.decision.location!.location;
  const conditionLabel = content.index.find((c) => c.id === state.conditionId)?.label ?? "Something else";
  const shared = [
    "Your first name and date of birth",
    `What brought you in: ${conditionLabel}`,
    "Your answers to the questions",
    "That you screened clear of emergency symptoms",
    "Your allergies and medicines",
    "Your age, and whether you have a BC Personal Health Number",
  ];
  const complete = firstName.trim() !== "" && /^\d{4}-\d{2}-\d{2}$/.test(dob);

  const agree = () => {
    if (preview) return router.push(STEP_PATH.waiting);
    dispatch({
      type: "consent",
      consent: {
        locationId: provider.id,
        firstName: firstName.trim(),
        dateOfBirth: dob,
        shared,
        at: new Date().toISOString(),
      },
    });
    router.push(STEP_PATH.waiting);
  };

  return (
    <Screen
      step={7}
      title={`Share your answers with ${provider.name}?`}
      lead="They can read them before you arrive, so you don't have to repeat yourself."
      footer={
        <>
          <PrimaryButton disabled={!complete} onClick={agree}>
            Share with {provider.name}
          </PrimaryButton>
          <SecondaryButton
            onClick={() => {
              if (!preview) dispatch({ type: "consent", consent: "declined" });
              router.push(STEP_PATH.waiting);
            }}
          >
            Don&apos;t share
          </SecondaryButton>
        </>
      }
    >
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">What they&apos;ll see</h2>
        <ul className="list-disc pl-5 text-base">
          {shared.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Only {provider.name} gets this, only for this visit. If you don&apos;t share, just show your code at the
          counter.
        </p>
      </section>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="first-name">First name</FieldLabel>
        <input
          id="first-name"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="dob">Date of birth</FieldLabel>
        <input id="dob" type="date" autoComplete="bday" value={dob} onChange={(e) => setDob(e.target.value)} className={inputClass} />
        <p className="text-sm text-muted">Staff check these against your code before opening your answers.</p>
      </div>

      <Note tone="warn">
        {preview
          ? `Preview: ${provider.name} isn't a ClinIQ pharmacy, so nothing would be shared. This is what patients of a ClinIQ pharmacy see.`
          : "Demo version: nothing is actually sent yet."}
      </Note>
    </Screen>
  );
}
