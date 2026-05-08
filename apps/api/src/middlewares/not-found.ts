import type { RequestHandler } from "express";

import { HttpError } from "../utils/http-error.js";

export const notFound: RequestHandler = (request, _response, next) => {
  next(new HttpError(404, `Route not found: ${request.method} ${request.path}`));
};
