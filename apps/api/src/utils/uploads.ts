import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { MATERIAL_MIME_TYPES, QUESTION_IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } from "@lms/shared";

import { env } from "../config/env.js";
import { HttpError } from "./http-error.js";

export const uploadDirs = {
  videos: path.resolve(process.cwd(), env.uploadVideoDir),
  materials: path.resolve(process.cwd(), env.uploadMaterialDir),
  questionImages: path.resolve(process.cwd(), env.uploadQuestionImageDir)
};

export function ensureUploadDirs() {
  fs.mkdirSync(uploadDirs.videos, { recursive: true });
  fs.mkdirSync(uploadDirs.materials, { recursive: true });
  fs.mkdirSync(uploadDirs.questionImages, { recursive: true });
}

function safeFileName(originalName: string) {
  const extension = path.extname(originalName);
  const base = path
    .basename(originalName, extension)
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base || "file"}${extension}`;
}

const storage = multer.diskStorage({
  destination(_request, file, callback) {
    if (file.fieldname === "videoFile") {
      callback(null, uploadDirs.videos);
      return;
    }

    if (file.fieldname === "questionImages") {
      callback(null, uploadDirs.questionImages);
      return;
    }

    callback(null, uploadDirs.materials);
  },
  filename(_request, file, callback) {
    callback(null, safeFileName(file.originalname));
  }
});

export const uploadLessonFiles = multer({
  storage,
  limits: {
    fileSize: env.maxVideoUploadMb * 1024 * 1024,
    files: 11
  },
  fileFilter(request, file, callback) {
    const isVideo = file.fieldname === "videoFile";
    const isMaterial = file.fieldname === "materials";
    const isQuestionImage = file.fieldname === "questionImages";
    const allowed = isVideo
      ? VIDEO_MIME_TYPES.includes(file.mimetype as (typeof VIDEO_MIME_TYPES)[number])
      : isQuestionImage
        ? QUESTION_IMAGE_MIME_TYPES.includes(file.mimetype as (typeof QUESTION_IMAGE_MIME_TYPES)[number])
      : MATERIAL_MIME_TYPES.includes(file.mimetype as (typeof MATERIAL_MIME_TYPES)[number]);

    if (!isVideo && !isMaterial && !isQuestionImage) {
      callback(new HttpError(400, "Unexpected upload field."));
      return;
    }

    if (isQuestionImage && file.size > env.maxQuestionImageUploadMb * 1024 * 1024) {
      callback(new HttpError(400, `Question image ${file.originalname} exceeds ${env.maxQuestionImageUploadMb}MB.`));
      return;
    }

    if (!allowed) {
      callback(new HttpError(400, `Unsupported file type: ${file.originalname}`));
      return;
    }

    request.body.targetField = file.fieldname;
    callback(null, true);
  }
});

export const uploadAssignmentFiles = multer({
  storage,
  limits: {
    fileSize: env.maxQuestionImageUploadMb * 1024 * 1024,
    files: 30
  },
  fileFilter(_request, file, callback) {
    if (file.fieldname !== "questionImages") {
      callback(new HttpError(400, "Unexpected upload field."));
      return;
    }

    if (!QUESTION_IMAGE_MIME_TYPES.includes(file.mimetype as (typeof QUESTION_IMAGE_MIME_TYPES)[number])) {
      callback(new HttpError(400, `Unsupported question image type: ${file.originalname}`));
      return;
    }

    callback(null, true);
  }
});

export function toPublicUploadPath(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  const marker = normalized.includes("/uploads/")
    ? normalized.slice(normalized.indexOf("/uploads/") + 1)
    : normalized;

  return `/${marker}`;
}
