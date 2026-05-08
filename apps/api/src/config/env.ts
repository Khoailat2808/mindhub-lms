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
  maxVideoUploadMb: Number(process.env.MAX_VIDEO_UPLOAD_MB ?? 100),
  maxMaterialUploadMb: Number(process.env.MAX_MATERIAL_UPLOAD_MB ?? 20),
  maxLessonMaterialsTotalMb: Number(process.env.MAX_LESSON_MATERIALS_TOTAL_MB ?? 50)
};
