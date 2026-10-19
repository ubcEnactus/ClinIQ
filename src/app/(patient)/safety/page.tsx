"use client";

import { useRouter } from "next/navigation";
import { Loading, PrimaryButton, Screen } from "@/components/ui";
import { CALL_911_PATH, STEP_PATH } from "@/store/flow";
import { useGuard, useIntake } from "@/store/intake-context";

// Screen 2. Appendix A, a fixed list. One tap on any item stops the flow:
// no scoring, no threshold, no way past it into triage.
export default function SafetyPage() {
  const ready = useGuard("safety");
  const { content, dispatch } = useIntake();
  const router = useRouter();
  if (!ready) return <Loading />;

  const { checklist } = content;
  const now = () => new Date().toISOString();

  return (
    <Screen
      step={2}
      title={checklist.heading}
      lead={checklist.instruction}
      footer={
        <PrimaryButton
          onClick={() => {
            dispatch({ type: "screen", checked: [], at: now() });
            router.push(STEP_PATH.eligibility);
          }}
        >
          {checklist.none_label}
        </PrimaryButton>
      }
    >
      <ul className="flex flex-col gap-2">
        {checklist.items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "screen", checked: [item.id], at: now() });
                router.replace(CALL_911_PATH);
              }}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left text-base"
            >
              <span aria-hidden className="size-5 shrink-0 rounded-md border-2 border-line-strong" />
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
