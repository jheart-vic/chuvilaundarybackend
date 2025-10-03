import express from "express";
import { validateBody } from "../middlewares/validateMiddleware.js";
import { createIssue } from "../controllers/issuesController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { createIssueSchema } from "../utils/validator.js";

const router = express.Router();

// POST /api/issues → with Joi validation
router.post("/", requireAuth, validateBody(createIssueSchema), createIssue);


export default router;