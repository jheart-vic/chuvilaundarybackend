import express from "express";
import { validateBody } from "../middlewares/validateMiddleware.js";
import { createIssue, listIssues, updateIssue } from "../controllers/issuesController.js";
import { requireAuth, requireEmployeeOrAdmin } from "../middlewares/authMiddleware.js";
import { createIssueSchema } from "../utils/validator.js";

const router = express.Router();

// POST /api/issues → with Joi validation
router.post("/", requireAuth, validateBody(createIssueSchema), createIssue);

// GET /api/issues → list issues (admin or support staff)
router.get("/",  requireAuth, requireEmployeeOrAdmin, listIssues);

// Admin: update issue status or message
router.patch("/:id",  requireAuth, requireEmployeeOrAdmin, updateIssue);

export default router;