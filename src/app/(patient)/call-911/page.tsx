"use client";

import { useRouter } from "next/navigation";
import { useGuard, useIntake } from "@/store/intake-context";

// Full width, high contrast, the same in light and dark mode. While an
// emergency is recorded every other screen redirects here; the only way
// back is "I checked this by mistake".
export default function Call911Page() {
  const ready = useGuard("call-911");
  const { state, dispatch } = useIntake();
  const router = useRouter();
  if (!ready) return <div className="min-h-dvh bg-[#a3261b]" />;

  const e = state.emergency;
  const selfHarm = state.emergencyScreen?.checked.includes("self_harm");

  const mistake = () => {
    const back = e?.source === "answer" ? "/questions" : e?.source === "link" ? "/" : "/safety";
    dispatch({ type: "clearEmergency" });
    router.replace(back);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#a3261b] px-4 text-white">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-10">
        <h1 className="text-5xl font-bold leading-none tracking-tight">Call 911 now</h1>
        <p className="text-xl leading-snug">
          {e?.source === "answer" ? `${e.reason}. ` : ""}
          This needs emergency care. Don&apos;t wait and don&apos;t drive yourself.
        </p>
        <a
          href="tel:911"
          className="flex min-h-16 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-[#a3261b]"
        >
          Call 911
        </a>
        <p className="text-base">If you can&apos;t call, ask someone near you to call for you.</p>
        {selfHarm ? (
          <p className="rounded-xl bg-white/15 px-4 py-3 text-base">
            You can also call or text <a href="tel:988" className="font-bold underline">9-8-8</a>, the Suicide Crisis
            Helpline, any time.
          </p>
        ) : null}
      </main>
      {e ? (
        <footer className="mx-auto w-full max-w-md pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={mistake} className="py-3 text-sm text-white/85 underline">
            {e.source === "answer" ? "I answered this by mistake" : "I checked this by mistake"}
          </button>
        </footer>
      ) : null}
    </div>
  );
}
