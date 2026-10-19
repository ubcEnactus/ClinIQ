"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Choice, Loading, PrimaryButton, Screen, SecondaryButton } from "@/components/ui";
import { OTHER_CONDITION, STEP_PATH } from "@/store/flow";
import { useGuard, useIntake } from "@/store/intake-context";

// Screen 4. Offer screen 1's match; "No" opens the list of 21 plus
// contraception. A condition without a file still continues: it routes to a
// physician.
export default function ConfirmPage() {
  const ready = useGuard("confirm");
  const { state, content, dispatch } = useIntake();
  const router = useRouter();
  const suggestion = content.conditions.find((c) => c.id === state.suggestedCondition) ?? null;
  const [showList, setShowList] = useState(false);
  if (!ready) return <Loading />;

  const choose = (id: string) => {
    dispatch({ type: "chooseCondition", conditionId: id });
    const hasFile = content.conditions.some((c) => c.id === id);
    router.push(hasFile ? STEP_PATH.questions : STEP_PATH.destination);
  };

  if (suggestion && !showList) {
    return (
      <Screen
        step={4}
        title={`It sounds like this might be ${suggestion.patient_phrase}. Is that right?`}
        lead="We'll ask a few questions about it next."
        footer={
          <>
            <PrimaryButton onClick={() => choose(suggestion.id)}>Yes</PrimaryButton>
            <SecondaryButton onClick={() => setShowList(true)}>No, something else</SecondaryButton>
          </>
        }
      />
    );
  }

  const current = state.conditionId;
  return (
    <Screen
      step={4}
      title="Which of these is closest?"
      lead="Pharmacists in BC can help with all of these. Pick the one that fits best."
      onBack={suggestion ? () => setShowList(false) : undefined}
    >
      <ul className="flex flex-col gap-2">
        {content.index.map((c) => (
          <li key={c.id}>
            <Choice selected={current === c.id} onClick={() => choose(c.id)}>
              {c.label}
            </Choice>
          </li>
        ))}
        <li>
          <Choice selected={current === OTHER_CONDITION} onClick={() => choose(OTHER_CONDITION)} hint="We'll point you to a doctor">
            Something else
          </Choice>
        </li>
      </ul>
    </Screen>
  );
}
