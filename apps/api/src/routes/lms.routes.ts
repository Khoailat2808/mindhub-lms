import bcrypt from "bcrypt";
import { Router } from "express";
import type { AssignmentQuestion, Prisma, Question } from "@prisma/client";
import { isQuestionType, isVideoType, type QuestionType } from "@lms/shared";

import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import {
  requireAuth,
  requireRoles,
  signAuthToken,
  type AuthenticatedRequest,
  type AuthenticatedUser
} from "../middlewares/auth.js";
import { sensitiveRouteRateLimit } from "../middlewares/security.js";
import { gradeAnswers } from "../utils/grade.js";
import { HttpError } from "../utils/http-error.js";
import { storeQuestionImage, type StoredQuestionImage } from "../utils/question-image-storage.js";
import { toPublicUploadPath, uploadAssignmentFiles, uploadLessonFiles } from "../utils/uploads.js";

export const lmsRoutes = Router();

const teacherRoles = requireRoles("teacher", "coach", "admin");
const studentListSelect = {
  id: true,
  username: true,
  email: true,
  fullName: true,
  role: true
} satisfies Prisma.UserSelect;

function isTeacherRole(role: string | undefined) {
  return role === "teacher" || role === "coach";
}

function teachingCourseWhere(user: AuthenticatedUser | undefined): Prisma.CourseWhereInput | undefined {
  if (!user || user.role === "admin") {
    return undefined;
  }

  if (isTeacherRole(user.role)) {
    return { teacherName: user.fullName };
  }

  return { id: -1 };
}

function studentVisibilityWhere(user: AuthenticatedUser | undefined): Prisma.UserWhereInput {
  if (!user || user.role === "admin") {
    return { role: "student" };
  }

  if (isTeacherRole(user.role)) {
    return {
      role: "student",
      OR: [
        {
          assignedLessons: {
            some: {
              lesson: {
                course: {
                  teacherName: user.fullName
                }
              }
            }
          }
        },
        {
          courseEnrollments: {
            some: {
              course: {
                teacherName: user.fullName
              }
            }
          }
        }
      ]
    };
  }

  return { id: user.id, role: "student" };
}

function studentDirectoryWhere(user: AuthenticatedUser | undefined): Prisma.UserWhereInput {
  if (!user || user.role === "admin" || isTeacherRole(user.role)) {
    return { role: "student" };
  }

  return { id: user.id, role: "student" };
}

async function assertCanAccessStudent(user: AuthenticatedUser | undefined, studentId: number) {
  if (!user) {
    throw new HttpError(401, "Authentication required.");
  }

  if (user.role === "admin" || (user.role === "student" && user.id === studentId)) {
    return;
  }

  if (isTeacherRole(user.role)) {
    const [assigned, enrolled] = await Promise.all([
      prisma.learningPath.count({
        where: { studentId, lesson: { course: { teacherName: user.fullName } } }
      }),
      prisma.courseStudent.count({
        where: { studentId, course: { teacherName: user.fullName } }
      })
    ]);
    if (assigned > 0 || enrolled > 0) {
      return;
    }
  }

  throw new HttpError(403, "You do not have access to this student.");
}

function asyncRoute<TRequest extends AuthenticatedRequest = AuthenticatedRequest>(
  handler: (request: TRequest, response: import("express").Response) => Promise<void>
) {
  return (request: TRequest, response: import("express").Response, next: import("express").NextFunction) => {
    handler(request, response).catch(next);
  };
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${field} is required.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function userDto(user: {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
}): AuthenticatedUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role as AuthenticatedUser["role"]
  };
}

function parsePositiveInt(value: unknown, field: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${field} must be a positive integer.`);
  }

  return parsed;
}

function parseOptionalPositiveInt(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parsePagination(query: { page?: unknown; pageSize?: unknown }) {
  const pageValue = Number(query.page ?? 1);
  const pageSizeValue = Number(query.pageSize ?? 10);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const pageSize = Number.isInteger(pageSizeValue)
    ? Math.min(Math.max(pageSizeValue, 1), 30)
    : 10;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize
  };
}

function paginatedResponse<T>(items: T[], total: number, page: number, pageSize: number) {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

function parseJsonArray<T>(value: unknown, field: string): T[] {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a JSON array.`);
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Not array");
    }

    return parsed as T[];
  } catch {
    throw new HttpError(400, `${field} must be a valid JSON array.`);
  }
}

function parseStudentIds(body: Record<string, unknown>) {
  if (!Object.prototype.hasOwnProperty.call(body, "studentIds")) {
    return undefined;
  }

  const studentIds = parseJsonArray<number>(body.studentIds, "studentIds").map((id) =>
    parsePositiveInt(id, "studentId")
  );

  if (new Set(studentIds).size !== studentIds.length) {
    throw new HttpError(400, "studentIds cannot contain duplicate students.");
  }

  return studentIds;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value === "true" ? true : value === "false" ? false : fallback;
  }

  return fallback;
}

async function validateStudentIds(tx: Prisma.TransactionClient, studentIds: number[]) {
  if (studentIds.length === 0) {
    return;
  }

  const students = await tx.user.findMany({
    where: { id: { in: studentIds }, role: "student" },
    select: { id: true }
  });
  const validIds = new Set(students.map((student) => student.id));
  const invalidIds = studentIds.filter((id) => !validIds.has(id));

  if (invalidIds.length > 0) {
    throw new HttpError(400, "studentIds must only contain existing student users.");
  }
}

async function syncCourseStudents(
  tx: Prisma.TransactionClient,
  courseId: number,
  studentIds: number[] | undefined,
  assignedBy: number
) {
  if (studentIds === undefined) {
    return;
  }

  await validateStudentIds(tx, studentIds);

  const existing = await tx.courseStudent.findMany({
    where: { courseId },
    select: { studentId: true }
  });
  const existingIds = new Set(existing.map((item) => item.studentId));
  const nextIds = new Set(studentIds);
  const toRemove = existing.filter((item) => !nextIds.has(item.studentId)).map((item) => item.studentId);
  const toAdd = studentIds.filter((studentId) => !existingIds.has(studentId));

  if (toRemove.length > 0) {
    await tx.courseStudent.deleteMany({ where: { courseId, studentId: { in: toRemove } } });
  }

  for (const studentId of toAdd) {
    await tx.courseStudent.create({ data: { courseId, studentId, assignedBy } });
  }
}

function validateVideo(videoType: string, videoUrl: string | null, videoFile?: Express.Multer.File) {
  if (!isVideoType(videoType)) {
    throw new HttpError(400, "Invalid video type.");
  }

  if (videoType === "upload") {
    if (!videoFile) {
      throw new HttpError(400, "Video file is required for upload video type.");
    }
    return toPublicUploadPath(videoFile.path);
  }

  if (!videoUrl) {
    throw new HttpError(400, "Video URL is required.");
  }

  if (videoType === "youtube" && !/(youtube\.com\/watch\?v=|youtu\.be\/)/i.test(videoUrl)) {
    throw new HttpError(400, "YouTube URL must contain youtube.com/watch?v= or youtu.be/.");
  }

  if (videoType === "google_drive" && !/drive\.google\.com\/file\/d\/[^/]+/i.test(videoUrl)) {
    throw new HttpError(400, "Google Drive URL must contain drive.google.com/file/d/FILE_ID/.");
  }

  return null;
}

type QuestionImageLookup = Map<number, StoredQuestionImage>;

