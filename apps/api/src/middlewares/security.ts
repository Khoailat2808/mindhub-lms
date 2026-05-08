import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../utils/http-error.js";

interface RateBucket {
  count: number;
  resetAt: number;
}

const loginBuckets = new Map<string, RateBucket>();

export function securityHeaders(_request: Request, response: Response, next: NextFunction) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
}

export function sensitiveRouteRateLimit(request: Request, _response: Response, next: NextFunction) {
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 20;
  const forwardedFor = request.header("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwardedFor || request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = loginBuckets.get(key);

  if (!current || current.resetAt <= now) {
    loginBuckets.set(key, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  if (current.count >= maxAttempts) {
    next(new HttpError(429, "Too many attempts. Please try again later."));
    return;
  }

  current.count += 1;
  next();
}
