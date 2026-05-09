"use client";

import type React from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/common/AppShell";
import { apiRequest } from "@/lib/api-client";

type QuestionType = "multiple_choice" | "short_answer";
type Tab = "overview" | "courses" | "create" | "lessons" | "assignments" | "students";

interface Subject {
  id: number;
  name: string;
}

interface Student {
  id: number;
  username: string;
  fullName: string;
  email: string;
}

interface Course {
  id: number;
  title: string;
  description?: string | null;
  teacherName?: string | null;
  subject?: Subject | null;
  students?: Student[];
  studentIds?: number[];
  lessons?: Lesson[];
}

interface Material {
  id: number;
  originalName: string;
  filePath: string;
}

interface Question {
  id?: number;
  questionType: QuestionType;
  content?: string | null;
  imageUrl?: string | null;
  imageOriginalName?: string | null;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  correctAnswer: string;
  explanation?: string | null;
  score?: number | null;
}

interface Lesson {
  id: number;
  title: string;
  description?: string | null;
  videoType?: string | null;
  videoUrl?: string | null;
  videoFilePath?: string | null;
  course: Course;
  questions: Question[];
  materials: Material[];
}

interface Assignment {
  id: number;
  title: string;
  description?: string | null;
  deadline?: string | null;
  maxScore?: number | null;
  course?: Course | null;
  lesson?: Lesson | null;
  questions?: Question[];
  submissions: {
    id: number;
    status: string;
    score?: number | null;
    answerText?: string | null;
    student: Student;
  }[];
}

interface QuestionDraft {
  id: string;
  questionType: QuestionType;
  content: string;
  imageFile: File | null;
  imagePreview: string | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string;
  score: string;
}

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Tong quan" },
  { id: "courses", label: "Khoa hoc cua toi" },
  { id: "create", label: "Tao khoa hoc" },
  { id: "lessons", label: "Bai giang" },
  { id: "assignments", label: "Bai tap / cau hoi" },
  { id: "students", label: "Hoc sinh" }
];

function emptyQuestionDraft(): QuestionDraft {
  return {
    id: crypto.randomUUID(),
    questionType: "multiple_choice",
    content: "",
    imageFile: null,
    imagePreview: null,
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "A",
    explanation: "",
    score: "1"
  };
}

