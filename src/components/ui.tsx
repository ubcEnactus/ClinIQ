"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// Mobile-first building blocks for the patient screens. Big tap targets,
// one primary action per screen.

export function Screen({
  step,
  title,
  lead,
  back = true,
  onBack,
  children,
  footer,
}: {
  step?: number;
  title: string;
  lead?: ReactNode;
  back?: boolean;
  /** Replaces browser back, for screens with steps inside them. */
  onBack?: () => void;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
      <header className="flex h-14 items-center justify-between">
        {back ? (
          <button type="button" onClick={onBack ?? (() => router.back())} className="-ml-2 rounded-lg px-2 py-2 text-sm text-muted">
            ← Back
          </button>
        ) : (
          <Wordmark />
        )}
        {step ? <span className="text-xs text-muted">Step {step} of 8</span> : null}
      </header>
      <main className="flex flex-1 flex-col gap-5 pb-6 pt-2">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">{title}</h1>
          {lead ? <div className="text-base text-muted">{lead}</div> : null}
        </div>
        {children}
      </main>
      {footer ? (
        <footer className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-line bg-bg/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}

export function Wordmark() {
  return (
    <span className="text-lg font-semibold tracking-tight">
      Clin<span className="text-muted">IQ</span>
    </span>
  );
}

const primary =
  "flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-4 text-base font-semibold text-on-accent disabled:opacity-40";
const secondary =
  "flex min-h-12 w-full items-center justify-center rounded-xl border border-line-strong bg-surface px-4 text-base font-medium text-ink";

export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={primary} />;
}

export function SecondaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={secondary} />;
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={secondary}>
      {children}
    </Link>
  );
}

/** A large tappable option. `selected` shows the current or previous answer. */
export function Choice({
  selected = false,
  onClick,
  children,
  hint,
}: {
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-14 w-full flex-col items-start justify-center rounded-xl border px-4 py-3 text-left text-base ${
        selected ? "border-accent bg-accent-tint font-medium" : "border-line bg-surface"
      }`}
    >
      {children}
      {hint ? <span className="text-sm text-muted">{hint}</span> : null}
    </button>
  );
}

export function Note({ tone = "info", children }: { tone?: "info" | "warn" | "good"; children: ReactNode }) {
  const tones = {
    info: "bg-surface-2 text-ink",
    warn: "bg-warn-tint text-ink border-l-4 border-warn",
    good: "bg-good-tint text-ink border-l-4 border-good",
  };
  return <div className={`rounded-xl px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

export function Card({
  children,
  className = "",
  highlight = false,
}: {
  children: ReactNode;
  className?: string;
  highlight?: boolean;
}) {
  const border = highlight ? "border-2 border-accent" : "border border-line";
  return <section className={`rounded-2xl ${border} bg-surface p-4 ${className}`}>{children}</section>;
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none";

/** A row of compact choices for a short question inside a form. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-12 flex-1 rounded-xl border px-3 text-base ${
            value === o.value ? "border-accent bg-accent-tint font-medium" : "border-line bg-surface"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Loading() {
  return <div className="mx-auto min-h-dvh max-w-md" aria-busy="true" />;
}
