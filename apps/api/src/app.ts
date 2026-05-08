import cors from "cors";
import express from "express";

import { errorHandler } from "./middlewares/error-handler.js";
import { notFound } from "./middlewares/not-found.js";
import { securityHeaders } from "./middlewares/security.js";
import { apiRoutes } from "./routes/index.js";
import { ensureUploadDirs, uploadDirs } from "./utils/uploads.js";
import { env } from "./config/env.js";

export const app = express();

ensureUploadDirs();

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, "");
}

const allowedOrigins = env.corsOrigin
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);
const allowsAnyOrigin = allowedOrigins.includes("*");

app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        env.nodeEnv !== "production" ||
        allowsAnyOrigin ||
        allowedOrigins.includes(normalizeOrigin(origin))
      ) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin is not allowed."));
    }
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(
  "/uploads/videos",
  express.static(uploadDirs.videos, {
    setHeaders(response) {
      response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    }
  })
);
app.use("/uploads/materials", express.static(uploadDirs.materials));

app.use("/api", apiRoutes);

app.use(notFound);
app.use(errorHandler);