function imageForQuestion(question: Record<string, unknown>, images: QuestionImageLookup) {
  const imageUploadIndex = parseOptionalPositiveInt(question.imageUploadIndex);
  const uploaded = imageUploadIndex ? images.get(imageUploadIndex) : undefined;
  const existingImageUrl = optionalString(question.imageUrl);

  return {
    imageUrl: uploaded?.imageUrl ?? existingImageUrl,
    imagePublicId: uploaded?.imagePublicId ?? optionalString(question.imagePublicId),
    imageOriginalName: uploaded?.imageOriginalName ?? optionalString(question.imageOriginalName),
    imageMimeType: uploaded?.imageMimeType ?? optionalString(question.imageMimeType)
  };
}

function validateQuestions(rawQuestions: unknown[], images: QuestionImageLookup = new Map()) {
  if (rawQuestions.length > 20) {
    throw new HttpError(400, "Each lesson can have at most 20 questions.");
  }

  return rawQuestions.map((raw, index) => {
    const question = raw as Record<string, unknown>;
    const questionType = requireString(question.questionType, "questionType");

    if (!isQuestionType(questionType)) {
      throw new HttpError(400, "Invalid question type.");
    }

    const content = optionalString(question.content);
    const image = imageForQuestion(question, images);
    if (!content && !image.imageUrl) {
      throw new HttpError(400, "Question must include text or an image.");
    }

    const correctAnswer = requireString(question.correctAnswer, "correctAnswer");
    const explanation = optionalString(question.explanation);
    const score = parseOptionalPositiveInt(question.score) ?? 1;

    if (questionType === "multiple_choice") {
      const options = {
        optionA: requireString(question.optionA, "optionA"),
        optionB: requireString(question.optionB, "optionB"),
        optionC: optionalString(question.optionC),
        optionD: optionalString(question.optionD)
      };
      const correctKey = correctAnswer.toUpperCase();
      const correctOption = options[`option${correctKey}` as keyof typeof options];
      if (!["A", "B", "C", "D"].includes(correctKey) || !correctOption) {
        throw new HttpError(400, "Correct answer must point to a non-empty option.");
      }

      return {
        questionType,
        content,
        ...image,
        ...options,
        correctAnswer: correctKey,
        explanation,
        score,
        orderIndex: index + 1
      };
    }

    return {
      questionType,
      content,
      ...image,
      optionA: null,
      optionB: null,
      optionC: null,
      optionD: null,
      correctAnswer,
      explanation,
      score,
      orderIndex: index + 1
    };
  });
}

function getUploadedFiles(request: AuthenticatedRequest) {
  const files = request.files as
    | {
        videoFile?: Express.Multer.File[];
        materials?: Express.Multer.File[];
        questionImages?: Express.Multer.File[];
      }
    | undefined;

  return {
    videoFile: files?.videoFile?.[0],
    materials: files?.materials ?? [],
    questionImages: files?.questionImages ?? []
  };
}

async function buildQuestionImageLookup(files: Express.Multer.File[]) {
  const maxBytes = env.maxQuestionImageUploadMb * 1024 * 1024;
  for (const file of files) {
    if (file.size > maxBytes) {
      throw new HttpError(400, `Question image ${file.originalname} exceeds ${env.maxQuestionImageUploadMb}MB.`);
    }
  }

  const entries = await Promise.all(
    files.map(async (file, index) => [index + 1, await storeQuestionImage(file)] as const)
  );

  return new Map(entries);
}

function assertMaterialLimits(existingBytes: number, files: Express.Multer.File[]) {
  const maxFileBytes = env.maxMaterialUploadMb * 1024 * 1024;
  const maxTotalBytes = env.maxLessonMaterialsTotalMb * 1024 * 1024;

  for (const file of files) {
    if (file.size > maxFileBytes) {
      throw new HttpError(400, `Material ${file.originalname} exceeds ${env.maxMaterialUploadMb}MB.`);
    }
  }

  const newBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (existingBytes + newBytes > maxTotalBytes) {
    throw new HttpError(400, `Lesson materials exceed ${env.maxLessonMaterialsTotalMb}MB total.`);
  }
}

function lessonInclude() {
  return {
    course: { include: { subject: true } },
    questions: true,
    materials: true
  } satisfies Prisma.LessonInclude;
}

function courseInclude() {
  return {
    subject: true,
    lessons: true,
    enrollments: {
      orderBy: { createdAt: "asc" as const },
      include: { student: { select: studentListSelect } }
    }
  } satisfies Prisma.CourseInclude;
}

function courseDto<TCourse extends { enrollments?: { student: { id: number } }[] }>(course: TCourse) {
  const students = course.enrollments?.map((enrollment) => enrollment.student) ?? [];

  return {
    ...course,
    enrollments: undefined,
    students,
    studentIds: students.map((student) => student.id)
  };
}

function hideCorrectAnswers<TLesson extends { questions?: Question[] }>(lesson: TLesson) {
  return {
    ...lesson,
    questions:
      lesson.questions?.map(({ correctAnswer: _correctAnswer, explanation: _explanation, ...question }) => question) ??
      []
  };
}

function hideAssignmentCorrectAnswers<TAssignment extends { questions?: AssignmentQuestion[] }>(assignment: TAssignment) {
  return {
    ...assignment,
    questions: assignment.questions?.map(({ correctAnswer: _correctAnswer, explanation: _explanation, ...question }) => question) ?? []
  };
}

function hidePathCorrectAnswers<TPath extends { lesson: { questions?: Question[] } }>(path: TPath[]) {
  return path.map((item) => ({
    ...item,
    lesson: hideCorrectAnswers(item.lesson)
  }));
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfYesterday() {
  const date = startOfToday();
  date.setDate(date.getDate() - 1);
  return date;
}

function sameCalendarDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

async function createUserWithRole(input: {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role: "teacher" | "coach" | "student";
}) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: input.username }, { email: input.email }] },
    select: { id: true }
  });

  if (existing) {
    throw new HttpError(409, "Username or email is already in use.");
  }

  const passwordHash = await bcrypt.hash(input.password, env.bcryptSaltRounds);
  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: input.role
    }
  });

  if (input.role === "student") {
    await prisma.streak.create({ data: { studentId: user.id } });
  }

  return user;
}

async function updateStreak(studentId: number) {
  const today = startOfToday();
  const yesterday = startOfYesterday();
  const streak = await prisma.streak.upsert({
    where: { studentId },
    update: {},
    create: { studentId, currentStreak: 0, longestStreak: 0 }
  });

  if (streak.lastCompletedDate && sameCalendarDay(streak.lastCompletedDate, today)) {
    return streak;
  }

  const nextCurrent =
    streak.lastCompletedDate && sameCalendarDay(streak.lastCompletedDate, yesterday)
      ? streak.currentStreak + 1
      : 1;

  return prisma.streak.update({
    where: { studentId },
    data: {
      currentStreak: nextCurrent,
      longestStreak: Math.max(streak.longestStreak, nextCurrent),
      lastCompletedDate: new Date()
    }
  });
}

async function studentStats(studentId: number) {
  const [availablePath, completed, streak] = await Promise.all([
    studentAvailablePath(studentId),
    prisma.studentLessonProgress.findMany({
      where: { studentId, completed: true },
      select: { score: true, totalQuestions: true }
    }),
    prisma.streak.findUnique({ where: { studentId } })
  ]);

  const totalScore = completed.reduce((sum, progress) => sum + (progress.score ?? 0), 0);
  const totalQuestions = completed.reduce((sum, progress) => sum + (progress.totalQuestions ?? 0), 0);
  const currentStreak = streak?.currentStreak ?? 0;

  return {
    assignedLessons: availablePath.length,
    completedLessons: completed.length,
    averageScore: totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0,
    currentStreak,
    longestStreak: streak?.longestStreak ?? 0,
    xp: completed.length * 10 + currentStreak * 5
  };
}

