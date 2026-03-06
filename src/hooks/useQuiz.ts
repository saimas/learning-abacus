import { useCallback, useState } from "react";
import { QuizResult } from "../models/quiz";
import { createQuizQuestion, isAnswerCorrect } from "../services/quizEngine";

export const useQuiz = (maxDigits: number) => {
  const [target, setTarget] = useState<number>(() => createQuizQuestion(maxDigits).target);
  const [lastResult, setLastResult] = useState<QuizResult>(null);

  const nextQuestion = useCallback(() => {
    setTarget(createQuizQuestion(maxDigits).target);
    setLastResult(null);
  }, [maxDigits]);

  const checkAnswer = useCallback(
    (answer: number) => {
      const nextResult: QuizResult = isAnswerCorrect(target, answer)
        ? "correct"
        : "wrong";
      setLastResult(nextResult);
      return nextResult === "correct";
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
