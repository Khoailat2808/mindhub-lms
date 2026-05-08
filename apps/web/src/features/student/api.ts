import { apiRequest } from "@/lib/api-client";
import type { AuthUser } from "@/lib/api-client";

import type {
  Assignment,
  CourseCardData,
  DashboardStats,
  Lesson,
  LessonProgress,
  NotificationItem,
  PaginatedResponse,
  PathItem,
  ScheduleItem,
  StudentProfile
} from "./types";

export interface DashboardResponse {
  stats: DashboardStats;
  profile: StudentProfile;
  path: PathItem[];
  assignments: Assignment[];
  notifications: NotificationItem[];
  schedule: ScheduleItem[];
}

export interface LessonResponse {
  lesson: Lesson;
  progress: LessonProgress | null;
  note: { id: number; content: string } | null;
}

export interface SubmitLessonResponse {
  score: number;
  totalQuestions: number;
  progress: LessonProgress;
  results: { questionId: number; correct: boolean; correctAnswer: string }[];
}

export interface StudentProgressResponse {
  stats: DashboardStats;
  subjects: {
    subject: string;
    completedLessons: number;
    totalLessons: number;
    percentage: number;
  }[];
  recentActivities: (LessonProgress & { lesson: Lesson })[];
  recommendations: Lesson[];
}

export function getDashboard() {
  return apiRequest<DashboardResponse>("/student/dashboard");
}

export function getCourses() {
  return apiRequest<{ courses: CourseCardData[] }>("/student/courses");
}

export function getCoursePath(courseId: number) {
  return apiRequest<{ path: PathItem[]; progress: LessonProgress[] }>(
    `/student/courses/${courseId}/path`
  );
}

export function getLesson(lessonId: number) {
  return apiRequest<LessonResponse>(`/student/lessons/${lessonId}`);
}

export function submitLesson(lessonId: number, answers: Record<number, string>) {
  return apiRequest<SubmitLessonResponse>(`/student/lessons/${lessonId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers })
  });
}

export function saveLessonNote(lessonId: number, content: string) {
  return apiRequest<{ note: { id: number; content: string } }>(`/student/lessons/${lessonId}/note`, {
    method: "PUT",
    body: JSON.stringify({ content })
  });
}

export function getAssignments(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  subject?: string;
  search?: string;
}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });

  return apiRequest<PaginatedResponse<Assignment>>(`/student/assignments?${query.toString()}`);
}

export function startAssignment(assignmentId: number) {
  return apiRequest(`/student/assignments/${assignmentId}/start`, { method: "POST" });
}

export function submitAssignment(assignmentId: number, answerText: string) {
  return apiRequest(`/student/assignments/${assignmentId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answerText })
  });
}

export function getProgress() {
  return apiRequest<StudentProgressResponse>("/student/progress");
}

export function getProfile() {
  return apiRequest<{ user: AuthUser; profile: StudentProfile }>("/student/profile");
}

export function updateProfile(profile: Partial<StudentProfile>) {
  return apiRequest<{ profile: StudentProfile }>("/student/profile", {
    method: "PATCH",
    body: JSON.stringify(profile)
  });
}
