import { useCallback, useMemo, useState } from "react";

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const useQuiz = (maxDigits: number) => {
  const maxValue = useMemo(() => Math.pow(10, maxDigits) - 1, [maxDigits]);
  const [target, setTarget] = useState<number>(() => randomInt(0, maxValue));
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | null>(null);

  const nextQuestion = useCallback(() => {
    setTarget(randomInt(0, maxValue));
    setLastResult(null);
  }, [maxValue]);

  const checkAnswer = useCallback(
    (answer: number) => {
      const isCorrect = answer === target;
      setLastResult(isCorrect ? "correct" : "wrong");
      return isCorrect;
    },
    [target]
  );

  return {
    target,
    lastResult,
    nextQuestion,
    checkAnswer,
  };
};