export default function CoachPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [newCourseStudentIds, setNewCourseStudentIds] = useState<number[]>([]);
  const [courseStudentDraftIds, setCourseStudentDraftIds] = useState<number[]>([]);
  const [lessonQuestions, setLessonQuestions] = useState<QuestionDraft[]>([emptyQuestionDraft()]);
  const [assignmentQuestions, setAssignmentQuestions] = useState<QuestionDraft[]>([emptyQuestionDraft()]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? courses[0] ?? null,
    [courses, selectedCourseId]
  );

  const selectedCourseLessons = useMemo(
    () => lessons.filter((lesson) => lesson.course.id === selectedCourse?.id),
    [lessons, selectedCourse?.id]
  );

  const selectedCourseAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.course?.id === selectedCourse?.id),
    [assignments, selectedCourse?.id]
  );

  useEffect(() => {
    loadWorkspace()
      .catch((error) => showError(error, "Could not load Teacher workspace."))
      .finally(() => setInitialLoading(false));
  }, []);

  useEffect(() => {
    const firstCourse = courses[0];
    if (!selectedCourse && firstCourse) {
      setSelectedCourseId(firstCourse.id);
    }
  }, [courses, selectedCourse]);

  useEffect(() => {
    setCourseStudentDraftIds(selectedCourse?.studentIds ?? []);
  }, [selectedCourse?.id, selectedCourse?.studentIds]);

  async function loadWorkspace() {
    const [subjectData, courseData, lessonData, studentData, assignmentData] = await Promise.all([
      apiRequest<{ subjects: Subject[] }>("/subjects"),
      apiRequest<{ courses: Course[] }>("/courses"),
      apiRequest<{ lessons: Lesson[] }>("/lessons"),
      apiRequest<{ students: Student[] }>("/users/students"),
      apiRequest<{ items: Assignment[] }>("/assignments?pageSize=50")
    ]);

    setSubjects(subjectData.subjects);
    setCourses(courseData.courses);
    setLessons(lessonData.lessons);
    setStudents(studentData.students);
    setAssignments(assignmentData.items);
    setSelectedCourseId((current) => current ?? courseData.courses[0]?.id ?? null);
  }

  async function runAction(successText: string, action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ type: "success", text: successText });
    } catch (error) {
      showError(error, "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  function showError(error: unknown, fallback: string) {
    setMessage({ type: "error", text: error instanceof Error ? error.message : fallback });
  }

  async function handleCreateCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    await runAction("Course created.", async () => {
      const response = await apiRequest<{ course: Course }>("/courses", {
        method: "POST",
        body: JSON.stringify({
          subjectId: data.get("subjectId") || undefined,
          title: data.get("title"),
          description: data.get("description"),
          studentIds: newCourseStudentIds
        })
      });

      setCourses((items) => [response.course, ...items.filter((item) => item.id !== response.course.id)]);
      setSelectedCourseId(response.course.id);
      setNewCourseStudentIds([]);
      form.reset();
      setActiveTab("courses");
    });
  }

  async function handleDeleteCourse(course: Course) {
    if (!window.confirm(`Delete course "${course.title}"? Courses with lessons or assignments cannot be deleted.`)) {
      return;
    }

    await runAction("Course deleted.", async () => {
      await apiRequest(`/courses/${course.id}`, { method: "DELETE" });
      setCourses((items) => items.filter((item) => item.id !== course.id));
      setSelectedCourseId((current) => (current === course.id ? null : current));
    });
  }

  async function handleCreateLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourse) {
      showError(null, "Select a course first.");
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("courseId", String(selectedCourse.id));
    appendQuestions(data, lessonQuestions);

    await runAction("Lesson created.", async () => {
      const response = await apiRequest<{ lesson: Lesson }>("/lessons", { method: "POST", body: data });
      setLessons((items) => [response.lesson, ...items.filter((item) => item.id !== response.lesson.id)]);
      setLessonQuestions([emptyQuestionDraft()]);
      form.reset();
    });
  }

  async function handleCreateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourse) {
      showError(null, "Select a course first.");
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("courseId", String(selectedCourse.id));
    appendQuestions(data, assignmentQuestions);

    await runAction("Assignment created.", async () => {
      const response = await apiRequest<{ assignment: Assignment }>("/assignments", {
        method: "POST",
        body: data
      });
      setAssignments((items) => [response.assignment, ...items.filter((item) => item.id !== response.assignment.id)]);
      setAssignmentQuestions([emptyQuestionDraft()]);
      form.reset();
    });
  }

  async function handleSaveStudents() {
    if (!selectedCourse) {
      showError(null, "Select a course first.");
      return;
    }

    await runAction("Course students updated.", async () => {
      const response = await apiRequest<{ course: Course }>(`/courses/${selectedCourse.id}`, {
        method: "PATCH",
        body: JSON.stringify({ studentIds: courseStudentDraftIds })
      });
      setCourses((items) => items.map((item) => (item.id === response.course.id ? response.course : item)));
    });
  }

  async function handleGrade(assignment: Assignment, student: Student) {
    const rawScore = window.prompt(`Score for ${student.fullName}`, String(assignment.maxScore ?? 10));
    if (!rawScore) {
      return;
    }

    const feedback = window.prompt("Feedback", "Good work.") ?? "";
    await runAction("Submission graded.", async () => {
      await apiRequest(`/assignments/${assignment.id}/submissions/${student.id}/grade`, {
        method: "POST",
        body: JSON.stringify({ score: Number(rawScore), feedback })
      });
      const refreshed = await apiRequest<{ items: Assignment[] }>("/assignments?pageSize=50");
      setAssignments(refreshed.items);
    });
  }

  if (initialLoading) {
    return (
      <AppShell allowedRoles={["teacher", "coach", "admin"]}>
        <div className="rounded-lg border border-line bg-white p-6 text-sm text-muted">Loading Teacher workspace...</div>
      </AppShell>
    );
  }

  return (
    <AppShell allowedRoles={["teacher", "coach", "admin"]}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Teacher Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Create a course first, then add lessons, assignments, questions, and students inside that course.
          </p>
        </div>
        <CourseSelect courses={courses} onChange={setSelectedCourseId} selectedCourseId={selectedCourse?.id ?? null} />
      </div>

      {message ? (
        <div
          className={`mb-5 rounded-md border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="mb-6 overflow-x-auto">
        <div className="flex min-w-max gap-2 rounded-lg border border-line bg-white p-2">
          {tabs.map((tab) => (
            <button
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                activeTab === tab.id ? "bg-brand text-white" : "text-muted hover:bg-surface"
              }`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" ? (
        <Overview
          assignments={assignments}
          courses={courses}
          lessons={lessons}
          selectedCourse={selectedCourse}
          students={students}
        />
      ) : null}

      {activeTab === "courses" ? (
        <CourseList
          courses={courses}
          onDelete={handleDeleteCourse}
          onSelect={(id) => {
            setSelectedCourseId(id);
            setActiveTab("lessons");
          }}
          selectedCourseId={selectedCourse?.id ?? null}
        />
      ) : null}

      {activeTab === "create" ? (
        <Panel title="Create course">
          <form className="grid gap-4" onSubmit={handleCreateCourse}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input name="title" placeholder="Course title" required />
              <Select name="subjectId">
                <option value="">Optional subject/category</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </Select>
            </div>
            <textarea
              className="min-h-24 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand"
              name="description"
              placeholder="Short description"
            />
            <StudentChecklist
              disabled={busy}
              onChange={setNewCourseStudentIds}
              selectedIds={newCourseStudentIds}
              students={students}
            />
            <Button disabled={busy}>Create course</Button>
          </form>
        </Panel>
      ) : null}

      {activeTab === "lessons" ? (
        <CourseScopedPanel course={selectedCourse} title="Lessons">
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <form className="grid gap-4" onSubmit={handleCreateLesson}>
              <Input name="title" placeholder="Lesson title" required />
              <Input name="description" placeholder="Description" />
              <div className="grid gap-3 md:grid-cols-2">
                <Select name="videoType" required>
                  <option value="youtube">YouTube</option>
                  <option value="google_drive">Google Drive</option>
                  <option value="upload">Upload video</option>
                </Select>
                <Input name="videoUrl" placeholder="YouTube or Google Drive URL" />
              </div>
              <FileInput accept="video/mp4,video/webm,video/ogg" label="Video file" name="videoFile" />
              <FileInput
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                label="Materials"
                multiple
                name="materials"
              />
              <QuestionBuilder questions={lessonQuestions} setQuestions={setLessonQuestions} />
              <Button disabled={busy}>Create lesson</Button>
            </form>
            <LessonList lessons={selectedCourseLessons} />
          </div>
        </CourseScopedPanel>
      ) : null}

      {activeTab === "assignments" ? (
        <CourseScopedPanel course={selectedCourse} title="Assignments and questions">
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <form className="grid gap-4" onSubmit={handleCreateAssignment}>
              <Input name="title" placeholder="Assignment title" required />
              <textarea
                className="min-h-24 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand"
                name="description"
                placeholder="Instructions"
              />
              <div className="grid gap-3 md:grid-cols-3">
                <Select name="type" defaultValue="assignment">
                  <option value="assignment">Assignment</option>
                  <option value="test">Test</option>
                </Select>
                <Input name="deadline" type="datetime-local" />
                <Input defaultValue="10" min="1" name="maxScore" type="number" />
              </div>
              <Select name="lessonId">
                <option value="">Optional linked lesson</option>
                {selectedCourseLessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title}
                  </option>
                ))}
              </Select>
              <QuestionBuilder questions={assignmentQuestions} setQuestions={setAssignmentQuestions} />
              <Button disabled={busy}>Create assignment</Button>
            </form>
            <AssignmentList assignments={selectedCourseAssignments} onGrade={handleGrade} />
          </div>
        </CourseScopedPanel>
      ) : null}

      {activeTab === "students" ? (
        <CourseScopedPanel course={selectedCourse} title="Students in this course">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <StudentChecklist
                disabled={busy}
                onChange={setCourseStudentDraftIds}
                selectedIds={courseStudentDraftIds}
                students={students}
              />
              <Button className="mt-4" disabled={busy} onClick={handleSaveStudents} type="button">
                Save students
              </Button>
            </div>
            <StudentList students={selectedCourse?.students ?? []} />
          </div>
        </CourseScopedPanel>
      ) : null}
    </AppShell>
  );
}