lmsRoutes.post(
  "/auth/login",
  sensitiveRouteRateLimit,
  asyncRoute(async (request, response) => {
    const username = requireString(request.body.username, "username");
    const password = requireString(request.body.password, "password");
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, "Invalid username or password.");
    }

    const dto = userDto(user);
    response.json({ token: signAuthToken(dto), user: dto });
  })
);

lmsRoutes.get(
  "/auth/me",
  requireAuth,
  asyncRoute(async (request, response) => {
    response.json({ user: request.user });
  })
);

lmsRoutes.post(
  "/auth/coaches",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (request, response) => {
    const user = await createUserWithRole({
      username: requireString(request.body.username, "username"),
      email: requireString(request.body.email, "email"),
      password: requireString(request.body.password, "password"),
      fullName: requireString(request.body.fullName, "fullName"),
      role: "teacher"
    });

    response.status(201).json({ user: userDto(user) });
  })
);

lmsRoutes.post(
  "/auth/teachers",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (request, response) => {
    const user = await createUserWithRole({
      username: requireString(request.body.username, "username"),
      email: requireString(request.body.email, "email"),
      password: requireString(request.body.password, "password"),
      fullName: requireString(request.body.fullName, "fullName"),
      role: "teacher"
    });

    response.status(201).json({ user: userDto(user) });
  })
);

lmsRoutes.post(
  "/auth/students",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (request, response) => {
    const user = await createUserWithRole({
      username: requireString(request.body.username, "username"),
      email: requireString(request.body.email, "email"),
      password: requireString(request.body.password, "password"),
      fullName: requireString(request.body.fullName, "fullName"),
      role: "student"
    });

    response.status(201).json({ user: userDto(user) });
  })
);

lmsRoutes.get(
  "/users/students",
  requireAuth,
  teacherRoles,
  asyncRoute(async (request, response) => {
    const students = await prisma.user.findMany({
      where: studentDirectoryWhere(request.user),
      orderBy: { fullName: "asc" },
      select: studentListSelect
    });

    response.json({ students });
  })
);

lmsRoutes.get(
  "/users/students/:studentId/progress",
  requireAuth,
  teacherRoles,
  asyncRoute(async (request, response) => {
    const studentId = parsePositiveInt(request.params.studentId, "studentId");
    await assertCanAccessStudent(request.user, studentId);
    const [student, stats, path] = await Promise.all([
      prisma.user.findUnique({
        where: { id: studentId },
        select: { id: true, username: true, email: true, fullName: true, role: true }
      }),
      studentStats(studentId),
      prisma.learningPath.findMany({
        where: { studentId },
        orderBy: { orderIndex: "asc" },
        include: { lesson: { include: lessonInclude() } }
      })
    ]);

    if (!student || student.role !== "student") {
      throw new HttpError(404, "Student not found.");
    }

    const progress = await prisma.studentLessonProgress.findMany({ where: { studentId } });
    response.json({ student, stats, path, progress });
  })
);

lmsRoutes.get(
  "/subjects",
  requireAuth,
  asyncRoute(async (_request, response) => {
    const subjects = await prisma.subject.findMany({
      orderBy: { name: "asc" },
      include: { courses: true }
    });
    response.json({ subjects });
  })
);

lmsRoutes.post(
  "/subjects",
  requireAuth,
  teacherRoles,
  asyncRoute(async (request, response) => {
    const subject = await prisma.subject.create({
      data: { name: requireString(request.body.name, "name") }
    });
    response.status(201).json({ subject });
  })
);

lmsRoutes.get(
  "/courses",
  requireAuth,
  asyncRoute(async (request, response) => {
    const subjectId = parseOptionalPositiveInt(request.query.subjectId);
    const scope = teachingCourseWhere(request.user);
    const where: Prisma.CourseWhereInput = {
      ...(scope ?? {}),
      ...(subjectId ? { subjectId } : {})
    };
    const courses = await prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: courseInclude()
    });
    response.json({ courses: courses.map(courseDto) });
  })
);

lmsRoutes.post(
  "/courses",
  requireAuth,
  teacherRoles,
  asyncRoute(async (request, response) => {
    const studentIds = parseStudentIds(request.body);
    const course = await prisma.$transaction(async (tx) => {
      const created = await tx.course.create({
        data: {
          subjectId: parseOptionalPositiveInt(request.body.subjectId),
          title: requireString(request.body.title, "title"),
          description: optionalString(request.body.description),
          teacherName:
            request.user?.role === "admin"
              ? optionalString(request.body.teacherName) ?? request.user?.fullName ?? null
              : request.user?.fullName ?? null
        }
      });

      await syncCourseStudents(tx, created.id, studentIds, request.user!.id);

      return tx.course.findUnique({
        where: { id: created.id },
        include: courseInclude()
      });
    });
    response.status(201).json({ course: courseDto(course!) });
  })
);

lmsRoutes.patch(
  "/courses/:courseId",
  requireAuth,
  teacherRoles,
  asyncRoute(async (request, response) => {
    const courseId = parsePositiveInt(request.params.courseId, "courseId");
    const course = await prisma.course.findFirst({
      where: { id: courseId, ...(teachingCourseWhere(request.user) ?? {}) }
    });

    if (!course) {
      throw new HttpError(404, "Course not found.");
    }

    const studentIds = parseStudentIds(request.body);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id: courseId },
        data: {
          subjectId: parseOptionalPositiveInt(request.body.subjectId) ?? course.subjectId,
          title: optionalString(request.body.title) ?? course.title,
          description: optionalString(request.body.description) ?? course.description,
          teacherName:
            request.user?.role === "admin"
              ? optionalString(request.body.teacherName) ?? course.teacherName
              : course.teacherName
        }
      });

      await syncCourseStudents(tx, courseId, studentIds, request.user!.id);

      return tx.course.findUnique({
        where: { id: courseId },
        include: courseInclude()
      });
    });

    response.json({ course: courseDto(updated!) });
  })
);

lmsRoutes.delete(
  "/courses/:courseId",
  requireAuth,
  teacherRoles,
  asyncRoute(async (request, response) => {
    const courseId = parsePositiveInt(request.params.courseId, "courseId");
    const course = await prisma.course.findFirst({
      where: { id: courseId, ...(teachingCourseWhere(request.user) ?? {}) },
      include: { lessons: true, assignments: true }
    });

    if (!course) {
      throw new HttpError(404, "Course not found.");
    }

    if (course.lessons.length > 0 || course.assignments.length > 0) {
      throw new HttpError(409, "Cannot delete a course that already has lessons or assignments.");
    }

    await prisma.course.delete({ where: { id: courseId } });
    response.status(204).send();
  })
);

lmsRoutes.get(
  "/lessons",
  requireAuth,
  asyncRoute(async (request, response) => {
    const courseId = parseOptionalPositiveInt(request.query.courseId);
    const subjectId = parseOptionalPositiveInt(request.query.subjectId);
    const courseScope = teachingCourseWhere(request.user);
    const lessons = await prisma.lesson.findMany({
      where: {
        isActive: true,
        ...(courseId ? { courseId } : {}),
        ...(courseScope || subjectId
          ? { course: { ...(courseScope ?? {}), ...(subjectId ? { subjectId } : {}) } }
          : {})
      },
      orderBy: { createdAt: "desc" },
      include: lessonInclude()
    });
    response.json({ lessons });
  })
);

lmsRoutes.get(
  "/lessons/:lessonId",
  requireAuth,
  asyncRoute(async (request, response) => {
    const lesson = await prisma.lesson.findUnique({
      where: { id: parsePositiveInt(request.params.lessonId, "lessonId") },
      include: lessonInclude()
    });

    if (!lesson || !lesson.isActive) {
      throw new HttpError(404, "Lesson not found.");
    }

    response.json({ lesson });
  })
);

