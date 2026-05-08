import type {
  QUESTION_TYPES,
  USER_ROLES,
  VIDEO_TYPES
} from "../constants/index.js";

export type UserRole = (typeof USER_ROLES)[number];

export type VideoType = (typeof VIDEO_TYPES)[number];

export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface AuthUserDto {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface LoginRequestDto {
  username: string;
  password: string;
}

export interface LoginResponseDto {
  token: string;
  user: AuthUserDto;
}

export interface RegisterStudentRequestDto {
  username: string;
  email: string;
  password: string;
  fullName: string;
}

export interface LessonVideoDto {
  videoType: VideoType;
  videoUrl?: string | null;
  videoFilePath?: string | null;
}

export interface QuestionDto {
  id: number;
  lessonId: number;
  questionType: QuestionType;
  content: string;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
}