function appendQuestions(data: FormData, drafts: QuestionDraft[]) {
  let uploadIndex = 0;
  const questions = drafts
    .map((question) => {
      const content = question.content.trim();
      if (!content && !question.imageFile) {
        return null;
      }

      const payload: Record<string, string | number> = {
        questionType: question.questionType,
        content,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation.trim(),
        score: Number(question.score || 1)
      };

      if (question.imageFile) {
        uploadIndex += 1;
        data.append("questionImages", question.imageFile);
        payload.imageUploadIndex = uploadIndex;
      }

      if (question.questionType === "multiple_choice") {
        payload.optionA = question.optionA.trim();
        payload.optionB = question.optionB.trim();
        payload.optionC = question.optionC.trim();
        payload.optionD = question.optionD.trim();
      }

      return payload;
    })
    .filter(Boolean);

  data.set("questions", JSON.stringify(questions));
}

function Overview({
  assignments,
  courses,
  lessons,
  selectedCourse,
  students
}: {
  assignments: Assignment[];
  courses: Course[];
  lessons: Lesson[];
  selectedCourse: Course | null;
  students: Student[];
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Courses" value={courses.length} />
        <Stat label="Lessons" value={lessons.length} />
        <Stat label="Assignments" value={assignments.length} />
        <Stat label="Students" value={students.length} />
      </div>
      <Panel title="Current course">
        {selectedCourse ? (
          <div className="grid gap-4 md:grid-cols-4">
            <Stat label="Course" value={selectedCourse.title} />
            <Stat label="Subject" value={selectedCourse.subject?.name ?? "Optional"} />
            <Stat label="Lessons" value={selectedCourse.lessons?.length ?? 0} />
            <Stat label="Students" value={selectedCourse.studentIds?.length ?? 0} />
          </div>
        ) : (
          <p className="text-sm text-muted">Create a course to start building content.</p>
        )}
      </Panel>
    </div>
  );
}