lmsRoutes.post(
  "/lessons",
  requireAuth,
  teacherRoles,
  uploadLessonFiles.fields([
    { name: "videoFile", maxCount: 1 },
    { name: "materials", maxCount: 10 },
    { name: "questionImages", maxCount: 20 }
  ]),
  asyncRoute(async (request, response) => {
    const files = getUploadedFiles(request);
    assertMaterialLimits(0, files.materials);

    const courseId = parsePositiveInt(request.body.courseId, "courseId");
    const course = await prisma.course.findFirst({
      where: { id: courseId, ...(teachingCourseWhere(request.user) ?? {}) }
    });
    if (!course) {
      throw new HttpError(404, "Course not found.");
    }

    const videoType = requireString(request.body.videoType, "videoType");
    const videoUrl = optionalString(request.body.videoUrl);
    const videoFilePath = validateVideo(videoType, videoUrl, files.videoFile);
    const questionImages = await buildQuestionImageLookup(files.questionImages);
    const questions = validateQuestions(
      parseJsonArray<Record<string, unknown>>(request.body.questions, "questions"),
      questionImages
    );

    const lesson = await prisma.lesson.create({
      data: {
        courseId,
        title: requireString(request.body.title, "title"),
        description: optionalString(request.body.description),
        videoType,
        videoUrl,
        videoFilePath,
        questions: { create: questions },
        materials: {
          create: files.materials.map((file) => ({
            originalName: file.originalname,
            fileName: file.filename,
            filePath: toPublicUploadPath(file.path),
            mimeType: file.mimetype,
            size: file.size
          }))
        }
      },
      include: lessonInclude()
    });

    response.status(201).json({ lesson });
  })
);

lmsRoutes.patch(
  "/lessons/:lessonId",
  requireAuth,
  teacherRoles,
  uploadLessonFiles.fields([
    { name: "videoFile", maxCount: 1 },
    { name: "materials", maxCount: 10 },
    { name: "questionImages", maxCount: 20 }
  ]),
  asyncRoute(async (request, response) => {
    const lessonId = parsePositiveInt(request.params.lessonId, "lessonId");
    const existing = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { materials: true, course: true }
    });

    if (
      !existing ||
      (request.user?.role !== "admin" &&
        isTeacherRole(request.user?.role) &&
        existing.course.teacherName !== request.user?.fullName)
    ) {
      throw new HttpError(404, "Lesson not found.");
    }

    const files = getUploadedFiles(request);
    assertMaterialLimits(
      existing.materials.reduce((sum, material) => sum + material.size, 0),
      files.materials
    );

    const videoType = optionalString(request.body.videoType) ?? existing.videoType ?? "youtube";
    const videoUrl = optionalString(request.body.videoUrl) ?? existing.videoUrl;
    const videoFilePath = files.videoFile
      ? validateVideo(videoType, videoUrl, files.videoFile)
      : existing.videoFilePath;
    const rawQuestions = parseJsonArray<Record<string, unknown>>(request.body.questions, "questions");
    const questionImages = await buildQuestionImageLookup(files.questionImages);
    const questions = rawQuestions.length > 0 ? validateQuestions(rawQuestions, questionImages) : null;

    const lesson = await prisma.$transaction(async (tx) => {
      if (questions) {
        await tx.question.deleteMany({ where: { lessonId } });
      }

      return tx.lesson.update({
        where: { id: lessonId },
        data: {
          title: optionalString(request.body.title) ?? existing.title,
          description: optionalString(request.body.description) ?? existing.description,
          videoType,
          videoUrl,
          videoFilePath,
          ...(questions ? { questions: { create: questions } } : {}),
          materials: {
            create: files.materials.map((file) => ({
              originalName: file.originalname,
              fileName: file.filename,
              filePath: toPublicUploadPath(file.path),
              mimeType: file.mimetype,
              size: file.size
            }))
          }
        },
        include: lessonInclude()
      });
    });

    response.json({ lesson });
  })
);

lmsRoutes.delete(
  "/lessons/:lessonId",
  requireAuth,
  teacherRoles,
  asyncRoute(async (request, response) => {
    const lessonId = parsePositiveInt(request.params.lessonId, "lessonId");
    const existing = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { course: true } });
    if (
      !existing ||
      (request.user?.role !== "admin" &&
        isTeacherRole(request.user?.role) &&
        existing.course.teacherName !== request.user?.fullName)
    ) {
      throw new HttpError(404, "Lesson not found.");
    }

    const hasProgress = await prisma.studentLessonProgress.count({ where: { lessonId } });

    if (hasProgress > 0) {
      const lesson = await prisma.lesson.update({
        where: { id: lessonId },
        data: { isActive: false }
      });
      response.json({ lesson, softDeleted: true });
      return;
    }

    await prisma.lesson.delete({ where: { id: lessonId } });
    response.status(204).send();
  })
);

lmsRoutes.get(
  "/learning-paths/:studentId",
  requireAuth,
  asyncRoute(async (request, response) => {
    const studentId = parsePositiveInt(request.params.studentId, "studentId");

    await assertCanAccessStudent(request.user, studentId);

    const path = await prisma.learningPath.findMany({
      where: { studentId },
      orderBy: { orderIndex: "asc" },
      include: { lesson: { include: lessonInclude() } }
    });

    response.json({ path: request.user?.role === "student" ? hidePathCorrectAnswers(path) : path });
  })
);

lmsRoutes.put(
  "/learning-paths/:studentId",
  requireAuth,
  teacherRoles,
  asyncRoute(async (request, response) => {
    const studentId = parsePositiveInt(request.params.studentId, "studentId");
    if (request.user?.role !== "admin") {
      const student = await prisma.user.findUnique({ where: { id: studentId } });
      if (!student || student.role !== "student") {
        throw new HttpError(404, "Student not found.");
      }
    }
    const lessonIds = parseJsonArray<number>(request.body.lessonIds, "lessonIds").map((id) =>
      parsePositiveInt(id, "lessonId")
    );

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student || student.role !== "student") {
      throw new HttpError(404, "Student not found.");
    }

    if (request.user?.role !== "admin") {
      await assertCanAccessStudent(request.user, studentId);
    }

    if (new Set(lessonIds).size !== lessonIds.length) {
      throw new HttpError(400, "Learning path cannot contain duplicate lessons.");
    }

    if (request.user?.role !== "admin") {
      const allowedLessons = await prisma.lesson.count({
        where: { id: { in: lessonIds }, course: { teacherName: request.user?.fullName } }
      });

      if (allowedLessons !== lessonIds.length) {
        throw new HttpError(403, "Teachers can only assign lessons from their own courses.");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.learningPath.deleteMany({ where: { studentId } });
      await tx.learningPath.createMany({
        data: lessonIds.map((lessonId, index) => ({
          studentId,
          lessonId,
          orderIndex: index + 1,
          assignedBy: request.user!.id
        }))
      });
    });

    const path = await prisma.learningPath.findMany({
      where: { studentId },
      orderBy: { orderIndex: "asc" },
      include: { lesson: { include: lessonInclude() } }
    });

    response.json({ path });
  })
);

lmsRoutes.get(
  "/admin/overview",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (_request, response) => {
    const [users, subjects, courses, lessons, assignments, submissions] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: { role: true } }),
      prisma.subject.count(),
      prisma.course.count(),
      prisma.lesson.count({ where: { isActive: true } }),
      prisma.assignment.count(),
      prisma.assignmentSubmission.count()
    ]);

    response.json({
      counts: {
        users: users.reduce<Record<string, number>>((map, item) => {
          map[item.role] = item._count.role;
          return map;
        }, {}),
        subjects,
        courses,
        lessons,
        assignments,
        submissions
      }
    });
  })
);

