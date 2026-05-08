import { QUESTION_TYPES, USER_ROLES, VIDEO_TYPES } from "../constants/index.js";
import type { QuestionType, UserRole, VideoType } from "../types/index.js";

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function isVideoType(value: string): value is VideoType {
  return VIDEO_TYPES.includes(value as VideoType);
}

export function isQuestionType(value: string): value is QuestionType {
  return QUESTION_TYPES.includes(value as QuestionType);
}
