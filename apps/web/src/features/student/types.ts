export interface Subject {
  id: number;
  name: string;
}

export interface Course {
  id: number;
  title: string;
  description?: string | null;
  teacherName?: string | null;
  subject: Subject;
}

export interface CourseCardData {
  course: Course;
  totalLessons: number;
  completedLessons: number;
}

export interface Material {
  id: number;
  originalName: string;
  filePath: string;
}

export interface Question {
  id: number;
  questionType: "multiple_choice" | "short_answer";
  content: string;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
}

export interface Lesson {
  id: number;
  courseId: number;
  title: string;
  description?: string | null;
  videoType?: "upload" | "youtube" | "google_drive" | null;
  videoUrl?: string | null;
  videoFilePath?: string | null;
  course: Course;
  questions: Question[];
  materials: Material[];
}

export interface PathItem {
  id: number;
  lessonId: number;
  orderIndex: number;
  lesson: Lesson;
}

export interface LessonProgress {
  lessonId: number;
  completed: boolean;
  score?: number | null;
  totalQuestions?: number | null;
  completedAt?: string | null;
}

export interface DashboardStats {
  assignedLessons: number;
  completedLessons: number;
  averageScore: number;
  currentStreak: number;
  longestStreak: number;
  xp: number;
}

export interface StudentProfile {
  id: number;
  studentId: number;
  avatarUrl?: string | null;
  grade?: string | null;
  schoolName?: string | null;
  learningGoals?: string | null;
  targetScore?: string | null;
  preferredSubjects?: string | null;
  parentPhone?: string | null;
}

export interface AssignmentSubmission {
  status: "not_started" | "in_progress" | "submitted" | "graded";
  score?: number | null;
  feedback?: string | null;
  submittedAt?: string | null;
  gradedAt?: string | null;
  answerText?: string | null;
}

export interface Assignment {
  id: number;
  title: string;
  description?: string | null;
  type: "assignment" | "test" | string;
  deadline?: string | null;
  maxScore?: number | null;
  subject?: Subject | null;
  course?: Course | null;
  lesson?: Lesson | null;
  submission?: AssignmentSubmission | null;
  studentStatus: AssignmentSubmission["status"];
  overdue: boolean;
}

export interface NotificationItem {
  id: number;
  title: string;
  content: string;
  type: string;
  readAt?: string | null;
  createdAt: string;
}

export interface ScheduleItem {
  id: number;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  status: string;
  course?: Course | null;
  lesson?: Lesson | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