lmsRoutes.get(
  "/admin/users",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (request, response) => {
    const { page, pageSize, skip } = parsePagination(request.query);
    const role = optionalString(request.query.role);
    const search = optionalString(request.query.search);
    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(search
        ? {
            OR: [
              { username: { contains: search } },
              { email: { contains: search } },
              { fullName: { contains: search } }
            ]
          }
        : {})
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: { id: true, username: true, email: true, fullName: true, role: true, createdAt: true }
      })
    ]);

    response.json(paginatedResponse(users, total, page, pageSize));
  })
);

lmsRoutes.patch(
  "/admin/users/:userId",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (request, response) => {
    const userId = parsePositiveInt(request.params.userId, "userId");
    const existing = await prisma.user.findUnique({ where: { id: userId } });

    if (!existing) {
      throw new HttpError(404, "User not found.");
    }

    const role = optionalString(request.body.role) ?? existing.role;
    if (!["admin", "teacher", "coach", "student"].includes(role)) {
      throw new HttpError(400, "Invalid role.");
    }

    const password = optionalString(request.body.password);
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: optionalString(request.body.fullName) ?? existing.fullName,
        email: optionalString(request.body.email) ?? existing.email,
        role,
        ...(password ? { passwordHash: await bcrypt.hash(password, env.bcryptSaltRounds) } : {})
      },
      select: { id: true, username: true, email: true, fullName: true, role: true, createdAt: true }
    });

    if (role === "student") {
      await prisma.streak.upsert({
        where: { studentId: userId },
        update: {},
        create: { studentId: userId }
      });
    }

    response.json({ user });
  })
);

lmsRoutes.delete(
  "/admin/users/:userId",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (request, response) => {
    const userId = parsePositiveInt(request.params.userId, "userId");

    if (request.user?.id === userId) {
      throw new HttpError(400, "You cannot delete your own account.");
    }

    const relatedRecords = await Promise.all([
      prisma.learningPath.count({ where: { OR: [{ studentId: userId }, { assignedBy: userId }] } }),
      prisma.courseStudent.count({ where: { OR: [{ studentId: userId }, { assignedBy: userId }] } }),
      prisma.studentLessonProgress.count({ where: { studentId: userId } }),
      prisma.assignment.count({ where: { createdBy: userId } }),
      prisma.assignmentSubmission.count({ where: { studentId: userId } })
    ]);

    if (relatedRecords.some((count) => count > 0)) {
      throw new HttpError(409, "Cannot delete a user with learning or grading history.");
    }

    await prisma.user.delete({ where: { id: userId } });
    response.status(204).send();
  })
);

function assignmentIncludeForTeacher() {
  return {
    subject: true,
    course: { include: { subject: true } },
    lesson: true,
    questions: { orderBy: { orderIndex: "asc" as const } },
    submissions: {
      include: {
        student: { select: { id: true, username: true, email: true, fullName: true, role: true } }
      },
      orderBy: { updatedAt: "desc" as const }
    },
    creator: { select: { id: true, username: true, fullName: true, role: true } }
  } satisfies Prisma.AssignmentInclude;
}

function teacherAssignmentWhere(user: AuthenticatedUser | undefined): Prisma.AssignmentWhereInput {
  if (!user || user.role === "admin") {
    return {};
  }

  return {
    OR: [{ createdBy: user.id }, { course: { teacherName: user.fullName } }]
  };
}

async function studentAvailablePath(studentId: number) {
  const [path, enrollments] = await Promise.all([
    prisma.learningPath.findMany({
      where: { studentId, lesson: { isActive: true } },
      orderBy: { orderIndex: "asc" },
      include: { lesson: { include: lessonInclude() } }
    }),
    prisma.courseStudent.findMany({
      where: { studentId },
      orderBy: { createdAt: "asc" },
      include: {
        course: {
          include: {
            lessons: {
              where: { isActive: true },
              orderBy: { createdAt: "asc" },
              include: lessonInclude()
            }
          }
        }
      }
    })
  ]);

  const items = [...path];
  const seenLessonIds = new Set(path.map((item) => item.lessonId));

  for (const enrollment of enrollments) {
    for (const lesson of enrollment.course.lessons) {
      if (seenLessonIds.has(lesson.id)) {
        continue;
      }

      items.push({
        id: -lesson.id,
        studentId,
        lessonId: lesson.id,
        orderIndex: items.length + 1,
        assignedBy: enrollment.assignedBy ?? studentId,
        createdAt: enrollment.createdAt,
        updatedAt: enrollment.createdAt,
        lesson
      });
      seenLessonIds.add(lesson.id);
    }
  }

  return items;
}

async function studentCoursePath(studentId: number, courseId: number) {
  const [enrollment, path, lessons] = await Promise.all([
    prisma.courseStudent.findUnique({
      where: { courseId_studentId: { courseId, studentId } },
      select: { id: true, assignedBy: true, createdAt: true }
    }),
    prisma.learningPath.findMany({
      where: { studentId, lesson: { courseId, isActive: true } },
      orderBy: { orderIndex: "asc" },
      include: { lesson: { include: lessonInclude() } }
    }),
    prisma.lesson.findMany({
      where: { courseId, isActive: true },
      orderBy: { createdAt: "asc" },
      include: lessonInclude()
    })
  ]);

  if (!enrollment && path.length === 0) {
    throw new HttpError(403, "Course is not assigned to this student.");
  }

  if (!enrollment) {
    return path;
  }

  const items = [...path];
  const seenLessonIds = new Set(path.map((item) => item.lessonId));

  for (const lesson of lessons) {
    if (seenLessonIds.has(lesson.id)) {
      continue;
    }

    items.push({
      id: -lesson.id,
      studentId,
      lessonId: lesson.id,
      orderIndex: items.length + 1,
      assignedBy: enrollment.assignedBy ?? studentId,
      createdAt: enrollment.createdAt,
      updatedAt: enrollment.createdAt,
      lesson
    });
    seenLessonIds.add(lesson.id);
  }

  return items;
}

async function assertCanAccessStudentLesson(studentId: number, lessonId: number) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: lessonInclude()
  });

  if (!lesson || !lesson.isActive) {
    throw new HttpError(404, "Lesson not found.");
  }

  const [assigned, enrolled] = await Promise.all([
    prisma.learningPath.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
      select: { id: true }
    }),
    prisma.courseStudent.findUnique({
      where: { courseId_studentId: { courseId: lesson.courseId, studentId } },
      select: { id: true }
    })
  ]);

  if (!assigned && !enrolled) {
    throw new HttpError(403, "Lesson is not assigned to this student.");
  }

  return lesson;
}

lmsRoutes.get(
  "/teacher/dashboard",
  requireAuth,
  teacherRoles,
  asyncRoute(async (request, response) => {
    const courseScope = teachingCourseWhere(request.user);
    const assignmentScope = teacherAssignmentWhere(request.user);
    const [courses, lessons, students, assignments, submissions] = await Promise.all([
      prisma.course.findMany({
        where: courseScope,
        include: { subject: true, lessons: { where: { isActive: true } } },
        orderBy: { createdAt: "desc" },
        take: 12
      }),
      prisma.lesson.count({ where: { isActive: true, ...(courseScope ? { course: courseScope } : {}) } }),
      prisma.user.findMany({
        where: studentVisibilityWhere(request.user),
        orderBy: { fullName: "asc" },
        select: { id: true, username: true, email: true, fullName: true, role: true },
        take: 20
      }),
      prisma.assignment.findMany({
        where: assignmentScope,
        include: assignmentIncludeForTeacher(),
        orderBy: { createdAt: "desc" },
        take: 8
      }),
      prisma.assignmentSubmission.count({
        where: { assignment: assignmentScope, status: { in: ["submitted", "graded"] } }
      })
    ]);

    response.json({
      counts: {
        courses: courses.length,
        lessons,
        students: students.length,
        assignments: assignments.length,
        submissions
      },
      courses,
      students,
      assignments
    });
  })
);

