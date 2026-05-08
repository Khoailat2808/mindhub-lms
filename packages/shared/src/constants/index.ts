export const USER_ROLES = ["student", "teacher", "coach", "admin"] as const;

export const VIDEO_TYPES = ["upload", "youtube", "google_drive"] as const;

export const QUESTION_TYPES = ["multiple_choice", "short_answer"] as const;

export const MATERIAL_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png"
] as const;

export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg"
] as const;
