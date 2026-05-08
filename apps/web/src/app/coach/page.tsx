"use client";

import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import type React from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/common/AppShell";
import { apiRequest } from "@/lib/api-client";

type QuestionType = "multiple_choice" | "short_answer";

interface Subject {
  id: number;
  name: string;
}

interface Course {
  id: number;
  title: string;
  description?: string | null;
  subject: Subject;
}

interface Lesson {
  id: number;
  title: string;
  description?: string | null;
  videoType?: string | null;
  course: Course;
  questions: Question[];
  materials: Material[];
}

interface Question {
  id?: number;
  questionType: QuestionType;
  content: string;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  correctAnswer: string;
}

interface Material {
  id: number;
  originalName: string;
  filePath: string;
}

interface Student {
  id: number;
  username: string;
  fullName: string;
  email: string;
}

interface Assignment {
  id: number;
  title: string;
  description?: string | null;
  deadline?: string | null;
  maxScore?: number | null;
  course?: Course | null;
  submissions: {
    id: number;
    status: string;
    score?: number | null;
    answerText?: string | null;
    student: Student;
  }[];
}

const emptyQuestion = (): Question => ({
  questionType: "multiple_choice",
  content: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctAnswer: "A"
});

export default function CoachPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [pathLessons, setPathLessons] = useState<Lesson[]>([]);
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const libraryLessons = useMemo(
    () => lessons.filter((lesson) => !pathLessons.some((item) => item.id === lesson.id)),
    [lessons, pathLessons]
  );

  async function loadWorkspace() {
    const [subjectData, courseData, lessonData, studentData, assignmentData] = await Promise.all([
      apiRequest<{ subjects: Subject[] }>("/subjects"),
      apiRequest<{ courses: Course[] }>("/courses"),
      apiRequest<{ lessons: Lesson[] }>("/lessons"),
      apiRequest<{ students: Student[] }>("/users/students"),
      apiRequest<{ items: Assignment[] }>("/assignments?pageSize=8")
    ]);
    setSubjects(subjectData.subjects);
    setCourses(courseData.courses);
    setLessons(lessonData.lessons);
    setStudents(studentData.students);
    setAssignments(assignmentData.items);
    setSelectedStudentId((current) => current ?? studentData.students[0]?.id ?? null);
  }

  useEffect(() => {
    loadWorkspace().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Could not load coach workspace.");
    });
  }, []);

  useEffect(() => {
    if (!selectedStudentId) {
      setPathLessons([]);
      return;
    }

    apiRequest<{ path: { lesson: Lesson }[] }>(`/learning-paths/${selectedStudentId}`)
      .then((data) => setPathLessons(data.path.map((item) => item.lesson)))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load path."));
  }, [selectedStudentId]);

  async function handleCreateSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction("Subject created.", async () => {
      await apiRequest("/subjects", {
        method: "POST",
        body: JSON.stringify({ name: form.get("name") })
      });
      event.currentTarget.reset();
      await loadWorkspace();
    });
  }

  async function handleCreateCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction("Course created.", async () => {
      await apiRequest("/courses", {
        method: "POST",
        body: JSON.stringify({
          subjectId: form.get("subjectId"),
          title: form.get("title"),
          description: form.get("description")
        })
      });
      event.currentTarget.reset();
      await loadWorkspace();
    });
  }

  async function handleCreateLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = new FormData();

    for (const key of ["courseId", "title", "description", "videoType", "videoUrl"]) {
      const value = form.get(key);
      if (typeof value === "string") {
        payload.append(key, value);
      }
    }

    const videoFile = form.get("videoFile");
    if (videoFile instanceof File && videoFile.size > 0) {
      payload.append("videoFile", videoFile);
    }

    for (const file of form.getAll("materials")) {
      if (file instanceof File && file.size > 0) {
        payload.append("materials", file);
      }
    }

    payload.append(
      "questions",
      JSON.stringify(
        questions
          .filter((question) => question.content.trim())
          .map((question) =>
            question.questionType === "multiple_choice"
              ? question
              : {
                  questionType: question.questionType,
                  content: question.content,
                  correctAnswer: question.correctAnswer
                }
        )
      )
    );
    const shouldAddToPath = form.get("addToPath") === "on" && selectedStudentId !== null;

    await runAction(shouldAddToPath ? "Lesson created and added to the selected path." : "Lesson created.", async () => {
      const { lesson } = await apiRequest<{ lesson: Lesson }>("/lessons", { method: "POST", body: payload });
      event.currentTarget.reset();
      setQuestions([emptyQuestion()]);
      setLessons((items) => [lesson, ...items.filter((item) => item.id !== lesson.id)]);

      if (shouldAddToPath && selectedStudentId) {
        const lessonIds = [...pathLessons.map((item) => item.id), lesson.id];
        const data = await apiRequest<{ path: { lesson: Lesson }[] }>(
          `/learning-paths/${selectedStudentId}`,
          {
            method: "PUT",
            body: JSON.stringify({ lessonIds })
          }
        );
        setPathLessons(data.path.map((item) => item.lesson));
      }
    });
  }

  async function handleCreateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction("Assignment created.", async () => {
      await apiRequest("/assignments", {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description"),
          courseId: form.get("courseId"),
          lessonId: form.get("lessonId") || undefined,
          deadline: form.get("deadline"),
          maxScore: form.get("maxScore") || 10,
          type: form.get("type") || "assignment"
        })
      });
      event.currentTarget.reset();
      await loadWorkspace();
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
      await loadWorkspace();
    });
  }

  async function handleSavePath() {
    if (!selectedStudentId) {
      setMessage("Select a student first.");
      return;
    }

    await runAction("Learning path saved.", async () => {
      const data = await apiRequest<{ path: { lesson: Lesson }[] }>(
        `/learning-paths/${selectedStudentId}`,
        {
          method: "PUT",
          body: JSON.stringify({ lessonIds: pathLessons.map((lesson) => lesson.id) })
        }
      );
      setPathLessons(data.path.map((item) => item.lesson));
    });
  }

  async function runAction(successMessage: string, action: () => Promise<void>) {
    setLoading(true);
    setMessage(null);
    try {
      await action();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) {
      return;
    }

    if (result.source.droppableId === "library" && result.destination.droppableId === "path") {
      const lesson = libraryLessons[result.source.index];
      if (!lesson) {
        return;
      }
      const next = Array.from(pathLessons);
      next.splice(result.destination.index, 0, lesson);
      setPathLessons(next);
      return;
    }

    if (result.source.droppableId === "path" && result.destination.droppableId === "path") {
      const next = Array.from(pathLessons);
      const [moved] = next.splice(result.source.index, 1);
      if (moved) {
        next.splice(result.destination.index, 0, moved);
        setPathLessons(next);
      }
    }
  }

  return (
    <AppShell allowedRoles={["teacher", "coach", "admin"]}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Teacher workspace</h1>
        <p className="mt-2 text-sm text-muted">
          Manage courses, lessons, assignments, student paths, progress, and feedback.
        </p>
      </div>

      {message ? (
        <p className="mb-5 rounded-md border border-line bg-white px-4 py-3 text-sm text-muted">
          {message}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-6">
          <Panel title="Subjects">
            <form className="flex gap-2" onSubmit={handleCreateSubject}>
              <input
                className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand"
                name="name"
                placeholder="Math"
                required
              />
              <Button disabled={loading}>Create</Button>
            </form>
          </Panel>

          <Panel title="Courses">
            <form className="grid gap-3" onSubmit={handleCreateCourse}>
              <Select name="subjectId" required>
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </Select>
              <Input name="title" placeholder="Algebra fundamentals" required />
              <Input name="description" placeholder="Description" />
              <Button disabled={loading}>Create course</Button>
            </form>
          </Panel>

          <Panel title="Lessons">
            <form className="grid gap-3" onSubmit={handleCreateLesson}>
              <Select name="courseId" required>
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.subject.name} / {course.title}
                  </option>
                ))}
              </Select>
              <Input name="title" placeholder="Lesson title" required />
              <Input name="description" placeholder="Description" />
              <Select name="videoType" required>
                <option value="youtube">YouTube</option>
                <option value="google_drive">Google Drive</option>
                <option value="upload">Upload video</option>
              </Select>
              <Input name="videoUrl" placeholder="Video URL for YouTube or Drive" />
              <input
                accept="video/mp4,video/webm,video/ogg"
                className="rounded-md border border-line bg-white px-3 py-2 text-sm"
                name="videoFile"
                type="file"
              />
              <input
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                className="rounded-md border border-line bg-white px-3 py-2 text-sm"
                multiple
                name="materials"
                type="file"
              />
              <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm">
                <input defaultChecked disabled={!selectedStudentId} name="addToPath" type="checkbox" />
                <span>Add this lesson to the selected student path after upload</span>
              </label>

              <div className="space-y-3 rounded-md border border-line bg-surface p-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Questions</h3>
                  <button
                    className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium"
                    onClick={() => setQuestions((items) => [...items, emptyQuestion()])}
                    type="button"
                  >
                    Add
                  </button>
                </div>
                {questions.map((question, index) => (
                  <QuestionEditor
                    key={index}
                    index={index}
                    question={question}
                    setQuestion={(next) =>
                      setQuestions((items) =>
                        items.map((item, itemIndex) => (itemIndex === index ? next : item))
                      )
                    }
                    removeQuestion={() =>
                      setQuestions((items) =>
                        items.length === 1 ? [emptyQuestion()] : items.filter((_, i) => i !== index)
                      )
                    }
                  />
                ))}
              </div>

              <Button disabled={loading}>Create lesson</Button>
            </form>
          </Panel>
        </section>

        <section className="space-y-6">
          <Panel title="Learning path">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Select
                onChange={(event) => setSelectedStudentId(Number(event.target.value))}
                value={selectedStudentId ?? ""}
              >
                <option value="">Select student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName} ({student.username})
                  </option>
                ))}
              </Select>
              <Button disabled={loading || !selectedStudentId} onClick={handleSavePath} type="button">
                Save path
              </Button>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid gap-4 md:grid-cols-2">
                <LessonColumn droppableId="library" lessons={libraryLessons} title="Lesson library" />
                <LessonColumn
                  droppableId="path"
                  lessons={pathLessons}
                  removable
                  removeLesson={(lessonId) =>
                    setPathLessons((items) => items.filter((lesson) => lesson.id !== lessonId))
                  }
                  title="Student path"
                />
              </div>
            </DragDropContext>
          </Panel>

          <Panel title="Progress snapshot">
            <div className="grid gap-3">
              {students.length === 0 ? (
                <p className="text-sm text-muted">No students yet.</p>
              ) : (
                students.map((student) => (
                  <StudentProgress key={student.id} student={student} />
                ))
              )}
            </div>
          </Panel>

          <Panel title="Assignments and grading">
            <form className="mb-5 grid gap-3" onSubmit={handleCreateAssignment}>
              <Select name="courseId" required>
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.subject.name} / {course.title}
                  </option>
                ))}
              </Select>
              <Select name="lessonId">
                <option value="">Optional lesson</option>
                {lessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title}
                  </option>
                ))}
              </Select>
              <Input name="title" placeholder="Assignment title" required />
              <Input name="description" placeholder="Instructions" />
              <div className="grid gap-3 sm:grid-cols-3">
                <Select name="type" defaultValue="assignment">
                  <option value="assignment">Assignment</option>
                  <option value="test">Test</option>
                </Select>
                <Input name="deadline" type="datetime-local" />
                <Input name="maxScore" defaultValue="10" min="1" type="number" />
              </div>
              <Button disabled={loading}>Create assignment</Button>
            </form>

            <div className="space-y-3">
              {assignments.length === 0 ? (
                <p className="text-sm text-muted">No assignments yet.</p>
              ) : (
                assignments.map((assignment) => (
                  <div className="rounded-md border border-line bg-surface p-3 text-sm" key={assignment.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{assignment.title}</p>
                        <p className="mt-1 text-xs text-muted">
                          {assignment.course?.title ?? "General"} · {assignment.submissions.length} submissions
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {assignment.submissions.map((submission) => (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2" key={submission.id}>
                          <span>{submission.student.fullName} · {submission.status} · {submission.score ?? "-"}/{assignment.maxScore ?? 10}</span>
                          <button className="text-xs font-medium text-brand" onClick={() => handleGrade(assignment, submission.student)} type="button">
                            Grade
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </section>
      </div>
    </AppShell>
  );
}

function QuestionEditor({
  index,
  question,
  setQuestion,
  removeQuestion
}: {
  index: number;
  question: Question;
  setQuestion: (question: Question) => void;
  removeQuestion: () => void;
}) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Question {index + 1}</span>
        <button className="text-sm font-medium text-red-600" onClick={removeQuestion} type="button">
          Remove
        </button>
      </div>
      <div className="grid gap-2">
        <Select
          onChange={(event) =>
            setQuestion({ ...question, questionType: event.target.value as QuestionType })
          }
          value={question.questionType}
        >
          <option value="multiple_choice">Multiple choice</option>
          <option value="short_answer">Short answer</option>
        </Select>
        <Input
          onChange={(event) => setQuestion({ ...question, content: event.target.value })}
          placeholder="Question content"
          value={question.content}
        />
        {question.questionType === "multiple_choice" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {(["optionA", "optionB", "optionC", "optionD"] as const).map((key) => (
              <Input
                key={key}
                onChange={(event) => setQuestion({ ...question, [key]: event.target.value })}
                placeholder={key.replace("option", "Option ")}
                value={question[key] ?? ""}
              />
            ))}
            <Select
              onChange={(event) => setQuestion({ ...question, correctAnswer: event.target.value })}
              value={question.correctAnswer}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </Select>
          </div>
        ) : (
          <Input
            onChange={(event) => setQuestion({ ...question, correctAnswer: event.target.value })}
            placeholder="Accepted answers separated by ;"
            value={question.correctAnswer}
          />
        )}
      </div>
    </div>
  );
}

function LessonColumn({
  droppableId,
  lessons,
  removable = false,
  removeLesson,
  title
}: {
  droppableId: string;
  lessons: Lesson[];
  removable?: boolean;
  removeLesson?: (lessonId: number) => void;
  title: string;
}) {
  return (
    <Droppable droppableId={droppableId}>
      {(provided) => (
        <div
          className="min-h-80 rounded-md border border-line bg-surface p-3"
          ref={provided.innerRef}
          {...provided.droppableProps}
        >
          <h3 className="mb-3 text-sm font-semibold">{title}</h3>
          <div className="space-y-2">
            {lessons.map((lesson, index) => (
              <Draggable draggableId={`${droppableId}-${lesson.id}`} index={index} key={lesson.id}>
                {(dragProvided) => (
                  <div
                    className="rounded-md border border-line bg-white p-3 text-sm"
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{lesson.title}</p>
                        <p className="mt-1 text-xs text-muted">
                          {lesson.course.subject.name} / {lesson.course.title}
                        </p>
                      </div>
                      {removable ? (
                        <button
                          className="text-xs font-medium text-red-600"
                          onClick={() => removeLesson?.(lesson.id)}
                          type="button"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
}

function StudentProgress({ student }: { student: Student }) {
  const [stats, setStats] = useState<{ completedLessons: number; assignedLessons: number; xp: number } | null>(
    null
  );

  useEffect(() => {
    apiRequest<{ stats: { completedLessons: number; assignedLessons: number; xp: number } }>(
      `/users/students/${student.id}/progress`
    )
      .then((data) => setStats(data.stats))
      .catch(() => setStats(null));
  }, [student.id]);

  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
      <p className="font-medium">{student.fullName}</p>
      <p className="mt-1 text-muted">
        {stats ? `${stats.completedLessons}/${stats.assignedLessons} lessons · ${stats.xp} XP` : "Loading"}
      </p>
    </div>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand ${
        props.className ?? ""
      }`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand ${
        props.className ?? ""
      }`}
    />
  );
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70 ${
        props.className ?? ""
      }`}
    />
  );
}