lmsRoutes.get(
  "/assignments",
  requireAuth,
  teacherRoles,
  asyncRoute(async (request, response) => {
    const { page, pageSize, skip } = parsePagination(request.query);
    const search = optionalString(request.query.search);
    const where: Prisma.AssignmentWhereInput = {
      ...teacherAssignmentWhere(request.user),
      ...(search
        ? {
            AND: [
              {
                OR: [
                  { title: { contains: search } },
                  { description: { contains: search } },
                  { course: { title: { contains: search } } }
                ]
              }
            ]
          }
        : {})
    };

    const [total, assignments] = await Promise.all([
      prisma.assignment.count({ where }),
      prisma.assignment.findMany({
        where,
        include: assignmentIncludeForTeacher(),
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      })
    ]);

    response.json(paginatedResponse(assignments, total, page, pageSize));
  })
);

lmsRoutes.post(
  "/assignments",
  requireAuth,
  teacherRoles,
  uploadAssignmentFiles.fields([{ name: "questionImages", maxCount: 30 }]),
  asyncRoute(async (request, response) => {
    const files = getUploadedFiles(request);
    const courseId = parseOptionalPositiveInt(request.body.courseId);
    const lessonId = parseOptionalPositiveInt(request.body.lessonId);

    if (courseId) {
      const course = await prisma.course.findFirst({
        where: { id: courseId, ...(teachingCourseWhere(request.user) ?? {}) }
      });
      if (!course) {
        throw new HttpError(404, "Course not found.");
      }
    }

    if (!courseId) {
      throw new HttpError(400, "courseId is required.");
    }

    const questionImages = await buildQuestionImageLookup(files.questionImages);
    const questions = validateQuestions(
      parseJsonArray<Record<string, unknown>>(request.body.questions, "questions"),
      questionImages
    );

    const assignment = await prisma.assignment.create({
      data: {
        title: requireString(request.body.title, "title"),
        description: optionalString(request.body.description),
        type: optionalString(request.body.type) ?? "assignment",
        subjectId: parseOptionalPositiveInt(request.body.subjectId),
        courseId,
        lessonId,
        deadline: optionalString(request.body.deadline)
          ? new Date(requireString(request.body.deadline, "deadline"))
          : null,
        maxScore: parseOptionalPositiveInt(request.body.maxScore) ?? 10,
        createdBy: request.user!.id,
        isPublished: parseBoolean(request.body.isPublished, true),
        questions: { create: questions }
      },
      include: assignmentIncludeForTeacher()
    });

    response.status(201).json({ assignment });
  })
);

lmsRoutes.patch(
  "/assignments/:assignmentId",
  requireAuth,
  teacherRoles,
  uploadAssignmentFiles.fields([{ name: "questionImages", maxCount: 30 }]),
  asyncRoute(async (request, response) => {
    const files = getUploadedFiles(request);
    const assignmentId = parsePositiveInt(request.params.assignmentId, "assignmentId");
    const existing = await prisma.assignment.findFirst({
      where: { id: assignmentId, ...teacherAssignmentWhere(request.user) }
    });

    if (!existing) {
      throw new HttpError(404, "Assignment not found.");
    }

    const shouldReplaceQuestions = Object.prototype.hasOwnProperty.call(request.body, "questions");
    const questionImages = await buildQuestionImageLookup(files.questionImages);
    const questions = shouldReplaceQuestions
      ? validateQuestions(parseJsonArray<Record<string, unknown>>(request.body.questions, "questions"), questionImages)
      : null;

    const assignment = await prisma.$transaction(async (tx) => {
      if (questions) {
        await tx.assignmentQuestion.deleteMany({ where: { assignmentId } });
      }

      return tx.assignment.update({
        where: { id: assignmentId },
        data: {
          title: optionalString(request.body.title) ?? existing.title,
          description: optionalString(request.body.description) ?? existing.description,
          deadline: optionalString(request.body.deadline)
            ? new Date(requireString(request.body.deadline, "deadline"))
            : existing.deadline,
          maxScore: parseOptionalPositiveInt(request.body.maxScore) ?? existing.maxScore,
          isPublished: parseBoolean(request.body.isPublished, existing.isPublished),
          ...(questions ? { questions: { create: questions } } : {})
        },
        include: assignmentIncludeForTeacher()
      });
    });

    response.json({ assignment });
  })
);

lmsRoutes.delete(
  "/assignments/:assignmentId",
  requireAuth,
  teacherRoles,
  asyncRoute(async (request, response) => {
    const assignmentId = parsePositiveInt(request.params.assignmentId, "assignmentId");
    const existing = await prisma.assignment.findFirst({
      where: { id: assignmentId, ...teacherAssignmentWhere(request.user) },
      include: { submissions: true }
    });

    if (!existing) {
      throw new HttpError(404, "Assignment not found.");
    }

    if (existing.submissions.length > 0) {
      throw new HttpError(409, "Cannot delete an assignment that already has submissions.");
    }

    await prisma.assignment.delete({ where: { id: assignmentId } });
    response.status(204).send();
  })
);

lmsRoutes.post(
  "/assignments/:assignmentId/submissions/:studentId/grade",
  requireAuth,
  teacherRoles,
  asyncRoute(async (request, response) => {
    const assignmentId = parsePositiveInt(request.params.assignmentId, "assignmentId");
    const studentId = parsePositiveInt(request.params.studentId, "studentId");
    const assignment = await prisma.assignment.findFirst({
      where: { id: assignmentId, ...teacherAssignmentWhere(request.user) }
    });

    if (!assignment) {
      throw new HttpError(404, "Assignment not found.");
    }

    const score = Number(request.body.score);
    if (!Number.isFinite(score) || score < 0 || score > (assignment.maxScore ?? 10)) {
      throw new HttpError(400, "Score is out of range.");
    }

    const submission = await prisma.assignmentSubmission.update({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      data: {
        status: "graded",
        score,
        feedback: optionalString(request.body.feedback),
        gradedAt: new Date()
      },
      include: { student: { select: { id: true, username: true, fullName: true, email: true } } }
    });

    response.json({ submission });
  })
);

async function studentCourseAndLessonIds(studentId: number) {
  const [path, enrollments] = await Promise.all([
    prisma.learningPath.findMany({
      where: { studentId, lesson: { isActive: true } },
      select: { lessonId: true, lesson: { select: { courseId: true } } }
    }),
    prisma.courseStudent.findMany({
      where: { studentId },
      include: { course: { include: { lessons: { where: { isActive: true }, select: { id: true } } } } }
    })
  ]);
  const enrolledLessonIds = enrollments.flatMap((item) => item.course.lessons.map((lesson) => lesson.id));

  return {
    courseIds: Array.from(new Set([...path.map((item) => item.lesson.courseId), ...enrollments.map((item) => item.courseId)])),
    lessonIds: Array.from(new Set([...path.map((item) => item.lessonId), ...enrolledLessonIds]))
  };
}

async function getOrCreateStudentProfile(studentId: number) {
  return prisma.studentProfile.upsert({
    where: { studentId },
    update: {},
    create: {
      studentId,
      grade: "Lớp 10",
      learningGoals: "Hiểu sâu kiến thức nền tảng và duy trì thói quen học đều mỗi tuần.",
      preferredSubjects: "Toán,Vật lý,Hóa học"
    }
  });
}

