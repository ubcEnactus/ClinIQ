"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { optionsFor, type Question } from "@/content/condition-schema";
import { Choice, Loading, PrimaryButton, Screen, SecondaryButton, inputClass } from "@/components/ui";
import { localTime } from "@/engine/clock";
import { FREETEXT_NONE, evaluateRules, type AnswerValue } from "@/engine/rules";
import { CALL_911_PATH, STEP_PATH, conditionFor } from "@/store/flow";
import { useGuard, useIntake } from "@/store/intake-context";

// Screen 5. The condition's questions, one at a time, each a tap where it
// can be. An answer that rules out the pharmacy does not stop the questions,
// because the clinician still wants the answers. An emergency answer does.
export default function QuestionsPage() {
  const ready = useGuard("questions");
  const { state, content, dispatch } = useIntake();
  const router = useRouter();
  if (!ready) return <Loading />;

  const condition = conditionFor(state, content)!;
  const total = condition.questions.length;
  const index = Math.min(state.questionIndex, total - 1);
  const question = condition.questions[index];

  const commit = (value: AnswerValue) => {
    const answers = { ...state.answers, [question.id]: value };
    dispatch({ type: "answer", questionId: question.id, value });
    const emergency = evaluateRules(condition, answers, new Date()).find((r) => r.outcome === "emergency");
    if (emergency) {
      dispatch({ type: "emergencyAnswer", questionId: question.id, ruleId: emergency.id, reason: emergency.reason });
      router.replace(CALL_911_PATH);
    } else if (index + 1 < total) {
      dispatch({ type: "goToQuestion", index: index + 1 });
    } else {
      router.push(STEP_PATH.destination);
    }
  };

  const back = () => (index > 0 ? dispatch({ type: "goToQuestion", index: index - 1 }) : router.back());
  const previous = state.answers[question.id] ?? state.previousAnswers[question.id];

  return (
    <Screen step={5} title={question.text} lead={`${condition.name} · question ${index + 1} of ${total}`} onBack={back}>
      {/* Keyed so a new question starts with fresh local input state. */}
      <Answer key={question.id} question={question} previous={previous} onAnswer={commit} />
    </Screen>
  );
}

function Answer({
  question,
  previous,
  onAnswer,
}: {
  question: Question;
  previous: AnswerValue | undefined;
  onAnswer: (v: AnswerValue) => void;
}) {
  switch (question.type) {
    case "yesno":
    case "single":
      return (
        <ul className="flex flex-col gap-2">
          {optionsFor(question).map((o) => (
            <li key={o.value}>
              <Choice selected={previous === o.value} onClick={() => onAnswer(o.value)}>
                {o.label}
              </Choice>
            </li>
          ))}
        </ul>
      );
    case "multi":
      return <MultiAnswer question={question} previous={previous} onAnswer={onAnswer} />;
    case "date":
      return <DateAnswer previous={previous} onAnswer={onAnswer} />;
    case "freetext":
      return (
        <FreeTextAnswer noneOption={question.none_option} previous={previous} onAnswer={onAnswer} />
      );
  }
}

function MultiAnswer({
  question,
  previous,
  onAnswer,
}: {
  question: Question;
  previous: AnswerValue | undefined;
  onAnswer: (v: AnswerValue) => void;
}) {
  const [picked, setPicked] = useState<string[]>(Array.isArray(previous) ? previous : []);
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  return (
    <>
      <p className="-mt-2 text-sm text-muted">Pick all that apply.</p>
      <ul className="flex flex-col gap-2">
        {optionsFor(question).map((o) => (
          <li key={o.value}>
            <Choice selected={picked.includes(o.value)} onClick={() => toggle(o.value)}>
              {o.label}
            </Choice>
          </li>
        ))}
      </ul>
      <PrimaryButton disabled={picked.length === 0} onClick={() => onAnswer(picked)}>
        Continue
      </PrimaryButton>
    </>
  );
}

function DateAnswer({ previous, onAnswer }: { previous: AnswerValue | undefined; onAnswer: (v: AnswerValue) => void }) {
  const [today, setToday] = useState("");
  const [value, setValue] = useState(typeof previous === "string" ? previous : "");
  useEffect(() => setToday(localTime(new Date()).date), []);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value) && (!today || value <= today);
  return (
    <>
      <input
        type="date"
        aria-label="Date"
        max={today || undefined}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={inputClass}
      />
      <PrimaryButton disabled={!valid} onClick={() => onAnswer(value)}>
        Continue
      </PrimaryButton>
    </>
  );
}

function FreeTextAnswer({
  noneOption,
  previous,
  onAnswer,
}: {
  noneOption: boolean;
  previous: AnswerValue | undefined;
  onAnswer: (v: AnswerValue) => void;
}) {
  const [value, setValue] = useState(typeof previous === "string" && previous !== FREETEXT_NONE ? previous : "");
  return (
    <>
      <textarea
        rows={3}
        aria-label="Your answer"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={inputClass}
        placeholder="Type your answer"
      />
      <PrimaryButton disabled={value.trim() === ""} onClick={() => onAnswer(value.trim())}>
        Continue
      </PrimaryButton>
      {noneOption ? <SecondaryButton onClick={() => onAnswer(FREETEXT_NONE)}>None</SecondaryButton> : null}
    </>
  );
}
