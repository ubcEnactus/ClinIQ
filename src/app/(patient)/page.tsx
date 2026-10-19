"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loading, PrimaryButton, Screen, inputClass } from "@/components/ui";
import { bestMatch } from "@/engine/matching";
import { CALL_911_PATH, STEP_PATH } from "@/store/flow";
import { useGuard, useIntake } from "@/store/intake-context";

// Screen 1. One open text box. No account and no sign-up before the patient
// describes the problem. The keyword match is only a suggestion; screen 4
// asks them to confirm it.
export default function DescribePage() {
  const ready = useGuard("describe");
  const { state, content, dispatch, hydrated } = useIntake();
  const router = useRouter();
  const [text, setText] = useState("");

  useEffect(() => {
    if (hydrated) setText(state.description);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  if (!ready) return <Loading />;

  const inProgress = state.emergencyScreen !== null || state.description !== "";

  const next = () => {
    const match = bestMatch(text, content.conditions);
    dispatch({ type: "describe", description: text.trim(), suggestedCondition: match?.id ?? null });
    router.push(STEP_PATH.safety);
  };

  return (
    <Screen
      back={false}
      step={1}
      title="What's going on?"
      lead="Tell us in your own words. We'll help you find the fastest place to get care."
      footer={<PrimaryButton onClick={next}>Continue</PrimaryButton>}
    >
      <textarea
        rows={5}
        aria-label="What's going on?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={inputClass}
        placeholder="e.g. It burns when I pee and I need to go all the time"
      />
      <div className="flex flex-col gap-3 text-sm">
        <Link href="/wait-times" className="font-medium text-accent underline">
          Just show me wait times
        </Link>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "emergencyLink" });
            router.replace(CALL_911_PATH);
          }}
          className="self-start font-medium text-crit underline"
        >
          This is an emergency
        </button>
        {inProgress ? (
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "reset", id: crypto.randomUUID(), now: new Date().toISOString() });
              setText("");
            }}
            className="self-start text-muted underline"
          >
            Start over
          </button>
        ) : null}
      </div>
    </Screen>
  );
}
