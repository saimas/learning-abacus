import { QuizQuestion } from "../models/quiz";

const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const createQuizQuestion = (maxDigits: number): QuizQuestion => {
  const maxValue = Math.pow(10, maxDigits) - 1;
  return { target: randomInt(0, maxValue) };
};

export const isAnswerCorrect = (target: number, answer: number): boolean => target === answer;
