import express from "express";
import { validateBody } from "../middlewares/validateMiddleware.js";
import { createIssue, getTotalIssues, listIssues, updateIssue } from "../controllers/issuesController.js";
import { requireAuth, requireEmployeeOrAdmin } from "../middlewares/authMiddleware.js";
import { createIssueSchema } from "../utils/validator.js";

const router = express.Router();

// POST /api/issues → with Joi validation
router.post("/", requireAuth, validateBody(createIssueSchema), createIssue);

// GET /api/issues → list issues (admin or support staff)
router.get("/",  requireAuth, requireEmployeeOrAdmin, listIssues);

// Admin: update issue status or message
router.patch("/:id",  requireAuth, requireEmployeeOrAdmin, updateIssue);

router.get("/total", requireAuth, requireEmployeeOrAdmin, getTotalIssues);

export default router;