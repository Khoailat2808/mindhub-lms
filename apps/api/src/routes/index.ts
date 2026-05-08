import { Router } from "express";

import { healthRoutes } from "./health.routes.js";
import { lmsRoutes } from "./lms.routes.js";

export const apiRoutes = Router();

apiRoutes.use("/health", healthRoutes);
apiRoutes.use(lmsRoutes);