function CourseList({
  courses,
  onDelete,
  onSelect,
  selectedCourseId
}: {
  courses: Course[];
  onDelete: (course: Course) => void;
  onSelect: (id: number) => void;
  selectedCourseId: number | null;
}) {
  return (
    <Panel title="My courses">
      {courses.length === 0 ? (
        <p className="text-sm text-muted">No courses yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {courses.map((course) => (
            <div
              className={`rounded-md border p-4 ${
                course.id === selectedCourseId ? "border-brand bg-blue-50" : "border-line bg-surface"
              }`}
              key={course.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{course.title}</p>
                  <p className="mt-1 text-xs text-muted">{course.subject?.name ?? "No required subject"}</p>
                </div>
                <span className="rounded-md bg-white px-2 py-1 text-xs text-muted">
                  {course.studentIds?.length ?? 0} students
                </span>
              </div>
              {course.description ? <p className="mt-3 text-sm text-muted">{course.description}</p> : null}
              <div className="mt-4 flex gap-2">
                <Button onClick={() => onSelect(course.id)} type="button">
                  Manage
                </Button>
                <button className="rounded-md border border-line px-4 py-2 text-sm font-medium text-red-600" onClick={() => onDelete(course)} type="button">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function QuestionBuilder({
  questions,
  setQuestions
}: {
  questions: QuestionDraft[];
  setQuestions: React.Dispatch<React.SetStateAction<QuestionDraft[]>>;
}) {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Questions</h3>
          <p className="mt-1 text-xs text-muted">Use text, image, or both. JPG, PNG, and WEBP are accepted.</p>
        </div>
        <button
          className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium"
          onClick={() => setQuestions((items) => [...items, emptyQuestionDraft()])}
          type="button"
        >
          Add question
        </button>
      </div>
      <div className="space-y-4">
        {questions.map((question, index) => (
          <QuestionEditor
            index={index}
            key={question.id}
            onChange={(next) => setQuestions((items) => items.map((item) => (item.id === question.id ? next : item)))}
            onRemove={() =>
              setQuestions((items) => (items.length === 1 ? [emptyQuestionDraft()] : items.filter((item) => item.id !== question.id)))
            }
            question={question}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionEditor({
  index,
  onChange,
  onRemove,
  question
}: {
  index: number;
  onChange: (question: QuestionDraft) => void;
  onRemove: () => void;
  question: QuestionDraft;
}) {
  function patch(next: Partial<QuestionDraft>) {
    onChange({ ...question, ...next });
  }

  function handleImage(file: File | null) {
    if (!file) {
      patch({ imageFile: null, imagePreview: null });
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      window.alert("Only JPG, PNG, or WEBP images are accepted.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      window.alert("Question image must be 5MB or smaller.");
      return;
    }

    patch({ imageFile: file, imagePreview: URL.createObjectURL(file) });
  }

  return (
    <div className="rounded-md border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">Question {index + 1}</span>
        <button className="text-sm font-medium text-red-600" onClick={onRemove} type="button">
          Remove
        </button>
      </div>
      <div className="grid gap-3">
        <Select onChange={(event) => patch({ questionType: event.target.value as QuestionType, correctAnswer: "A" })} value={question.questionType}>
          <option value="multiple_choice">Multiple choice</option>
          <option value="short_answer">Short answer</option>
        </Select>
        <textarea
          className="min-h-24 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand"
          onChange={(event) => patch({ content: event.target.value })}
          placeholder="Question text"
          value={question.content}
        />
        <div className="rounded-md border border-dashed border-line bg-surface p-3">
          <label className="block text-sm font-medium text-ink">Question image</label>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
            onChange={(event) => handleImage(event.target.files?.[0] ?? null)}
            type="file"
          />
          {question.imagePreview ? (
            <div className="mt-3">
              <img alt="Question preview" className="max-h-72 w-full rounded-md border border-line bg-white object-contain" src={question.imagePreview} />
              <button className="mt-2 text-sm font-medium text-red-600" onClick={() => handleImage(null)} type="button">
                Remove image
              </button>
            </div>
          ) : null}
        </div>
        {question.questionType === "multiple_choice" ? (
          <div className="grid gap-3 md:grid-cols-2">
            {(["A", "B", "C", "D"] as const).map((key) => (
              <label className="flex gap-2 rounded-md border border-line bg-surface p-2 text-sm" key={key}>
                <input
                  checked={question.correctAnswer === key}
                  name={`correct-${question.id}`}
                  onChange={() => patch({ correctAnswer: key })}
                  type="radio"
                />
                <input
                  className="min-w-0 flex-1 bg-transparent outline-none"
                  onChange={(event) => patch({ [`option${key}`]: event.target.value } as Partial<QuestionDraft>)}
                  placeholder={`Option ${key}`}
                  value={question[`option${key}` as keyof QuestionDraft] as string}
                />
              </label>
            ))}
          </div>
        ) : (
          <Input
            onChange={(event) => patch({ correctAnswer: event.target.value })}
            placeholder="Accepted answers separated by ;"
            value={question.correctAnswer}
          />
        )}
        <div className="grid gap-3 md:grid-cols-[110px_1fr]">
          <Input min="1" onChange={(event) => patch({ score: event.target.value })} placeholder="Score" type="number" value={question.score} />
          <Input onChange={(event) => patch({ explanation: event.target.value })} placeholder="Explanation or grading note" value={question.explanation} />
        </div>
        <QuestionPreview question={question} />
      </div>
    </div>
  );
}

function QuestionPreview({ question }: { question: QuestionDraft }) {
  if (!question.content.trim() && !question.imagePreview) {
    return null;
  }

  return (
    <div className="rounded-md border border-line bg-surface p-3 text-sm">
      <p className="font-semibold text-ink">Preview</p>
      {question.content.trim() ? <p className="mt-2 text-muted">{question.content}</p> : null}
      {question.imagePreview ? <img alt="Preview" className="mt-2 max-h-52 w-full rounded-md object-contain" src={question.imagePreview} /> : null}
    </div>
  );
}

function CourseScopedPanel({ children, course, title }: { children: React.ReactNode; course: Course | null; title: string }) {
  if (!course) {
    return (
      <Panel title={title}>
        <p className="text-sm text-muted">Create or select a course first.</p>
      </Panel>
    );
  }

  return (
    <Panel title={`${title}: ${course.title}`}>
      {children}
    </Panel>
  );
}

function CourseSelect({
  courses,
  onChange,
  selectedCourseId
}: {
  courses: Course[];
  onChange: (id: number) => void;
  selectedCourseId: number | null;
}) {
  return (
    <Select className="min-w-64" onChange={(event) => onChange(Number(event.target.value))} value={selectedCourseId ?? ""}>
      <option value="">Select course</option>
      {courses.map((course) => (
        <option key={course.id} value={course.id}>
          {course.title}
        </option>
      ))}
    </Select>
  );
}

function LessonList({ lessons }: { lessons: Lesson[] }) {
  return (
    <div className="space-y-3">
      {lessons.length === 0 ? (
        <p className="rounded-md border border-line bg-surface p-4 text-sm text-muted">No lessons in this course yet.</p>
      ) : (
        lessons.map((lesson) => (
          <div className="rounded-md border border-line bg-surface p-4 text-sm" key={lesson.id}>
            <p className="font-semibold text-ink">{lesson.title}</p>
            <p className="mt-1 text-muted">{lesson.description ?? "No description"}</p>
            <p className="mt-2 text-xs text-muted">{lesson.questions.length} questions - {lesson.materials.length} materials</p>
          </div>
        ))
      )}
    </div>
  );
}

function AssignmentList({ assignments, onGrade }: { assignments: Assignment[]; onGrade: (assignment: Assignment, student: Student) => void }) {
  return (
    <div className="space-y-3">
      {assignments.length === 0 ? (
        <p className="rounded-md border border-line bg-surface p-4 text-sm text-muted">No assignments in this course yet.</p>
      ) : (
        assignments.map((assignment) => (
          <div className="rounded-md border border-line bg-surface p-4 text-sm" key={assignment.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{assignment.title}</p>
                <p className="mt-1 text-muted">{assignment.description ?? "No description"}</p>
              </div>
              <span className="rounded-md bg-white px-2 py-1 text-xs text-muted">{assignment.questions?.length ?? 0} questions</span>
            </div>
            <div className="mt-3 space-y-2">
              {assignment.submissions.length === 0 ? (
                <p className="text-xs text-muted">No submissions yet.</p>
              ) : (
                assignment.submissions.map((submission) => (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2" key={submission.id}>
                    <span>
                      {submission.student.fullName} - {submission.status} - {submission.score ?? "-"}/{assignment.maxScore ?? 10}
                    </span>
                    <button className="text-xs font-medium text-brand" onClick={() => onGrade(assignment, submission.student)} type="button">
                      Grade
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function StudentList({ students }: { students: Student[] }) {
  return (
    <div className="space-y-2">
      {students.length === 0 ? (
        <p className="rounded-md border border-line bg-surface p-4 text-sm text-muted">No students are enrolled in this course.</p>
      ) : (
        students.map((student) => (
          <div className="rounded-md border border-line bg-surface px-3 py-2 text-sm" key={student.id}>
            <p className="font-medium text-ink">{student.fullName}</p>
            <p className="text-xs text-muted">{student.email || student.username}</p>
          </div>
        ))
      )}
    </div>
  );
}

function StudentChecklist({
  disabled,
  onChange,
  selectedIds,
  students
}: {
  disabled?: boolean;
  onChange: (studentIds: number[]) => void;
  selectedIds: number[];
  students: Student[];
}) {
  const [query, setQuery] = useState("");
  const filteredStudents = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return students;
    }

    return students.filter((student) =>
      `${student.fullName} ${student.email} ${student.username}`.toLowerCase().includes(value)
    );
  }, [query, students]);

  function toggle(studentId: number) {
    onChange(selectedIds.includes(studentId) ? selectedIds.filter((id) => id !== studentId) : [...selectedIds, studentId]);
  }

  return (
    <div className="rounded-md border border-line bg-white p-3">
      <Input className="w-full" onChange={(event) => setQuery(event.target.value)} placeholder="Search students" value={query} />
      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {filteredStudents.length === 0 ? (
          <p className="text-sm text-muted">No students found.</p>
        ) : (
          filteredStudents.map((student) => (
            <label className="flex items-start gap-3 rounded-md border border-line bg-surface px-3 py-2 text-sm" key={student.id}>
              <input checked={selectedIds.includes(student.id)} className="mt-1" disabled={disabled} onChange={() => toggle(student.id)} type="checkbox" />
              <span>
                <span className="block font-medium">{student.fullName}</span>
                <span className="block text-xs text-muted">{student.email || student.username}</span>
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <p className="text-xs font-medium uppercase text-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function FileInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <label className="grid gap-2 text-sm font-medium text-ink">
      {label}
      <input {...inputProps} className="rounded-md border border-line bg-white px-3 py-2 text-sm" type="file" />
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand ${props.className ?? ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand ${props.className ?? ""}`}
    />
  );
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70 ${props.className ?? ""}`}
    />
  );
}
