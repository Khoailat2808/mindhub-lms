import crypto from "node:crypto";
import fs from "node:fs/promises";

import { env } from "../config/env.js";
import { toPublicUploadPath } from "./uploads.js";

export interface StoredQuestionImage {
  imageUrl: string;
  imagePublicId: string | null;
  imageOriginalName: string;
  imageMimeType: string;
}

function cloudinaryEnabled() {
  return Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
}

function signCloudinaryParams(params: Record<string, string>) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${payload}${env.cloudinaryApiSecret}`)
    .digest("hex");
}

export async function storeQuestionImage(file: Express.Multer.File): Promise<StoredQuestionImage> {
  if (!cloudinaryEnabled()) {
    return {
      imageUrl: toPublicUploadPath(file.path),
      imagePublicId: null,
      imageOriginalName: file.originalname,
      imageMimeType: file.mimetype
    };
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const params = {
    folder: env.cloudinaryFolder,
    timestamp
  };
  const form = new FormData();
  const buffer = await fs.readFile(file.path);

  form.append("file", new Blob([buffer], { type: file.mimetype }), file.originalname);
  form.append("api_key", env.cloudinaryApiKey);
  form.append("timestamp", timestamp);
  form.append("folder", env.cloudinaryFolder);
  form.append("signature", signCloudinaryParams(params));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/image/upload`, {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    throw new Error(`Cloudinary upload failed with status ${response.status}`);
  }

  const body = (await response.json()) as { secure_url?: string; public_id?: string };
  if (!body.secure_url) {
    throw new Error("Cloudinary upload did not return a secure URL.");
  }

  return {
    imageUrl: body.secure_url,
    imagePublicId: body.public_id ?? null,
    imageOriginalName: file.originalname,
    imageMimeType: file.mimetype
  };
}
