"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FieldLabel,
  Loading,
  Note,
  PrimaryButton,
  Screen,
  Segmented,
  inputClass,
} from "@/components/ui";
import type { LatLng } from "@/engine/locations";
import { forgetDeviceFacts, readDeviceFacts, saveDeviceFacts } from "@/store/device-facts";
import { STEP_PATH, type Basics } from "@/store/flow";
import { useGuard, useIntake } from "@/store/intake-context";

const POSTAL = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i;
const NONE = "None";

type YesNo = "yes" | "no";
const yesNo = [
  { value: "yes" as const, label: "Yes" },
  { value: "no" as const, label: "No" },
];

// Screen 3. Eligibility (Appendix D) and the basics every intake carries.
// Reusable facts are prefilled from this phone and shown for review, never
// silently reused.
export default function EligibilityPage() {
  const ready = useGuard("eligibility");
  const { state, dispatch, hydrated } = useIntake();
  const router = useRouter();

  const [hasPhn, setHasPhn] = useState<Basics["hasPhn"] | null>(null);
  const [age, setAge] = useState("");
  const [ltc, setLtc] = useState<YesNo | null>(null);
  const [bc, setBc] = useState<YesNo | null>(null);
  const [postalCode, setPostalCode] = useState("");
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "failed">("idle");
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [remember, setRemember] = useState(true);
  const [prefilled, setPrefilled] = useState(false);

  // Fill once: from this visit if they came back, else from a past visit on this phone.
  useEffect(() => {
    if (!hydrated) return;
    const b = state.basics;
    const facts = b ? null : readDeviceFacts();
    const src = b ?? facts;
    if (!src) return;
    setHasPhn(src.hasPhn);
    setAge(String(src.age));
    setLtc(src.inLongTermCare ? "yes" : "no");
    setBc(src.livesInBC ? "yes" : "no");
    setAllergies(src.allergies);
    setMedications(src.medications);
    if (b) {
      setPostalCode(b.postalCode);
      setOrigin(b.origin);
      setPrefilled(b.carriedForward);
    } else {
      setPrefilled(true);
    }
    // Only on arrival; later edits are the patient's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  if (!ready) return <Loading />;

  const ageNum = Number(age);
  const ageOk = age.trim() !== "" && Number.isInteger(ageNum) && ageNum >= 0 && ageNum <= 120;
  const postalOk = postalCode.trim() === "" || POSTAL.test(postalCode.trim());
  const complete =
    hasPhn && ageOk && ltc && bc && postalOk && allergies.trim() !== "" && medications.trim() !== "";

  const locate = () => {
    if (!("geolocation" in navigator)) return setLocating("failed");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating("idle");
      },
      () => setLocating("failed"),
      { timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const submit = () => {
    if (!complete) return;
    const basics: Basics = {
      hasPhn,
      age: ageNum,
      inLongTermCare: ltc === "yes",
      livesInBC: bc === "yes",
      postalCode: postalCode.trim().toUpperCase(),
      origin,
      allergies: allergies.trim(),
      medications: medications.trim(),
      carriedForward: prefilled,
    };
    if (remember) {
      saveDeviceFacts({
        hasPhn: basics.hasPhn,
        age: basics.age,
        inLongTermCare: basics.inLongTermCare,
        livesInBC: basics.livesInBC,
        allergies: basics.allergies,
        medications: basics.medications,
        savedAt: new Date().toISOString(),
      });
    } else {
      forgetDeviceFacts();
    }
    dispatch({ type: "basics", basics });
    router.push(STEP_PATH.confirm);
  };

  return (
    <Screen
      step={3}
      title="A few basics"
      lead="These decide where you can be seen and whether it's free."
      footer={
        <PrimaryButton disabled={!complete} onClick={submit}>
          Continue
        </PrimaryButton>
      }
    >
      {prefilled && !state.basics ? (
        <Note tone="warn">Filled in from your last visit on this phone. Check each one is still right.</Note>
      ) : null}

      <div className="flex flex-col gap-2">
        <FieldLabel>Do you have a BC Personal Health Number?</FieldLabel>
        <Segmented
          label="BC Personal Health Number"
          value={hasPhn}
          onChange={setHasPhn}
          options={[...yesNo, { value: "unknown", label: "Not sure" }]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="age">Your age</FieldLabel>
        <input
          id="age"
          inputMode="numeric"
          autoComplete="off"
          value={age}
          onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
          className={inputClass}
          placeholder="e.g. 34"
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel>Do you live in a long-term care home?</FieldLabel>
        <Segmented label="Long-term care" value={ltc} onChange={setLtc} options={yesNo} />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel>Do you live in BC?</FieldLabel>
        <Segmented label="Lives in BC" value={bc} onChange={setBc} options={yesNo} />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="postal">Where are you now?</FieldLabel>
        <input
          id="postal"
          autoComplete="postal-code"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value.toUpperCase().slice(0, 7))}
          className={inputClass}
          placeholder="Postal code, e.g. V6B 1A1"
          aria-invalid={!postalOk}
        />
        {!postalOk ? <p className="text-sm text-crit">That doesn&apos;t look like a postal code.</p> : null}
        <button
          type="button"
          onClick={locate}
          className="self-start rounded-lg py-1 text-sm font-medium text-accent underline"
        >
          {origin ? "✓ Using your current location" : locating === "busy" ? "Finding you…" : "Use my current location"}
        </button>
        {locating === "failed" ? (
          <p className="text-sm text-muted">Couldn&apos;t get your location. We&apos;ll rank places by wait time only.</p>
        ) : null}
      </div>

      <FreeText
        id="allergies"
        label="Any allergies to medicines?"
        placeholder="e.g. penicillin, gives me a rash"
        noneLabel="No allergies"
        value={allergies}
        onChange={setAllergies}
      />
      <FreeText
        id="medications"
        label="Medicines you take now"
        placeholder="Include birth control and supplements"
        noneLabel="None"
        value={medications}
        onChange={setMedications}
      />

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
        />
        <span>
          Remember these on this phone for next time. Only your allergies, medicines and the answers above are kept,
          and only on this device.
        </span>
      </label>
    </Screen>
  );
}

function FreeText({
  id,
  label,
  placeholder,
  noneLabel,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  noneLabel: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const none = value === NONE;
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {!none ? (
        <textarea
          id={id}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          placeholder={placeholder}
        />
      ) : null}
      <label className="flex items-center gap-3 text-base">
        <input
          type="checkbox"
          checked={none}
          onChange={(e) => onChange(e.target.checked ? NONE : "")}
          className="size-5 shrink-0 accent-[var(--accent)]"
        />
        {noneLabel}
      </label>
    </div>
  );
}
