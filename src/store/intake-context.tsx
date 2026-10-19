"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from "react";
import type { PatientContent } from "@/content/server";
import { newIntake, reduce, redirectFor, type Action, type IntakeState, type Step } from "./flow";

// Holds the intake for this browser tab, mirrored to sessionStorage so a
// refresh keeps it (including an emergency lock). Nothing is sent anywhere.

const KEY = "cliniq.intake.v1";

interface IntakeContextValue {
  state: IntakeState;
  dispatch: (action: Action) => void;
  content: PatientContent;
  hydrated: boolean;
}

const IntakeContext = createContext<IntakeContextValue | null>(null);

type Internal = { type: "hydrate"; state: IntakeState } | Action;

function internalReduce(state: IntakeState, action: Internal): IntakeState {
  return action.type === "hydrate" ? action.state : reduce(state, action);
}

export function IntakeProvider({ content, children }: { content: PatientContent; children: ReactNode }) {
  const [state, dispatch] = useReducer(internalReduce, null, () => newIntake("", new Date(0)));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let restored: IntakeState | null = null;
    try {
      const raw = window.sessionStorage.getItem(KEY);
      if (raw) restored = JSON.parse(raw) as IntakeState;
    } catch {}
    dispatch({ type: "hydrate", state: restored ?? newIntake(crypto.randomUUID(), new Date()) });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated]);

  return <IntakeContext.Provider value={{ state, dispatch, content, hydrated }}>{children}</IntakeContext.Provider>;
}

export function useIntake(): IntakeContextValue {
  const value = useContext(IntakeContext);
  if (!value) throw new Error("useIntake must be used inside IntakeProvider");
  return value;
}

/**
 * Sends the patient where they belong if they may not be on `step`. Returns
 * true once the page may render.
 */
export function useGuard(step: Step | "call-911"): boolean {
  const { state, content, hydrated } = useIntake();
  const router = useRouter();
  const target = hydrated ? redirectFor(step, state, content) : null;
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);
  return hydrated && !target;
}
