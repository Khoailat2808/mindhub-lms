import type { Question } from "@prisma/client";

export interface AnswerResult {
  questionId: number;
  correct: boolean;
  correctAnswer: string;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function gradeAnswers(questions: Question[], answers: Record<string, string>) {
  const results: AnswerResult[] = questions.map((question) => {
    const submitted = normalize(answers[String(question.id)] ?? "");
    const acceptedAnswers =
      question.questionType === "short_answer"
        ? question.correctAnswer.split(";").map(normalize)
        : [normalize(question.correctAnswer)];

    return {
      questionId: question.id,
      correct: submitted.length > 0 && acceptedAnswers.includes(submitted),
      correctAnswer: question.correctAnswer
    };
  });

  return {
    score: results.filter((result) => result.correct).length,
    totalQuestions: questions.length,
    results
  };
}