async function assignmentScopeForStudent(studentId: number): Promise<Prisma.AssignmentWhereInput> {
  const { courseIds, lessonIds } = await studentCourseAndLessonIds(studentId);

  return {
    isPublished: true,
    OR: [
      { courseId: { in: courseIds.length > 0 ? courseIds : [-1] } },
      { lessonId: { in: lessonIds.length > 0 ? lessonIds : [-1] } },
      { submissions: { some: { studentId } } }
    ]
  };
}

function assignmentIncludeForStudent(studentId: number) {
  return {
    subject: true,
    course: { include: { subject: true } },
    lesson: true,
    questions: { orderBy: { orderIndex: "asc" as const } },
    submissions: { where: { studentId }, take: 1 }
  } satisfies Prisma.AssignmentInclude;
}

function toStudentAssignment<TAssignment extends {
  submissions: {
    status: string;
    score: number | null;
    feedback: string | null;
    submittedAt: Date | null;
    gradedAt: Date | null;
    answerText: string | null;
  }[];
  questions?: AssignmentQuestion[];
  deadline: Date | null;
}>(assignment: TAssignment) {
  const [submission] = assignment.submissions;
  const status = submission?.status ?? "not_started";

  return {
    ...assignment,
    questions: assignment.questions?.map(({ correctAnswer: _correctAnswer, explanation: _explanation, ...question }) => question) ?? [],
    submissions: undefined,
    submission: submission
      ? {
          status,
          score: submission.score,
          feedback: submission.feedback,
          submittedAt: submission.submittedAt,
          gradedAt: submission.gradedAt,
          answerText: submission.answerText
        }
      : null,
    studentStatus: status,
    overdue: !submission && assignment.deadline ? assignment.deadline < new Date() : false
  };
}

lmsRoutes.get(
  "/student/profile",
  requireAuth,
  requireRoles("student"),
  asyncRoute(async (request, response) => {
    const profile = await getOrCreateStudentProfile(request.user!.id);
    response.json({ user: request.user, profile });
  })
);

lmsRoutes.patch(
  "/student/profile",
  requireAuth,
  requireRoles("student"),
  asyncRoute(async (request, response) => {
    const studentId = request.user!.id;
    const profile = await prisma.studentProfile.upsert({
      where: { studentId },
      update: {
        avatarUrl: optionalString(request.body.avatarUrl),
        grade: optionalString(request.body.grade),
        schoolName: optionalString(request.body.schoolName),
        learningGoals: optionalString(request.body.learningGoals),
        targetScore: optionalString(request.body.targetScore),
        preferredSubjects: optionalString(request.body.preferredSubjects),
        parentPhone: optionalString(request.body.parentPhone)
      },
      create: {
        studentId,
        avatarUrl: optionalString(request.body.avatarUrl),
        grade: optionalString(request.body.grade),
        schoolName: optionalString(request.body.schoolName),
        learningGoals: optionalString(request.body.learningGoals),
        targetScore: optionalString(request.body.targetScore),
        preferredSubjects: optionalString(request.body.preferredSubjects),
        parentPhone: optionalString(request.body.parentPhone)
      }
    });

    response.json({ profile });
  })
);

lmsRoutes.get(
  "/student/dashboard",
  requireAuth,
  requireRoles("student"),
  asyncRoute(async (request, response) => {
    const studentId = request.user!.id;
    const assignmentScope = await assignmentScopeForStudent(studentId);
    const [stats, leaderboard, path, notifications, schedule, assignments, profile] = await Promise.all([
      studentStats(studentId),
      buildLeaderboard(),
      studentAvailablePath(studentId),
      prisma.notification.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        take: 4
      }),
      prisma.scheduleItem.findMany({
        where: { studentId, startsAt: { gte: new Date() } },
        orderBy: { startsAt: "asc" },
        include: { course: { include: { subject: true } }, lesson: true },
        take: 4
      }),
      prisma.assignment.findMany({
        where: assignmentScope,
        orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
        include: assignmentIncludeForStudent(studentId),
        take: 4
      }),
      getOrCreateStudentProfile(studentId)
    ]);

    response.json({
      stats,
      leaderboard,
      profile,
      path: hidePathCorrectAnswers(path),
      notifications,
      schedule,
      assignments: assignments.map(toStudentAssignment)
    });
  })
);

lmsRoutes.get(
  "/student/courses",
  requireAuth,
  requireRoles("student"),
  asyncRoute(async (request, response) => {
    const studentId = request.user!.id;
    const [path, enrollments, progress] = await Promise.all([
      prisma.learningPath.findMany({
        where: { studentId },
        include: { lesson: { include: { course: { include: { subject: true } } } } },
        orderBy: { orderIndex: "asc" }
      }),
      prisma.courseStudent.findMany({
        where: { studentId },
        include: { course: { include: { subject: true, lessons: { where: { isActive: true } } } } },
        orderBy: { createdAt: "desc" }
      }),
      prisma.studentLessonProgress.findMany({ where: { studentId } })
    ]);
    const completedIds = new Set(progress.filter((item) => item.completed).map((item) => item.lessonId));
    const courseMap = new Map<number, { course: unknown; totalLessons: number; completedLessons: number }>();
    const enrolledCourseIds = new Set(enrollments.map((enrollment) => enrollment.courseId));

    for (const enrollment of enrollments) {
      const course = enrollment.course;
      courseMap.set(course.id, {
        course,
        totalLessons: course.lessons.length,
        completedLessons: course.lessons.filter((lesson) => completedIds.has(lesson.id)).length
      });
    }

    for (const item of path) {
      const course = item.lesson.course;
      if (enrolledCourseIds.has(course.id)) {
        continue;
      }
      const current = courseMap.get(course.id) ?? {
        course,
        totalLessons: 0,
        completedLessons: 0
      };
      current.totalLessons += 1;
      current.completedLessons += completedIds.has(item.lessonId) ? 1 : 0;
      courseMap.set(course.id, current);
    }

    response.json({ courses: Array.from(courseMap.values()) });
  })
);

lmsRoutes.get(
  "/student/courses/:courseId/path",
  requireAuth,
  requireRoles("student"),
  asyncRoute(async (request, response) => {
    const studentId = request.user!.id;
    const courseId = parsePositiveInt(request.params.courseId, "courseId");
    const [path, progress] = await Promise.all([
      studentCoursePath(studentId, courseId),
      prisma.studentLessonProgress.findMany({ where: { studentId } })
    ]);

    response.json({ path: hidePathCorrectAnswers(path), progress });
  })
);

lmsRoutes.get(
  "/student/assignments",
  requireAuth,
  requireRoles("student"),
  asyncRoute(async (request, response) => {
    const studentId = request.user!.id;
    const { page, pageSize, skip } = parsePagination(request.query);
    const status = optionalString(request.query.status);
    const subject = optionalString(request.query.subject);
    const search = optionalString(request.query.search);
    const scope = await assignmentScopeForStudent(studentId);

    const where: Prisma.AssignmentWhereInput = { ...scope };

    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { title: { contains: search } },
            { description: { contains: search } },
            { course: { title: { contains: search } } }
          ]
        }
      ];
    }

    if (subject) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { subject: { name: { contains: subject } } },
            { course: { subject: { name: { contains: subject } } } }
          ]
        }
      ];
    }

    if (status) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        status === "not_started"
          ? { submissions: { none: { studentId } } }
          : { submissions: { some: { studentId, status } } }
      ];
    }

    const [total, assignments] = await Promise.all([
      prisma.assignment.count({ where }),
      prisma.assignment.findMany({
        where,
        orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
        include: assignmentIncludeForStudent(studentId)
      })
    ]);

    response.json(paginatedResponse(assignments.map(toStudentAssignment), total, page, pageSize));
  })
);

