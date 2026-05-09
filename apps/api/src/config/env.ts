import "dotenv/config";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 10),
  uploadVideoDir: process.env.UPLOAD_VIDEO_DIR ?? "uploads/videos",
  uploadMaterialDir: process.env.UPLOAD_MATERIAL_DIR ?? "uploads/materials",
  uploadQuestionImageDir: process.env.UPLOAD_QUESTION_IMAGE_DIR ?? "uploads/question-images",
  maxVideoUploadMb: Number(process.env.MAX_VIDEO_UPLOAD_MB ?? 100),
  maxMaterialUploadMb: Number(process.env.MAX_MATERIAL_UPLOAD_MB ?? 20),
  maxLessonMaterialsTotalMb: Number(process.env.MAX_LESSON_MATERIALS_TOTAL_MB ?? 50),
  maxQuestionImageUploadMb: Number(process.env.MAX_QUESTION_IMAGE_UPLOAD_MB ?? 5),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER ?? "mindhub/question-images",
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@mindhub.test",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  adminFullName: process.env.ADMIN_FULL_NAME ?? "MindHub Admin"
};
