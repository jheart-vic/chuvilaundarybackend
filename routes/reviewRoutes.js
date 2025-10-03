import { Router } from 'express';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { reviewSchema } from '../utils/validator.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { createReview } from '../controllers/reviewsController.js';

const router = Router();

// ✅ Require auth to create a review
router.post('/', requireAuth, validateBody(reviewSchema), createReview);

export default router;
