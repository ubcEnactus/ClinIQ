"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { inputClass } from "@/components/ui";
import { normalizeCode } from "@/engine/reference-code";
import { appendAudit, clearDemoData, findByCode, identityMatches, type IntakeStatus, type SharedIntake } from "@/store/inbox";
import { useProviderView } from "@/store/provider-context";

// Desktop building blocks shared by the clinic view and the pharmacy view.

const VIEW_LABEL: Record<string, string> = { "/clinic": "Clinic", "/pharmacy": "Pharmacy" };

export function ProviderShell({ children, back }: { children: ReactNode; back?: boolean }) {
  const { provider, basePath } = useProviderView();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4">
        <div className="flex items-center gap-4">
          <Link href={basePath} className="text-lg font-semibold tracking-tight">
            Clin<span className="text-muted">IQ</span>{" "}
            <span className="font-normal text-muted">· {VIEW_LABEL[basePath]}</span>
          </Link>
          {back ? (
            <Link href={basePath} className="text-sm text-muted underline">
              ← All patients
            </Link>
          ) : null}
        </div>
        <div className="flex flex-col items-end text-sm">
          <span className="font-medium">{provider.name}</span>
          <span className="text-xs text-muted">
            {provider.demo ? `Fictional demo ${provider.kind === "pharmacy" ? "pharmacy" : "clinic"}` : provider.address}
          </span>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-6 py-6">{children}</main>
      <footer className="border-t border-line py-4 text-xs text-muted">
        If ClinIQ is unavailable, patients check in at the counter as usual. Nothing in their care depends on ClinIQ.
      </footer>
    </div>
  );
}

const STATUS: Record<IntakeStatus, { label: string; className: string }> = {
  waiting: { label: "Waiting", className: "bg-accent-tint text-accent" },
  in_assessment: { label: "In assessment", className: "bg-warn-tint text-warn" },
  seen: { label: "Seen", className: "bg-good-tint text-good" },
  not_ours: { label: "Not our patient", className: "bg-warn-tint text-warn" },
  prescribed: { label: "Prescribed", className: "bg-good-tint text-good" },
  referred: { label: "Referred to a doctor", className: "bg-good-tint text-good" },
};

export function StatusChip({ status }: { status: IntakeStatus }) {
  const s = STATUS[status];
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>;
}

export function Section({ title, children, tone }: { title: string; children: ReactNode; tone?: "warn" }) {
  return (
    <section
      className={`rounded-2xl border p-5 ${tone === "warn" ? "border-warn bg-warn-tint" : "border-line bg-surface"}`}
    >
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

/** "just now", "4 min ago", "2 h ago". */
export function since(iso: string, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
}

/** A clock that ticks every 30 s, for "4 min ago" labels. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// Once per day, before anything else. Not optional: without it ClinIQ would
// carry liability for clinical decisions it has no business making.
export function DailyConfirmation() {
  const { acknowledge } = useProviderView();
  const [checked, setChecked] = useState(false);
  return (
    <ProviderShell>
      <div className="mx-auto mt-10 flex w-full max-w-lg flex-col gap-6 rounded-2xl border border-line bg-surface p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Before you start today</h1>
        <p className="text-lg leading-relaxed">
          ClinIQ shows you information a patient entered themselves. It is not a diagnosis. Any decision about this
          patient is yours.
        </p>
        <label className="flex items-center gap-3 text-base">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="size-5 shrink-0 accent-[var(--accent)]"
          />
          I understand
        </label>
        <button
          type="button"
          disabled={!checked}
          onClick={acknowledge}
          className="min-h-12 rounded-xl bg-accent px-4 font-semibold text-on-accent disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </ProviderShell>
  );
}

export function PatientList({ now }: { now: Date }) {
  const { intakes, basePath } = useProviderView();
  const router = useRouter();
  if (intakes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-muted">
        No patients yet. When a patient shares their answers with you, they appear here straight away.
      </div>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {intakes.map((i) => (
        <li key={i.id}>
          <button
            type="button"
            onClick={() => router.push(`${basePath}/patient?id=${encodeURIComponent(i.id)}`)}
            className="grid w-full grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 text-left hover:bg-surface-2 sm:grid-cols-[minmax(5rem,8rem)_1fr_auto_auto_auto]"
          >
            <span className="font-semibold">{i.firstName}</span>
            <span className="hidden sm:block">{i.conditionLabel}</span>
            <span className="hidden text-sm text-muted sm:block">{since(i.sharedAt, now)}</span>
            <span className="hidden font-mono text-sm sm:block">{i.referenceCode}</span>
            <span className="justify-self-end">
              <StatusChip status={i.status} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// Most patients walk in holding a code. A code alone never opens a record:
// first name and date of birth must match what it pulls up.
export function CodeLookup() {
  const { intakes, provider, basePath } = useProviderView();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [found, setFound] = useState<SharedIntake | null>(null);
  const [firstName, setFirstName] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);

  const lookUp = () => {
    const match = findByCode(intakes, provider.id, normalizeCode(code), new Date());
    setError(
      match
        ? null
        : "Nothing was shared with this code in this browser. In the demo, the patient taps Share on their last screen, on this same device.",
    );
    setFound(match);
  };

  const confirm = () => {
    if (!found) return;
    if (!identityMatches(found, firstName, dob)) {
      appendAudit({ at: new Date().toISOString(), providerId: provider.id, intakeId: found.id, action: "code_lookup_failed" });
      setError("Name or date of birth doesn't match. Check with the patient.");
      return;
    }
    router.push(`${basePath}/patient?id=${encodeURIComponent(found.id)}`);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <label htmlFor="code" className="text-base font-semibold">
        Enter a patient&apos;s code
      </label>
      <input
        id="code"
        value={code}
        onChange={(e) => {
          setCode(e.target.value.toUpperCase());
          setFound(null);
          setError(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && lookUp()}
        className={`${inputClass} font-mono text-2xl tracking-[0.2em]`}
        placeholder="AB3K9X"
        maxLength={8}
        autoComplete="off"
      />
      {!found ? (
        <button
          type="button"
          onClick={lookUp}
          disabled={normalizeCode(code).length !== 6}
          className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-accent disabled:opacity-40"
        >
          Look up
        </button>
      ) : (
        <>
          <p className="text-sm text-muted">Confirm it&apos;s them before opening their answers.</p>
          <input
            aria-label="Patient's first name"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
          />
          <input
            aria-label="Patient's date of birth"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className={inputClass}
          />
          <button
            type="button"
            onClick={confirm}
            disabled={!firstName.trim() || !dob}
            className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-accent disabled:opacity-40"
          >
            Open answers
          </button>
        </>
      )}
      {error ? <p className="text-sm text-crit">{error}</p> : null}
    </div>
  );
}

/** Empties the demo inbox in this browser, for re-recording a demo. */
export function ClearDemoData() {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm("Clear all demo patients from this browser?")) clearDemoData();
      }}
      className="self-start text-xs text-muted underline"
    >
      Clear demo data
    </button>
  );
}
