"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { fileBaseUrl } from "@/lib/api-client";
import { getCoursePath, getLesson, saveLessonNote, submitLesson } from "@/features/student/api";
import {
  EmptyState,
  LoadingState,
  ProgressBar,
  SectionCard
} from "@/features/student/components";
import type { Lesson, PathItem, Question } from "@/features/student/types";

export default function StudentLessonPage() {
  const params = useParams<{ courseId: string; lessonId: string }>();
  const router = useRouter();
  const courseId = Number(params.courseId);
  const lessonId = Number(params.lessonId);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [path, setPath] = useState<PathItem[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ score: number; totalQuestions: number } | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    Promise.all([getLesson(lessonId), getCoursePath(courseId)])
      .then(([lessonData, pathData]) => {
        setLesson(lessonData.lesson);
        setPath(pathData.path);
        setNote(lessonData.note?.content ?? "");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Không tải được bài học."))
      .finally(() => setLoading(false));
  }, [courseId, lessonId]);

  const navigation = useMemo(() => {
    const index = path.findIndex((item) => item.lessonId === lessonId);
    return {
      currentIndex: index,
      previous: index > 0 ? path[index - 1] : null,
      next: index >= 0 && index < path.length - 1 ? path[index + 1] : null
    };
  }, [lessonId, path]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = await submitLesson(lessonId, answers);
    setResult({ score: data.score, totalQuestions: data.totalQuestions });
  }

  async function handleSaveNote() {
    setSavingNote(true);
    try {
      await saveLessonNote(lessonId, note);
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) {
    return <LoadingState label="Đang mở bài học..." />;
  }

  if (message || !lesson) {
    return <EmptyState title="Không mở được bài học" description={message ?? "Bài học này chưa sẵn sàng."} />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <main className="space-y-6">
        <section className="rounded-[32px] bg-white p-5 shadow-sm md:p-6">
          <Link className="text-sm font-bold text-brandOrange" href={`/student/courses/${courseId}`}>
            Quay lại khóa học
          </Link>
          <h2 className="mt-3 text-3xl font-bold text-brand">{lesson.title}</h2>
          <p className="mt-3 text-sm leading-7 text-[#66758d]">{lesson.description}</p>
          <div className="mt-5">
            <VideoPlayer lesson={lesson} />
          </div>
        </section>

        <SectionCard title="Nội dung bài học">
          <div className="prose max-w-none text-[#536179]">
            <p>
              Hãy xem bài giảng, ghi lại điểm chưa rõ và hoàn thành phần luyện tập bên dưới. Mục tiêu là hiểu được cách lập luận,
              không chỉ nhớ đáp án.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Luyện tập nhanh">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {lesson.questions.length === 0 ? (
              <EmptyState title="Không có câu hỏi" description="Bạn vẫn có thể đánh dấu hoàn thành sau khi xem nội dung bài." />
            ) : (
              lesson.questions.map((question) => (
                <QuestionBlock
                  answer={answers[question.id] ?? ""}
                  key={question.id}
                  onAnswer={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
                  question={question}
                />
              ))
            )}
            <button className="rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-[#06265a]" type="submit">
              Đánh dấu hoàn thành
            </button>
            {result ? (
              <p className="rounded-2xl bg-[#e9f9ef] px-4 py-3 text-sm font-bold text-green-700">
                Điểm luyện tập: {result.score}/{result.totalQuestions}
              </p>
            ) : null}
          </form>
        </SectionCard>

        <SectionCard title="Tài liệu đính kèm">
          {lesson.materials.length === 0 ? (
            <EmptyState title="Chưa có tài liệu" description="Tài liệu bổ sung sẽ xuất hiện tại đây khi coach cập nhật." />
          ) : (
            <div className="flex flex-wrap gap-3">
              {lesson.materials.map((material) => (
                <a
                  className="rounded-2xl border border-[#d8e5f6] px-4 py-3 text-sm font-bold text-brand hover:border-brandOrange"
                  href={`${fileBaseUrl}${material.filePath}`}
                  key={material.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  {material.originalName}
                </a>
              ))}
            </div>
          )}
        </SectionCard>
      </main>

      <aside className="space-y-6">
        <SectionCard title="Bài trong khóa">
          <div className="space-y-2">
            {path.map((item, index) => (
              <Link
                className={`block rounded-2xl px-4 py-3 text-sm font-bold ${
                  item.lessonId === lessonId ? "bg-brand text-white" : "bg-[#f5f9ff] text-brand"
                }`}
                href={`/student/courses/${courseId}/lessons/${item.lessonId}`}
                key={item.id}
              >
                {index + 1}. {item.lesson.title}
              </Link>
            ))}
          </div>
          <div className="mt-5">
            <ProgressBar value={path.length > 0 ? ((navigation.currentIndex + 1) / path.length) * 100 : 0} />
          </div>
        </SectionCard>

        <SectionCard title="Ghi chú cá nhân">
          <textarea
            className="min-h-44 w-full rounded-2xl border border-[#d8e5f6] p-4 text-sm leading-6 outline-none focus:border-brandOrange focus:ring-4 focus:ring-brandOrange/15"
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ghi lại điều bạn vừa hiểu ra..."
            value={note}
          />
          <button
            className="mt-3 w-full rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-[#06265a]"
            disabled={savingNote}
            onClick={handleSaveNote}
            type="button"
          >
            {savingNote ? "Đang lưu..." : "Lưu ghi chú"}
          </button>
        </SectionCard>

        <div className="grid grid-cols-2 gap-3">
          <button
            className="rounded-2xl border border-[#d8e5f6] bg-white px-4 py-3 text-sm font-bold text-brand disabled:opacity-50"
            disabled={!navigation.previous}
            onClick={() => navigation.previous && router.push(`/student/courses/${courseId}/lessons/${navigation.previous.lessonId}`)}
            type="button"
          >
            Bài trước
          </button>
          <button
            className="rounded-2xl bg-brand px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            disabled={!navigation.next}
            onClick={() => navigation.next && router.push(`/student/courses/${courseId}/lessons/${navigation.next.lessonId}`)}
            type="button"
          >
            Bài tiếp
          </button>
        </div>
      </aside>
    </div>
  );
}

function VideoPlayer({ lesson }: { lesson: Lesson }) {
  if (lesson.videoType === "upload" && lesson.videoFilePath) {
    return <video className="aspect-video w-full rounded-3xl bg-black" controls src={`${fileBaseUrl}${lesson.videoFilePath}`} />;
  }

  if (lesson.videoType === "youtube" && lesson.videoUrl) {
    const id = lesson.videoUrl.includes("youtu.be/")
      ? lesson.videoUrl.split("youtu.be/")[1]?.split(/[?&]/)[0]
      : new URL(lesson.videoUrl).searchParams.get("v");
    return <iframe allowFullScreen className="aspect-video w-full rounded-3xl border border-[#d8e5f6]" src={`https://www.youtube.com/embed/${id ?? ""}`} title={lesson.title} />;
  }

  if (lesson.videoType === "google_drive" && lesson.videoUrl) {
    const id = lesson.videoUrl.match(/\/file\/d\/([^/]+)/)?.[1];
    return <iframe allow="autoplay" className="aspect-video w-full rounded-3xl border border-[#d8e5f6]" src={`https://drive.google.com/file/d/${id ?? ""}/preview`} title={lesson.title} />;
  }

  return <div className="grid aspect-video place-items-center rounded-3xl bg-[#f4f8ff] text-sm font-bold text-[#66758d]">Bài học dạng văn bản</div>;
}

function QuestionBlock({
  answer,
  onAnswer,
  question
}: {
  answer: string;
  onAnswer: (value: string) => void;
  question: Question;
}) {
  return (
    <div className="rounded-3xl border border-[#d8e5f6] bg-[#f8fbff] p-4">
      <p className="font-bold text-brand">{question.content}</p>
      {question.questionType === "multiple_choice" ? (
        <div className="mt-3 grid gap-2">
          {(["A", "B", "C", "D"] as const).map((key) => {
            const label = question[`option${key}` as keyof Question] as string | null | undefined;
            return (
              <label className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm" key={key}>
                <input checked={answer === key} name={`question-${question.id}`} onChange={() => onAnswer(key)} type="radio" />
                <span>{key}. {label}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <input
          className="mt-3 h-12 w-full rounded-2xl border border-[#d8e5f6] px-4 text-sm outline-none focus:border-brandOrange"
          onChange={(event) => onAnswer(event.target.value)}
          placeholder="Câu trả lời của bạn"
          value={answer}
        />
      )}
    </div>
  );
}
