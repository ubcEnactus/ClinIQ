"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Location } from "@/content/data-schemas";
import type { PatientContent } from "@/content/server";
import { localTime } from "@/engine/clock";
import { onInboxChange, readInbox, writeInbox, type SharedIntake } from "./inbox";

// State for a provider's screens (the clinic view and the pharmacy view):
// who the provider is, today's confirmation, and the live inbox of intakes
// shared with them (demo: same device, see inbox.ts).

interface Ack {
  date: string; // Vancouver date it applies to
  at: string; // when it was given
}

interface ProviderViewValue {
  content: PatientContent;
  provider: Location;
  /** "/clinic" or "/pharmacy". */
  basePath: string;
  hydrated: boolean;
  /** Intakes shared with this provider, newest first. */
  intakes: SharedIntake[];
  updateInbox: (change: (all: SharedIntake[]) => SharedIntake[]) => void;
  acknowledgedToday: boolean;
  acknowledge: () => void;
}

const ProviderViewContext = createContext<ProviderViewValue | null>(null);

const ackKey = (providerId: string) => `cliniq.demo.ack.${providerId}.v1`;

function readAck(providerId: string): Ack | null {
  try {
    const raw = window.localStorage.getItem(ackKey(providerId));
    return raw ? (JSON.parse(raw) as Ack) : null;
  } catch {
    return null;
  }
}

export function ProviderViewProvider({
  content,
  providerId,
  basePath,
  children,
}: {
  content: PatientContent;
  providerId: string;
  basePath: string;
  children: ReactNode;
}) {
  const provider = content.locations.find((l) => l.id === providerId)!;
  const [hydrated, setHydrated] = useState(false);
  const [all, setAll] = useState<SharedIntake[]>([]);
  const [ack, setAck] = useState<Ack | null>(null);

  useEffect(() => {
    setAll(readInbox());
    setAck(readAck(providerId));
    setHydrated(true);
    return onInboxChange(() => setAll(readInbox()));
  }, [providerId]);

  const updateInbox = useCallback((change: (all: SharedIntake[]) => SharedIntake[]) => {
    writeInbox(change(readInbox()));
  }, []);

  const acknowledge = useCallback(() => {
    const now = new Date();
    const next = { date: localTime(now).date, at: now.toISOString() };
    try {
      window.localStorage.setItem(ackKey(providerId), JSON.stringify(next));
    } catch {}
    setAck(next);
  }, [providerId]);

  const acknowledgedToday = hydrated && ack !== null && ack.date === localTime(new Date()).date;
  const intakes = all.filter((i) => i.providerId === provider.id);

  return (
    <ProviderViewContext.Provider
      value={{ content, provider, basePath, hydrated, intakes, updateInbox, acknowledgedToday, acknowledge }}
    >
      {children}
    </ProviderViewContext.Provider>
  );
}

export function useProviderView(): ProviderViewValue {
  const value = useContext(ProviderViewContext);
  if (!value) throw new Error("useProviderView must be used inside ProviderViewProvider");
  return value;
}
