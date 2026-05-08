import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { isUserRole, type UserRole } from "@lms/shared";

import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { HttpError } from "../utils/http-error.js";

export interface AuthenticatedUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

interface TokenPayload {
  sub?: string;
}

export function signAuthToken(user: AuthenticatedUser): string {
  if (!env.jwtSecret) {
    throw new HttpError(500, "JWT_SECRET is not configured.");
  }

  return jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: String(user.id),
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"]
  });
}

export async function requireAuth(
  request: AuthenticatedRequest,
  _response: Response,
  next: NextFunction
) {
  try {
    const header = request.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

    if (!token) {
      throw new HttpError(401, "Missing bearer token.");
    }

    if (!env.jwtSecret) {
      throw new HttpError(500, "JWT_SECRET is not configured.");
    }

    const payload = jwt.verify(token, env.jwtSecret) as TokenPayload;
    const userId = Number(payload.sub);

    if (!Number.isInteger(userId)) {
      throw new HttpError(401, "Invalid token.");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !isUserRole(user.role)) {
      throw new HttpError(401, "User not found.");
    }

    request.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    };

    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "Invalid token."));
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    if (!request.user) {
      next(new HttpError(401, "Authentication required."));
      return;
    }

    if (!roles.includes(request.user.role)) {
      next(new HttpError(403, "You do not have permission to access this resource."));
      return;
    }

    next();
  };
}