lmsRoutes.post(
  "/student/assignments/:assignmentId/start",
  requireAuth,
  requireRoles("student"),
  asyncRoute(async (request, response) => {
    const studentId = request.user!.id;
    const assignmentId = parsePositiveInt(request.params.assignmentId, "assignmentId");
    const scope = await assignmentScopeForStudent(studentId);
    const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, ...scope } });

    if (!assignment) {
      throw new HttpError(404, "Assignment not found.");
    }

    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      update: { status: "in_progress", startedAt: new Date() },
      create: { assignmentId, studentId, status: "in_progress", startedAt: new Date() }
    });

    response.json({ submission });
  })
);

lmsRoutes.post(
  "/student/assignments/:assignmentId/submit",
  requireAuth,
  requireRoles("student"),
  asyncRoute(async (request, response) => {
    const studentId = request.user!.id;
    const assignmentId = parsePositiveInt(request.params.assignmentId, "assignmentId");
    const answerText = requireString(request.body.answerText, "answerText");
    const scope = await assignmentScopeForStudent(studentId);
    const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, ...scope } });

    if (!assignment) {
      throw new HttpError(404, "Assignment not found.");
    }

    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      update: {
        status: "submitted",
        answerText,
        submittedAt: new Date()
      },
      create: {
        assignmentId,
        studentId,
        status: "submitted",
        answerText,
        startedAt: new Date(),
        submittedAt: new Date()
      }
    });

    response.json({ submission });
  })
);

lmsRoutes.get(
  "/student/progress",
  requireAuth,
  requireRoles("student"),
  asyncRoute(async (request, response) => {
    const studentId = request.user!.id;
    const [stats, path, progress] = await Promise.all([
      studentStats(studentId),
      studentAvailablePath(studentId),
      prisma.studentLessonProgress.findMany({
        where: { studentId },
        orderBy: { updatedAt: "desc" },
        include: { lesson: { include: { course: { include: { subject: true } } } } }
      })
    ]);

    const completedLessonIds = new Set(progress.filter((item) => item.completed).map((item) => item.lessonId));
    const bySubject = new Map<string, { subject: string; completedLessons: number; totalLessons: number }>();

    for (const item of path) {
      const subject = item.lesson.course.subject?.name ?? "Chung";
      const current = bySubject.get(subject) ?? { subject, completedLessons: 0, totalLessons: 0 };
      current.totalLessons += 1;
      current.completedLessons += completedLessonIds.has(item.lessonId) ? 1 : 0;
      bySubject.set(subject, current);
    }

    const subjects = Array.from(bySubject.values()).map((item) => ({
      ...item,
      percentage:
        item.totalLessons > 0 ? Math.round((item.completedLessons / item.totalLessons) * 100) : 0
    }));

    const nextLessons = path
      .filter((item) => !completedLessonIds.has(item.lessonId))
      .slice(0, 3)
      .map((item) => item.lesson);

    response.json({
      stats,
      subjects,
      recentActivities: progress.slice(0, 8),
      recommendations: nextLessons
    });
  })
);

lmsRoutes.get(
  "/student/notifications",
  requireAuth,
  requireRoles("student"),
  asyncRoute(async (request, response) => {
    const studentId = request.user!.id;
    const { page, pageSize, skip } = parsePagination(request.query);
    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where: { studentId } }),
      prisma.notification.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      })
    ]);

    response.json(paginatedResponse(notifications, total, page, pageSize));
  })
);

lmsRoutes.patch(
  "/student/notifications/:notificationId/read",
  requireAuth,
  requireRoles("student"),
  asyncRoute(async (request, response) => {
    const studentId = request.user!.id;
    const id = parsePositiveInt(request.params.notificationId, "notificationId");
    const existing = await prisma.notification.findFirst({ where: { id, studentId } });

    if (!existing) {
      throw new HttpError(404, "Notification not found.");
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() }
    });

    response.json({ notification });
  })
);

lmsRoutes.get(
  "/student/schedule",
  requireAuth,
  requireRoles("student"),
  asyncRoute(async (request, response) => {
    const studentId = request.user!.id;
    const { page, pageSize, skip } = parsePagination(request.query);
    const [total, schedule] = await Promise.all([
      prisma.scheduleItem.count({ where: { studentId } }),
      prisma.scheduleItem.findMany({
        where: { studentId },
        orderBy: { startsAt: "asc" },
        include: { course: { include: { subject: true } }, lesson: true },
        skip,
        take: pageSize
      })
    ]);

    response.json(paginatedResponse(schedule, total, page, pageSize));
  })
);

lmsRoutes.get(
  "/student/lessons/:lessonId",
  requireAuth,
  requireRoles("student"),
  asyncRoute(async (request, response) => {
    const studentId = request.user!.id;
    const lessonId = parsePositiveInt(request.params.lessonId, "lessonId");
    const lesson = await assertCanAccessStudentLesson(studentId, lessonId);
    const [progress, note] = await Promise.all([
      prisma.studentLessonProgress.findUnique({ where: { studentId_lessonId: { studentId, lessonId } } }),
      prisma.studentLessonNote.findUnique({ where: { studentId_lessonId: { studentId, lessonId } } })
    ]);

    response.json({ lesson: hideCorrectAnswers(lesson), progress, note });
  })
);

lmsRoutes.put(
  "/student/lessons/:lessonId/note",
  requireAuth,
  requireRoles("student"),
  asyncRoute(async (request, response) => {
    const studentId = request.user!.id;
    const lessonId = parsePositiveInt(request.params.lessonId, "lessonId");
    const content = typeof request.body.content === "string" ? request.body.content : "";
    await assertCanAccessStudentLesson(studentId, lessonId);

    const note = await prisma.studentLessonNote.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      update: { content },
      create: { studentId, lessonId, content }
    });

    response.json({ note });
  })
);

lmsRoutes.post(
  "/student/lessons/:lessonId/submit",
  requireAuth,
  requireRoles("student"),
  asyncRoute(async (request, response) => {
    const studentId = request.user!.id;
    const lessonId = parsePositiveInt(request.params.lessonId, "lessonId");
    await assertCanAccessStudentLesson(studentId, lessonId);

    const questions = await prisma.question.findMany({ where: { lessonId }, orderBy: { id: "asc" } });
    const answers = (request.body.answers ?? {}) as Record<string, string>;
    const result = gradeAnswers(questions, answers);
    const [progress, streak] = await prisma.$transaction(async (tx) => {
      const saved = await tx.studentLessonProgress.upsert({
        where: { studentId_lessonId: { studentId, lessonId } },
        update: {
          completed: true,
          score: result.score,
          totalQuestions: result.totalQuestions,
          completedAt: new Date()
        },
        create: {
          studentId,
          lessonId,
          completed: true,
          score: result.score,
          totalQuestions: result.totalQuestions,
          completedAt: new Date()
        }
      });

      return [saved, null] as const;
    });
    const updatedStreak = await updateStreak(studentId);

    response.json({ progress, streak: streak ?? updatedStreak, ...result });
  })
);

async function buildLeaderboard() {
  const students = await prisma.user.findMany({
    where: { role: "student" },
    select: { id: true, username: true, fullName: true }
  });

  const rows = await Promise.all(
    students.map(async (student) => ({
      student,
      stats: await studentStats(student.id)
    }))
  );

  return rows
    .map((row) => ({
      ...row.student,
      xp: row.stats.xp,
      completedLessons: row.stats.completedLessons,
      currentStreak: row.stats.currentStreak
    }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);
}

lmsRoutes.get(
  "/leaderboard",
  requireAuth,
  asyncRoute(async (_request, response) => {
    response.json({ leaderboard: await buildLeaderboard() });
  })
);
